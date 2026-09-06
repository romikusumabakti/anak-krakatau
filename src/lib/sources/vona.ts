import { parse } from 'node-html-parser'
import { cache } from 'react'
import { VONA_URL } from '@/lib/urls'
import { fetchText } from './http'
import { fail, ok, type Result } from './types'

export type AviationColour = 'green' | 'yellow' | 'orange' | 'red' | 'unknown'

export type VonaNotice = {
  issuedAt: Date
  noticeCode: string
  colour: AviationColour
  summary: string
  ashTopFtAsl: number | null
  ashTopMAsl: number | null
  ashAboveSummitFt: number | null
  ashAboveSummitM: number | null
  movementLabel: string | null
  detailUrl: string | null
}

const COLOURS: AviationColour[] = ['green', 'yellow', 'orange', 'red']

const HEIGHT_RE =
  /around\s+(\d+)\s*FT\s*\((\d+)\s*M\)\s*above sea level(?:\s*or\s*(\d+)\s*FT\s*\((\d+)\s*M\)\s*above summit)?/i
const MOVEMENT_RE = /Ash cloud moving (?:from |to )?([^.]+)\./i
const CODE_RE = /(\d{8}\/\d{4}Z)/
/**
 * The ICAO phrase PVMBG uses to state, positively, that no ash cloud was
 * seen. This is the ONLY evidence for a hazard-negative. A null height or
 * a null bearing means "our regex did not match", which is a statement
 * about this codebase, not about the sky -- see `ashCloudNotObserved`.
 */
const NOT_OBSERVED_RE = /ash[- ]cloud is not observed/i

const toColour = (raw: string): AviationColour => {
  const lower = raw.trim().toLowerCase()
  return COLOURS.includes(lower as AviationColour) ? (lower as AviationColour) : 'unknown'
}

/** "2026-09-05 02:00:00 UTC" -> Date */
const parseUtc = (raw: string): Date | null => {
  const match = raw.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (!match) return null
  const [, y, mo, d, h, mi, s] = match
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * True only when the notice text itself says the ash cloud was not
 * observed. Never infer this from an unparsed height or bearing: HEIGHT_RE,
 * MOVEMENT_RE and `bearingFromPhrase` all return null on any wording they
 * don't recognise, and "we couldn't read it" is not "there was nothing
 * there". Reporting the second when only the first is true is a false
 * hazard-negative on a live eruption.
 */
export function ashCloudNotObserved(notice: VonaNotice): boolean {
  return NOT_OBSERVED_RE.test(notice.summary)
}

export function parseVona(html: string): VonaNotice[] {
  if (!html.trim()) return []
  const root = parse(html)
  const notices: VonaNotice[] = []

  for (const item of root.querySelectorAll('.timeline-item')) {
    const issuedAt = parseUtc(item.querySelector('.timeline-time small')?.text ?? '')
    const summary = item.querySelector('.timeline-text')?.text.replace(/\s+/g, ' ').trim() ?? ''
    if (!issuedAt || !summary) continue

    const title = item.querySelector('.timeline-title')?.text ?? ''
    const height = summary.match(HEIGHT_RE)
    const movement = summary.match(MOVEMENT_RE)

    notices.push({
      issuedAt,
      noticeCode: title.match(CODE_RE)?.[1] ?? '',
      colour: toColour(item.querySelector('.timeline-time a')?.text ?? ''),
      summary,
      ashTopFtAsl: height?.[1] ? Number(height[1]) : null,
      ashTopMAsl: height?.[2] ? Number(height[2]) : null,
      ashAboveSummitFt: height?.[3] ? Number(height[3]) : null,
      ashAboveSummitM: height?.[4] ? Number(height[4]) : null,
      movementLabel: movement?.[1]?.trim() ?? null,
      detailUrl: item.querySelector('a.card-link')?.getAttribute('href') ?? null,
    })
  }

  return notices.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime())
}

// Wrapped in React's `cache()` for the same reason as `getStatus`: a fresh
// AbortSignal on every `fetchText` call defeats Next.js's fetch memoization,
// so any future call site sharing this render (e.g. a timeline card) would
// otherwise double the upstream hit to MAGMA's VONA feed.
export const getVonaNotices = cache(async (): Promise<Result<VonaNotice[]>> => {
  const html = await fetchText(VONA_URL)
  if (!html.ok) return html
  const notices = parseVona(html.data)
  if (notices.length === 0) return fail('parse', VONA_URL)
  // Third argument: the upstream `Date` header carried by `fetchText`.
  // Dropping it makes `ok()` stamp `new Date()` -- render time -- so every
  // card would read "updated now" no matter how old the response was.
  return ok(notices, VONA_URL, html.fetchedAt)
})
