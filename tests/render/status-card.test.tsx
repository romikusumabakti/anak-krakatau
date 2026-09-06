import { afterEach, expect, test } from 'bun:test'
import { ACTIVITY_URL } from '@/lib/urls'
import {
  FIXTURES,
  minutesAgo,
  render,
  restoreFetch,
  setLocale,
  sigmetDocument,
  stubFetch,
  vonaDocument,
} from './harness'

afterEach(restoreFetch)

const ok = (body: string, date?: Date) => ({ body, date })

async function statusCard(locale: 'en' | 'id' = 'en') {
  setLocale(locale)
  const { StatusCard } = await import('@/components/status-card')
  return render(<StatusCard locale={locale} />)
}

test('an unavailable status source says so and links a page that works', async () => {
  // The report URL is signed and 403s without its signature; handing it to
  // a reader as the escape hatch reproduces the failure for them.
  stubFetch({ activity: ok(FIXTURES.activity), report: null, vona: ok(FIXTURES.vona) })
  const html = await statusCard()
  expect(html).toContain('Source unavailable')
  expect(html).toContain(`href="${ACTIVITY_URL}"`)
  expect(html).not.toContain('signature=')
})

test('the freshness line reports the upstream Date header, not render time', async () => {
  stubFetch({
    activity: ok(FIXTURES.activity, minutesAgo(60)),
    report: ok(FIXTURES.report, minutesAgo(12)),
    vona: ok(FIXTURES.vona, minutesAgo(47)),
  })
  const html = await statusCard()
  expect(html).toContain('updated 12 minutes ago')
  expect(html).not.toContain('updated now')
  // Finding 8: the VONA block carries its own source line and its own age,
  // rather than sheltering under MAGMA's footer.
  expect(html).toContain('updated 47 minutes ago')
  expect(html).toContain('PVMBG VONA')
})

test('the level badge carries a numeral and a word, not only a colour', async () => {
  stubFetch({
    activity: ok(FIXTURES.activity),
    report: ok(FIXTURES.report),
    vona: ok(FIXTURES.vona),
  })
  const html = await statusCard()
  expect(html).toContain('Level III')
  expect(html).toContain('Alert')
})

test('the alert level is shown with the observation window it came from', async () => {
  stubFetch({
    activity: ok(FIXTURES.activity),
    report: ok(FIXTURES.report),
    vona: ok(FIXTURES.vona),
  })
  const html = await statusCard()
  expect(html).toContain('Observation period')
  expect(html).toContain('00:00–06:00 WIB')
})

test('a report with no stated observation window says so instead of implying "now"', async () => {
  const noPeriod =
    '<html><body><h5>Level III (Siaga)</h5><p>radius 3 km dari kawah aktif.</p></body></html>'
  stubFetch({
    activity: ok(FIXTURES.activity),
    report: ok(noPeriod),
    vona: ok(FIXTURES.vona),
  })
  const html = await statusCard()
  expect(html).toContain('Observation period not stated in the latest report.')
})

test('an unreadable ash height is NOT rendered as "ash cloud not observed"', async () => {
  // Reachable today: this wording yields a movementLabel but no height and
  // no compass point. Asserting a hazard-negative from a failed regex is a
  // false statement about a live hazard.
  stubFetch({
    activity: ok(FIXTURES.activity),
    report: ok(FIXTURES.report),
    vona: ok(vonaDocument('Eruption at 0200 UTC (0900 local). Ash cloud moving to the sea.')),
  })
  const html = await statusCard()
  expect(html).not.toContain('Ash cloud not observed')
  expect(html).toContain('We could not read the ash-cloud height from the latest notice.')
  expect(html).toContain('This does not mean no ash cloud was reported.')
  expect(html).toContain('https://magma.esdm.go.id/v1/vona/22575?signature=abc')
})

test('a notice that really says the ash cloud was not observed still says so', async () => {
  stubFetch({
    activity: ok(FIXTURES.activity),
    report: ok(FIXTURES.report),
    vona: ok(vonaDocument('Eruption at 0200 UTC (0900 local). Ash-cloud is not observed.')),
  })
  const html = await statusCard()
  expect(html).toContain('Ash cloud not observed')
  expect(html).not.toContain('We could not read the ash-cloud height')
})

test('Indonesian renders Indonesian copy for the unreadable-height state', async () => {
  stubFetch({
    activity: ok(FIXTURES.activity),
    report: ok(FIXTURES.report),
    vona: ok(vonaDocument('Eruption at 0200 UTC (0900 local). Ash cloud moving to the sea.')),
  })
  const html = await statusCard('id')
  expect(html).toContain('Kami tidak dapat membaca tinggi kolom abu dari notice terbaru.')
  expect(html).not.toContain('Kolom abu tidak teramati')
  expect(html).toContain('Periode pengamatan')
})

test('the success-path source link is the stable page, not the signed report', async () => {
  // The signed report URL is the precise document, but only while its
  // signature is live. Pages are served from cache for up to a year under
  // stale-while-revalidate, so a reader clicking through a cached page can
  // land on a 403 -- reproducing a failure at the moment they were trying to
  // reach the official source. The activity page always carries a fresh
  // signed link to the current report, so precision loses to reachability.
  stubFetch({
    activity: ok(FIXTURES.activity),
    report: ok(FIXTURES.report),
    vona: ok(FIXTURES.vona),
  })
  const html = await statusCard()
  expect(html).toContain('Level III')
  expect(html).toContain(`href="${ACTIVITY_URL}"`)
  expect(html).not.toContain('gunung-api/laporan/')
})

test('does not state "ash cloud not observed" alone while a SIGMET says otherwise', async () => {
  // VONA can go quiet for days while ash SIGMETs keep being issued. Reading
  // only VONA, this card flatly reported no observed ash cloud while BMKG's
  // own watch office had an active SIGMET saying the opposite -- the worst
  // thing a hazard card can do is understate a live one.
  stubFetch({
    activity: ok(FIXTURES.activity),
    report: ok(FIXTURES.report),
    vona: ok(vonaDocument('Eruption at 0200 UTC. Ash-cloud is not observed.')),
    sigmet: ok(sigmetDocument()),
  })
  const html = await statusCard()
  expect(html).toContain('Ash cloud not observed')
  expect(html).toContain('An ash SIGMET is in force')
})

test('says nothing about airspace ash when no SIGMET is in force', async () => {
  stubFetch({
    activity: ok(FIXTURES.activity),
    report: ok(FIXTURES.report),
    vona: ok(vonaDocument('Eruption at 0200 UTC. Ash-cloud is not observed.')),
    sigmet: ok('[]'),
  })
  const html = await statusCard()
  expect(html).toContain('Ash cloud not observed')
  expect(html).not.toContain('An ash SIGMET is in force')
})
