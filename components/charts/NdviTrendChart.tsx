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
    // Titik cloud-invalid (>ambang) ditandai MERAH — beda dari hijau/biru normal.
    // Garis tetap tersambung (data ndvi/ndwi tidak dihapus), cuma warna dot yang beda.
    const isCloud = (payload.cloud_cover_percent ?? 0) > CLOUD_COVER_THRESHOLD
    return (
      <Dot
        cx={cx}
        cy={cy}
        r={isActive ? 6 : 4}
        fill={isCloud ? '#ef4444' : isActive ? '#15803d' : '#22c55e'}
        stroke={isCloud ? '#991b1b' : isActive ? '#14532d' : 'none'}
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
      {d.ndvi_score != null && (
        <p className="text-green-700">NDVI: <span className="font-mono">{d.ndvi_score.toFixed(3)}</span></p>
      )}
      {d.ndwi_score != null && (
        <p className="text-blue-600">NDWI: <span className="font-mono">{d.ndwi_score.toFixed(3)}</span></p>
      )}
      {d.cloud_cover_percent != null && (
        d.cloud_cover_percent > CLOUD_COVER_THRESHOLD ? (
          <p className="text-red-600 font-medium mt-1">⚠ Tutupan awan {d.cloud_cover_percent.toFixed(0)}% — data tidak reliable</p>
        ) : (
          <p className="text-gray-500 mt-1">Awan: {d.cloud_cover_percent.toFixed(0)}%</p>
        )
      )}
      {d.estimated_phase && (
        <p className="text-gray-600 mt-0.5">{d.estimated_phase}</p>
      )}
    </div>
  )
}

export default function NdviTrendChart({ logs, activeScanId, onSelect }: Props) {
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
    ndvi: l.ndvi_score,
    ndwi: l.ndwi_score,
    cloud_cover_percent: l.cloud_cover_percent,
    estimated_phase: l.estimated_phase,
  }))

  const ndviDot = CustomDot(activeScanId, onSelect)
  const ndwiDot = CustomDot(activeScanId, onSelect)

  return (
    <div className="h-52">
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
            domain={[-0.2, 1.0]}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            tickCount={7}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(v) => v === 'ndvi' ? 'NDVI' : 'NDWI'}
          />
          <ReferenceLine y={0} stroke="#d1d5db" strokeDasharray="2 2" />
          <ReferenceLine y={0.3} stroke="#86efac" strokeDasharray="3 3" strokeOpacity={0.6} />
          <ReferenceLine y={0.6} stroke="#16a34a" strokeDasharray="3 3" strokeOpacity={0.6} />
          <Line
            type="monotone"
            dataKey="ndvi"
            stroke="#22c55e"
            strokeWidth={2}
            dot={ndviDot}
            activeDot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="ndwi"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={ndwiDot}
            activeDot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
