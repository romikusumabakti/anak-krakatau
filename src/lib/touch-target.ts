/**
 * Expands a control's tappable area to the 44x44px the design spec requires,
 * without changing how large it looks.
 *
 * The header's icon buttons render at 32px, because 44px of visible chrome
 * crowds the site title at 360px. Shrinking the hit area to match would fail
 * the spec's minimum on the two controls a phone user reaches for first, so a
 * transparent centred pseudo-element carries the target instead.
 *
 * Controls using this must sit at least 12px apart. 32px of button plus a 12px
 * gap is exactly 44px, so the invisible areas tile rather than overlap -- and
 * overlapping ones would silently route a tap to the wrong control.
 */
export const TOUCH_TARGET =
  "relative after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
