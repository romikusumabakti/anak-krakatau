import { parse } from 'node-html-parser'
import { cache } from 'react'
import { ERUPTIONS_URL } from '@/lib/urls'
import { fetchText } from './http'
import { fail, ok, type Result } from './types'
import { MONTHS_ID, wibToDate } from './wib'

export type EruptionEvent = {
  occurredAt: Date
  narrative: string
  ongoing: boolean
  seismicAmplitudeMm: number | null
  durationSeconds: number | null
}

const DATE_RE = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4}),\s*pukul\s*(\d{1,2}):(\d{2})\s*WIB/i
// Indonesian text conventionally uses a comma as the decimal separator (e.g.
// "12,5 mm"). Accept both so a comma-decimal reading normalises to a real
// number instead of failing to match and silently becoming null, the same
// way status.ts normalises the hazard radius.
const AMPLITUDE_RE = /amplitudo\s+maksimum\s+([\d.,]+)\s*mm/i
const DURATION_RE = /durasi\s+([\d.,]+)\s*detik/i
const ONGOING_RE = /erupsi\s+masih\s+berlangsung/i

export function parseEruptions(html: string): EruptionEvent[] {
  if (!html.trim()) return []
  const events: EruptionEvent[] = []

  for (const item of parse(html).querySelectorAll('.timeline-item')) {
    const narrative = item.querySelector('.timeline-text')?.text.replace(/\s+/g, ' ').trim()
    if (!narrative) continue

    const date = narrative.match(DATE_RE)
    if (!date?.[2]) continue
    const monthIndex = MONTHS_ID.indexOf(date[2].toLowerCase())
    if (monthIndex < 0) continue

    const amplitude = narrative.match(AMPLITUDE_RE)
    const duration = narrative.match(DURATION_RE)

    events.push({
      occurredAt: wibToDate(
        Number(date[3]),
        monthIndex,
        Number(date[1]),
        Number(date[4]),
        Number(date[5]),
      ),
      narrative,
      ongoing: ONGOING_RE.test(narrative),
      seismicAmplitudeMm: amplitude?.[1] ? Number(amplitude[1].replace(',', '.')) : null,
      durationSeconds: duration?.[1] ? Number(duration[1].replace(',', '.')) : null,
    })
  }

  return events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
}

/**
 * Wrapped in React's `cache()` for the same reason as `getStatus` and
 * `getVonaNotices`: `fetchText` passes a fresh `AbortSignal.timeout(...)`
 * on every call, and a distinct signal instance defeats Next.js's own
 * fetch-level request memoization, so a second call site sharing a render
 * would double the upstream hit to a government server. One call site
 * today; the invariant is what's being protected, not the current count.
 *
 * `html.fetchedAt` is threaded into `ok()` so the card reports the age of
 * the upstream response rather than the moment it happened to render.
 */
export const getEruptions = cache(async (): Promise<Result<EruptionEvent[]>> => {
  const html = await fetchText(ERUPTIONS_URL)
  if (!html.ok) return html
  const events = parseEruptions(html.data)
  if (events.length === 0) return fail('parse', ERUPTIONS_URL)
  return ok(events, ERUPTIONS_URL, html.fetchedAt)
})
