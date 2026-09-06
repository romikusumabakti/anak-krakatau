import { useTranslations } from 'next-intl'
import { ACTIVITY_URL } from '@/lib/sources/status'

export function DisclaimerBanner() {
  const t = useTranslations('disclaimer')
  return (
    <div
      role="note"
      className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs sm:text-sm"
    >
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
