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

/**
 * A MAGMA report covers a six-hour shift ("periode 00:00-06:00 WIB"), not
 * an instant, so it is rendered as a range. Both ends are formatted in
 * Asia/Jakarta like every other time on the page. When the window crosses
 * WIB midnight the date is repeated on both ends rather than silently
 * attributing both times to one day.
 */
export function formatWibRange(locale: Locale, start: Date, end: Date): string {
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
  })
  const clock = new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const startDay = day.format(start)
  const endDay = day.format(end)
  return startDay === endDay
    ? `${startDay}, ${clock.format(start)}\u2013${clock.format(end)} WIB`
    : `${startDay} ${clock.format(start)} \u2013 ${endDay} ${clock.format(end)} WIB`
}

export function formatRelative(locale: Locale, from: Date, now: Date = new Date()): string {
  const seconds = Math.round((from.getTime() - now.getTime()) / 1000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const absSeconds = Math.abs(seconds)

  // Ensure the displayed number never reaches the ratio for the next unit.
  // For example, 3599 seconds should display as "1 hour ago", never "60 minutes ago".
  if (absSeconds < 60) {
    return formatter.format(seconds, 'second')
  }

  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, 'minute')
  }

  const hours = Math.round(seconds / 3600)
  if (Math.abs(hours) < 24) {
    return formatter.format(hours, 'hour')
  }

  const days = Math.round(seconds / 86400)
  return formatter.format(days, 'day')
}
