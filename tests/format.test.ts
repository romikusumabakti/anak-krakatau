import { expect, test } from 'bun:test'
import { formatAshHeight, formatRelative, formatWib } from '@/lib/format'

test('English puts feet first with a metric aside', () => {
  expect(formatAshHeight('en', 50000, 15240)).toBe('50,000 ft (~15,240 m)')
})

test('Indonesian puts metres first and uses dot separators', () => {
  expect(formatAshHeight('id', 50000, 15240)).toBe('15.240 m (~50.000 kaki)')
})

test('timestamps always render in WIB regardless of host timezone (Indonesian)', () => {
  // 2026-09-06T00:10:00Z is 07:10 WIB.
  const formatted = formatWib('id', new Date('2026-09-06T00:10:00Z'))
  expect(formatted).toContain('07.10')
  expect(formatted).toContain('WIB')
})

test('timestamps always render in WIB regardless of host timezone (English)', () => {
  // 2026-09-06T00:10:00Z is 07:10 WIB.
  const formatted = formatWib('en', new Date('2026-09-06T00:10:00Z'))
  expect(formatted).toContain('07:10')
  expect(formatted).toContain('WIB')
})

test('relative time is localised', () => {
  const now = new Date('2026-09-06T02:10:00Z')
  const then = new Date('2026-09-06T00:10:00Z')
  expect(formatRelative('en', then, now)).toBe('2 hours ago')
  expect(formatRelative('id', then, now)).toBe('2 jam yang lalu')
})

test('relative time falls back to minutes under an hour', () => {
  const now = new Date('2026-09-06T00:40:00Z')
  const then = new Date('2026-09-06T00:10:00Z')
  expect(formatRelative('en', then, now)).toBe('30 minutes ago')
})

// Boundary tests for unit thresholds
test('boundary: 0 seconds renders as now', () => {
  const now = new Date('2026-09-06T02:10:00Z')
  expect(formatRelative('en', now, now)).toBe('now')
  expect(formatRelative('id', now, now)).toBe('sekarang')
})

test('boundary: 59 seconds', () => {
  const now = new Date('2026-09-06T02:10:00Z')
  const then = new Date(now.getTime() - 59_000)
  expect(formatRelative('en', then, now)).toBe('59 seconds ago')
  expect(formatRelative('id', then, now)).toBe('59 detik yang lalu')
})

test('boundary: 60 seconds (exactly 1 minute)', () => {
  const now = new Date('2026-09-06T02:10:00Z')
  const then = new Date(now.getTime() - 60_000)
  expect(formatRelative('en', then, now)).toBe('1 minute ago')
  expect(formatRelative('id', then, now)).toBe('1 menit yang lalu')
})

test('boundary: 1800 seconds (exactly 30 minutes)', () => {
  const now = new Date('2026-09-06T02:10:00Z')
  const then = new Date(now.getTime() - 1800_000)
  expect(formatRelative('en', then, now)).toBe('30 minutes ago')
  expect(formatRelative('id', then, now)).toBe('30 menit yang lalu')
})

test('boundary: 3599 seconds (59:59) must NOT render as 60 minutes', () => {
  // This is the critical bug case: 3599 seconds should be "1 hour ago", not "60 minutes ago"
  const now = new Date('2026-09-06T02:10:00Z')
  const then = new Date(now.getTime() - 3599_000)
  expect(formatRelative('en', then, now)).toBe('1 hour ago')
  expect(formatRelative('id', then, now)).toBe('1 jam yang lalu')
})

test('boundary: 3600 seconds (exactly 1 hour)', () => {
  const now = new Date('2026-09-06T02:10:00Z')
  const then = new Date(now.getTime() - 3600_000)
  expect(formatRelative('en', then, now)).toBe('1 hour ago')
  expect(formatRelative('id', then, now)).toBe('1 jam yang lalu')
})

test('boundary: 7200 seconds (exactly 2 hours)', () => {
  const now = new Date('2026-09-06T02:10:00Z')
  const then = new Date(now.getTime() - 7200_000)
  expect(formatRelative('en', then, now)).toBe('2 hours ago')
  expect(formatRelative('id', then, now)).toBe('2 jam yang lalu')
})

test('boundary: 86399 seconds (23:59:59) must NOT render as 24 hours', () => {
  // This is the critical bug case: 86399 seconds should be "1 day ago", not "24 hours ago"
  const now = new Date('2026-09-06T02:10:00Z')
  const then = new Date(now.getTime() - 86399_000)
  // ICU may render as "yesterday" or "1 day ago" with numeric: 'auto'
  const result_en = formatRelative('en', then, now)
  const result_id = formatRelative('id', then, now)
  expect(result_en === '1 day ago' || result_en === 'yesterday').toBe(true)
  expect(result_id === '1 hari yang lalu' || result_id === 'kemarin').toBe(true)
})

test('boundary: 86400 seconds (exactly 1 day)', () => {
  const now = new Date('2026-09-06T02:10:00Z')
  const then = new Date(now.getTime() - 86400_000)
  // ICU may render as "yesterday" or "1 day ago" with numeric: 'auto'
  const result_en = formatRelative('en', then, now)
  const result_id = formatRelative('id', then, now)
  expect(result_en === '1 day ago' || result_en === 'yesterday').toBe(true)
  expect(result_id === '1 hari yang lalu' || result_id === 'kemarin').toBe(true)
})

test('boundary: future direction at 3599 seconds must NOT render as 60 minutes', () => {
  // Verify the same rule applies in the future direction
  const now = new Date('2026-09-06T02:10:00Z')
  const then = new Date(now.getTime() + 3599_000)
  expect(formatRelative('en', then, now)).toBe('in 1 hour')
  expect(formatRelative('id', then, now)).toBe('dalam 1 jam')
})
