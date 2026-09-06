import { expect, test } from 'bun:test'
import { MONTHS_ID, wibToDate } from '@/lib/sources/wib'

test('MONTHS_ID lists twelve lowercase Indonesian month names, january-first', () => {
  expect(MONTHS_ID).toHaveLength(12)
  expect(MONTHS_ID[0]).toBe('januari')
  expect(MONTHS_ID[8]).toBe('september')
  expect(MONTHS_ID[11]).toBe('desember')
})

test('maps a WIB wall-clock time to the correct UTC instant', () => {
  const date = wibToDate(2026, 8, 6, 7, 10)
  expect(date.toISOString()).toBe('2026-09-06T00:10:00.000Z')
})

test('rolls back to the previous UTC day for a WIB time before 07:00', () => {
  const date = wibToDate(2026, 8, 6, 3, 53)
  expect(date.toISOString()).toBe('2026-09-05T20:53:00.000Z')
})
