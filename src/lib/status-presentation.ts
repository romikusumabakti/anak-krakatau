import type { AviationColour } from '@/lib/sources/vona'

/**
 * `level` is the closed union `1 | 2 | 3 | 4`, never a bare `number`. Keying
 * these lookups by that union (rather than `Record<number, string>`) means
 * every branch is checked for completeness at compile time instead of
 * degrading to `string | undefined` under `noUncheckedIndexedAccess`.
 *
 * Colours are verified for >=4.5:1 contrast against their text at the
 * exact oklch values Tailwind v4 resolves in this repo (see
 * node_modules/tailwindcss/theme.css), not just the named-colour hex
 * approximation. emerald-600 (3.67:1), amber-600 (3.19:1), and gray-400
 * (2.60:1) all failed; the -700/-600 steps used here pass (5.37, 5.05,
 * 7.56 respectively). Badge text is text-xs, below the large-text
 * threshold that would relax the bar to 3:1.
 */
export const LEVEL_STYLES: Record<1 | 2 | 3 | 4, string> = {
  1: 'bg-emerald-700 text-white',
  2: 'bg-yellow-500 text-black',
  3: 'bg-amber-700 text-white',
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
  green: 'bg-emerald-700 text-white',
  yellow: 'bg-yellow-500 text-black',
  orange: 'bg-amber-700 text-white',
  red: 'bg-red-700 text-white',
  unknown: 'bg-gray-600 text-white',
}
