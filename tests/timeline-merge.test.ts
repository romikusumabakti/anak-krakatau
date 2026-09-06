import { expect, test } from 'bun:test'
import { mergeTimeline, timelineKey } from '@/lib/merge-timeline'
import type { EruptionEvent } from '@/lib/sources/eruptions'
import type { VonaNotice } from '@/lib/sources/vona'

const eruption = (iso: string, ongoing = false, narrative?: string): EruptionEvent => ({
  occurredAt: new Date(iso),
  narrative: narrative ?? `eruption at ${iso}`,
  ongoing,
  seismicAmplitudeMm: null,
  durationSeconds: null,
})

const notice = (iso: string, summary?: string): VonaNotice => ({
  issuedAt: new Date(iso),
  noticeCode: '20260905/0200Z',
  colour: 'red',
  summary: summary ?? `notice at ${iso}`,
  ashTopFtAsl: null,
  ashTopMAsl: null,
  ashAboveSummitFt: null,
  ashAboveSummitM: null,
  movementLabel: null,
  detailUrl: 'https://example.test/n',
})

test('interleaves both kinds newest first', () => {
  const merged = mergeTimeline(
    [eruption('2026-09-06T00:10:00Z'), eruption('2026-09-04T16:07:00Z')],
    [notice('2026-09-05T02:00:00Z')],
  )
  expect(merged.map((e) => e.kind)).toEqual(['eruption', 'vona', 'eruption'])
})

test('does not drop either feed when interleaving', () => {
  // A merge that concatenated eruptions with itself, or read the wrong
  // parameter for one side, could still land the right *count* by luck on
  // the test above's small fixture. Assert both kinds are represented and
  // that the total equals the sum of the inputs.
  const eruptions = [
    eruption('2026-09-06T00:10:00Z'),
    eruption('2026-09-05T12:00:00Z'),
    eruption('2026-09-04T16:07:00Z'),
  ]
  const notices = [
    notice('2026-09-05T20:00:00Z'),
    notice('2026-09-05T02:00:00Z'),
    notice('2026-09-04T10:00:00Z'),
  ]
  const merged = mergeTimeline(eruptions, notices)
  expect(merged.length).toBe(eruptions.length + notices.length)
  expect(merged.filter((e) => e.kind === 'eruption').length).toBe(eruptions.length)
  expect(merged.filter((e) => e.kind === 'vona').length).toBe(notices.length)
  expect(merged.map((e) => e.at.toISOString())).toEqual(
    [...merged].sort((a, b) => b.at.getTime() - a.at.getTime()).map((e) => e.at.toISOString()),
  )
})

test('carries the ongoing flag through from eruptions', () => {
  const [entry] = mergeTimeline([eruption('2026-09-06T00:10:00Z', true)], [])
  expect(entry?.ongoing).toBe(true)
})

test('caps the list at twenty entries, keeping the newest ones', () => {
  const many = Array.from({ length: 40 }, (_, i) =>
    eruption(new Date(Date.UTC(2026, 8, 1, i)).toISOString(), false, `entry-${i}`),
  )
  const merged = mergeTimeline(many, [])
  expect(merged.length).toBe(20)
  // The 40 inputs run hour 0 (oldest) through hour 39 (newest). Keeping the
  // newest 20 means indices 20-39 survive and 0-19 are dropped. A merge that
  // sliced *before* sorting (or sorted ascending) would still return exactly
  // 20 items -- passing a length-only assertion -- but the wrong 20.
  const kept = new Set(merged.map((e) => e.text))
  expect(kept.has('entry-39')).toBe(true)
  expect(kept.has('entry-20')).toBe(true)
  expect(kept.has('entry-19')).toBe(false)
  expect(kept.has('entry-0')).toBe(false)
})

test('handles both sides being empty', () => {
  expect(mergeTimeline([], [])).toEqual([])
})

test('timelineKey stays unique for same-kind entries sharing a timestamp', () => {
  // MAGMA has issued multiple VONA notices within the same minute during
  // this eruption, so `kind + at` alone is not a safe React key.
  const merged = mergeTimeline(
    [],
    [
      notice('2026-09-05T02:00:00Z', 'Ash cloud moving to the northwest.'),
      notice('2026-09-05T02:00:00Z', 'Ash cloud moving to the southeast.'),
    ],
  )
  expect(merged.length).toBe(2)
  const keys = merged.map(timelineKey)
  expect(new Set(keys).size).toBe(2)
})
