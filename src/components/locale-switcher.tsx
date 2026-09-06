'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

export function LocaleSwitcher() {
  const pathname = usePathname()
  const active = useLocale()
  const t = useTranslations('locale')

  return (
    <nav aria-label={t('label')} className="flex items-center gap-1 text-sm">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          aria-current={locale === active ? 'true' : undefined}
          className={
            locale === active
              ? 'flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 font-medium underline underline-offset-4'
              : 'flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-muted-foreground hover:text-foreground'
          }
        >
          {locale.toUpperCase()}
        </Link>
      ))}
    </nav>
  )
}
