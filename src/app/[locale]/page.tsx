import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { ActivityTimeline } from '@/components/activity-timeline'
import { AshMap } from '@/components/ash-map'
import { AutoRefresh } from '@/components/auto-refresh'
import { PreparednessCards } from '@/components/preparedness-cards'
import { MapSkeleton, StatusSkeleton, TimelineSkeleton } from '@/components/skeletons'
import { StatusCard } from '@/components/status-card'
import type { Locale } from '@/lib/format'

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
          <AshMap />
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
