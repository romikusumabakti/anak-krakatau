import { getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { getStatus } from '@/lib/sources/status'
import { COLOUR_STYLES, LEVEL_NUMERALS, LEVEL_STYLES } from '@/lib/status-presentation'
import { ACTIVITY_URL } from '@/lib/urls'

/**
 * Compact echo of the status card's alert level, mounted in the sticky
 * header so the most important number on the page stays visible once the
 * user scrolls past the card. Reads the same `getStatus()` call the card
 * reads; wrapping `getStatus` in React's `cache()` (src/lib/sources/status.ts)
 * means this costs no extra upstream request even though it's a second
 * call site in the same render.
 *
 * On fetch failure this still renders a badge -- an empty header slot is
 * an unmarked blank on the one element specifically built to persist
 * through scrolling, which the "never show a blank without a marker"
 * constraint rules out. The failure copy is its own catalogue key: it
 * previously reused `status.aviationColourUnknown` ("Unrecognised" /
 * "Tidak dikenali"), which an Indonesian reader parses as a claim about
 * the volcano's classification rather than about our connection to MAGMA.
 * The badge is also a link, so the header keeps working as an escape
 * hatch to the official page exactly when our own data is missing.
 */
export async function HeaderStatusBadge() {
  const status = await getStatus()
  const t = await getTranslations('status')

  if (!status.ok) {
    return (
      <a
        aria-label={t('unavailableLink')}
        className="shrink-0"
        href={ACTIVITY_URL}
        rel="noreferrer"
        target="_blank"
      >
        <Badge className={`${COLOUR_STYLES.unknown} shrink-0 gap-1`}>
          <span aria-hidden="true">?</span>
          <span>{t('unavailable')}</span>
        </Badge>
      </a>
    )
  }

  return (
    <Badge className={`${LEVEL_STYLES[status.data.level]} shrink-0 gap-1`}>
      <span aria-hidden="true">{LEVEL_NUMERALS[status.data.level]}</span>
      <span>{t(`levels.${status.data.level}`)}</span>
    </Badge>
  )
}
