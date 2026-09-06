import { afterEach, expect, mock, test } from 'bun:test'
import { fetchText } from '@/lib/sources/http'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

test('returns ok with body text on 200', async () => {
  globalThis.fetch = mock(
    async () => new Response('hello', { status: 200 }),
  ) as unknown as typeof fetch
  const result = await fetchText('https://example.test/a')
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.data).toBe('hello')
})

test('returns http failure on non-200', async () => {
  globalThis.fetch = mock(
    async () => new Response('nope', { status: 403 }),
  ) as unknown as typeof fetch
  const result = await fetchText('https://example.test/b')
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe('http')
})

test('returns timeout failure when the request aborts', async () => {
  globalThis.fetch = mock(async () => {
    throw new DOMException('The operation was aborted.', 'TimeoutError')
  }) as unknown as typeof fetch
  const result = await fetchText('https://example.test/c')
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe('timeout')
})

test('always reports the source url it was given', async () => {
  globalThis.fetch = mock(async () => new Response('x', { status: 500 })) as unknown as typeof fetch
  const result = await fetchText('https://example.test/d')
  expect(result.sourceUrl).toBe('https://example.test/d')
})
