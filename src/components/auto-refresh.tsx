'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const INTERVAL_MS = 60_000

export function AutoRefresh() {
  const router = useRouter()

  useEffect(() => {
    const tick = () => {
      // Refreshing a hidden tab burns upstream requests for nobody to read.
      if (document.visibilityState === 'visible') router.refresh()
    }
    const id = setInterval(tick, INTERVAL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [router])

  return null
}
