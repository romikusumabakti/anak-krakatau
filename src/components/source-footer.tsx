import { getTranslations } from 'next-intl/server'
import type { Locale } from '@/lib/format'
import { formatRelative } from '@/lib/format'

export async function SourceFooter({
  locale,
  label,
  url,
  fetchedAt,
}: {
  locale: Locale
  label: string
  url: string
  fetchedAt: Date
}) {
  const t = await getTranslations('source')
  return (
    <p className="text-muted-foreground mt-4 text-xs">
      {t('label')}:{' '}
      <a className="underline underline-offset-2" href={url} rel="noreferrer" target="_blank">
        {label}
      </a>{' '}
      · {t('updated', { time: formatRelative(locale, fetchedAt) })}
    </p>
  )
}
