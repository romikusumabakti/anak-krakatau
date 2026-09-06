import { ExternalLink } from 'lucide-react'
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
      <a
        className="inline-flex items-center gap-1 underline underline-offset-2"
        href={url}
        rel="noreferrer"
        target="_blank"
      >
        {label}
        <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
      </a>{' '}
      · {t('updated', { time: formatRelative(locale, fetchedAt) })}
    </p>
  )
}
