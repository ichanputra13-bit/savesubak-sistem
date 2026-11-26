'use client'

import dynamic from 'next/dynamic'
import type { PlotData } from './KawasanMapInner'

const KawasanMapInner = dynamic(() => import('./KawasanMapInner'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400 text-sm">
      Memuat peta…
    </div>
  ),
})

interface Props {
  kawasanId: string
  initialPlots: PlotData[]
  flyToggle?: number
  flyToPlot?: { plotId: string; counter: number } | null
  region?: string
  boundaryGeojson?: Record<string, unknown> | null
  matchedPlotIds?: Set<string> | null
}

export default function KawasanMap({ kawasanId, initialPlots, flyToggle, flyToPlot, region, boundaryGeojson, matchedPlotIds }: Props) {
  return (
    <KawasanMapInner
      kawasanId={kawasanId}
      initialPlots={initialPlots}
      flyToggle={flyToggle}
      flyToPlot={flyToPlot}
      region={region}
      boundaryGeojson={boundaryGeojson}
      matchedPlotIds={matchedPlotIds}
    />
  )
}
