import { expect, test } from 'bun:test'
import { bearingFromPhrase, circlePolygon, sectorPolygon } from '@/lib/geo'

type Position = [number, number]

const EARTH_RADIUS_KM = 6371

/**
 * Independent haversine implementation (not shared with src/lib/geo.ts) so
 * these tests can't pass just because they happen to call the same math the
 * implementation uses internally.
 */
function distanceKm(a: Position, b: Position): number {
  const [lon1, lat1] = a
  const [lon2, lat2] = b
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const la1 = (lat1 * Math.PI) / 180
  const la2 = (lat2 * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

function bearingBetween(a: Position, b: Position): number {
  const [lon1, lat1] = a
  const [lon2, lat2] = b
  const la1 = (lat1 * Math.PI) / 180
  const la2 = (lat2 * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos(la2)
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon)
  const theta = Math.atan2(y, x)
  return ((theta * 180) / Math.PI + 360) % 360
}

/** Smallest signed difference from `a` to `b` in degrees, in (-180, 180]. */
function angleDiff(a: number, b: number): number {
  return ((((b - a + 180) % 360) + 360) % 360) - 180
}

const CENTRE: Position = [105.4233, -6.1009]

test('reads a bearing from a simple phrase', () => {
  expect(bearingFromPhrase('north to northeast')).toBe(45)
})

test('uses the last named direction in a multi-part phrase', () => {
  expect(bearingFromPhrase('southwest, west to north')).toBe(0)
})

test('matches longer compass names before their substrings', () => {
  expect(bearingFromPhrase('moving to northwest')).toBe(315)
})

test('returns null when no direction is named', () => {
  expect(bearingFromPhrase('ash cloud is not observed')).toBeNull()
  expect(bearingFromPhrase(null)).toBeNull()
})

// The five real (post-"from "/"to " stripping) movement phrases found in the
// committed VONA fixture. Each reads as a progression, so the bearing must
// come from the LAST direction named, not from whichever name happens to
// start at the highest string index (a compound name like "northeast"
// contains "east" at a higher index than the compound name itself starts).
test.each([
  ['north to northeast', 45],
  ['north to northwest', 315],
  ['south to northwest', 315],
  ['southwest, west to northwest', 315],
  ['northwest', 315],
])('real fixture phrase %p resolves to bearing %d', (phrase, expected) => {
  expect(bearingFromPhrase(phrase)).toBe(expected)
})

test('circle polygon closes on itself', () => {
  const [ring] = circlePolygon(CENTRE[0], CENTRE[1], 3)
  expect(ring).toBeDefined()
  if (!ring) return
  expect(ring[0]).toEqual(ring[ring.length - 1])
})

test('every point on the circle polygon is actually about the requested distance from the centre', () => {
  // A function returning a fixed-size but wrong-shaped ring (e.g. always the
  // same square, or points scaled by degrees rather than kilometres) would
  // still close on itself and pass the test above. Checking real distances
  // catches that.
  const radiusKm = 25
  const [ring] = circlePolygon(CENTRE[0], CENTRE[1], radiusKm)
  expect(ring).toBeDefined()
  if (!ring) return
  expect(ring.length).toBeGreaterThan(10)
  for (const point of ring) {
    expect(distanceKm(CENTRE, point)).toBeCloseTo(radiusKm, 1)
  }
})

test('sector polygon starts and ends at the centre', () => {
  const [ring] = sectorPolygon(CENTRE[0], CENTRE[1], 45, 40)
  expect(ring).toBeDefined()
  if (!ring) return
  expect(ring[0]).toEqual(CENTRE)
  expect(ring[ring.length - 1]).toEqual(CENTRE)
})

test('sector polygon arms sit at the requested distance and span the requested arc around the requested bearing', () => {
  // "Starts and ends at the centre" alone would pass for a sector that draws
  // a full circle, a single degenerate line, or an arc centred on the wrong
  // bearing -- as long as someone remembered to prepend/append the centre
  // point. Checking the arm distances and the bearings of the arc endpoints
  // relative to the requested bearing and spread catches all of those.
  const bearingDeg = 315
  const radiusKm = 120
  const spreadDeg = 40
  const [ring] = sectorPolygon(CENTRE[0], CENTRE[1], bearingDeg, radiusKm, spreadDeg)
  expect(ring).toBeDefined()
  if (!ring) return

  // Strip the leading and trailing centre point to get just the arc.
  const arc = ring.slice(1, -1)
  expect(arc.length).toBeGreaterThan(2)

  const first = arc[0]
  const last = arc[arc.length - 1]
  expect(first).toBeDefined()
  expect(last).toBeDefined()
  if (!first || !last) return

  // Every arm point should be ~radiusKm from the centre.
  for (const point of arc) {
    expect(distanceKm(CENTRE, point)).toBeCloseTo(radiusKm, 0)
  }

  // The arc should span from bearing-spread/2 to bearing+spread/2, in order.
  const firstBearing = bearingBetween(CENTRE, first)
  const lastBearing = bearingBetween(CENTRE, last)
  expect(Math.abs(angleDiff(firstBearing, bearingDeg - spreadDeg / 2))).toBeLessThan(1)
  expect(Math.abs(angleDiff(lastBearing, bearingDeg + spreadDeg / 2))).toBeLessThan(1)

  // And the midpoint of the arc should point directly at the requested bearing.
  const mid = arc[Math.floor(arc.length / 2)]
  expect(mid).toBeDefined()
  if (!mid) return
  const midBearing = bearingBetween(CENTRE, mid)
  expect(Math.abs(angleDiff(midBearing, bearingDeg))).toBeLessThan(2)
})
