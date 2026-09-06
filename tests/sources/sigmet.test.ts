import { expect, test } from 'bun:test'
import { parseAshSigmets } from '@/lib/sources/sigmet'

const fixture = JSON.parse(await Bun.file('tests/fixtures/isigmet.json').text())

/** Inside the fixture's validity windows, so nothing is filtered as expired. */
const DURING = new Date('2026-09-06T16:42:00Z')

test('picks the Krakatau ash SIGMETs out of every international SIGMET', () => {
  // Derived from the fixture rather than hardcoded, so a refresh that changes
  // the feed fails the test instead of silently passing.
  const expected = fixture.filter(
    (s: { hazard?: string; qualifier?: string }) =>
      s.hazard === 'VA' && /krakatau/i.test(s.qualifier ?? ''),
  )
  expect(expected.length).toBeGreaterThan(0)
  // Two of the fixture's Melbourne entries carry the same polygon and validity
  // and differ only by a trailing remark, so the parsed count is lower.
  const parsed = parseAshSigmets(fixture, DURING)
  expect(parsed.length).toBeGreaterThan(0)
  expect(parsed.length).toBeLessThan(expected.length)
})

test('ignores other hazards and other volcanoes', () => {
  const parsed = parseAshSigmets(fixture, DURING)
  // The fixture holds turbulence, icing, thunderstorms and eight other
  // volcanoes; none of them describe ash over the Sunda Strait.
  expect(parsed.every((s) => /krakatau/i.test(s.volcano))).toBe(true)
  expect(parsed.length).toBeLessThan(fixture.length)
})

test('drops a SIGMET whose validity has expired', () => {
  const parsed = parseAshSigmets(fixture, new Date('2026-09-07T00:00:00Z'))
  // Every window in the fixture closes before this instant. An expired ash
  // polygon left on the map is the same lie as a stale timestamp: it shows a
  // hazard boundary that no longer has an issuing authority behind it.
  expect(parsed).toEqual([])
})

test('de-duplicates SIGMETs that describe the same area and window', () => {
  const parsed = parseAshSigmets(fixture, DURING)
  const seen = parsed.map(
    (s) => `${s.firName}|${s.validTo.toISOString()}|${JSON.stringify(s.polygon)}`,
  )
  expect(new Set(seen).size).toBe(seen.length)
})

test('reads the Jakarta polygon as coordinates that actually contain the volcano', () => {
  const jakarta = parseAshSigmets(fixture, DURING).find((s) => /jakarta/i.test(s.firName))
  expect(jakarta).toBeDefined()
  if (!jakarta) return

  // A polygon that parsed but landed in the wrong hemisphere would still be a
  // valid-looking array, so assert the geometry rather than its shape.
  const [lon, lat] = [105.4233, -6.1009]
  let inside = false
  const ring = jakarta.polygon
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (!a || !b) continue
    if (a[1] > lat !== b[1] > lat && lon < ((b[0] - a[0]) * (lat - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside
    }
  }
  expect(inside).toBe(true)
  expect(jakarta.topFt).toBe(15000)
  expect(jakarta.movement).toBe('SE 05KT')
  expect(jakarta.intensifying).toBe(true)
})

test('returns an empty array for input that is not a SIGMET list', () => {
  expect(parseAshSigmets(null, DURING)).toEqual([])
  expect(parseAshSigmets({}, DURING)).toEqual([])
  expect(parseAshSigmets([{ hazard: 'VA' }], DURING)).toEqual([])
})

test('one malformed entry elsewhere in the world does not blank our polygons', () => {
  // The live feed carries every international SIGMET, and two of the 133 in
  // the captured fixture encode `coords` as nested arrays. Validating the
  // whole response as one array rejects all of it over those two, which is
  // how the ash polygons over the Sunda Strait first came back empty.
  const malformed = {
    ...fixture[0],
    coords: [
      [1, 2],
      [3, 4],
      [5, 6],
    ],
  }
  const parsed = parseAshSigmets([malformed, ...fixture], DURING)
  expect(parsed.length).toBeGreaterThan(0)
  expect(parsed.some((s) => /jakarta/i.test(s.firName))).toBe(true)
})
