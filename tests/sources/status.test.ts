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
