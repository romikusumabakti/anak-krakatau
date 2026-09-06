import type { ZodType } from 'zod'
import { fail, ok, type Result } from './types'

const USER_AGENT =
  'anak-krakatau-dashboard/1.0 (public volcano status dashboard; contact via repository)'

export const REVALIDATE_SECONDS = 300

export async function fetchText(url: string): Promise<Result<string>> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip' },
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!response.ok) return fail('http', url)

    // Try to get the fetch time from the Date header
    let fetchedAt: Date | undefined
    const dateHeader = response.headers.get('date')
    if (dateHeader) {
      const parsedDate = new Date(dateHeader)
      // Only use if it's a valid Date (not NaN)
      if (!Number.isNaN(parsedDate.getTime())) {
        fetchedAt = parsedDate
      }
    }

    return ok(await response.text(), url, fetchedAt)
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    return fail(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'http', url)
  }
}

export async function fetchJson<T>(url: string, schema: ZodType<T>): Promise<Result<T>> {
  const text = await fetchText(url)
  if (!text.ok) return text
  try {
    const parsed = schema.safeParse(JSON.parse(text.data))
    if (!parsed.success) return fail('parse', url)
    return ok(parsed.data, url)
  } catch {
    return fail('parse', url)
  }
}
