'use client'

import { Languages } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Link, usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { TOUCH_TARGET } from '@/lib/touch-target'

export function LocaleSwitcher() {
  // Keeps the reader on the page they were on when switching language.
  const pathname = usePathname()
  const active = useLocale()
  const t = useTranslations('locale')

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className={TOUCH_TARGET} aria-label={t('label')} />
          }
        >
          <Languages aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {routing.locales.map((locale) => (
            <DropdownMenuItem
              key={locale}
              // A real anchor, not an onSelect handler: the entry stays
              // middle-clickable and copyable, and next-intl rewrites the
              // href for the target locale.
              render={<Link href={pathname} locale={locale} />}
              aria-current={locale === active ? 'true' : undefined}
            >
              <span className="whitespace-nowrap">{t(locale)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/*
        The switcher used to be two plain links, which worked with JavaScript
        disabled -- deliberate, per the design spec, because the preparedness
        and coastal cards are static and readable without it. A dropdown needs
        JavaScript to open, so this restores that path rather than dropping the
        property silently.
      */}
      <noscript>
        <span className="flex items-center gap-2 text-sm">
          {routing.locales.map((locale) => (
            <Link
              key={locale}
              href={pathname}
              locale={locale}
              aria-current={locale === active ? 'true' : undefined}
              className={
                locale === active
                  ? 'font-medium underline underline-offset-4'
                  : 'text-muted-foreground'
              }
            >
              {locale.toUpperCase()}
            </Link>
          ))}
        </span>
      </noscript>
    </>
  )
}
