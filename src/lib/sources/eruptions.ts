import { parse } from 'node-html-parser'
import { fetchText } from './http'
import { fail, ok, type Result } from './types'
import { MONTHS_ID, wibToDate } from './wib'

export const ERUPTIONS_URL = 'https://magma.esdm.go.id/v1/gunung-api/informasi-letusan/KRA'

export type EruptionEvent = {
  occurredAt: Date
  narrative: string
  ongoing: boolean
  seismicAmplitudeMm: number | null
  durationSeconds: number | null
}

const DATE_RE = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4}),\s*pukul\s*(\d{1,2}):(\d{2})\s*WIB/i
const AMPLITUDE_RE = /amplitudo\s+maksimum\s+([\d.]+)\s*mm/i
const DURATION_RE = /durasi\s+([\d.]+)\s*detik/i
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
      seismicAmplitudeMm: amplitude?.[1] ? Number(amplitude[1]) : null,
      durationSeconds: duration?.[1] ? Number(duration[1]) : null,
    })
  }

  return events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
}

export async function getEruptions(): Promise<Result<EruptionEvent[]>> {
  const html = await fetchText(ERUPTIONS_URL)
  if (!html.ok) return html
  const events = parseEruptions(html.data)
  if (events.length === 0) return fail('parse', ERUPTIONS_URL)
  return ok(events, ERUPTIONS_URL)
}
