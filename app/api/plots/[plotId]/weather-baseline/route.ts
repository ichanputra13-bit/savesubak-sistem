import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchWeatherRange } from '@/lib/weather/openmeteo'
import { plotCentroid } from '@/lib/plot-geo'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ plotId: string }> }
) {
  const { plotId } = await params
  const supabase = createAdminClient()

  if (!plotId) {
    return NextResponse.json({ error: 'Plot ID required' }, { status: 400 })
  }

  try {
    // 1. Get plot geo data
    const { data: plot, error: plotErr } = await supabase
      .from('v_plots')
      .select('id, geo_data')
      .eq('id', plotId)
      .single()

    if (plotErr || !plot) throw new Error('Plot tidak ditemukan')

    const centroid = plotCentroid(plot)
    if (!centroid) throw new Error('Plot tidak punya data geometri yang valid')
    const [lat, lon] = centroid

    // 2. Define 1095-day (3 years) window — SAMA seperti baseline satelit
    // (lihat app/api/plots/[plotId]/baseline/route.ts), supaya histori cuaca
    // & satelit konsisten jangka waktunya.
    const today = new Date()
    const toDate = today.toISOString().split('T')[0]
    const fromDate = new Date(today.getTime() - 1095 * 86400000).toISOString().split('T')[0]

    // 3. Tarik data cuaca (Open-Meteo) — beda dari Sentinel/Copernicus, tidak
    // ada kuota/rate-limit, jadi 1 request per plot sudah cukup untuk seluruh
    // rentang (tidak perlu loop per interval seperti fetchSar/fetchNdvi).
    const weatherDays = await fetchWeatherRange(lat, lon, fromDate, toDate)

    // 4. Upsert ke weather_logs — pola SAMA seperti cron harian
    // (app/api/cron/satellite-scan/route.ts), supaya tidak duplikat kalau
    // dijalankan berkali-kali atau tumpang tindih dengan data cron.
    const rows = weatherDays.map((w) => ({
      plot_id: plotId,
      date: w.date,
      rainfall_mm: w.rainfall_mm,
      temp_avg_c: w.temp_avg_c,
      humidity_avg_pct: w.humidity_avg_pct,
              temp_min_c: w.temp_min_c,
              temp_max_c: w.temp_max_c,
              wind_speed_max_ms: w.wind_speed_max_ms,
              wind_gust_max_ms: w.wind_gust_max_ms,
              wind_dir_deg: w.wind_dir_deg,
              pressure_hpa: w.pressure_hpa,
              radiation_mj_m2: w.radiation_mj_m2,
              sunshine_hours: w.sunshine_hours,
              et0_mm: w.et0_mm,
              soil_moisture_m3m3: w.soil_moisture_m3m3,
      source: 'open-meteo',
    }))

    if (rows.length > 0) {
      const { error } = await supabase
        .from('weather_logs')
        .upsert(rows, { onConflict: 'plot_id,date' })

      if (error) throw error
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menarik ${rows.length} hari data cuaca (Open-Meteo) untuk 3 tahun terakhir (1095 hari)!`,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
