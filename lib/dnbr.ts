import type { SupabaseClient } from '@supabase/supabase-js'

// dNBR — selisih NBR antar-scan berurutan, PELENGKAP ambang absolut NBR
// yang sudah ada (nbr_score), bukan pengganti. Metodologi standar riset
// kebakaran (USGS FIREMON) memakai dNBR (selisih pra-pasca), BUKAN nilai
// absolut 1 waktu — literatur riset bakar jerami sawah spesifik menegaskan
// dNBR jauh lebih sensitif membedakan "baru dipanen" (bare soil, NBR
// rendah tapi wajar) dari "bekas dibakar" (juga rendah, tapi karena
// insiden mendadak). Lihat PROJECT_LOG.md 25 Juli 2026 untuk rujukan
// lengkap & investigasi yang memotivasi ini.
//
// CATATAN PENTING SOAL TANDA (SIGN): dNBR tekstual FIREMON dihitung
// PRA-kebakaran MINUS PASCA-kebakaran (positif = kebakaran). Project ini
// menghitung SEBALIKNYA — scan SEKARANG minus scan SEBELUMNYA (kronologis,
// supaya intuitif dibaca "NBR naik/turun dari waktu ke waktu") — jadi di
// sini KEBAKARAN ditandai dNBR NEGATIF, bukan positif. JANGAN disamakan
// tanpa konversi tanda kalau membandingkan ke tabel severity FIREMON asli.
//
// Ambang -0.1 diambil dari batas bawah kelas "low severity" FIREMON/USGS
// (raw dNBR 100, skala umum *1000 -> 0.1 di skala natural -1..1 yang
// dipakai project ini untuk nbr_score).
export const DNBR_BURN_THRESHOLD = -0.1

// Gap maksimal antar-scan supaya penurunan dianggap "mendadak" (bukan
// siklus panen->tanam ulang yang wajar) — KEPUTUSAN DESAIN project ini,
// BUKAN dari literatur: interval scan normal project ini 6-10 hari (lihat
// lib/adaptive-scan.ts), jadi gap >15 hari kemungkinan besar cuma
// lompatan siklus musim, bukan insiden tunggal mendadak.
export const DNBR_MAX_GAP_DAYS = 15

const CLOUD_VALID_THRESHOLD = 15

export interface DnbrLogInput {
  scan_date: string
  nbr_score: number | null
  cloud_cover_percent: number | null
}

export interface DnbrResult {
  scan_date: string
  dnbr_score: number | null
  dnbr_reference_scan_date: string | null
}

// Pure — tidak menyentuh database, gampang diuji ulang manual kalau ambang
// perlu direvisi nanti.
export function computeDnbrSeries(logs: DnbrLogInput[]): DnbrResult[] {
  const sorted = [...logs].sort((a, b) => a.scan_date.localeCompare(b.scan_date))
  const results: DnbrResult[] = []
  let lastValid: { scan_date: string; nbr_score: number } | null = null

  for (const log of sorted) {
    const isValid =
      log.nbr_score != null &&
      log.cloud_cover_percent != null &&
      log.cloud_cover_percent <= CLOUD_VALID_THRESHOLD

    if (isValid && lastValid) {
      results.push({
        scan_date: log.scan_date,
        dnbr_score: Math.round((log.nbr_score! - lastValid.nbr_score) * 10000) / 10000,
        dnbr_reference_scan_date: lastValid.scan_date,
      })
    } else {
      results.push({ scan_date: log.scan_date, dnbr_score: null, dnbr_reference_scan_date: null })
    }

    if (isValid) lastValid = { scan_date: log.scan_date, nbr_score: log.nbr_score! }
  }

  return results
}

// Flag UI "penurunan mendadak" — beda dari sekadar "dnbr_score <= ambang",
// karena juga mensyaratkan gap waktu pendek (lihat DNBR_MAX_GAP_DAYS).
export function isSuddenBurnFlag(
  dnbrScore: number | null,
  referenceScanDate: string | null,
  currentScanDate: string
): boolean {
  if (dnbrScore == null || referenceScanDate == null) return false
  if (dnbrScore > DNBR_BURN_THRESHOLD) return false
  const gapDays = (new Date(currentScanDate).getTime() - new Date(referenceScanDate).getTime()) / 86400000
  return gapDays <= DNBR_MAX_GAP_DAYS
}

// ── Indikator Pembakaran Gabungan (dNBR + kecocokan waktu panen) ──────────
// Investigasi manual (lihat PROJECT_LOG.md 26 Juli 2026, contoh SSB/001)
// menunjukkan: flag dNBR SENDIRIAN tidak cukup — banyak yang cuma transisi
// fase tanaman wajar (NDVI ikut turun proporsional). Kecocokan dengan
// jendela pasca-panen (1-21 hari, waktu wajar bakar jerami) adalah sinyal
// tambahan yang JAUH lebih kuat. Fungsi ini otomatiskan pengecekan itu
// untuk SEMUA petak, supaya tidak perlu investigasi manual satu-satu lagi.
export type BurnIndicationCategory = 'likely_burn' | 'sudden_drop_not_harvest' | 'insufficient_data'

export interface HarvestDateInput {
  date: string
  isEstimated: boolean // true = dari estimated_harvest_date (dihitung otomatis), false = actual_harvest_date (dikonfirmasi)
}

export interface BurnIndicationResult {
  category: BurnIndicationCategory
  daysSinceHarvest: number | null
  harvestDate: string | null
  isEstimatedHarvest: boolean
}

// Jendela wajar bakar jerami pasca-panen — KEPUTUSAN DESAIN project ini
// (diminta eksplisit di spesifikasi fitur ini), bukan dari 1 sumber
// literatur tunggal, tapi konsisten dengan rentang umum yang disebutkan
// riset bakar jerami sawah (lihat rujukan dNBR di atas).
const HARVEST_WINDOW_MIN_DAYS = 1
const HARVEST_WINDOW_MAX_DAYS = 21

// Return null kalau baris ini TIDAK kena flag dNBR sama sekali — badge
// tidak perlu ditampilkan (tidak ada apa-apa untuk dilaporkan).
export function classifyBurnIndication(
  dnbrScore: number | null,
  dnbrReferenceScanDate: string | null,
  scanDate: string,
  harvestDates: HarvestDateInput[]
): BurnIndicationResult | null {
  if (!isSuddenBurnFlag(dnbrScore, dnbrReferenceScanDate, scanDate)) return null

  if (harvestDates.length === 0) {
    return { category: 'insufficient_data', daysSinceHarvest: null, harvestDate: null, isEstimatedHarvest: false }
  }

  for (const h of harvestDates) {
    const daysSince = Math.round((new Date(scanDate).getTime() - new Date(h.date).getTime()) / 86400000)
    if (daysSince >= HARVEST_WINDOW_MIN_DAYS && daysSince <= HARVEST_WINDOW_MAX_DAYS) {
      return { category: 'likely_burn', daysSinceHarvest: daysSince, harvestDate: h.date, isEstimatedHarvest: h.isEstimated }
    }
  }

  return { category: 'sudden_drop_not_harvest', daysSinceHarvest: null, harvestDate: null, isEstimatedHarvest: false }
}

// Hitung ulang dNBR untuk SEMUA baris satu petak, dari data yang sudah ada
// di database (dipanggil setelah baseline/scan/cron upsert NDVI+NBR baru,
// atau untuk backfill histori). Upsert 1 kali per plot (bukan per-baris)
// supaya efisien — konsisten dengan pola onConflict 'plot_id,scan_date'
// yang sudah dipakai di seluruh project ini.
export async function recomputeDnbrForPlot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  plotId: string
): Promise<{ rowsUpdated: number } | { error: string }> {
  const { data: logs, error: fetchErr } = await supabase
    .from('satellite_logs')
    .select('scan_date, nbr_score, cloud_cover_percent')
    .eq('plot_id', plotId)
    .not('nbr_score', 'is', null)
    .order('scan_date', { ascending: true })

  if (fetchErr) return { error: fetchErr.message }
  if (!logs || logs.length === 0) return { rowsUpdated: 0 }

  const results = computeDnbrSeries(logs)

  const payload = results.map((r) => ({
    plot_id: plotId,
    scan_date: r.scan_date,
    dnbr_score: r.dnbr_score,
    dnbr_reference_scan_date: r.dnbr_reference_scan_date,
  }))

  const { error: upsertErr } = await supabase
    .from('satellite_logs')
    .upsert(payload, { onConflict: 'plot_id,scan_date' })

  if (upsertErr) return { error: upsertErr.message }
  return { rowsUpdated: payload.length }
}
