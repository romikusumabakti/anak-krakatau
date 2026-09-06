import { Suspense } from 'react'
import { HeaderStatusBadge } from '@/components/header-status-badge'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { ThemeToggle } from '@/components/theme-toggle'
import { Skeleton } from '@/components/ui/skeleton'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold sm:text-base">Anak Krakatau</span>
          {/* Own Suspense boundary: the header shell renders instantly and
              only this badge streams in once getStatus() resolves. */}
          <Suspense fallback={<Skeleton className="h-5 w-12 shrink-0 rounded-full" />}>
            <HeaderStatusBadge />
          </Suspense>
        </div>
        {/* gap-3 is load-bearing, not spacing taste: both controls render at
            32px with an invisible 44px hit area, and 12px of separation is
            exactly what stops those areas overlapping and routing a tap to
            the wrong control. */}
        <div className="flex shrink-0 items-center gap-3">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
