import { expect, test } from 'bun:test'
import { formatAshHeight, formatRelative, formatWib } from '@/lib/format'

test('English puts feet first with a metric aside', () => {
  expect(formatAshHeight('en', 50000, 15240)).toBe('50,000 ft (~15,240 m)')
})

test('Indonesian puts metres first and uses dot separators', () => {
  expect(formatAshHeight('id', 50000, 15240)).toBe('15.240 m (~50.000 kaki)')
})

test('timestamps always render in WIB regardless of host timezone', () => {
  // 2026-09-06T00:10:00Z is 07:10 WIB.
  const formatted = formatWib('id', new Date('2026-09-06T00:10:00Z'))
  expect(formatted).toContain('07.10')
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
