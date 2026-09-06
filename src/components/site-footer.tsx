// lucide v1 dropped brand icons, so a generic source-code mark rather than
// a GitHub logo.
import { Code } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { REPOSITORY_URL } from '@/lib/urls'

/**
 * Attribution, kept separate from and below the disclaimer banner.
 *
 * The banner's only job is to stop this looking like an official government
 * source during an eruption. Folding a credit line into it would dilute that
 * for the sake of a byline, so this sits underneath in a quieter register.
 *
 * The repository link is not decoration: this dashboard scrapes government
 * pages and presents derived figures, and the source is where a reader can
 * check how any of them were arrived at.
 */
export async function SiteFooter() {
  const t = await getTranslations('footer')

  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pt-3 pb-6 text-center text-muted-foreground text-xs">
      <span>{t('copyright')}</span>
      <a
        className="inline-flex items-center gap-1 underline underline-offset-2"
        href={REPOSITORY_URL}
        rel="noreferrer"
        target="_blank"
      >
        <Code aria-hidden="true" className="size-3.5 shrink-0" />
        {t('repository')}
      </a>
    </footer>
  )
}
