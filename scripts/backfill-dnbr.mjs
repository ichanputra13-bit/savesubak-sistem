// Backfill dNBR (selisih NBR antar-scan berurutan) untuk data yang SUDAH ADA.
// Lihat lib/dnbr.ts untuk formula & ambang, PROJECT_LOG.md 25 Juli 2026 untuk
// konteks/rujukan literatur lengkap.
//
// SENGAJA MELEWATI (skip):
//   1. Kawasan Subak Sangeh — akan dihapus & diulang manual oleh user,
//      reprocess/backfill apapun di situ sia-sia (instruksi eksplisit).
//   2. Petak yang datanya MASIH pakai bug resx/resy lama (cloud_cover_percent
//      biner <=2 nilai unik di baris ber-NBR) — dNBR dari 2 sampel 1-pixel
//      acak (yang bisa dari lokasi FISIK berbeda dalam kotak sampel raksasa
//      yang sama) tidak bermakna apa-apa, malah berisiko flag palsu ganda.
//      Petak begini perlu direprocess baseline dulu (lihat sesi-sesi
//      sebelumnya), BUKAN di-backfill dNBR sekarang.
//   3. Petak tanpa data NBR sama sekali — tidak ada apa-apa untuk dihitung.
//
// Jalankan: node --env-file=.env.local scripts/backfill-dnbr.mjs
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Duplikat SENGAJA dari lib/dnbr.ts computeDnbrSeries() — script .mjs di
// project ini tidak bisa import file .ts secara langsung (lihat pola yang
// sama di scripts/recalculate-phases.mjs). KALAU formula/ambang di
// lib/dnbr.ts diubah, salin ulang ke sini juga.
const CLOUD_VALID_THRESHOLD = 15

function computeDnbrSeries(logs) {
  const sorted = [...logs].sort((a, b) => a.scan_date.localeCompare(b.scan_date))
  const results = []
  let lastValid = null

  for (const log of sorted) {
    const isValid = log.nbr_score != null && log.cloud_cover_percent != null && log.cloud_cover_percent <= CLOUD_VALID_THRESHOLD

    if (isValid && lastValid) {
      results.push({
        scan_date: log.scan_date,
        dnbr_score: Math.round((log.nbr_score - lastValid.nbr_score) * 10000) / 10000,
        dnbr_reference_scan_date: lastValid.scan_date,
      })
    } else {
      results.push({ scan_date: log.scan_date, dnbr_score: null, dnbr_reference_scan_date: null })
    }

    if (isValid) lastValid = { scan_date: log.scan_date, nbr_score: log.nbr_score }
  }

  return results
}

const { data: sangeh } = await supabase.from('kawasan').select('id').ilike('name', '%Sangeh%').single()
console.log(`Kawasan Subak Sangeh (dikecualikan): ${sangeh?.id ?? 'tidak ditemukan'}`)

const { data: plots, error: plotsErr } = await supabase
  .from('v_plots')
  .select('id, farmer_name, nama_penggarap, kawasan_id')
if (plotsErr) { console.error(plotsErr); process.exit(1) }

const targetPlots = plots.filter((p) => p.kawasan_id !== sangeh?.id)
console.log(`Total petak (di luar Sangeh): ${targetPlots.length} dari ${plots.length} total`)

const summary = { computed: 0, skippedBuggy: 0, skippedNoData: 0, failed: 0 }

for (const plot of targetPlots) {
  const name = plot.nama_penggarap ?? plot.farmer_name

  const { data: logs, error: logsErr } = await supabase
    .from('satellite_logs')
    .select('scan_date, nbr_score, cloud_cover_percent')
    .eq('plot_id', plot.id)
    .not('nbr_score', 'is', null)
    .order('scan_date', { ascending: true })

  if (logsErr) {
    console.log(`  ❌ ${name}: gagal fetch (${logsErr.message})`)
    summary.failed++
    continue
  }
  if (!logs || logs.length === 0) {
    summary.skippedNoData++
    continue
  }

  const distinctCloud = new Set(logs.map((l) => l.cloud_cover_percent)).size
  if (distinctCloud <= 2) {
    console.log(`  ⏳ ${name}: DILEWATI — cloud_cover biner (${distinctCloud} nilai unik), masih data lama/buggy, perlu reprocess dulu`)
    summary.skippedBuggy++
    continue
  }

  const results = computeDnbrSeries(logs)
  const payload = results.map((r) => ({
    plot_id: plot.id,
    scan_date: r.scan_date,
    dnbr_score: r.dnbr_score,
    dnbr_reference_scan_date: r.dnbr_reference_scan_date,
  }))

  const { error: upsertErr } = await supabase
    .from('satellite_logs')
    .upsert(payload, { onConflict: 'plot_id,scan_date' })

  if (upsertErr) {
    console.log(`  ❌ ${name}: gagal upsert dNBR (${upsertErr.message})`)
    summary.failed++
    continue
  }

  const computedCount = results.filter((r) => r.dnbr_score !== null).length
  console.log(`  ✅ ${name}: ${payload.length} baris diupdate, ${computedCount} di antaranya punya dNBR terhitung`)
  summary.computed++
}

console.log('\n=== RINGKASAN ===')
console.log(`Petak berhasil dihitung dNBR: ${summary.computed}`)
console.log(`Petak dilewati (masih buggy, perlu reprocess dulu): ${summary.skippedBuggy}`)
console.log(`Petak dilewati (belum ada data NBR sama sekali): ${summary.skippedNoData}`)
console.log(`Petak gagal: ${summary.failed}`)
console.log(`(Kawasan Subak Sangeh dikecualikan total — tidak dihitung sama sekali)`)
