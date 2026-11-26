'use client'

import { useState } from 'react'
import type { BurnIndicationResult } from '@/lib/dnbr'
import { fmtDateLong as fmtDate } from '@/lib/format'

interface ScanPoint {
  scan_date: string
  nbr_score: number | null
  ndvi_score: number | null
}

interface Props {
  result: BurnIndicationResult | null
  // Data mentah untuk "Lihat Detail Analisis" — TIDAK mempengaruhi kategori
  // (itu sudah diputuskan oleh classifyBurnIndication di lib/dnbr.ts), murni
  // dipakai untuk menjelaskan DASAR di balik kesimpulan yang sudah ada.
  currentScan: ScanPoint | null
  referenceScan: ScanPoint | null
}

function fmtNum(v: number | null) {
  return v == null ? '—' : v.toFixed(2)
}

function gapDaysBetween(a: string, b: string) {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000)
}

// Indikator Pembakaran Gabungan — dNBR (selisih NBR antar-scan) + kecocokan
// waktu panen, lihat lib/dnbr.ts untuk logika lengkap & rujukan. `result`
// null (dNBR tidak kena flag sama sekali) = tidak render apa-apa, TIDAK ada
// badge kosong yang mengganggu tampilan.
export default function BurnIndicatorBadge({ result, currentScan, referenceScan }: Props) {
  const [showDetail, setShowDetail] = useState(false)
  if (!result) return null

  // Kalimat detail beda per kategori — cuma perlu currentScan+referenceScan
  // (sudah tersedia di semua kategori yang lolos ke sini, karena result
  // non-null artinya dNBR pasti kena flag, yang artinya scan sekarang &
  // scan pembanding pasti valid & ber-NBR).
  function renderDetail() {
    if (!currentScan || !referenceScan) return null
    const gapDays = gapDaysBetween(currentScan.scan_date, referenceScan.scan_date)
    const dnbrText = currentScan.nbr_score != null && referenceScan.nbr_score != null
      ? (currentScan.nbr_score - referenceScan.nbr_score).toFixed(2)
      : '—'

    if (result!.category === 'likely_burn') {
      const estimasiNote = result!.isEstimatedHarvest ? ' (estimasi, belum dikonfirmasi)' : ''
      return (
        <p>
          NBR turun dari {fmtNum(referenceScan.nbr_score)} ({fmtDate(referenceScan.scan_date)}) ke {fmtNum(currentScan.nbr_score)} ({fmtDate(currentScan.scan_date)})
          {' '}— selisih {dnbrText} dalam {gapDays} hari, {result!.daysSinceHarvest} hari setelah tanggal panen tercatat{estimasiNote} ({fmtDate(result!.harvestDate!)}).
          {' '}NDVI juga turun dari {fmtNum(referenceScan.ndvi_score)} ke {fmtNum(currentScan.ndvi_score)} di periode yang sama.
        </p>
      )
    }

    if (result!.category === 'sudden_drop_not_harvest') {
      return (
        <p>
          NBR turun dari {fmtNum(referenceScan.nbr_score)} ({fmtDate(referenceScan.scan_date)}) ke {fmtNum(currentScan.nbr_score)} ({fmtDate(currentScan.scan_date)})
          {' '}— selisih {dnbrText} dalam {gapDays} hari. NDVI turun dari {fmtNum(referenceScan.ndvi_score)} ke {fmtNum(currentScan.ndvi_score)} di periode yang sama.
          {' '}Tidak ada tanggal panen tercatat dalam 21 hari sebelum penurunan ini, jadi kemungkinan besar ini transisi fase tanaman biasa (bukan bekas panen), atau gangguan data lain.
        </p>
      )
    }

    // insufficient_data
    return (
      <p>
        Petak ini terdeteksi penurunan NBR mendadak pada {fmtDate(currentScan.scan_date)} (dNBR {dnbrText}), TAPI tidak ada data tanggal panen tercatat
        {' '}sama sekali untuk musim tanam yang relevan — sistem tidak bisa menilai apakah ini terkait pembakaran atau bukan. Isi data &quot;Musim Tanam&quot;
        {' '}untuk petak ini supaya penilaian ke depan lebih akurat.
      </p>
    )
  }

  const style =
    result.category === 'likely_burn'
      ? { box: 'bg-red-50 border-red-200 text-red-800', detail: 'border-red-200 text-red-900', toggle: 'text-red-700 hover:text-red-900' }
      : result.category === 'sudden_drop_not_harvest'
      ? { box: 'bg-amber-50 border-amber-200 text-amber-800', detail: 'border-amber-200 text-amber-900', toggle: 'text-amber-700 hover:text-amber-900' }
      : { box: 'bg-gray-50 border-gray-200 text-gray-600', detail: 'border-gray-200 text-gray-700', toggle: 'text-gray-500 hover:text-gray-800' }

  return (
    <div className={`rounded-lg px-3 py-2 text-xs leading-relaxed border ${style.box}`}>
      {result.category === 'likely_burn' && (
        <>
          🔥 Kemungkinan pembakaran terdeteksi — {result.daysSinceHarvest} hari setelah panen{result.isEstimatedHarvest ? ' (estimasi, belum dikonfirmasi)' : ''} ({fmtDate(result.harvestDate!)}).
          Indikasi otomatis, BUKAN bukti pasti — perlu konfirmasi lapangan.
        </>
      )}
      {result.category === 'sudden_drop_not_harvest' && (
        <>⚠️ Penurunan NBR mendadak terdeteksi, TIDAK dekat waktu panen — kemungkinan besar bukan indikasi bakar (transisi fase tanaman atau gangguan lain).</>
      )}
      {result.category === 'insufficient_data' && (
        <>ℹ️ Tidak dapat dinilai — data musim tanam/tanggal panen belum lengkap untuk petak ini.</>
      )}

      {(currentScan && referenceScan) && (
        <>
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className={`block mt-1.5 font-medium underline decoration-dotted underline-offset-2 ${style.toggle}`}
          >
            {showDetail ? 'Sembunyikan detail analisis' : 'Lihat detail analisis'}
          </button>
          {showDetail && (
            <div className={`mt-1.5 pt-1.5 border-t ${style.detail}`}>
              {renderDetail()}
            </div>
          )}
        </>
      )}
    </div>
  )
}
