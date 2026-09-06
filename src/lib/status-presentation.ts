import type { AviationColour } from '@/lib/sources/vona'

/**
 * `level` is the closed union `1 | 2 | 3 | 4`, never a bare `number`. Keying
 * these lookups by that union (rather than `Record<number, string>`) means
 * every branch is checked for completeness at compile time instead of
 * degrading to `string | undefined` under `noUncheckedIndexedAccess`.
 */
export const LEVEL_STYLES: Record<1 | 2 | 3 | 4, string> = {
  1: 'bg-emerald-600 text-white',
  2: 'bg-yellow-500 text-black',
  3: 'bg-amber-600 text-white',
  4: 'bg-red-700 text-white',
}

export const LEVEL_NUMERALS: Record<1 | 2 | 3 | 4, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
}

/**
 * Includes `unknown` so an unrecognised VONA colour code renders as a
 * distinct neutral state rather than silently falling back to a style that
 * implies a real severity.
 */
export const COLOUR_STYLES: Record<AviationColour, string> = {
  green: 'bg-emerald-600 text-white',
  yellow: 'bg-yellow-500 text-black',
  orange: 'bg-amber-600 text-white',
  red: 'bg-red-700 text-white',
  unknown: 'bg-gray-400 text-white',
}
