/**
 * scripts/backfill-weather.mjs
 *
 * One-time backfill: tarik data cuaca historis (Open-Meteo) untuk SEMUA
 * plot yang ada, dari tanggal histori satelit paling awal sampai hari ini.
 * Beda dari backfill-satellite.mjs — Open-Meteo tidak ada limit kuota/rate,
 * jadi 1 request per plot sudah cukup untuk seluruh rentang (tidak perlu
 * loop per interval + delay panjang).
 *
 * Jalankan: node --env-file=.env.local scripts/backfill-weather.mjs
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Duplikasi kecil dari lib/plot-geo.ts + lib/weather/openmeteo.ts — pola yang
// sudah dipakai script lain di project ini (mis. recalculate-phases.mjs),
// supaya script berdiri sendiri tanpa perlu Node meng-import file .ts.
function plotCentroid(plot) {
  const ring = plot.geo_data?.coordinates?.[0]
  if (!ring || ring.length === 0) return null
  return [
    ring.reduce((s, [, lat]) => s + lat, 0) / ring.length,
    ring.reduce((s, [lng]) => s + lng, 0) / ring.length,
  ]
}

async function fetchWeatherRange(lat, lon, fromDate, toDate) {
  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat}&longitude=${lon}` +
    `&start_date=${fromDate}&end_date=${toDate}` +
    `&daily=precipitation_sum,temperature_2m_mean,relative_humidity_2m_mean` +
    `&timezone=Asia%2FJakarta`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const days = data.daily?.time ?? []
  return days.map((date, i) => ({
    date,
    rainfall_mm: data.daily?.precipitation_sum?.[i] ?? null,
    temp_avg_c: data.daily?.temperature_2m_mean?.[i] ?? null,
    humidity_avg_pct: data.daily?.relative_humidity_2m_mean?.[i] ?? null,
  }))
}

const BACKFILL_FROM = '2023-07-21' // sama dengan awal histori satelit
const today = new Date().toISOString().split('T')[0]

async function main() {
  console.log('Mengambil semua plot...')
  const { data: plots, error } = await supabase
    .from('v_plots')
    .select('id, farmer_name, geo_data')

  if (error) {
    console.error('Error fetch plots:', error.message)
    process.exit(1)
  }

  console.log(`Total plot: ${plots.length}\n`)

  let ok = 0
  let failed = 0

  for (const plot of plots) {
    const centroid = plotCentroid(plot)
    if (!centroid) {
      console.log(`  [${plot.farmer_name}] dilewati — tidak ada geo_data`)
      continue
    }
    const [lat, lon] = centroid

    try {
      const days = await fetchWeatherRange(lat, lon, BACKFILL_FROM, today)
      const rows = days.map((d) => ({
        plot_id: plot.id,
        date: d.date,
        rainfall_mm: d.rainfall_mm,
        temp_avg_c: d.temp_avg_c,
        humidity_avg_pct: d.humidity_avg_pct,
        source: 'open-meteo',
      }))

      // Upsert per batch 500 baris (batas aman Supabase)
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500)
        const { error: upsertErr } = await supabase
          .from('weather_logs')
          .upsert(batch, { onConflict: 'plot_id,date' })
        if (upsertErr) throw upsertErr
      }

      console.log(`  [${plot.farmer_name}] OK — ${rows.length} hari (${BACKFILL_FROM} s/d ${today})`)
      ok++
    } catch (err) {
      console.error(`  [${plot.farmer_name}] ERROR — ${err.message ?? err}`)
      failed++
    }
  }

  console.log('\n──────────────────────────────────────')
  console.log(`Berhasil : ${ok}`)
  console.log(`Gagal    : ${failed}`)
  console.log('Selesai.')
}

main()
