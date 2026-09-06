import { afterEach, expect, test } from 'bun:test'
import { ACTIVITY_URL } from '@/lib/urls'
import { FIXTURES, render, restoreFetch, setLocale, stubFetch } from './harness'

afterEach(restoreFetch)

const ok = (body: string) => ({ body })

async function badge(locale: 'en' | 'id' = 'en') {
  setLocale(locale)
  const { HeaderStatusBadge } = await import('@/components/header-status-badge')
  return render(<HeaderStatusBadge />)
}

test('an outage is described as an outage, not as an unrecognised volcano state', async () => {
  stubFetch({ activity: null })
  const html = await badge()
  expect(html).toContain('Status unavailable')
  expect(html).not.toContain('Unrecognised')
  expect(html).toContain(`href="${ACTIVITY_URL}"`)
})

test('the Indonesian outage badge does not read as a claim about the volcano', async () => {
  // "Tidak dikenali" parses as "the volcano's classification is not
  // recognised", which is a statement about the mountain, not our network.
  stubFetch({ activity: null })
  const html = await badge('id')
  expect(html).toContain('Status tidak tersedia')
  expect(html).not.toContain('Tidak dikenali')
  expect(html).toContain('aria-label="Status tidak tersedia — buka MAGMA Indonesia"')
})

test('the header level badge carries a numeral and a word, not only a colour', async () => {
  stubFetch({ activity: ok(FIXTURES.activity), report: ok(FIXTURES.report) })
  const html = await badge()
  expect(html).toContain('>III<')
  expect(html).toContain('>Alert<')
})
