import { afterEach, expect, test } from 'bun:test'
import { CoastalCard } from '@/components/coastal-card'
import { BMKG_URL } from '@/lib/urls'
import { render, restoreFetch, setLocale } from './harness'

afterEach(restoreFetch)

/**
 * This card exists because every other card on the dashboard answers "ash is
 * falling on me", and none answered "I am on the coast and the volcano just
 * did something big". Anak Krakatau's 2018 flank collapse killed 437 people
 * on exactly the coastlines this dashboard serves.
 *
 * The assertions below pin the two things that make it worth having: that it
 * needs no network, and that it never implies we are watching for a tsunami.
 */

test('renders with no network at all — it must survive every source being down', async () => {
  // No fetch stub is installed. Any network call would throw here rather than
  // fall back to a fixture, which is the point: this card holds the guidance a
  // reader still gets when MAGMA is unreachable.
  const html = await render(await CoastalCard())
  expect(html).toContain('If you are on the coast')
  expect(html).toContain('437')
  expect(html).toContain(BMKG_URL)
})

test('tells the reader not to wait for an earthquake they will never feel', async () => {
  const html = await render(await CoastalCard())
  // The 2018 collapse produced no strong shaking, so the usual cue was absent
  // and no alert was issued. A card that omitted this would leave a reader
  // waiting for a signal that is not coming.
  expect(html).toContain('without a felt earthquake')
  expect(html).toContain('Do not wait to feel an earthquake')
})

test('disclaims monitoring rather than implying a tsunami watch', async () => {
  const html = await render(await CoastalCard())
  expect(html).toContain('does not monitor tsunami risk')
  expect(html).toContain('BMKG')
})

test('renders the Indonesian copy for the Indonesian route', async () => {
  setLocale('id')
  const html = await render(await CoastalCard())
  expect(html).toContain('Jika Anda berada di pesisir')
  expect(html).toContain('Jangan menunggu merasakan gempa')
  expect(html).toContain('tidak memantau risiko tsunami')
  // Half this audience reads only Indonesian; English leaking through would
  // strand them on the one card written for the deadliest hazard here.
  expect(html).not.toContain('If you are on the coast')
})
