'use client'

import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import { ImageOverlay, MapContainer, Polygon, TileLayer, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import area from '@turf/area'
import type { LayerType, SatelliteLog } from '@/lib/types/plot'
import { statusLahanToColor, CLOUD_COVER_THRESHOLD } from '@/lib/plot-geo'
import CompassIndicator from './CompassIndicator'

export interface PlotGeoJSON {
  type: 'Polygon'
  coordinates: number[][][]
}

interface Props {
  geoData: { coordinates: number[][][] }
  activeScan: SatelliteLog | null
  activeLayer: LayerType
  editMode?: boolean
  onEditChange?: (geoJson: PlotGeoJSON, areaHa: number) => void
  trueColorUrl?: string | null
  nbrUrl?: string | null
  statusLahan?: string | null
}

function ndviToColor(v: number | null): string {
  if (v === null) return '#9ca3af'
  if (v < 0)   return '#fca5a5'
  if (v < 0.1) return '#fde68a'
  if (v < 0.2) return '#fef08a'
  if (v < 0.3) return '#bef264'
  if (v < 0.4) return '#86efac'
  if (v < 0.5) return '#4ade80'
  if (v < 0.6) return '#22c55e'
  if (v < 0.7) return '#16a34a'
  return '#14532d'
}

function ndwiToColor(v: number | null): string {
  if (v === null) return '#9ca3af'
  if (v < -0.1)  return '#fde68a'
  if (v < 0)     return '#bae6fd'
  if (v < 0.2)   return '#60a5fa'
  if (v < 0.4)   return '#2563eb'
  return '#1e3a8a'
}

function BoundsFitter({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(positions as unknown as L.LatLngBoundsExpression, {
        padding: [48, 48],
        maxZoom: 18,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

// ─── Geoman editor — aktif saat editMode=true ───────────────────────────────
function GeomanEditor({
  initialPositions,
  onEditChange,
}: {
  initialPositions: [number, number][]
  onEditChange: (geoJson: PlotGeoJSON, areaHa: number) => void
}) {
  const map = useMap()

  useEffect(() => {
    const layer = L.polygon(initialPositions, {
      color: '#ea580c',
      fillColor: '#fed7aa',
      fillOpacity: 0.35,
      weight: 2.5,
      dashArray: '6 4',
    }).addTo(map)

    layer.pm.enable({ allowSelfIntersection: false })

    const emitChange = () => {
      const feature = layer.toGeoJSON()
      const geom = feature.geometry as PlotGeoJSON
      const areaM2 = area(feature)
      const areaHa = Math.round((areaM2 / 10000) * 1000) / 1000
      onEditChange(geom, areaHa)
    }

    // Fire once on mount so parent already has current state
    emitChange()

    layer.on('pm:edit', emitChange)
    layer.on('pm:vertexadded', emitChange)
    layer.on('pm:vertexremoved', emitChange)

    return () => {
      layer.off('pm:edit', emitChange)
      layer.off('pm:vertexadded', emitChange)
      layer.off('pm:vertexremoved', emitChange)
      layer.pm.disable()
      map.removeLayer(layer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default function PlotMapInner({ geoData, activeScan, activeLayer, editMode = false, onEditChange, trueColorUrl, nbrUrl, statusLahan }: Props) {
  // GeoJSON coords are [lng, lat]; Leaflet expects [lat, lng]
  const positions: [number, number][] = geoData.coordinates[0].map(
    ([lng, lat]) => [lat, lng]
  )

  // Bounding box axis-aligned dari polygon
  const imageBounds: [[number, number], [number, number]] = [
    [Math.min(...positions.map((p) => p[0])), Math.min(...positions.map((p) => p[1]))],
    [Math.max(...positions.map((p) => p[0])), Math.max(...positions.map((p) => p[1]))],
  ]

  const isCloudy = (activeScan?.cloud_cover_percent ?? 0) > CLOUD_COVER_THRESHOLD
  // 'landcategory' sengaja dikecualikan dari status "optical" — status_lahan
  // adalah metadata manual, tidak terkait tutupan awan scan satelit hari itu.
  const isOptical = activeLayer !== 'landcategory'

  const fillColor =
    activeLayer === 'landcategory'
      ? statusLahanToColor(statusLahan)
      : isCloudy && isOptical
      ? '#9ca3af' // Abu-abu gelap jika tertutup awan
      : activeLayer === 'ndvi'
      ? ndviToColor(activeScan?.ndvi_score ?? null)
      : activeLayer === 'ndwi'
      ? ndwiToColor(activeScan?.ndwi_score ?? null)
      : '#ffffff' // truecolor & nbr — neutral outline only

  const fillOpacity =
    activeLayer === 'landcategory' ? 0.55
    : (isCloudy && isOptical) ? 0.4
    : (activeLayer === 'truecolor' || activeLayer === 'nbr') ? 0.08 : 0.55

  const center: [number, number] = [
    positions.reduce((s, p) => s + p[0], 0) / positions.length,
    positions.reduce((s, p) => s + p[1], 0) / positions.length,
  ]

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} maxNativeZoom={18} />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          pane="overlayPane"
        />
        <BoundsFitter positions={positions} />
        {activeLayer === 'truecolor' && trueColorUrl && (
          <ImageOverlay url={trueColorUrl} bounds={imageBounds} className={isCloudy ? 'grayscale opacity-60' : ''} />
        )}
        {activeLayer === 'nbr' && nbrUrl && (
          <ImageOverlay url={nbrUrl} bounds={imageBounds} className={isCloudy ? 'grayscale opacity-60' : ''} />
        )}
        {editMode ? (
          <GeomanEditor
            initialPositions={positions}
            onEditChange={onEditChange ?? (() => {})}
          />
        ) : (
          <Polygon
            positions={positions}
            pathOptions={{
              color: '#ffffff',
              weight: 2.5,
              fillColor,
              fillOpacity,
              dashArray: (activeLayer === 'truecolor' || activeLayer === 'nbr') ? '6 4' : undefined,
            }}
          />
        )}
      </MapContainer>
      {/* ── Penunjuk arah mata angin — tidak ada elemen lain di pojok kiri-bawah
          peta detail petak ini (legenda "Warna polygon" dirender terpisah di
          bawah kartu peta oleh PlotDashboard.tsx, bukan di atas peta) ── */}
      <CompassIndicator className="absolute bottom-4 left-4 z-[1000]" />
    </div>
  )
}
