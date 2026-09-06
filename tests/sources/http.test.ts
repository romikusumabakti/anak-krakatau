import { afterEach, expect, mock, test } from 'bun:test'
import { z } from 'zod'
import { fetchJson, fetchText } from '@/lib/sources/http'

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

test('uses Date header from response when present', async () => {
  const expectedDate = new Date('2026-09-06T12:00:00Z')
  globalThis.fetch = mock(
    async () =>
      new Response('hello', {
        status: 200,
        headers: { date: expectedDate.toUTCString() },
      }),
  ) as unknown as typeof fetch
  const result = await fetchText('https://example.test/e')
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.fetchedAt.getTime()).toBe(expectedDate.getTime())
  }
})

test('falls back to current time when Date header is missing', async () => {
  globalThis.fetch = mock(
    async () => new Response('hello', { status: 200 }),
  ) as unknown as typeof fetch
  const result = await fetchText('https://example.test/f')
  expect(result.ok).toBe(true)
  if (result.ok) {
    // Verify fetchedAt is a valid Date with a recent timestamp
    expect(Number.isNaN(result.fetchedAt.getTime())).toBe(false)
    expect(result.fetchedAt.getTime()).toBeGreaterThan(Date.now() - 1000)
    expect(result.fetchedAt.getTime()).toBeLessThanOrEqual(Date.now())
  }
})

test('falls back to current time when Date header is unparseable', async () => {
  globalThis.fetch = mock(
    async () =>
      new Response('hello', {
        status: 200,
        headers: { date: 'not-a-date' },
      }),
  ) as unknown as typeof fetch
  const result = await fetchText('https://example.test/g')
  expect(result.ok).toBe(true)
  if (result.ok) {
    // Verify fetchedAt is a valid Date with a recent timestamp
    expect(Number.isNaN(result.fetchedAt.getTime())).toBe(false)
    expect(result.fetchedAt.getTime()).toBeGreaterThan(Date.now() - 1000)
    expect(result.fetchedAt.getTime()).toBeLessThanOrEqual(Date.now())
  }
})

test('fetchJson preserves Date header from response', async () => {
  const expectedDate = new Date('2026-09-06T14:30:00Z')
  const schema = z.object({ message: z.string() })
  globalThis.fetch = mock(
    async () =>
      new Response(JSON.stringify({ message: 'test' }), {
        status: 200,
        headers: { date: expectedDate.toUTCString() },
      }),
  ) as unknown as typeof fetch
  const result = await fetchJson('https://example.test/h', schema)
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.data.message).toBe('test')
    expect(result.fetchedAt.getTime()).toBe(expectedDate.getTime())
  }
})
