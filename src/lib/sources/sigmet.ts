import { z } from 'zod'
import { fetchJson } from './http'
import { ok, type Result } from './types'

export const SIGMET_URL = 'https://aviationweather.gov/api/data/isigmet?format=json'

/**
 * International SIGMETs, filtered to volcanic ash over Anak Krakatau.
 *
 * MAGMA's VONA gives a prose movement phrase and nothing more, so the map
 * could only ever draw an indicative wedge from three words. A volcanic-ash
 * SIGMET carries the affected area as an actual polygon, issued by the
 * responsible meteorological watch office -- for the Sunda Strait that is
 * BMKG's Jakarta office, so this is an Indonesian authority rather than a
 * foreign estimate.
 *
 * It also covers a gap this dashboard had: VONA notices can go quiet for
 * days while SIGMETs keep being issued, and relying on VONA alone let the
 * page state that no ash cloud was observed while an active BMKG SIGMET
 * said the opposite.
 *
 * A SIGMET describes AIRSPACE affected by ash, not ashfall on the ground.
 * The UI must say so; the two are not the same thing to a reader deciding
 * whether to bring the washing in.
 */
export type AshSigmet = {
  firName: string
  volcano: string
  validFrom: Date
  validTo: Date
  /** Feet above sea level. */
  baseFt: number
  topFt: number
  /** e.g. "SE 05KT". Null when the SIGMET states no movement. */
  movement: string | null
  /** The SIGMET's own INTSF marker: the cloud is intensifying. */
  intensifying: boolean
  /** GeoJSON winding: [longitude, latitude]. */
  polygon: Array<[number, number]>
}

/**
 * Validated one entry at a time, not as `z.array(...)`.
 *
 * The live feed carries every international SIGMET, and two of the 133 in the
 * captured fixture encode `coords` as nested arrays rather than objects. A
 * whole-array schema rejects the entire response over those two, which would
 * blank the ash polygons over the Sunda Strait because of a malformed
 * turbulence advisory somewhere else in the world.
 */
const entrySchema = z.object({
  hazard: z.string().nullish(),
  qualifier: z.string().nullish(),
  firName: z.string().nullish(),
  validTimeFrom: z.number(),
  validTimeTo: z.number(),
  base: z.number().nullish(),
  top: z.number().nullish(),
  dir: z.string().nullish(),
  spd: z.string().nullish(),
  rawSigmet: z.string().nullish(),
  coords: z.array(z.object({ lat: z.number(), lon: z.number() })).nullish(),
})

/**
 * @param now Passed in rather than read from the clock so expiry is testable
 *   and so a render cannot disagree with itself midway through.
 */
export function parseAshSigmets(raw: unknown, now: Date): AshSigmet[] {
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  const result: AshSigmet[] = []

  for (const candidate of raw) {
    const validated = entrySchema.safeParse(candidate)
    if (!validated.success) continue
    const entry = validated.data

    if (entry.hazard !== 'VA') continue
    if (!/krakatau/i.test(entry.qualifier ?? '')) continue

    const ring = entry.coords ?? []
    // Three points is the minimum that encloses anything.
    if (ring.length < 3) continue

    const validTo = new Date(entry.validTimeTo * 1000)
    // An expired polygon still renders as a hazard boundary while no longer
    // having an issuing authority behind it, so it is dropped rather than
    // dimmed.
    if (validTo.getTime() <= now.getTime()) continue

    const polygon: Array<[number, number]> = ring.map((c) => [c.lon, c.lat])
    const firName = entry.firName ?? ''

    // The same eruption is often described twice by one FIR, identically
    // apart from a trailing remark. Keyed on what is drawn, not on the text.
    const key = `${firName}|${entry.validTimeTo}|${JSON.stringify(polygon)}`
    if (seen.has(key)) continue
    seen.add(key)

    const movement = entry.dir && entry.spd ? `${entry.dir} ${entry.spd}KT` : null

    result.push({
      firName,
      volcano: entry.qualifier ?? '',
      validFrom: new Date(entry.validTimeFrom * 1000),
      validTo,
      baseFt: entry.base ?? 0,
      topFt: entry.top ?? 0,
      movement,
      intensifying: /\bINTSF\b/.test(entry.rawSigmet ?? ''),
      polygon,
    })
  }

  // Highest ceiling first: the widest, highest plume is the one a reader
  // scanning the map should register before the near-field detail.
  return result.sort((a, b) => b.topFt - a.topFt)
}

export async function getAshSigmets(): Promise<Result<AshSigmet[]>> {
  const response = await fetchJson(SIGMET_URL, z.unknown())
  if (!response.ok) return response
  const sigmets = parseAshSigmets(response.data, new Date())
  // An empty list is a real, common answer here -- most of the time no ash
  // SIGMET is in force -- so unlike the MAGMA adapters this is not a parse
  // failure.
  return ok(sigmets, SIGMET_URL, response.fetchedAt)
}
