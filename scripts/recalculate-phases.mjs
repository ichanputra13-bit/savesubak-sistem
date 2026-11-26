/**
 * scripts/recalculate-phases.mjs
 *
 * One-time script: recalculate estimated_phase untuk semua baris
 * di satellite_logs berdasarkan logic NDVI+NDWI yang sudah diperbarui.
 * Tidak fetch ulang ke Sentinel Hub — hitung dari ndvi_score + ndwi_score
 * yang sudah tersimpan di DB.
 *
 * Jalankan: node scripts/recalculate-phases.mjs
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Logic baru — konsisten dengan semua scan route
// Threshold NDWI dikonfirmasi 04 Jul 2026 (ilustratif, bukan standar agronomi resmi):
// NDWI < -0.35 + NDVI 0.3-0.5 → pematangan (bukan vegetatif)
// NDWI < -0.30 + NDVI 0.5-0.7 → pematangan (bukan generatif)
function estimatePhase(v, ndwi) {
  if (v < 0.1) return 'kosong'
  if (v < 0.3) return 'semai'
  if (v < 0.5) return (ndwi !== null && ndwi < -0.35) ? 'pematangan' : 'vegetatif'
  if (v < 0.7) return (ndwi !== null && ndwi < -0.3)  ? 'pematangan' : 'generatif'
  return 'pematangan'
}

async function main() {
  console.log('Mengambil semua baris satellite_logs...')

  const { data: logs, error } = await supabase
    .from('satellite_logs')
    .select('id, ndvi_score, ndwi_score, cloud_cover_percent, estimated_phase, scan_date, plot_id')
    .order('scan_date', { ascending: true })

  if (error) {
    console.error('Error fetch:', error.message)
    process.exit(1)
  }

  console.log(`Total baris: ${logs.length}\n`)

  let updated = 0
  let noChange = 0
  let cloudSkipped = 0
  let noNdvi = 0

  for (const log of logs) {
    // Baris dengan cloud > 15 seharusnya estimated_phase = null
    if ((log.cloud_cover_percent ?? 100) > 15) {
      if (log.estimated_phase !== null) {
        const { error: err } = await supabase
          .from('satellite_logs')
          .update({ estimated_phase: null })
          .eq('id', log.id)
        if (err) {
          console.error(`  ${log.scan_date} [${log.plot_id.slice(0,8)}]: ERROR clear — ${err.message}`)
        } else {
          console.log(`  ${log.scan_date} [${log.plot_id.slice(0,8)}]: berawan (cloud ${log.cloud_cover_percent}%) — fase di-clear`)
          updated++
        }
      } else {
        cloudSkipped++
      }
      continue
    }

    if (log.ndvi_score === null) {
      noNdvi++
      continue
    }

    const newPhase = estimatePhase(log.ndvi_score, log.ndwi_score ?? null)

    if (newPhase === log.estimated_phase) {
      noChange++
      continue
    }

    const { error: err } = await supabase
      .from('satellite_logs')
      .update({ estimated_phase: newPhase })
      .eq('id', log.id)

    if (err) {
      console.error(`  ${log.scan_date} [${log.plot_id.slice(0,8)}]: ERROR — ${err.message}`)
    } else {
      const ndviStr = log.ndvi_score.toFixed(3)
      const ndwiStr = log.ndwi_score !== null ? log.ndwi_score.toFixed(3) : 'null'
      console.log(
        `  ${log.scan_date} [${log.plot_id.slice(0,8)}]: ` +
        `${log.estimated_phase ?? 'null'} → ${newPhase}  ` +
        `(NDVI=${ndviStr}, NDWI=${ndwiStr})`
      )
      updated++
    }
  }

  console.log('\n──────────────────────────────────────')
  console.log(`Diupdate  : ${updated}`)
  console.log(`Tidak berubah : ${noChange}`)
  console.log(`Dilewati (berawan) : ${cloudSkipped}`)
  console.log(`Dilewati (tanpa NDVI) : ${noNdvi}`)
  console.log('Selesai.')
}

main()
