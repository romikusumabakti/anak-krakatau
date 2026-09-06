type Position = [number, number]

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
