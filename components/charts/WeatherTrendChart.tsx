'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import type { WeatherLog } from '@/lib/types/plot'
import DateRangeControl from '@/components/charts/DateRangeControl'
import { fmtDateShort as fmtDate } from '@/lib/format'

interface Props {
  logs: WeatherLog[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{fmtDate(d.date)}</p>
      <p className="text-blue-600 font-medium">Curah hujan: <span className="font-mono">{d.rainfall_mm?.toFixed(1) ?? '—'} mm</span></p>
      {d.temp_avg_c != null && <p className="text-gray-500">Suhu rata-rata: {d.temp_avg_c.toFixed(1)}°C</p>}
      {d.humidity_avg_pct != null && <p className="text-gray-500">Kelembapan: {d.humidity_avg_pct.toFixed(0)}%</p>}
    </div>
  )
}

export default function WeatherTrendChart({ logs }: Props) {
  // Weather tidak punya konsep "titik terpilih" yang disinkronkan ke bagian
  // lain halaman (beda dari NDVI/SAR) — activeId cuma dipakai internal untuk
  // slider DateRangeControl, tidak perlu naik ke state PlotDashboard.
  const [activeId, setActiveId] = useState<string | null>(logs.length > 0 ? logs[logs.length - 1].date : null)
  const [rangeFiltered, setRangeFiltered] = useState<WeatherLog[]>(logs)

  if (logs.length === 0) {
    return (
      <div className="h-48 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center">
        <p className="text-sm text-gray-400">Belum ada data cuaca untuk petak ini</p>
      </div>
    )
  }

  const data = rangeFiltered.map((l) => ({
    date: l.date,
    label: fmtDate(l.date),
    rainfall_mm: l.rainfall_mm,
    temp_avg_c: l.temp_avg_c,
    humidity_avg_pct: l.humidity_avg_pct,
  }))

  const totalRainfall = rangeFiltered.reduce((sum, l) => sum + (l.rainfall_mm ?? 0), 0)
  const dryDays = rangeFiltered.filter((l) => (l.rainfall_mm ?? 0) < 1).length

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] text-gray-500">
          {rangeFiltered.length} hari · total {totalRainfall.toFixed(0)} mm · {dryDays} hari kering (&lt;1mm)
        </p>
        <p className="text-[10px] text-gray-400">Sumber: Open-Meteo (ERA5 reanalysis)</p>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="rainfall_mm" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3">
        <DateRangeControl
          items={logs}
          getDate={(l) => l.date}
          getId={(l) => l.date}
          activeId={activeId}
          onSelect={setActiveId}
          onRangeChange={setRangeFiltered}
          accent="blue"
          defaultRange="3m"
        />
      </div>
    </div>
  )
}
