import { parse } from 'node-html-parser'
import { fetchText } from './http'
import { fail, ok, type Result } from './types'
import { MONTHS_ID, wibToDate } from './wib'

export const ACTIVITY_URL = 'https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas'

export type LevelLabel = 'Normal' | 'Waspada' | 'Siaga' | 'Awas'

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
  observedAt: Date
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
  const period = text.match(
    /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4}),\s*periode\s*(\d{2}):(\d{2})-(\d{2}):(\d{2})\s*WIB/,
  )

  const monthIndex = period?.[2] ? MONTHS_ID.indexOf(period[2].toLowerCase()) : -1
  const observedAt =
    period && monthIndex >= 0
      ? wibToDate(
          Number(period[3]),
          monthIndex,
          Number(period[1]),
          Number(period[6]),
          Number(period[7]),
        )
      : new Date()

  return {
    level: numeric,
    levelLabel: label,
    hazardRadiusKm: radius?.[1] ? Number(radius[1].replace(',', '.')) : null,
    latitude: lat?.[1] ? Number(lat[1]) : ANAK_KRAKATAU_SUMMIT.latitude,
    longitude: lon?.[1] ? Number(lon[1]) : ANAK_KRAKATAU_SUMMIT.longitude,
    elevationM: elevation?.[1] ? Number(elevation[1]) : ANAK_KRAKATAU_SUMMIT.elevationM,
    observedAt,
  }
}

export async function getStatus(): Promise<Result<VolcanoStatus>> {
  const activity = await fetchText(ACTIVITY_URL)
  if (!activity.ok) return activity

  const reportUrl = findReportUrl(activity.data)
  if (!reportUrl) return fail('parse', ACTIVITY_URL)

  const report = await fetchText(reportUrl)
  if (!report.ok) return report

  const status = parseReport(report.data)
  if (!status) return fail('parse', reportUrl)

  return ok({ ...status, reportUrl }, reportUrl)
}
