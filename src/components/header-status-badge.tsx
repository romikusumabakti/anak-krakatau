import { getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { getStatus } from '@/lib/sources/status'
import { LEVEL_NUMERALS, LEVEL_STYLES } from '@/lib/status-presentation'

/**
 * Compact echo of the status card's alert level, mounted in the sticky
 * header so the most important number on the page stays visible once the
 * user scrolls past the card. Reads the same `getStatus()` call the card
 * reads; Next's fetch cache (revalidate: 300) plus React's per-render
 * request dedupe mean this costs no extra upstream request.
 *
 * On fetch failure this renders nothing rather than an error — the status
 * card underneath is the authoritative place for the "source unavailable"
 * message and the link to the original report.
 */
export async function HeaderStatusBadge() {
  const status = await getStatus()
  if (!status.ok) return null

  const t = await getTranslations('status')

  return (
    <Badge className={`${LEVEL_STYLES[status.data.level]} shrink-0 gap-1`}>
      <span aria-hidden="true">{LEVEL_NUMERALS[status.data.level]}</span>
      <span>{t(`levels.${status.data.level}`)}</span>
    </Badge>
  )
}
