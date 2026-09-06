import { afterEach, expect, test } from 'bun:test'
import { FIXTURES, render, restoreFetch, setLocale, stubFetch } from './harness'

afterEach(restoreFetch)

const ok = (body: string) => ({ body })

async function timeline(locale: 'en' | 'id' = 'en') {
  setLocale(locale)
  const { ActivityTimeline } = await import('@/components/activity-timeline')
  return render(<ActivityTimeline locale={locale} />)
}

test('the ongoing flag is reported as what the report said, not as a live claim', async () => {
  // `ongoing` is parsed from "erupsi masih berlangsung" inside one past
  // report. Present tense stamps "Still ongoing" on eruptions that ended
  // days ago -- the committed fixture alone produces three of them.
  stubFetch({ eruptions: ok(FIXTURES.eruptions), vona: ok(FIXTURES.vona) })
  const html = await timeline()
  expect(html).toContain('Ongoing at time of report')
  expect(html).not.toContain('>Still ongoing<')
})

test('the Indonesian ongoing badge is past tense too', async () => {
  stubFetch({ eruptions: ok(FIXTURES.eruptions), vona: ok(FIXTURES.vona) })
  const html = await timeline('id')
  expect(html).toContain('Masih berlangsung saat laporan dibuat')
  expect(html).not.toContain('>Masih berlangsung<')
})

test('both feeds down renders an outage with links, never "No recent events."', async () => {
  stubFetch({ eruptions: null, vona: null })
  const html = await timeline()
  expect(html).not.toContain('No recent events.')
  expect(html).toContain('Source unavailable')
  expect(html).toContain('href="https://magma.esdm.go.id/v1/gunung-api/informasi-letusan/KRA"')
  expect(html).toContain('href="https://magma.esdm.go.id/v1/vona?code=KRA"')
})
