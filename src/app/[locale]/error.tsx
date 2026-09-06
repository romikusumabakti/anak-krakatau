'use client'

import { useTranslations } from 'next-intl'
// Imported from '@/lib/urls', not '@/lib/sources/status': that module pulls
// in the HTML parser used for server-side scraping, which has no business
// in a client error-boundary bundle. lib/urls.ts holds the bare constants
// with no dependencies, so one definition serves both sides.
import { ACTIVITY_URL } from '@/lib/urls'

export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('error')

  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="font-semibold text-lg">{t('heading')}</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        {t('body')}{' '}
        <a
          className="underline underline-offset-2"
          href={ACTIVITY_URL}
          rel="noreferrer"
          target="_blank"
        >
          {t('linkLabel')}
        </a>
        .
      </p>
      <button className="mt-4 text-sm underline underline-offset-2" onClick={reset} type="button">
        {t('retry')}
      </button>
    </main>
  )
}
