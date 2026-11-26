import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const PLOT_IDS = {
  'Budidaya BSO': '0032c36a-4cea-4590-8802-52fbead2563c',
  'Budidaya BSO 1': 'c0c4fb6d-97f5-464f-88bd-afe393690f3e',
}

for (const [name, plotId] of Object.entries(PLOT_IDS)) {
  console.log(`\n=== ${name} ===`)

  const { data: seasons } = await supabase
    .from('planting_seasons')
    .select('id, planting_date, actual_harvest_date, status')
    .eq('plot_id', plotId)

  for (const season of seasons ?? []) {
    const end = season.actual_harvest_date ?? new Date().toISOString().split('T')[0]
    console.log(`\n  Musim ${season.planting_date} s/d ${end} (${season.status})`)

    const { data: wp } = await supabase
      .from('season_water_pattern_analysis')
      .select('pattern_detected, oscillation_count, total_aeration_days')
      .eq('planting_season_id', season.id)
      .maybeSingle()
    if (wp) console.log(`  Klasifikasi satelit: ${wp.pattern_detected} (${wp.oscillation_count} transisi, ${wp.total_aeration_days ?? '?'} hari aerasi)`)

    const { data: satLogs } = await supabase
      .from('satellite_logs')
      .select('scan_date, ndwi_score, sar_flood_index')
      .eq('plot_id', plotId)
      .gte('scan_date', season.planting_date)
      .lte('scan_date', end)
      .or('ndwi_score.not.is.null,sar_flood_index.not.is.null')
      .order('scan_date', { ascending: true })

    const { data: weather } = await supabase
      .from('weather_logs')
      .select('date, rainfall_mm')
      .eq('plot_id', plotId)
      .gte('date', season.planting_date)
      .lte('date', end)
      .order('date', { ascending: true })

    const rainByDate = new Map((weather ?? []).map(w => [w.date, w.rainfall_mm ?? 0]))

    let dryDaysWithRecentRain = 0
    let dryDaysTotal = 0
    const evidenceRows = []

    for (const log of satLogs ?? []) {
      let state = null
      if (log.sar_flood_index != null) {
        if (log.sar_flood_index >= 0.28) state = 'basah'
        else if (log.sar_flood_index <= 0.22) state = 'kering'
      } else if (log.ndwi_score != null) {
        state = log.ndwi_score < -0.1 ? 'kering' : 'basah'
      }
      if (state !== 'kering') continue
      dryDaysTotal++

      // Cek hujan dalam 5 hari sebelum tanggal scan "kering" ini
      const scanDate = new Date(log.scan_date)
      let rainInWindow = 0
      for (let i = 0; i <= 5; i++) {
        const d = new Date(scanDate)
        d.setDate(d.getDate() - i)
        const key = d.toISOString().split('T')[0]
        rainInWindow += rainByDate.get(key) ?? 0
      }
      if (rainInWindow >= 5) {
        dryDaysWithRecentRain++
        evidenceRows.push(`${log.scan_date}: lahan KERING tapi hujan ${rainInWindow.toFixed(1)}mm dalam 5 hari sebelumnya`)
      }
    }

    console.log(`  Titik "kering" total: ${dryDaysTotal}`)
    console.log(`  Titik "kering" MESKI ada hujan >=5mm (bukti pengeringan aktif): ${dryDaysWithRecentRain}`)
    evidenceRows.slice(0, 5).forEach(r => console.log(`    - ${r}`))
  }
}
