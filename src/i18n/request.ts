import { notFound } from 'next/navigation'
import * as rootParams from 'next/root-params'
import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ locale }) => {
  let active = locale
  if (!active) {
    const fromParams = await rootParams.locale()
    if (!hasLocale(routing.locales, fromParams)) notFound()
    active = fromParams
  }
  return {
    locale: active,
    messages: (await import(`../../messages/${active}.json`)).default,
    timeZone: 'Asia/Jakarta',
  }
})
