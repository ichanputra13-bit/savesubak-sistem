import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import KawasanDashboard, { type DashPlot, type DashWeather, type DashSeason } from '@/components/kawasan-dashboard/KawasanDashboard'

// Dashboard Kawasan baru (Langkah 2, 26 Nov 2026) — gaya Save Subak Sistem.
// Semua data dari Supabase; nama petani/pemilik SENGAJA tidak dikirim ke sini.
interface Props { params: Promise<{ kawasanId: string }> }

export const dynamic = 'force-dynamic'

export default async function KawasanDashboardPage({ params }: Props) {
  const { kawasanId } = await params
  const supabase = createAdminClient()

  const [{ data: kawasan }, { data: plots }] = await Promise.all([
    supabase.from('kawasan').select('id, name, local_term, region').eq('id', kawasanId).single(),
    supabase.from('v_plots').select('id, crop_variety, area_ha, geo_data, created_at').eq('kawasan_id', kawasanId).order('created_at', { ascending: true }),
  ])
  if (!kawasan) notFound()

  const ids = (plots ?? []).map((p) => p.id)
  const since60 = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10)
  const since35 = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10)

  const [{ data: logs }, { data: lastNdvi }, { data: weather }, { data: seasons }] = await Promise.all([
    ids.length ? supabase.from('satellite_logs')
      .select('plot_id, scan_date, ndvi_score, ndwi_score, cloud_cover_percent, sar_flood_index, estimated_phase')
      .in('plot_id', ids).gte('scan_date', since60).order('scan_date', { ascending: true }).limit(20000) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('satellite_logs')
      .select('plot_id, scan_date, ndvi_score, cloud_cover_percent, estimated_phase')
      .in('plot_id', ids).not('ndvi_score', 'is', null).order('scan_date', { ascending: false }).limit(ids.length * 6) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('weather_logs')
      .select('plot_id, date, rainfall_mm, temp_avg_c, humidity_avg_pct, et0_mm, wind_speed_max_ms, wind_dir_deg')
      .in('plot_id', ids).gte('date', since35).order('date', { ascending: true }).limit(5000) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('planting_seasons')
      .select('plot_id, season_year, season_number, crop_variety, planting_date, estimated_harvest_date, actual_harvest_date, actual_harvest_kg, status')
      .in('plot_id', ids).order('planting_date', { ascending: true }) : Promise.resolve({ data: [] }),
  ])

  type Log = { plot_id: string; scan_date: string; ndvi_score: number | null; ndwi_score?: number | null; cloud_cover_percent: number | null; sar_flood_index: number | null; estimated_phase: string | null }
  const L = (logs ?? []) as Log[]
  const LN = (lastNdvi ?? []) as Log[]

  const dashPlots: DashPlot[] = (plots ?? []).map((p, i) => {
    const mine = L.filter((l) => l.plot_id === p.id)
    const clear = LN.find((l) => l.plot_id === p.id && (l.cloud_cover_percent ?? 100) <= 15)
    const anyNdvi = LN.find((l) => l.plot_id === p.id)
    const sar = mine.filter((l) => l.sar_flood_index != null).map((l) => ({ d: l.scan_date, f: l.sar_flood_index as number }))
    const phase = [...mine].reverse().find((l) => l.estimated_phase)?.estimated_phase ?? clear?.estimated_phase ?? null
    return {
      id: p.id,
      no: i + 1,
      variety: p.crop_variety ?? null,
      area: p.area_ha ?? 0,
      geo: p.geo_data as DashPlot['geo'],
      ndvi: clear?.ndvi_score ?? null,
      ndviDate: clear?.scan_date ?? null,
      lastImage: anyNdvi?.scan_date ?? null,
      phase,
      sar,
      idx: mine.filter((l) => l.ndvi_score != null && (l.cloud_cover_percent ?? 100) <= 15).map((l) => ({ d: l.scan_date, ndvi: l.ndvi_score as number, ndwi: l.ndwi_score ?? null })),
      phases: mine.filter((l) => l.estimated_phase).map((l) => ({ d: l.scan_date, p: l.estimated_phase as string })),
    }
  })

  // Cuaca kawasan = rata-rata semua petak per tanggal
  type W = { date: string; rainfall_mm: number | null; temp_avg_c: number | null; humidity_avg_pct: number | null; et0_mm: number | null; wind_speed_max_ms: number | null; wind_dir_deg: number | null }
  const byDate = new Map<string, W[]>()
  for (const w of (weather ?? []) as W[]) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w])
  const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }
  const dashWeather: DashWeather[] = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, ws]) => ({
    date,
    rain: avg(ws.map((w) => w.rainfall_mm)),
    temp: avg(ws.map((w) => w.temp_avg_c)),
    hum: avg(ws.map((w) => w.humidity_avg_pct)),
    et0: avg(ws.map((w) => w.et0_mm)),
    wind: avg(ws.map((w) => w.wind_speed_max_ms)),
    windDir: avg(ws.map((w) => w.wind_dir_deg)),
  }))

  const dashSeasons: DashSeason[] = ((seasons ?? []) as Array<{ plot_id: string; season_year: number | null; season_number: number | null; crop_variety: string | null; planting_date: string | null; estimated_harvest_date: string | null; actual_harvest_date: string | null; actual_harvest_kg: number | null; status: string | null }>)
    .map((s) => ({ plotId: s.plot_id, year: s.season_year, num: s.season_number, variety: s.crop_variety, planting: s.planting_date, estHarvest: s.estimated_harvest_date, harvest: s.actual_harvest_date, harvestKg: s.actual_harvest_kg, status: s.status }))

  return (
    <KawasanDashboard
      kawasan={{ id: kawasan.id, name: kawasan.name, sub: [kawasan.local_term, kawasan.region].filter(Boolean).join(' · ') }}
      plots={dashPlots}
      weather={dashWeather}
      seasons={dashSeasons}
    />
  )
}
