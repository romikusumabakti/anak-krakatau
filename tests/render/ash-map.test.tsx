import { afterEach, expect, mock, test } from 'bun:test'
import {
  FIXTURES,
  minutesAgo,
  render,
  restoreFetch,
  sigmetDocument,
  stubFetch,
  vonaDocument,
} from './harness'

// The map body is a client component that dynamically imports MapLibre and
// its CSS; neither exists outside a bundler. Only the card's chrome -- the
// legend, the caption, the source lines -- is under test here, so the
// canvas is stubbed to a marker element.
mock.module('@/components/ash-map-loader', () => ({
  AshMapLoader: () => <div data-testid="map-canvas" />,
}))

afterEach(restoreFetch)

const ok = (body: string, date?: Date) => ({ body, date })
const NOTICE_URL = 'https://magma.esdm.go.id/v1/vona/22575?signature=abc'

async function ashMap() {
  const { AshMap } = await import('@/components/ash-map')
  return render(<AshMap locale="en" />)
}

test('the map card names its sources, its data age, and links the originating notice', async () => {
  stubFetch({
    activity: ok(FIXTURES.activity),
    report: ok(FIXTURES.report, minutesAgo(9)),
    vona: ok(vonaDocument('Eruption. Ash cloud moving to northwest.'), minutesAgo(23)),
  })
  const html = await ashMap()
  expect(html).toContain('data-testid="map-canvas"')
  expect(html).toContain('MAGMA Indonesia')
  expect(html).toContain('PVMBG VONA')
  expect(html).toContain('updated 9 minutes ago')
  expect(html).toContain('updated 23 minutes ago')
  // The wedge's own age -- when the notice was issued, not when we fetched.
  expect(html).toContain('issued Sep 5, 09:00 WIB')
  expect(html).toContain(`href="${NOTICE_URL}"`)
  expect(html).toContain('Open the VONA notice')
})

test('both drawn geometries are named in text, not left as colour alone', async () => {
  stubFetch({
    activity: ok(FIXTURES.activity),
    report: ok(FIXTURES.report),
    vona: ok(vonaDocument('Eruption. Ash cloud moving to northwest.')),
    sigmet: ok(sigmetDocument()),
  })
  const html = await ashMap()
  expect(html).toContain('Shaded area:')
  expect(html).toContain('Red ring:')
})

test('an active SIGMET names its FIR, altitude band and expiry', async () => {
  stubFetch({
    activity: ok(FIXTURES.activity),
    report: ok(FIXTURES.report),
    vona: ok(vonaDocument('Eruption. Ash-cloud is not observed.')),
    sigmet: ok(sigmetDocument()),
  })
  const html = await ashMap()
  expect(html).toContain('WIIF JAKARTA')
  expect(html).toContain('15000 ft')
  expect(html).toContain('moving SE 05KT')
  expect(html).toContain('intensifying')
  // The distinction the whole feature turns on: this is airspace, not the
  // ground a reader is standing on.
  expect(html).toContain('not ashfall where you are standing')
})

test('says plainly when no ash SIGMET is in force', async () => {
  stubFetch({
    activity: ok(FIXTURES.activity),
    report: ok(FIXTURES.report),
    vona: ok(vonaDocument('Eruption. Ash-cloud is not observed.')),
    sigmet: ok('[]'),
  })
  const html = await ashMap()
  expect(html).toContain('No volcanic-ash SIGMET is in force')
  expect(html).not.toContain('Shaded area:')
})

test('an expired SIGMET is not drawn as if it were current', async () => {
  const expired = JSON.parse(sigmetDocument())
  expired[0].validTimeTo = Math.floor(Date.now() / 1000) - 60
  stubFetch({
    activity: ok(FIXTURES.activity),
    report: ok(FIXTURES.report),
    vona: ok(vonaDocument('Eruption. Ash-cloud is not observed.')),
    sigmet: ok(JSON.stringify(expired)),
  })
  const html = await ashMap()
  expect(html).toContain('No volcanic-ash SIGMET is in force')
  expect(html).not.toContain('WIIF JAKARTA')
})

test('a movement phrase with no compass point is NOT reported as "no ash cloud observed"', async () => {
  // Reachable today with no upstream change: "moving to the sea" gives a
  // non-null movementLabel and a null bearing.
  stubFetch({
    activity: ok(FIXTURES.activity),
    report: ok(FIXTURES.report),
    vona: ok(vonaDocument('Eruption at 0200 UTC. Ash cloud moving to the sea.')),
  })
  const html = await ashMap()
  expect(html).not.toContain('reports no observed ash cloud')
  expect(html).toContain('We could not read a drift direction from the latest notice')
  expect(html).toContain('This does not mean no ash cloud was reported.')
  // No wedge is drawn, so no wedge is described.
  expect(html).not.toContain('Amber wedge:')
})

test('a notice that states no observed ash cloud is still reported as such', async () => {
  stubFetch({
    activity: ok(FIXTURES.activity),
    report: ok(FIXTURES.report),
    vona: ok(vonaDocument('Eruption at 0200 UTC. Ash-cloud is not observed.')),
  })
  const html = await ashMap()
  expect(html).toContain('reports no observed ash cloud')
  expect(html).not.toContain('We could not read a drift direction')
})

test('a VONA outage is reported as an outage and links out', async () => {
  stubFetch({ activity: ok(FIXTURES.activity), report: ok(FIXTURES.report), vona: null })
  const html = await ashMap()
  expect(html).toContain('Source unavailable')
  expect(html).toContain('href="https://magma.esdm.go.id/v1/vona?code=KRA"')
})

test('still draws the ash areas when MAGMA is down', async () => {
  // The polygons come from a different authority entirely, and MAGMA is the
  // flakiest source here. Bailing out of the whole card on a status failure
  // meant the ash areas -- the one thing this card exists to show -- vanished
  // exactly as often as the volcano's own site hiccuped.
  stubFetch({ activity: null, report: null, vona: null, sigmet: ok(sigmetDocument()) })
  const html = await ashMap()
  expect(html).toContain('WIIF JAKARTA')
  expect(html).toContain('Shaded area:')
  // No exclusion ring, because its radius is a live instruction we no longer
  // have -- and that omission is stated rather than left blank.
  expect(html).not.toContain('Red ring:')
  expect(html).toContain('Exclusion radius not stated')
})
