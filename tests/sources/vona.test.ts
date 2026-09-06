import { expect, test } from 'bun:test'
import { parseVona } from '@/lib/sources/vona'

const fixture = await Bun.file('tests/fixtures/vona-kra.html').text()

test('parses every notice in the list', () => {
  const notices = parseVona(fixture)
  expect(notices.length).toBeGreaterThan(5)
})

test('reads timestamp, colour, and notice code', () => {
  const [latest] = parseVona(fixture)
  expect(latest).toBeDefined()
  if (!latest) return
  expect(latest.issuedAt.getTime()).not.toBeNaN()
  expect(['green', 'yellow', 'orange', 'red']).toContain(latest.colour)
  expect(latest.noticeCode).toMatch(/^\d{8}\/\d{4}Z$/)
})

test('extracts ash-cloud height in both feet and metres', () => {
  const notice = parseVona(fixture).find((n) => n.ashTopFtAsl !== null)
  expect(notice).toBeDefined()
  if (!notice) return
  expect(notice.ashTopFtAsl).toBeGreaterThan(0)
  expect(notice.ashTopMAsl).toBeGreaterThan(0)
  expect(notice.ashAboveSummitFt).toBeGreaterThan(0)
  expect(notice.ashAboveSummitM).toBeGreaterThan(0)
})

test('extracts the movement phrase for every notice that states one', () => {
  const notices = parseVona(fixture)
  const withMovementText = notices.filter((n) => n.summary.includes('Ash cloud moving'))
  const withMovementLabel = notices.filter((n) => n.movementLabel !== null)
  expect(withMovementText.length).toBeGreaterThan(0)
  expect(withMovementLabel.length).toBe(withMovementText.length)
  for (const notice of withMovementText) {
    expect(notice.movementLabel).toBeTruthy()
  }
})

test('extracts the bare "moving to X" form without a "from"', () => {
  const html = `
    <div class="timeline-item">
      <div class="timeline-time"><small>2026-09-05 02:00:00 UTC</small>
        <a href="#" class="btn btn-sm btn-danger">Red</a></div>
      <div class="timeline-body">
        <p class="timeline-title"><a href="#">Anak Krakatau - 20260905/0200Z</a></p>
        <p class="timeline-text">Eruption with volcanic ash cloud at 0200 UTC (0900 local). Ash cloud moving to northwest.</p>
        <a class="card-link m-b-10" href="https://magma.esdm.go.id/v1/vona/22575?signature=abc">View</a>
      </div>
    </div>`
  const [notice] = parseVona(html)
  expect(notice?.movementLabel).toBe('northwest')
})

test('"ash-cloud is not observed" yields null heights, not zero', () => {
  const html = `
    <div class="timeline-item">
      <div class="timeline-time"><small>2026-09-05 02:00:00 UTC</small>
        <a href="#" class="btn btn-sm btn-danger">Red</a></div>
      <div class="timeline-body">
        <p class="timeline-title"><a href="#">Anak Krakatau - 20260905/0200Z</a></p>
        <p class="timeline-text">Eruption at 0200 UTC (0900 local). Ash-cloud is not observed.</p>
        <a class="card-link m-b-10" href="https://magma.esdm.go.id/v1/vona/22575?signature=abc">View</a>
      </div>
    </div>`
  const [notice] = parseVona(html)
  expect(notice?.ashTopFtAsl).toBeNull()
  expect(notice?.ashAboveSummitM).toBeNull()
  expect(notice?.movementLabel).toBeNull()
  expect(notice?.colour).toBe('red')
})

test('an unrecognised colour text yields "unknown", not an invented severity', () => {
  const html = `
    <div class="timeline-item">
      <div class="timeline-time"><small>2026-09-05 02:00:00 UTC</small>
        <a href="#" class="btn btn-sm btn-danger">Merah</a></div>
      <div class="timeline-body">
        <p class="timeline-title"><a href="#">Anak Krakatau - 20260905/0200Z</a></p>
        <p class="timeline-text">Eruption at 0200 UTC (0900 local). Ash-cloud is not observed.</p>
        <a class="card-link m-b-10" href="https://magma.esdm.go.id/v1/vona/22575?signature=abc">View</a>
      </div>
    </div>`
  const [notice] = parseVona(html)
  expect(notice?.colour).toBe('unknown')
})

test('a height with no "above summit" clause leaves summit fields null', () => {
  const html = `
    <div class="timeline-item">
      <div class="timeline-time"><small>2026-09-05 02:00:00 UTC</small>
        <a href="#" class="btn btn-sm btn-danger">Red</a></div>
      <div class="timeline-body">
        <p class="timeline-title"><a href="#">Anak Krakatau - 20260905/0200Z</a></p>
        <p class="timeline-text">Best estimate of ash-cloud top is around 1782 FT (557 M) above sea level.</p>
        <a class="card-link m-b-10" href="https://magma.esdm.go.id/v1/vona/22575?signature=abc">View</a>
      </div>
    </div>`
  const [notice] = parseVona(html)
  expect(notice?.ashTopFtAsl).toBe(1782)
  expect(notice?.ashTopMAsl).toBe(557)
  expect(notice?.ashAboveSummitFt).toBeNull()
  expect(notice?.ashAboveSummitM).toBeNull()
})

test('returns an empty array for markup with no notices', () => {
  expect(parseVona('<html><body><p>nothing here</p></body></html>')).toEqual([])
})

test('returns an empty array for an empty document', () => {
  expect(parseVona('')).toEqual([])
})
