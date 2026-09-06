'use client'

import dynamic from 'next/dynamic'
import type { AshMapClientProps } from '@/components/ash-map-client'

// `dynamic(..., { ssr: false })` is rejected by Next.js when called from a
// Server Component. This loader is the client boundary that owns the
// dynamic import instead, so the async server component (ash-map.tsx) can
// stay a plain Server Component while the MapLibre bundle -- pulled in
// transitively by ash-map-client.tsx -- still stays off the initial/server
// bundle and critical path.
const AshMapClient = dynamic(
  () => import('@/components/ash-map-client').then((mod) => mod.AshMapClient),
  {
    ssr: false,
    loading: () => <div className="h-[55svh] w-full animate-pulse rounded-md bg-muted" />,
  },
)

export function AshMapLoader(props: AshMapClientProps) {
  return <AshMapClient {...props} />
}
