'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  Legend,
  Dot,
} from 'recharts'
import type { SatelliteLog } from '@/lib/types/plot'
import { fmtDateShort as fmtDate } from '@/lib/format'
import { CLOUD_COVER_THRESHOLD } from '@/lib/plot-geo'

interface Props {
  logs: SatelliteLog[]
  activeScanId: string | null
  onSelect: (id: string) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomDot(activeScanId: string | null, onSelect: (id: string) => void) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function DotRenderer(props: any) {
    const { cx, cy, payload } = props
    const isActive = payload.id === activeScanId
    const isCloud = (payload.cloud_cover_percent ?? 0) > CLOUD_COVER_THRESHOLD
    return (
      <Dot
        cx={cx}
        cy={cy}
        r={isActive ? 6 : 4}
        fill={isCloud ? '#ef4444' : isActive ? '#c2410c' : '#ea580c'}
        stroke={isCloud ? '#991b1b' : isActive ? '#7c2d12' : 'none'}
        strokeWidth={2}
        style={{ cursor: 'pointer' }}
        onClick={() => onSelect(payload.id)}
      />
    )
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{fmtDate(d.scan_date)}</p>
      {d.nbr_score != null && (
        <p className="text-orange-600 font-medium">NBR: <span className="font-mono">{d.nbr_score.toFixed(3)}</span></p>
      )}
      {d.cloud_cover_percent != null && (
        d.cloud_cover_percent > CLOUD_COVER_THRESHOLD ? (
          <p className="text-red-600 font-medium mt-1">⚠ Tutupan awan {d.cloud_cover_percent.toFixed(0)}% — data tidak reliable</p>
        ) : (
          <p className="text-gray-500 mt-1">Awan: {d.cloud_cover_percent.toFixed(0)}%</p>
        )
      )}
    </div>
  )
}

export default function NbrTrendChart({ logs, activeScanId, onSelect }: Props) {
  if (logs.length === 0) {
    return (
      <div className="h-48 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center">
        <p className="text-sm text-gray-400">Belum ada data scan satelit untuk petak ini</p>
      </div>
    )
  }

  const data = logs.map((l) => ({
    id: l.id,
    scan_date: l.scan_date,
    label: fmtDate(l.scan_date),
    nbr: l.nbr_score,
    cloud_cover_percent: l.cloud_cover_percent,
  }))

  const nbrDot = CustomDot(activeScanId, onSelect)

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[-0.6, 1.0]}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            tickCount={9}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={() => 'NBR (Normalized Burn Ratio)'}
          />
          <ReferenceArea y1={-0.6} y2={-0.25} fill="#fee2e2" fillOpacity={0.4} />
          <ReferenceLine y={0} stroke="#d1d5db" strokeDasharray="2 2" />
          <ReferenceLine y={-0.25} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.6} />
          <Line
            type="monotone"
            dataKey="nbr"
            stroke="#ea580c"
            strokeWidth={2}
            dot={nbrDot}
            activeDot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
