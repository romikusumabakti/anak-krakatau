'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
// maplibre-gl 6.x ships no default export (the brief's `import maplibregl
// from 'maplibre-gl'` doesn't compile) -- only named exports.
import { Map as MaplibreMap, Marker as MaplibreMarker } from 'maplibre-gl'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useEffect, useRef, useState } from 'react'
import { circlePolygon, sectorPolygon } from '@/lib/geo'
import { VONA_URL } from '@/lib/urls'

const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/fiord',
} as const

/** Indicative sector radius in km. Not tied to any measured ash extent --
 * it exists only to make the drawn direction visible on the map, per the
 * honesty requirement that this is a direction, not a boundary. */
const SECTOR_RADIUS_KM = 120

/**
 * How long to wait for MapLibre's `load` event before declaring the map dead.
 *
 * A missing WebGL context -- old phones, GPU driver blocklists, some managed
 * browsers -- does not always throw from the constructor: MapLibre can create
 * the canvas, fetch the style, and then simply never render or fire `load`.
 * Without this, that path leaves a silent empty box, which is the one failure
 * mode every other card on this dashboard is built to avoid.
 */
const LOAD_TIMEOUT_MS = 15_000

export type AshMapClientProps = {
  longitude: number
  latitude: number
  /**
   * Null when MAGMA's report doesn't state a radius. Never defaulted --
   * see VolcanoStatus.hazardRadiusKm. When null, no exclusion circle is
   * drawn at all, rather than guessing one.
   */
  hazardRadiusKm: number | null
  /** Null when there is no direction to draw (VONA unreadable, or the
   * latest notice reports no observed ash cloud / no movement phrase). */
  bearing: number | null
}

export function AshMapClient({ longitude, latitude, hazardRadiusKm, bearing }: AshMapClientProps) {
  const container = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const [unavailable, setUnavailable] = useState(false)
  const t = useTranslations('map')
  const tSource = useTranslations('source')

  useEffect(() => {
    if (!container.current) return

    let map: MaplibreMap
    try {
      map = new MaplibreMap({
        container: container.current,
        style: resolvedTheme === 'dark' ? STYLES.dark : STYLES.light,
        center: [longitude, latitude],
        zoom: 7,
        attributionControl: { compact: true },
      })
    } catch {
      // No WebGL context at all: MapLibre throws from the constructor.
      setUnavailable(true)
      return
    }

    let loaded = false
    let disposed = false
    let deadline: ReturnType<typeof setTimeout>

    // MapLibre builds its canvas and controls inside the container by hand,
    // outside React's knowledge, so switching to the fallback has to tear the
    // map down explicitly -- a state-only re-render does not re-run this
    // effect's cleanup, which would otherwise leave the dead map's DOM sitting
    // under the fallback text and the instance leaked.
    const dispose = () => {
      if (disposed) return
      disposed = true
      clearTimeout(deadline)
      map.remove()
    }

    const giveUp = () => {
      dispose()
      setUnavailable(true)
    }

    deadline = setTimeout(() => {
      if (!loaded) giveUp()
    }, LOAD_TIMEOUT_MS)

    // Only fatal before `load`. Afterwards these are transient tile or glyph
    // failures, and blanking a working map over one missing tile would be
    // worse than the gap it reports.
    map.on('error', () => {
      if (!loaded) giveUp()
    })

    map.on('load', () => {
      loaded = true
      clearTimeout(deadline)
      if (bearing !== null) {
        map.addSource('sector', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: sectorPolygon(longitude, latitude, bearing, SECTOR_RADIUS_KM),
            },
          },
        })
        map.addLayer({
          id: 'sector',
          type: 'fill',
          source: 'sector',
          paint: { 'fill-color': '#d97706', 'fill-opacity': 0.25 },
        })
      }

      if (hazardRadiusKm !== null) {
        map.addSource('hazard', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: circlePolygon(longitude, latitude, hazardRadiusKm),
            },
          },
        })
        map.addLayer({
          id: 'hazard',
          type: 'line',
          source: 'hazard',
          paint: { 'line-color': '#dc2626', 'line-width': 2 },
        })
      }

      new MaplibreMarker({ color: '#dc2626' }).setLngLat([longitude, latitude]).addTo(map)
    })

    return dispose
  }, [longitude, latitude, hazardRadiusKm, bearing, resolvedTheme])

  if (unavailable) {
    // Distinct key so React mounts a fresh node instead of reconciling onto
    // the div MapLibre wrote into; without it the dead canvas and attribution
    // survive underneath this message.
    return (
      <div
        key="map-unavailable"
        className="flex h-[55svh] w-full flex-col items-start justify-center gap-2 rounded-md bg-muted p-4"
      >
        <p className="text-muted-foreground text-sm">{t('renderUnavailable')}</p>
        <a
          className="text-sm underline underline-offset-2"
          href={VONA_URL}
          rel="noreferrer"
          target="_blank"
        >
          {tSource('openNotice')}
        </a>
      </div>
    )
  }

  return <div key="map" ref={container} className="h-[55svh] w-full rounded-md" />
}
