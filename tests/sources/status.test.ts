import { expect, test } from 'bun:test'
import { findReportUrl, parseReport } from '@/lib/sources/status'

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

test('reads the observation period timestamp', () => {
  expect(parseReport(report)?.observedAt.getTime()).not.toBeNaN()
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
