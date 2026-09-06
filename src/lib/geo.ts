type Position = [number, number]

/**
 * Ordered longest-first so a single left-to-right regex scan consumes a
 * compound name like "northeast" whole, rather than the "north" substring
 * matching first and leaving "east" to match again on its own later.
 *
 * This is NOT the same bug as picking `lastIndexOf` for each name and
 * keeping the highest index: in "north to northeast" the substring "east"
 * sits at a higher index (14) than the compound word "northeast" starts
 * (9), so a lastIndexOf-per-name approach wrongly returns the bearing for
 * "east" (90) instead of "northeast" (45). A global alternation regex never
 * re-enters text already consumed by an earlier match, so it can't make
 * that mistake.
 */
const COMPASS_NAMES = [
  'northnortheast',
  'eastnortheast',
  'eastsoutheast',
  'southsoutheast',
  'southsouthwest',
  'westsouthwest',
  'westnorthwest',
  'northnorthwest',
  'northeast',
  'southeast',
  'southwest',
  'northwest',
  'north',
  'east',
  'south',
  'west',
] as const

const BEARINGS: Record<(typeof COMPASS_NAMES)[number], number> = {
  northnortheast: 22.5,
  eastnortheast: 67.5,
  eastsoutheast: 112.5,
  southsoutheast: 157.5,
  southsouthwest: 202.5,
  westsouthwest: 247.5,
  westnorthwest: 292.5,
  northnorthwest: 337.5,
  northeast: 45,
  southeast: 135,
  southwest: 225,
  northwest: 315,
  north: 0,
  east: 90,
  south: 180,
  west: 270,
}

const COMPASS_RE = new RegExp(COMPASS_NAMES.join('|'), 'g')

/**
 * Reads the compass bearing a VONA movement phrase settles on. These
 * phrases read as a progression ("north to northeast", "southwest, west to
 * northwest"), so the direction that matters is the LAST one named -- it is
 * the most recent heading, not the first. Pure function; returns null when
 * no direction is named (e.g. the ash cloud wasn't observed at all).
 */
export function bearingFromPhrase(phrase: string | null): number | null {
  if (!phrase) return null
  const normalised = phrase.toLowerCase()
  let lastMatch: string | null = null
  for (const match of normalised.matchAll(COMPASS_RE)) {
    lastMatch = match[0]
  }
  if (!lastMatch) return null
  return BEARINGS[lastMatch as (typeof COMPASS_NAMES)[number]] ?? null
}

const EARTH_RADIUS_KM = 6371

function destination(lon: number, lat: number, bearingDeg: number, distanceKm: number): Position {
  const angular = distanceKm / EARTH_RADIUS_KM
  const bearing = (bearingDeg * Math.PI) / 180
  const lat1 = (lat * Math.PI) / 180
  const lon1 = (lon * Math.PI) / 180
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  )
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    )
  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]
}

/** A closed ring approximating a circle of `radiusKm` around (lon, lat). */
export function circlePolygon(
  lon: number,
  lat: number,
  radiusKm: number,
  steps = 64,
): Position[][] {
  const ring: Position[] = []
  for (let i = 0; i <= steps; i += 1) {
    ring.push(destination(lon, lat, (i * 360) / steps, radiusKm))
  }
  return [ring]
}

/**
 * A closed "pie slice" ring: centre -> arc of `spreadDeg` around
 * `bearingDeg` at `radiusKm` -> back to centre. This is an INDICATIVE
 * direction, not a measured ash-cloud boundary -- see map.sectorCaption.
 */
export function sectorPolygon(
  lon: number,
  lat: number,
  bearingDeg: number,
  radiusKm: number,
  spreadDeg = 45,
): Position[][] {
  const ring: Position[] = [[lon, lat]]
  const start = bearingDeg - spreadDeg / 2
  const steps = 24
  for (let i = 0; i <= steps; i += 1) {
    ring.push(destination(lon, lat, start + (i * spreadDeg) / steps, radiusKm))
  }
  ring.push([lon, lat])
  return [ring]
}
