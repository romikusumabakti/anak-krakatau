import { parse } from 'node-html-parser'
import { fetchText } from './http'
import { fail, ok, type Result } from './types'
import { MONTHS_ID, wibToDate } from './wib'

export const ACTIVITY_URL = 'https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas'

export type LevelLabel = 'Normal' | 'Waspada' | 'Siaga' | 'Awas'

export type VolcanoStatus = {
  level: 1 | 2 | 3 | 4
  levelLabel: LevelLabel
  hazardRadiusKm: number
  latitude: number
  longitude: number
  elevationM: number
  observedAt: Date
  reportUrl: string
}

const ROMAN: Record<string, 1 | 2 | 3 | 4> = { I: 1, II: 2, III: 3, IV: 4 }
const LABELS: LevelLabel[] = ['Normal', 'Waspada', 'Siaga', 'Awas']

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
  const text = parse(reportHtml).text.replace(/\s+/g, ' ')

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
    hazardRadiusKm: radius?.[1] ? Number(radius[1].replace(',', '.')) : 3,
    latitude: lat?.[1] ? Number(lat[1]) : -6.1009,
    longitude: lon?.[1] ? Number(lon[1]) : 105.4233,
    elevationM: elevation?.[1] ? Number(elevation[1]) : 157,
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
