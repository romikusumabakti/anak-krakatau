'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
// maplibre-gl 6.x ships no default export (the brief's `import maplibregl
// from 'maplibre-gl'` doesn't compile) -- only named exports.
import { Map as MaplibreMap, Marker as MaplibreMarker } from 'maplibre-gl'
import { useTheme } from 'next-themes'
import { useEffect, useRef } from 'react'
import { circlePolygon, sectorPolygon } from '@/lib/geo'

const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/fiord',
} as const

/** Indicative sector radius in km. Not tied to any measured ash extent --
 * it exists only to make the drawn direction visible on the map, per the
 * honesty requirement that this is a direction, not a boundary. */
const SECTOR_RADIUS_KM = 120

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

  useEffect(() => {
    if (!container.current) return
    const map = new MaplibreMap({
      container: container.current,
      style: resolvedTheme === 'dark' ? STYLES.dark : STYLES.light,
      center: [longitude, latitude],
      zoom: 7,
      attributionControl: { compact: true },
    })

    map.on('load', () => {
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

    return () => map.remove()
  }, [longitude, latitude, hazardRadiusKm, bearing, resolvedTheme])

  return <div ref={container} className="h-[55svh] w-full rounded-md" />
}
