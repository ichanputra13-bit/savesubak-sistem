'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, Polygon, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { useEffect } from 'react'

export interface MapPlot { id: string; label: string; rings: [number, number][]; color: string; selected: boolean }

function Fit({ plots }: { plots: MapPlot[] }) {
  const map = useMap()
  useEffect(() => {
    const pts = plots.flatMap((p) => p.rings)
    if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [24, 24], maxZoom: 18 })
    // hanya sekali saat jumlah petak berubah
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plots.length])
  return null
}

export default function DashMap({ plots, onPick }: { plots: MapPlot[]; onPick: (id: string) => void }) {
  return (
    <MapContainer center={[-8.48, 115.21]} zoom={16} style={{ height: '100%', width: '100%', borderRadius: 12 }} scrollWheelZoom>
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} attribution="Esri" />
      <Fit plots={plots} />
      {plots.map((p) => (
        <Polygon key={p.id + p.color + p.selected} positions={p.rings}
          pathOptions={{ color: '#fff', weight: p.selected ? 3 : 1, opacity: p.selected ? 1 : 0.6, fillColor: p.color, fillOpacity: 0.6 }}
          eventHandlers={{ click: () => onPick(p.id) }}>
          <Tooltip sticky>{p.label}</Tooltip>
        </Polygon>
      ))}
    </MapContainer>
  )
}
