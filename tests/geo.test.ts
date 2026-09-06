import { expect, test } from 'bun:test'
import { circlePolygon } from '@/lib/geo'

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

const CENTRE: Position = [105.4233, -6.1009]

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
