import { useTranslations } from 'next-intl'

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
        href="https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas"
        rel="noreferrer"
        target="_blank"
      >
        {t('link')}
      </a>
    </div>
  )
}
