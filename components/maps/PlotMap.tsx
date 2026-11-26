'use client'

import dynamic from 'next/dynamic'
import type { LayerType, SatelliteLog } from '@/lib/types/plot'
import type { PlotGeoJSON } from './PlotMapInner'

const PlotMapInner = dynamic(() => import('./PlotMapInner'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-gray-100 animate-pulse rounded-xl flex items-center justify-center text-gray-400 text-sm">
      Memuat peta…
    </div>
  ),
})

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

export default function PlotMap(props: Props) {
  return <PlotMapInner {...props} />
}
