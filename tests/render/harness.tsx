import { mock } from 'bun:test'
import { createTranslator } from 'next-intl'
import type { ReactElement } from 'react'
import { renderToReadableStream } from 'react-dom/server'
import en from '../../messages/en.json'
import id from '../../messages/id.json'

/**
 * Render harness for the server components.
 *
 * Every finding that reached the final review gate lived in JSX, because
 * nothing in this repo ever rendered a component. These helpers make that
 * cheap without adding Playwright: real components, real message
 * catalogues, real adapters -- only `fetch` and next-intl's request-scoped
 * translator are substituted.
 *
 * MAGMA is never contacted. `stubFetch` serves the committed fixtures in
 * tests/fixtures/ (MAGMA has been intermittently 502-ing, and hammering a
 * government server from a test suite would be indefensible anyway).
 */

const MESSAGES = { en, id } as const
export type TestLocale = keyof typeof MESSAGES

let activeLocale: TestLocale = 'en'

/** next-intl's server translator is request-scoped and needs the Next.js
 * runtime. `createTranslator` is the same library's runtime-free entry
 * point over the same catalogues, so the copy under test is the real
 * shipped copy, not a fake. */
mock.module('next-intl/server', () => ({
  getTranslations: async (arg: string | { locale?: string; namespace?: string }) => {
    const namespace = typeof arg === 'string' ? arg : arg?.namespace
    return createTranslator({
      locale: activeLocale,
      messages: MESSAGES[activeLocale],
      namespace,
      timeZone: 'Asia/Jakarta',
      // biome-ignore lint/suspicious/noExplicitAny: the namespace is chosen at runtime per component
    } as any)
  },
}))

export function setLocale(locale: TestLocale) {
  activeLocale = locale
}

export const FIXTURES = {
  sigmet: await Bun.file('tests/fixtures/isigmet.json').text(),
  activity: await Bun.file('tests/fixtures/tingkat-aktivitas.html').text(),
  report: await Bun.file('tests/fixtures/laporan.html').text(),
  vona: await Bun.file('tests/fixtures/vona-kra.html').text(),
  eruptions: await Bun.file('tests/fixtures/informasi-letusan-kra.html').text(),
}

/** One VONA notice, wrapped in the markup parseVona expects. */
export function vonaDocument(summary: string, colour = 'Red'): string {
  return `
    <div class="timeline-item">
      <div class="timeline-time"><small>2026-09-05 02:00:00 UTC</small>
        <a href="#" class="btn btn-sm btn-danger">${colour}</a></div>
      <div class="timeline-body">
        <p class="timeline-title"><a href="#">Anak Krakatau - 20260905/0200Z</a></p>
        <p class="timeline-text">${summary}</p>
        <a class="card-link m-b-10" href="https://magma.esdm.go.id/v1/vona/22575?signature=abc">View</a>
      </div>
    </div>`
}

/**
 * One volcanic-ash SIGMET, valid from an hour ago until an hour from now.
 *
 * The committed fixture's validity windows closed in September 2026, and the
 * adapter drops expired SIGMETs on purpose, so a render test that wants a
 * drawn polygon has to supply one that is currently in force.
 */
export function sigmetDocument(
  overrides: Partial<{
    firName: string
    top: number
    dir: string
    spd: string
    rawSigmet: string
  }> = {},
): string {
  const now = Math.floor(Date.now() / 1000)
  return JSON.stringify([
    {
      hazard: 'VA',
      qualifier: 'KRAKATAU',
      firName: overrides.firName ?? 'WIIF JAKARTA',
      validTimeFrom: now - 3600,
      validTimeTo: now + 3600,
      base: 0,
      top: overrides.top ?? 15000,
      dir: overrides.dir ?? 'SE',
      spd: overrides.spd ?? '05',
      rawSigmet: overrides.rawSigmet ?? 'WIIF JAKARTA FIR VA ERUPTION MT KRAKATAU INTSF=',
      coords: [
        { lon: 105.05, lat: -3.333 },
        { lon: 109.45, lat: -6.217 },
        { lon: 106.317, lat: -11.183 },
        { lon: 98.383, lat: -5.85 },
        { lon: 98.017, lat: -3.067 },
        { lon: 105.05, lat: -3.333 },
      ],
    },
  ])
}

type Route = { body: string; status?: number; date?: Date }
type RouteKey = 'activity' | 'report' | 'vona' | 'eruptions' | 'sigmet'

const realFetch = globalThis.fetch

/** Routes by URL shape. A route set to `null` fails with a 503, which is
 * how the "source unavailable" states are exercised. */
export function stubFetch(routes: Partial<Record<RouteKey, Route | null>>) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    const key: RouteKey = url.includes('tingkat-aktivitas')
      ? 'activity'
      : url.includes('/vona')
        ? 'vona'
        : url.includes('informasi-letusan')
          ? 'eruptions'
          : url.includes('aviationweather')
            ? 'sigmet'
            : 'report'
    const route = routes[key]
    if (!route) return new Response('unavailable', { status: 503 })
    return new Response(route.body, {
      status: route.status ?? 200,
      headers: route.date ? { date: route.date.toUTCString() } : {},
    })
  }) as unknown as typeof fetch
}

export function restoreFetch() {
  globalThis.fetch = realFetch
  setLocale('en')
}

/**
 * Renders a (possibly async) server component to HTML. React comment
 * separators are stripped so assertions can match the sentence a reader
 * actually sees rather than `Ash cloud<!-- --> not observed`.
 */
export async function render(node: ReactElement): Promise<string> {
  const stream = await renderToReadableStream(node)
  await stream.allReady
  const html = await new Response(stream).text()
  return html.replace(/<!--.*?-->/g, '')
}

/** `minutes` ago, so relative-time assertions are deterministic without
 * faking the clock. */
export function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000)
}
