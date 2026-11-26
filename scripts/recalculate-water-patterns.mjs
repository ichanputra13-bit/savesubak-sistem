/**
 * scripts/recalculate-water-patterns.mjs
 *
 * One-time script: panggil ulang fn_analyze_season_water_pattern untuk
 * SEMUA planting_seasons yang ada, supaya estimated_co2e_tonnes yang
 * sudah tersimpan (dihitung pakai formula v18 yang salah — CH4 tanpa
 * netting N2O, GWP 28/AR5) diganti dengan hasil formula v19 (NET
 * CH4-N2O, GWP 27/AR6). Tidak fetch ulang ke Sentinel Hub — RPC ini
 * cuma membaca satellite_logs yang sudah ada di DB.
 *
 * Jalankan: node scripts/recalculate-water-patterns.mjs
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('Mengambil semua planting_seasons...')

  const { data: seasons, error } = await supabase
    .from('planting_seasons')
    .select('id, plot_id, planting_date, actual_harvest_date, status')
    .order('planting_date', { ascending: true })

  if (error) {
    console.error('Error fetch:', error.message)
    process.exit(1)
  }

  console.log(`Total musim tanam: ${seasons.length}\n`)

  let ok = 0
  let failed = 0

  for (const season of seasons) {
    const { data: result, error: rpcErr } = await supabase.rpc(
      'fn_analyze_season_water_pattern',
      { p_season_id: season.id }
    )

    if (rpcErr) {
      console.error(
        `  [${season.plot_id.slice(0, 8)}] musim ${season.planting_date}: ERROR — ${rpcErr.message}`
      )
      failed++
      continue
    }

    console.log(
      `  [${season.plot_id.slice(0, 8)}] musim ${season.planting_date} → ${season.actual_harvest_date ?? '(belum panen)'}: ` +
      `pola=${result.pattern_detected}, transisi=${result.oscillation_count}, ` +
      `hari_aerasi=${result.total_aeration_days}, CO2e=${result.estimated_co2e_tonnes} ton`
    )
    ok++
  }

  console.log('\n──────────────────────────────────────')
  console.log(`Berhasil dihitung ulang : ${ok}`)
  console.log(`Gagal                   : ${failed}`)
  console.log('Selesai. Bandingkan angka CO2e di atas dengan yang tampil di UI sebelumnya')
  console.log('untuk memastikan turun (formula lama overstate karena tidak netting N2O).')
}

main()
