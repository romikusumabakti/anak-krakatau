import { expect, test } from 'bun:test'
import { parse } from 'node-html-parser'
import { parseEruptions } from '@/lib/sources/eruptions'

const fixture = await Bun.file('tests/fixtures/informasi-letusan-kra.html').text()

test('parses eruption events from the timeline', () => {
  // A loose floor like ">3" would still pass if the parser silently dropped
  // real timeline items (as happened in Task 4). Instead, count independently
  // how many timeline-item blocks in the fixture actually carry a narrative
  // and assert every one of them produced an event.
  const narrativeCount = parse(fixture)
    .querySelectorAll('.timeline-item')
    .filter((item) => item.querySelector('.timeline-text')?.text.trim()).length
  expect(narrativeCount).toBeGreaterThan(3)
  expect(parseEruptions(fixture).length).toBe(narrativeCount)
})

test('reads the WIB timestamp out of the Indonesian narrative', () => {
  const html = `
    <div class="timeline-item"><div class="timeline-body">
      <p class="timeline-text">Terjadi erupsi G. Anak Krakatau pada hari Minggu,
      06 September 2026, pukul 07:10 WIB. Visual letusan tidak teramati. Erupsi ini
      terekam di seismograf dengan amplitudo maksimum 50 mm dan durasi 16 detik.</p>
    </div></div>`
  const [event] = parseEruptions(html)
  // 07:10 WIB is 00:10 UTC on the same day.
  expect(event?.occurredAt.toISOString()).toBe('2026-09-06T00:10:00.000Z')
  expect(event?.seismicAmplitudeMm).toBe(50)
  expect(event?.durationSeconds).toBe(16)
  expect(event?.ongoing).toBe(false)
})

test('flags an eruption that was still ongoing at report time', () => {
  const html = `
    <div class="timeline-item"><div class="timeline-body">
      <p class="timeline-text">Terjadi erupsi G. Anak Krakatau pada hari Jumat,
      04 September 2026, pukul 23:07 WIB. Visual letusan tidak teramati. Saat
      laporan ini dibuat, erupsi masih berlangsung.</p>
    </div></div>`
  const [event] = parseEruptions(html)
  expect(event?.ongoing).toBe(true)
  expect(event?.seismicAmplitudeMm).toBeNull()
  expect(event?.durationSeconds).toBeNull()
})

test('sorts newest first', () => {
  const events = parseEruptions(fixture)
  const times = events.map((e) => e.occurredAt.getTime())
  expect([...times].sort((a, b) => b - a)).toEqual(times)
})

test('returns an empty array for an empty document', () => {
  expect(parseEruptions('')).toEqual([])
})

test('skips timeline items whose narrative has no parsable date', () => {
  const html =
    '<div class="timeline-item"><div class="timeline-body"><p class="timeline-text">tidak ada tanggal</p></div></div>'
  expect(parseEruptions(html)).toEqual([])
})
