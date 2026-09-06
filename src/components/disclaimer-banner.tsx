import { Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ACTIVITY_URL } from '@/lib/urls'

/**
 * Rendered at the foot of the page rather than the head.
 *
 * The spec requires this on every page, and it still is -- but a reader who
 * never scrolls now never sees it, and its whole job is to stop this looking
 * like an official government source during an eruption. The sticky header's
 * alert badge partly compensates by linking MAGMA whenever our own data is
 * missing, and every card names and links its own source. Worth revisiting if
 * the page ever grows longer.
 */
export function DisclaimerBanner() {
  const t = useTranslations('disclaimer')
  return (
    <div
      role="note"
      className="mt-4 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 border-amber-500/30 border-t bg-amber-500/10 px-4 py-3 text-center text-xs sm:text-sm"
    >
      <Info aria-hidden="true" className="size-4 shrink-0" />
      <span>{t('text')} </span>
      <a
        className="font-medium underline underline-offset-2"
        href={ACTIVITY_URL}
        rel="noreferrer"
        target="_blank"
      >
        {t('link')}
      </a>
    </div>
  )
}
