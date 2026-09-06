import { afterEach, expect, mock, test } from 'bun:test'
import { findReportUrl, getStatus, parseReport } from '@/lib/sources/status'
import { ACTIVITY_URL } from '@/lib/urls'

const activity = await Bun.file('tests/fixtures/tingkat-aktivitas.html').text()
const report = await Bun.file('tests/fixtures/laporan.html').text()

test('finds the signed report URL for Anak Krakatau', () => {
  const url = findReportUrl(activity)
  expect(url).toMatch(/\/gunung-api\/laporan\/\d+\?signature=[a-f0-9]+$/)
})

test('returns null when no Anak Krakatau row exists', () => {
  expect(findReportUrl('<table><tr><td>Merapi</td></tr></table>')).toBeNull()
})

test('reads alert level as both number and label', () => {
  const status = parseReport(report)
  expect(status?.level).toBe(3)
  expect(status?.levelLabel).toBe('Siaga')
})

test('reads the hazard radius in kilometres', () => {
  expect(parseReport(report)?.hazardRadiusKm).toBe(3)
})

test('reads coordinates and summit elevation', () => {
  const status = parseReport(report)
  expect(status?.latitude).toBeCloseTo(-6.102, 2)
  expect(status?.longitude).toBeCloseTo(105.423, 2)
  expect(status?.elevationM).toBe(157)
})

test('reads the observation period as an exact WIB window', () => {
  // The old assertion was `.not.toBeNaN()`, which `new Date()` also
  // satisfies -- so it passed whether the period was read or fabricated.
  // The committed fixture is headed "06 September 2026, periode
  // 00:00-06:00 WIB", i.e. 2026-09-05T17:00Z to 2026-09-05T23:00Z.
  const period = parseReport(report)?.observationPeriod
  expect(period?.start.toISOString()).toBe('2026-09-05T17:00:00.000Z')
  expect(period?.end.toISOString()).toBe('2026-09-05T23:00:00.000Z')
})

test('observationPeriod is null, not the current time, when no period is stated', () => {
  // Fabricating `new Date()` here presented an alert level of entirely
  // unknown age as observed "right now".
  const noPeriod = `
    <html><body>
      <h5>Level III (Siaga)</h5>
      <p>Latitude -6.102\u00b0LU, Longitude 105.423\u00b0BT dan memiliki ketinggian 157 mdpl</p>
      <p>beraktivitas dalam radius 3 km dari kawah aktif.</p>
    </body></html>
  `
  const status = parseReport(noPeriod)
  expect(status?.level).toBe(3)
  expect(status?.observationPeriod).toBeNull()
})

test('rolls an end-of-day window past midnight instead of emitting a backwards range', () => {
  const lateShift = `
    <html><body>
      <h5>Level III (Siaga)</h5>
      <p>Pengamatan 06 September 2026, periode 18:00-24:00 WIB</p>
    </body></html>
  `
  const period = parseReport(lateShift)?.observationPeriod
  expect(period?.start.toISOString()).toBe('2026-09-06T11:00:00.000Z')
  expect(period?.end.toISOString()).toBe('2026-09-06T17:00:00.000Z')
})

test('returns null for a document with no level statement', () => {
  expect(parseReport('<html><body>nothing</body></html>')).toBeNull()
})

test('returns null for an empty document', () => {
  expect(parseReport('')).toBeNull()
})

test('the visible badge level wins over a script-embedded level string appearing earlier in markup', () => {
  const contaminated = `
    <html>
    <head>
    <script>
      var status = 'Level IV (Awas)';
    </script>
    </head>
    <body>
      <h5><span class="badge bg-orange tx-white">Level II (Waspada)</span></h5>
      <p>Latitude -6.102°LU, Longitude 105.423°BT dan memiliki ketinggian 157 mdpl</p>
      <p>radius 2 km dari kawah aktif.</p>
    </body>
    </html>
  `
  const status = parseReport(contaminated)
  expect(status?.level).toBe(2)
  expect(status?.levelLabel).toBe('Waspada')
})

test('reads radius, elevation, and coordinates from the document, not from the fallback constants', () => {
  const synthetic = `
    <html><body>
      <h5>Level II (Waspada)</h5>
      <p>Latitude -7.542°LU, Longitude 110.442°BT dan memiliki ketinggian 200 mdpl</p>
      <p>beraktivitas dalam radius 5 km dari kawah aktif.</p>
    </body></html>
  `
  const status = parseReport(synthetic)
  expect(status?.hazardRadiusKm).toBe(5)
  expect(status?.latitude).toBeCloseTo(-7.542, 2)
  expect(status?.longitude).toBeCloseTo(110.442, 2)
  expect(status?.elevationM).toBe(200)
})

test('hazardRadiusKm is null, not a fallback of 3, when a level is stated but no radius sentence exists', () => {
  const noRadius = `
    <html><body>
      <h5>Level II (Waspada)</h5>
      <p>Latitude -7.542°LU, Longitude 110.442°BT dan memiliki ketinggian 200 mdpl</p>
    </body></html>
  `
  const status = parseReport(noRadius)
  expect(status?.hazardRadiusKm).toBeNull()
})

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

/** Serves the committed fixtures, never MAGMA. */
function stubMagma(activityDate: Date, reportDate: Date) {
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    const isActivity = url.includes('tingkat-aktivitas')
    return new Response(isActivity ? activity : report, {
      status: 200,
      headers: { date: (isActivity ? activityDate : reportDate).toUTCString() },
    })
  }) as unknown as typeof fetch
}

test('fetchedAt is the report response Date header, not render time', async () => {
  // Dropping fetchText's fetchedAt made ok() re-stamp new Date(), so every
  // card rendered "updated now" regardless of how old the response was.
  // The two headers differ so this also pins WHICH fetch is reported: the
  // report is where the displayed level and radius actually came from.
  const activityDate = new Date('2026-09-06T11:00:00Z')
  const reportDate = new Date('2026-09-06T11:56:00Z')
  stubMagma(activityDate, reportDate)
  const result = await getStatus()
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.fetchedAt.getTime()).toBe(reportDate.getTime())
  expect(result.fetchedAt.getTime()).not.toBe(activityDate.getTime())
})

test('an http failure on the signed report reports the stable activity URL, not the signed one', async () => {
  // The signed report URL 403s once its signature expires. Handing it back
  // as "open the original report" reproduces the failure for the reader.
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    return url.includes('tingkat-aktivitas')
      ? new Response(activity, { status: 200 })
      : new Response('forbidden', { status: 403 })
  }) as unknown as typeof fetch
  const result = await getStatus()
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.reason).toBe('http')
  expect(result.sourceUrl).toBe(ACTIVITY_URL)
  expect(result.sourceUrl).not.toContain('signature=')
})

test('a parse failure on the report also reports the stable activity URL', async () => {
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    return url.includes('tingkat-aktivitas')
      ? new Response(activity, { status: 200 })
      : new Response('<html><body>no level here</body></html>', { status: 200 })
  }) as unknown as typeof fetch
  const result = await getStatus()
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.reason).toBe('parse')
  expect(result.sourceUrl).toBe(ACTIVITY_URL)
})
