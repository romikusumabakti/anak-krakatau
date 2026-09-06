export type Locale = 'en' | 'id'

export const TIME_ZONE = 'Asia/Jakarta'

const number = (locale: Locale, value: number): string =>
  new Intl.NumberFormat(locale).format(value)

/**
 * Aviation reports ash height in feet; the Indonesian public reads metres.
 * Both units are always shown, ordered by what the reader expects first.
 */
export function formatAshHeight(locale: Locale, feet: number, metres: number): string {
  return locale === 'id'
    ? `${number('id', metres)} m (~${number('id', feet)} kaki)`
    : `${number('en', feet)} ft (~${number('en', metres)} m)`
}

export function formatWib(locale: Locale, date: Date): string {
  const formatted = new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return `${formatted} WIB`
}

export function formatRelative(locale: Locale, from: Date, now: Date = new Date()): string {
  const seconds = Math.round((from.getTime() - now.getTime()) / 1000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit)
  }
  return formatter.format(seconds, 'second')
}
