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

interface Props {
  logs: SatelliteLog[]
  activeScanId?: string | null
  onSelect?: (id: string) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FloodIndexDot(activeScanId: string | null | undefined, onSelect: ((id: string) => void) | undefined) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function DotRenderer(props: any) {
    const { cx, cy, payload } = props
    const isActive = payload.id === activeScanId
    return (
      <Dot
        cx={cx}
        cy={cy}
        r={isActive ? 6 : 3}
        fill="#2563eb"
        stroke={isActive ? '#1e3a8a' : 'none'}
        strokeWidth={2}
        style={{ cursor: onSelect ? 'pointer' : undefined }}
        onClick={() => onSelect?.(payload.id)}
      />
    )
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{fmtDate(d.scan_date)}</p>
      {d.vv != null && (
        <p className="text-slate-600">VV: <span className="font-mono">{d.vv.toFixed(4)}</span></p>
      )}
      {d.vh != null && (
        <p className="text-indigo-600">VH: <span className="font-mono">{d.vh.toFixed(4)}</span></p>
      )}
      {d.flood_index != null && (
        <p className="text-blue-700 font-medium mt-0.5">
          VH/VV: <span className="font-mono">{d.flood_index.toFixed(4)}</span>
          <span className="ml-1 text-gray-400">
            ({d.flood_index > 0.4 ? 'genangan tinggi' : d.flood_index > 0.25 ? 'genangan sedang' : 'relatif kering'})
          </span>
        </p>
      )}
      {d.orbit && (
        <p className="text-gray-400 mt-0.5">Orbit: {d.orbit}</p>
      )}
    </div>
  )
}

export default function SarTrendChart({ logs, activeScanId = null, onSelect }: Props) {
  const sarLogs = logs.filter(l => l.sar_flood_index != null)

  if (sarLogs.length === 0) {
    return (
      <div className="h-40 bg-gray-50 rounded-xl border border-dashed border-blue-100 flex items-center justify-center">
        <p className="text-sm text-gray-400">Belum ada data radar SAR untuk petak ini</p>
      </div>
    )
  }

  const data = sarLogs.map(l => ({
    id: l.id,
    scan_date: l.scan_date,
    label: fmtDate(l.scan_date),
    vv: l.sar_vv,
    vh: l.sar_vh,
    flood_index: l.sar_flood_index,
    orbit: l.sar_orbit_direction,
  }))

  const floodDot = FloodIndexDot(activeScanId, onSelect)

  return (
    <div className="h-48">
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
            domain={[0, 0.55]}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            tickCount={6}
          />
          <Tooltip content={<SarTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(v) =>
              v === 'vv' ? 'VV (σ°)' :
              v === 'vh' ? 'VH (σ°)' :
              'Rasio VH/VV (flood index)'
            }
          />
          {/* Threshold genangan sedang */}
          <ReferenceLine y={0.25} stroke="#7dd3fc" strokeDasharray="3 3" strokeOpacity={0.7} />
          {/* Threshold genangan tinggi */}
          <ReferenceLine y={0.40} stroke="#2563eb" strokeDasharray="3 3" strokeOpacity={0.7} />
          <Line
            type="monotone"
            dataKey="vv"
            stroke="#94a3b8"
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="vh"
            stroke="#818cf8"
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="flood_index"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={floodDot}
            activeDot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
