import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { ActivityTimeline } from '@/components/activity-timeline'
import { AshMap } from '@/components/ash-map'
import { AutoRefresh } from '@/components/auto-refresh'
import { PreparednessCards } from '@/components/preparedness-cards'
import { MapSkeleton, StatusSkeleton, TimelineSkeleton } from '@/components/skeletons'
import { StatusCard } from '@/components/status-card'
import type { Locale } from '@/lib/format'

// Bounds how stale a cached page's render-time-computed relative times
// (formatRelative in src/lib/format.ts) can get: without this, the static
// shell is generated once at build and served stale-while-revalidate
// indefinitely, so a cold visit after an idle period can render "updated
// now" over data that is actually hours old. 60s matches the <AutoRefresh />
// client-side refresh cadence. The fetch-level cache (300s, see
// src/lib/sources/http.ts) is unaffected -- most of these revalidations
// reuse already-cached upstream responses rather than re-fetching MAGMA.
export const revalidate = 60

// getStatus makes two sequential MAGMA fetches, each budgeted at
// REQUEST_TIMEOUT_MS (20s), so a worst-case render can take ~40s before the
// adapters give up and the cards degrade. Stated explicitly rather than left
// to the host's default, which varies by platform and plan and would
// otherwise cut a slow-but-recoverable render short.
export const maxDuration = 60

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="mx-auto grid max-w-5xl gap-4 p-4 sm:grid-cols-2 lg:grid-cols-12">
      <AutoRefresh />
      <section className="sm:col-span-2 lg:col-span-12">
        <Suspense fallback={<StatusSkeleton />}>
          <StatusCard locale={locale as Locale} />
        </Suspense>
      </section>
      <section className="sm:col-span-2 lg:col-span-12">
        <Suspense fallback={<MapSkeleton />}>
          <AshMap locale={locale as Locale} />
        </Suspense>
      </section>
      <section className="sm:col-span-2 lg:col-span-7">
        <Suspense fallback={<TimelineSkeleton />}>
          <ActivityTimeline locale={locale as Locale} />
        </Suspense>
      </section>
      <section className="sm:col-span-2 lg:col-span-5">
        <PreparednessCards />
      </section>
    </main>
  )
}
