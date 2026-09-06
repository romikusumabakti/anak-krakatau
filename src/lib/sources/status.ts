import { parse } from 'node-html-parser'
import { cache } from 'react'
import { ACTIVITY_URL } from '@/lib/urls'
import { fetchText } from './http'
import { fail, ok, type Result } from './types'
import { MONTHS_ID, wibToDate } from './wib'

export type LevelLabel = 'Normal' | 'Waspada' | 'Siaga' | 'Awas'

/**
 * The window a MAGMA report covers. PVMBG never states an observation
 * *instant*: every report is headed "periode 00:00-06:00 WIB", a six-hour
 * shift. Collapsing that to a single Date would present a range as a
 * moment, so the range is carried whole and rendered as a range.
 */
export type ObservationPeriod = { start: Date; end: Date }

export type VolcanoStatus = {
  level: 1 | 2 | 3 | 4
  levelLabel: LevelLabel
  /**
   * A live safety instruction that changes with the volcano's state. Never
   * defaulted: if the report doesn't state a radius, this is null rather
   * than a guessed evacuation boundary. Downstream, a null radius means
   * "omit the line, draw no exclusion circle."
   */
  hazardRadiusKm: number | null
  latitude: number
  longitude: number
  elevationM: number
  /**
   * Null when the report's "periode HH:MM-HH:MM WIB" heading can't be read.
   * Never `new Date()`: an unknown observation window silently becoming
   * "right now" would present an alert level of unknown age as live, which
   * is the same class of mistake `hazardRadiusKm` already refuses.
   */
  observationPeriod: ObservationPeriod | null
  reportUrl: string
}

const ROMAN: Record<string, 1 | 2 | 3 | 4> = { I: 1, II: 2, III: 3, IV: 4 }
const LABELS: LevelLabel[] = ['Normal', 'Waspada', 'Siaga', 'Awas']

/**
 * Anak Krakatau's summit position and elevation are fixed physical facts
 * about an island that does not move, unlike hazardRadiusKm (a live safety
 * instruction). Using them as a fallback when a report's text omits the
 * field is a defensible identity, not an invented instruction.
 */
const ANAK_KRAKATAU_SUMMIT = {
  latitude: -6.1009,
  longitude: 105.4233,
  elevationM: 157,
} as const

const DAY_MS = 86_400_000

export function findReportUrl(activityHtml: string): string | null {
  if (!activityHtml.trim()) return null
  const root = parse(activityHtml)
  for (const cell of root.querySelectorAll('td')) {
    if (!/anak\s+krakatau/i.test(cell.text)) continue
    const href = cell.querySelector('a')?.getAttribute('href')
    if (href?.includes('/gunung-api/laporan/')) return href
  }
  return null
}

function parseObservationPeriod(text: string): ObservationPeriod | null {
  const period = text.match(
    /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4}),\s*periode\s*(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\s*WIB/,
  )
  if (!period?.[2]) return null
  const monthIndex = MONTHS_ID.indexOf(period[2].toLowerCase())
  if (monthIndex < 0) return null

  const year = Number(period[3])
  const day = Number(period[1])
  const start = wibToDate(year, monthIndex, day, Number(period[4]), Number(period[5]))
  let end = wibToDate(year, monthIndex, day, Number(period[6]), Number(period[7]))
  // MAGMA writes the last shift of the day as "18:00-24:00", which
  // wibToDate already rolls into the next day. A report written
  // "18:00-00:00" would not, and would land the end of the window before
  // its start; treat that as the following midnight rather than emitting
  // a backwards range.
  if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + DAY_MS)
  return { start, end }
}

export function parseReport(reportHtml: string): Omit<VolcanoStatus, 'reportUrl'> | null {
  if (!reportHtml.trim()) return null
  const root = parse(reportHtml)
  // Strip <script>/<style> before flattening to text. node-html-parser's
  // .text includes script bodies, and MAGMA's report pages embed a Leaflet
  // icon-switch script listing all four level strings — without this guard
  // the parser can pick up whichever level string comes first in document
  // order, not the one the visible badge actually states.
  for (const node of root.querySelectorAll('script, style')) node.remove()
  const text = root.text.replace(/\s+/g, ' ')

  const level = text.match(/Level\s+(IV|III|II|I)\s*\((Normal|Waspada|Siaga|Awas)\)/)
  if (!level?.[1] || !level[2]) return null
  const numeric = ROMAN[level[1]]
  const label = level[2] as LevelLabel
  if (!numeric || !LABELS.includes(label)) return null

  const radius = text.match(/radius\s+([\d.,]+)\s*km/i)
  const lat = text.match(/Latitude\s*(-?[\d.]+)\s*°/)
  const lon = text.match(/Longitude\s*(-?[\d.]+)\s*°/)
  const elevation = text.match(/ketinggian\s+([\d.]+)\s*mdpl/i)

  return {
    level: numeric,
    levelLabel: label,
    hazardRadiusKm: radius?.[1] ? Number(radius[1].replace(',', '.')) : null,
    latitude: lat?.[1] ? Number(lat[1]) : ANAK_KRAKATAU_SUMMIT.latitude,
    longitude: lon?.[1] ? Number(lon[1]) : ANAK_KRAKATAU_SUMMIT.longitude,
    elevationM: elevation?.[1] ? Number(elevation[1]) : ANAK_KRAKATAU_SUMMIT.elevationM,
    observationPeriod: parseObservationPeriod(text),
  }
}

/**
 * Wrapped in React's `cache()` so the header badge and the status card --
 * two independent call sites reading the same request -- share one
 * in-flight call instead of issuing two live requests to MAGMA. This is
 * required rather than incidental: `fetchText` passes a fresh
 * `AbortSignal.timeout(...)` on every call, and a distinct signal instance
 * defeats Next.js's own fetch-level request memoization (which compares
 * the full options object), so without this wrapper each render doubles
 * the upstream hit.
 *
 * Every failure carries ACTIVITY_URL, never the signed report URL. The UI
 * renders `sourceUrl` as "open the original report"; handing a reader the
 * signed URL that just failed -- or one whose signature has expired, which
 * returns 403 -- would reproduce the failure for them.
 *
 * On success, `fetchedAt` is the report fetch's upstream `Date` header:
 * that is the response the displayed level and radius were read out of.
 */
export const getStatus = cache(async (): Promise<Result<VolcanoStatus>> => {
  const activity = await fetchText(ACTIVITY_URL)
  if (!activity.ok) return activity

  const reportUrl = findReportUrl(activity.data)
  if (!reportUrl) return fail('parse', ACTIVITY_URL)

  const report = await fetchText(reportUrl)
  if (!report.ok) return fail(report.reason, ACTIVITY_URL)

  const status = parseReport(report.data)
  if (!status) return fail('parse', ACTIVITY_URL)

  return ok({ ...status, reportUrl }, reportUrl, report.fetchedAt)
})
