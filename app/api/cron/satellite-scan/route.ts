import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSentinelToken } from '@/lib/sentinel-hub/auth'
import { fetchSar } from '@/lib/sentinel-hub/sar'
import { fetchCatalogProduct } from '@/lib/sentinel-hub/catalog'
import { fetchTrueColorImage, uploadTrueColorImage } from '@/lib/sentinel-hub/truecolor'
import { getEffectiveScanInterval } from '@/lib/adaptive-scan'
import { fetchWeatherRange } from '@/lib/weather/openmeteo'
import { plotCentroid, CLOUD_COVER_THRESHOLD } from '@/lib/plot-geo'
import { estimatePhase, fetchSentinelStats, pickClearestInterval, NDVI_EVALSCRIPT, NDWI_EVALSCRIPT } from '@/lib/sentinel-hub/formulas'

const SAR_INTERVAL_DAYS = 6
const NDVI_WINDOW_DAYS = 10
// 27 Nov 2026: Vercel Hobby memotong fungsi ±5 menit — dulu cron selalu
// terhenti setelah 13–45 petak (dibuktikan dari jejak created_at weather_logs
// 25–27 Nov). Sekarang: cuaca 1x per kawasan, satelit bergiliran (petak yang
// paling lama belum di-scan dulu) dan berhenti rapi sebelum batas waktu.
const TIME_BUDGET_MS = 240_000
const MAX_SAT_PLOTS = 60
export const maxDuration = 300

function round4(v: number) { return Math.round(v * 10000) / 10000 }

// Dipanggil Vercel Cron: setiap hari jam 07:00 UTC = 15:00 WITA (vercel.json),
// setelah lintasan Sentinel-2 pagi hari di Bali sempat diproses.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const windowFrom = new Date(Date.now() - NDVI_WINDOW_DAYS * 86400000).toISOString().split('T')[0]

  const [{ data: plots, error: plotsError }, { data: activeSeasons }] = await Promise.all([
    supabase.from('v_plots').select('id, kawasan_id, geo_data, scan_interval_days'),
    supabase.from('planting_seasons').select('plot_id, planting_date').eq('status', 'aktif'),
  ])

  if (plotsError) {
    return NextResponse.json({ error: plotsError.message }, { status: 500 })
  }

  const plantingDateMap = new Map(
    (activeSeasons ?? []).map((s: { plot_id: string; planting_date: string }) => [s.plot_id, s.planting_date])
  )

  const summary = { scanned: 0, skipped: 0, sarScanned: 0, failed: 0, weatherKawasan: 0, weatherRows: 0, stoppedEarly: false, details: [] as string[] }
  const t0 = Date.now()

  // ── 1. Cuaca: SEKALI per kawasan (titik tengah semua petaknya), disimpan ke semua petak ──
  const byKawasan = new Map<string, NonNullable<typeof plots>>()
  for (const p of plots ?? []) byKawasan.set(p.kawasan_id, [...(byKawasan.get(p.kawasan_id) ?? []), p])
  const weatherFrom = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]
  for (const [kid, kplots] of byKawasan) {
    try {
      const cs = kplots.map((p) => plotCentroid(p)).filter((c): c is [number, number] => !!c)
      if (!cs.length) continue
      const lat = cs.reduce((a, c) => a + c[0], 0) / cs.length, lon = cs.reduce((a, c) => a + c[1], 0) / cs.length
      const days = await fetchWeatherRange(lat, lon, weatherFrom, today)
      const rows = kplots.flatMap((p) => days.map((w) => ({
        plot_id: p.id, date: w.date, rainfall_mm: w.rainfall_mm, temp_avg_c: w.temp_avg_c, humidity_avg_pct: w.humidity_avg_pct,
        temp_min_c: w.temp_min_c, temp_max_c: w.temp_max_c, wind_speed_max_ms: w.wind_speed_max_ms, wind_gust_max_ms: w.wind_gust_max_ms,
        wind_dir_deg: w.wind_dir_deg, pressure_hpa: w.pressure_hpa, radiation_mj_m2: w.radiation_mj_m2, sunshine_hours: w.sunshine_hours,
        et0_mm: w.et0_mm, soil_moisture_m3m3: w.soil_moisture_m3m3, source: 'open-meteo',
      })))
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from('weather_logs').upsert(rows.slice(i, i + 500), { onConflict: 'plot_id,date' })
        if (error) throw new Error(error.message)
      }
      summary.weatherKawasan++; summary.weatherRows += rows.length
    } catch (weatherErr) {
      summary.details.push(`kawasan ${kid.slice(0, 8)}: weather error (${String(weatherErr).slice(0, 80)})`)
    }
  }

  // ── 2. Satelit: bergiliran — tiap hari mulai dari posisi berbeda dalam daftar
  // petak (urut id), jadi semua petak kebagian merata (±tiap 6–7 hari untuk
  // ±370 petak) dan petak yang terus berawan tidak memblokir petak lain.
  const sorted = [...(plots ?? [])].sort((a, b) => a.id.localeCompare(b.id))
  const dayNo = Math.floor(Date.now() / 86400000)
  const start = sorted.length ? (dayNo * MAX_SAT_PLOTS) % sorted.length : 0
  const queue = [...sorted.slice(start), ...sorted.slice(0, start)]
  let processed = 0

  for (const plot of queue) {
    if (Date.now() - t0 > TIME_BUDGET_MS || processed >= MAX_SAT_PLOTS) { summary.stoppedEarly = true; break }
    processed++
    try {
      // ── NDVI/NDWI — adaptive interval check ──────────────────────────────────
      const { data: recentLogs } = await supabase
        .from('satellite_logs')
        .select('scan_date, ndvi_score')
        .eq('plot_id', plot.id)
        .not('ndvi_score', 'is', null)
        .order('scan_date', { ascending: false })
        .limit(3)

      const logsAsc = [...(recentLogs ?? [])].reverse()
      const lastNdviDate = recentLogs?.[0]?.scan_date ?? null
      const daysSinceNdvi = lastNdviDate
        ? Math.floor((Date.now() - new Date(lastNdviDate).getTime()) / 86400000)
        : Infinity

      const adaptive = getEffectiveScanInterval(
        { scan_interval_days: plot.scan_interval_days, planting_date: plantingDateMap.get(plot.id) ?? null },
        logsAsc
      )

      if (daysSinceNdvi >= adaptive.interval) {
        // 26 Nov 2026: dulu cuma minta citra "hari ini" jam 09:00 WITA — padahal
        // Sentinel-2 lewat Bali ±10:30 WITA & datanya baru siap beberapa jam
        // kemudian, jadi hampir selalu kosong (baris kosong) atau 1 lintasan
        // berawan (awan 100%). Sekarang: lihat 10 hari ke belakang, pilih citra
        // paling cerah, dan TIDAK menyimpan apa-apa kalau tidak ada citra.
        const token = await getSentinelToken()
        const [ndviIntervals, ndwiIntervals] = await Promise.all([
          fetchSentinelStats(token, plot.geo_data, NDVI_EVALSCRIPT, 'ndvi', windowFrom, today),
          fetchSentinelStats(token, plot.geo_data, NDWI_EVALSCRIPT, 'ndwi', windowFrom, today),
        ])
        const best = pickClearestInterval(ndviIntervals, CLOUD_COVER_THRESHOLD)
        const bestDate = best?.interval.from.split('T')[0] ?? null

        if (!best || !bestDate) {
          summary.skipped++
          summary.details.push(`${plot.id.slice(0, 8)}: NDVI tidak ada citra Sentinel-2 dalam ${NDVI_WINDOW_DAYS} hari`)
        } else if (lastNdviDate && bestDate <= lastNdviDate) {
          summary.skipped++
          summary.details.push(`${plot.id.slice(0, 8)}: NDVI tidak ada citra baru (terbaik ${bestDate}, tersimpan ${lastNdviDate})`)
        } else {
          const ndviMean = best.outputs.ndvi.bands.B0.stats.mean
          const cloudPct = Math.round((best.outputs.cloudMask?.bands?.B0?.stats?.mean ?? 0) * 1000) / 10
          const ndwiMean = ndwiIntervals.find((d) => d.interval.from.split('T')[0] === bestDate)?.outputs?.ndwi?.bands?.B0?.stats?.mean ?? null
          const isValid = cloudPct <= CLOUD_COVER_THRESHOLD
          const estimated_phase = isValid ? estimatePhase(ndviMean, ndwiMean) : null

          const catalogProduct = await fetchCatalogProduct(plot.geo_data, bestDate, 'sentinel-2-l2a').catch(() => null)
          const trueColorPath = await fetchTrueColorImage(plot.geo_data, bestDate)
            .then((buf) => (buf ? uploadTrueColorImage(supabase, plot.id, bestDate, buf) : null))
            .catch(() => null)

          const { error: upErr } = await supabase.from('satellite_logs').upsert({
            plot_id: plot.id,
            scan_date: bestDate,
            cloud_cover_percent: cloudPct,
            ndvi_score: round4(ndviMean),
            ndwi_score: ndwiMean !== null ? round4(ndwiMean) : null,
            estimated_phase,
            ndvi_product_id: catalogProduct?.id ?? null,
            ndvi_acquisition_datetime: catalogProduct?.datetime ?? null,
            ndvi_platform: catalogProduct?.platform ?? null,
            true_color_path: trueColorPath,
          }, { onConflict: 'plot_id,scan_date' })
          if (upErr) throw new Error(upErr.message)

          summary.scanned++
          summary.details.push(`${plot.id.slice(0, 8)}: NDVI ok ${bestDate} (${adaptive.mode}, ndvi ${ndviMean.toFixed(3)}, awan ${cloudPct}%)`)
        }
      } else {
        summary.skipped++
        summary.details.push(`${plot.id.slice(0, 8)}: NDVI skip (${adaptive.reason}, last=${daysSinceNdvi}d)`)
      }

      // ── SAR — independent 6-day interval check ───────────────────────────────
      const { data: lastSarRow } = await supabase
        .from('satellite_logs')
        .select('scan_date')
        .eq('plot_id', plot.id)
        .not('sar_vv', 'is', null)
        .order('scan_date', { ascending: false })
        .limit(1)

      const lastSarDate = lastSarRow?.[0]?.scan_date ?? null
      const daysSinceSar = lastSarDate
        ? Math.floor((Date.now() - new Date(lastSarDate).getTime()) / 86400000)
        : Infinity

      if (daysSinceSar >= SAR_INTERVAL_DAYS) {
        // Window 8 hari ke belakang — cukup untuk dapat ≥1 pass tiap orbit
        const sarFrom = new Date()
        sarFrom.setDate(sarFrom.getDate() - 8)
        const sarFromStr = sarFrom.toISOString().split('T')[0]

        const sarResults = await fetchSar(plot.geo_data, sarFromStr, today)

        for (const sar of sarResults) {
          const sarCatalogProduct = await fetchCatalogProduct(plot.geo_data, sar.date, 'sentinel-1-grd').catch(() => null)

          await supabase.from('satellite_logs').upsert({
            plot_id:             plot.id,
            scan_date:           sar.date,
            sar_vv:              round4(sar.vv),
            sar_vh:              round4(sar.vh),
            sar_flood_index:     round4(sar.flood_index),
            sar_orbit_direction: sar.orbit_direction,
            sar_source:          'sentinel-1',
            sar_product_id:            sarCatalogProduct?.id ?? null,
            sar_acquisition_datetime:  sarCatalogProduct?.datetime ?? null,
            sar_platform:              sarCatalogProduct?.platform ?? null,
          }, { onConflict: 'plot_id,scan_date' })
        }

        if (sarResults.length > 0) {
          summary.sarScanned++
          summary.details.push(`${plot.id.slice(0, 8)}: SAR ok (${sarResults.length} pass, last=${sarResults.at(-1)?.date})`)
        } else {
          summary.details.push(`${plot.id.slice(0, 8)}: SAR no data in window`)
        }
      }
    } catch (err) {
      summary.failed++
      summary.details.push(`${plot.id.slice(0, 8)}: error (${String(err).slice(0, 80)})`)
    }

    await new Promise((r) => setTimeout(r, 500))
  }

  return NextResponse.json({ date: today, plots: plots?.length ?? 0, processed, durationSec: Math.round((Date.now() - t0) / 1000), ...summary })
}
