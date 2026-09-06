import { Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ACTIVITY_URL } from '@/lib/urls'

export function DisclaimerBanner() {
  const t = useTranslations('disclaimer')
  return (
    <div
      role="note"
      className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 border-amber-500/30 border-b bg-amber-500/10 px-4 py-2 text-center text-xs sm:text-sm"
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
