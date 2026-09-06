import { afterEach, expect, mock, test } from 'bun:test'
import { FIXTURES, minutesAgo, render, restoreFetch, stubFetch, vonaDocument } from './harness'

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
  })
  const html = await ashMap()
  expect(html).toContain('Amber wedge:')
  expect(html).toContain('Red ring:')
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
