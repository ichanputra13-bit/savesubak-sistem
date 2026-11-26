import InfoTooltip from '@/components/plots/InfoTooltip'
import { PHASE_LABEL, CLOUD_COVER_THRESHOLD } from '@/lib/plot-geo'
import type { PlantingSeason, PlotDetail, SatelliteLog, WaterPatternType } from '@/lib/types/plot'

// ── Insight engine (rule-based) ────────────────────────────────────────────────
export type Insight = { level: 'info' | 'warning' | 'success'; text: string }

export function deriveInsights(scan: SatelliteLog | null, plot: PlotDetail, activeSeason: PlantingSeason | null): Insight[] {
  if (!scan) return [{ level: 'info', text: 'Belum ada data scan satelit. Klik "Picu Scan" atau tunggu jadwal otomatis.' }]

  const out: Insight[] = []
  const daysSince = Math.floor((Date.now() - new Date(scan.scan_date).getTime()) / 86400000)

  if (daysSince > plot.scan_interval_days + 5)
    out.push({ level: 'warning', text: `Scan terakhir ${daysSince} hari lalu — melewati interval ${plot.scan_interval_days} hari.` })

  // Kalau citra tertutup awan (atau estimated_phase sudah di-null-kan lewat audit
  // cloud cover 08 Juli 2026), JANGAN lanjut hitung insight fase/kering-basah dari
  // NDVI/NDWI yang sama — nilainya sudah dinyatakan tidak bisa dipercaya, insight
  // yang dihitung dari situ cuma akan mengulang kesalahan yang sama dengan nada
  // percaya diri (persis bug yang bikin "kosong" salah disimpulkan padahal berawan).
  const cloud = scan.cloud_cover_percent ?? 0
  const dataUnreliable = cloud > CLOUD_COVER_THRESHOLD || scan.estimated_phase === null
  if (dataUnreliable) {
    out.push({
      level: 'warning',
      text: `Citra tertutup awan ${cloud.toFixed(0)}% — NDVI/NDWI tanggal ini tidak bisa dipercaya. Fase dan kondisi lahan tidak ditampilkan untuk scan ini.`,
    })
    return out
  }

  // Gunakan logic yang sama dengan estimatePhase() di scan route — konsisten dengan kartu Data Scan
  const ndvi = scan.ndvi_score
  const ndwi = scan.ndwi_score
  if (ndvi !== null) {
    if (ndvi < 0.1) {
      out.push({ level: 'info', text: 'Lahan terdeteksi kosong atau bera (NDVI < 0.1).' })
    } else if (ndvi < 0.3) {
      out.push({ level: 'info', text: 'Fase semai atau awal pertumbuhan — vegetasi sangat rendah.' })
    } else if (ndvi < 0.5) {
      if (ndwi !== null && ndwi < -0.35) {
        out.push({ level: 'success', text: 'Fase pematangan — lahan kering (NDWI rendah), bulir sedang mengering menjelang panen.' })
      } else {
        out.push({ level: 'success', text: 'Fase vegetatif — pertumbuhan aktif, kanopi berkembang baik.' })
      }
    } else if (ndvi < 0.7) {
      if (ndwi !== null && ndwi < -0.3) {
        out.push({ level: 'success', text: 'Fase pematangan — NDWI sangat rendah, bulir mengering, panen kemungkinan dekat.' })
      } else {
        out.push({ level: 'success', text: 'Fase generatif — padi mulai berbunga atau berbulir.' })
      }
    } else {
      out.push({ level: 'success', text: 'Fase pematangan — NDVI tinggi, panen kemungkinan dalam waktu dekat.' })
    }
  }

  // NDWI insight: skip peringatan "kering" kalau sudah teridentifikasi sebagai fase pematangan
  // (NDWI rendah saat pematangan adalah hal yang diharapkan, bukan anomali)
  const isPematangan = ndvi !== null && (
    ndvi >= 0.7 ||
    (ndvi >= 0.5 && ndwi !== null && ndwi < -0.3) ||
    (ndvi >= 0.3 && ndwi !== null && ndwi < -0.35)
  )
  if (ndwi !== null) {
    if (ndwi > 0.3) out.push({ level: 'warning', text: `Genangan tinggi terdeteksi (NDWI ${ndwi.toFixed(2)}) — pastikan drainase terkontrol.` })
    else if (ndwi < -0.1 && !isPematangan) out.push({ level: 'warning', text: `Lahan terdeteksi kering (NDWI ${ndwi.toFixed(2)}) — pertimbangkan pengairan.` })
  }

  // NBR — SELALU ditampilkan (diminta user 18 Juli): status pembakaran
  // relevan untuk data karbon (klaim AWD/CO2e tidak sah kalau lahan bekas
  // dibakar) — ambang sama dengan NbrTrendChart.
  if (scan.nbr_score !== null) {
    if (scan.nbr_score < -0.25) out.push({ level: 'warning', text: `Indikasi kuat bekas terbakar (NBR ${scan.nbr_score.toFixed(2)}) — cek lapangan langsung, ini relevan untuk keabsahan klaim karbon.` })
    else if (scan.nbr_score < 0.1) out.push({ level: 'warning', text: `Kemungkinan bekas terbakar ringan (NBR ${scan.nbr_score.toFixed(2)}) — bisa juga tanah kosong pasca panen, perlu dicek untuk keabsahan klaim karbon.` })
    else out.push({ level: 'success', text: `Tidak ada indikasi terbakar (NBR ${scan.nbr_score.toFixed(2)}) — lahan aman untuk data karbon.` })
  }

  // dNBR + kecocokan waktu panen — DIGANTIKAN oleh "Indikator Pembakaran
  // Gabungan" (BurnIndicatorBadge, dekat chart NBR) sejak 26 Juli 2026 —
  // versi lama di sini (dNBR sendirian tanpa cek waktu panen) dihapus,
  // supaya tidak ada 2 sinyal berbeda/berpotensi tumpang tindih untuk hal
  // yang sama. Lihat lib/dnbr.ts classifyBurnIndication().

  if (out.length === 0)
    out.push({ level: 'info', text: 'Kondisi lahan terlihat normal berdasarkan data satelit terakhir.' })

  // Ringkasan musim tanam aktif — data SAMA dengan yang ditampilkan di tab
  // Musim Tanam & Karbon, cuma diringkas di sini biar tidak perlu buka tab lain
  // untuk lihat gambaran umum. Sengaja dipisah dari fallback "normal" di atas
  // (musim tanam adalah info tambahan, bukan pengganti status hari ini).
  if (activeSeason?.water_pattern) {
    const wp = activeSeason.water_pattern
    const patternText: Record<string, string> = {
      oscillating_awd_like: 'pola berselang-seling (mirip AWD)',
      borderline_ambiguous: 'pola campuran, belum tegas',
      continuous_flooding: 'tergenang terus-menerus',
      insufficient_data: 'data belum cukup untuk disimpulkan',
    }
    let seasonText = `Musim tanam berjalan: ${patternText[wp.pattern_detected] ?? wp.pattern_detected}`
    if (wp.awd_intentionality_pct != null) {
      seasonText += ` — ${wp.awd_intentionality_pct}% bukti pengeringan aktif`
    }
    if (wp.estimated_co2e_tonnes != null) {
      seasonText += `, estimasi ${wp.estimated_co2e_tonnes.toFixed(2)} ton CO2e (ilustratif).`
    } else {
      seasonText += '.'
    }
    out.push({ level: 'info', text: seasonText })
  }

  return out
}

// ── Format helpers ─────────────────────────────────────────────────────────────

// "sentinel-2c" -> "Sentinel-2C", "sentinel-1d" -> "Sentinel-1D"
export function formatPlatform(p: string | null): string {
  if (!p) return '—'
  return p.replace(/^sentinel-(\d)([a-z])$/i, (_m, num, letter) => `Sentinel-${num}${String(letter).toUpperCase()}`)
}

export function fmtPreciseDatetime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    timeZone: 'Asia/Jakarta',
  }) + ' WIB'
}

// Statistik tutupan awan untuk 1 musim tanam, dihitung client-side dari
// satelliteLogs yang sudah di-fetch (tidak perlu API call tambahan) —
// scoped ke rentang planting_date..actual_harvest_date/hari ini, sama
// seperti fn_analyze_season_water_pattern.
export function seasonCloudStats(logs: SatelliteLog[], from: string, to: string | null) {
  const end = to ?? new Date().toISOString().slice(0, 10)
  const inRange = logs.filter((l) => l.ndvi_score !== null && l.scan_date >= from && l.scan_date <= end)
  const total = inRange.length
  const cloudy = inRange.filter((l) => (l.cloud_cover_percent ?? 0) > CLOUD_COVER_THRESHOLD).length
  return { total, cloudy, pct: total > 0 ? Math.round((cloudy / total) * 1000) / 10 : 0 }
}

// "Belum ada scan" hanya kalau memang tidak ada baris sama sekali. Kalau scan
// ADA (activeScan tidak null) tapi estimated_phase null, itu artinya citra
// tertutup awan (dari validasi is_valid saat scan, atau audit cloud cover
// retroaktif 08 Juli 2026) — bukan "tidak pernah di-scan". Dua kondisi ini
// HARUS ditampilkan beda supaya tidak menyesatkan.
export function phaseBadgeText(scan: SatelliteLog | null): string {
  if (!scan) return 'Belum ada scan'
  if (scan.estimated_phase) return PHASE_LABEL[scan.estimated_phase] ?? scan.estimated_phase
  return '☁️ Tertutup awan — fase tidak dapat ditentukan'
}

export function polygonCentroid(geoData: { coordinates?: number[][][] } | null | undefined): [number, number] | null {
  const ring = geoData?.coordinates?.[0]
  if (!ring || ring.length === 0) return null
  return [
    ring.reduce((s, [, lat]) => s + lat, 0) / ring.length,
    ring.reduce((s, [lng]) => s + lng, 0) / ring.length,
  ]
}

// Copernicus Browser mendukung deep-link zoom/lat/lng/fromTime/toTime (dikonfirmasi
// dari dokumentasi resmi + repo eu-cdse/copernicus-browser) — siapa pun bisa buka
// link ini dan cek sendiri citra di lokasi+tanggal yang sama tanpa perlu percaya ke dashboard kami.
export function copernicusBrowserUrl(lat: number, lng: number, date: string): string {
  const params = new URLSearchParams({
    zoom: '17',
    lat: lat.toFixed(6),
    lng: lng.toFixed(6),
    fromTime: `${date}T00:00:00.000Z`,
    toTime: `${date}T23:59:59.999Z`,
  })
  return `https://browser.dataspace.copernicus.eu/?${params.toString()}`
}

export function scoreChip(
  value: number | null,
  label: string,
  colorFn: (v: number) => string,
  tooltip?: { title: string; body: string }
) {
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
      <span className="flex items-center gap-1 text-xs text-gray-500">
        {label}
        {tooltip && (
          <InfoTooltip title={tooltip.title}>
            <span>{tooltip.body}</span>
          </InfoTooltip>
        )}
      </span>
      <span
        className="text-xl font-bold mt-0.5"
        style={{ color: value !== null ? colorFn(value) : '#9ca3af' }}
      >
        {value !== null ? value.toFixed(3) : '—'}
      </span>
    </div>
  )
}

export function ndviColor(v: number): string {
  if (v < 0.1) return '#ca8a04'
  if (v < 0.3) return '#65a30d'
  if (v < 0.5) return '#16a34a'
  if (v < 0.7) return '#15803d'
  return '#14532d'
}

export function ndwiColor(v: number): string {
  if (v < 0) return '#b45309'
  if (v < 0.2) return '#0284c7'
  return '#1d4ed8'
}

export function nbrColor(v: number): string {
  if (v < -0.25) return '#7f1d1d'
  if (v < 0.1) return '#ea580c'
  if (v < 0.3) return '#84cc16'
  return '#16a34a'
}

// Label + warna hasil analisis pola pengairan rule-based (bukan AI/LLM) —
// lihat fn_analyze_season_water_pattern di migration_v12
export const WATER_PATTERN_LABEL: Record<WaterPatternType, { label: string; bg: string; text: string; icon: string }> = {
  oscillating_awd_like: { label: 'Basah-kering berulang (indikasi AWD)', bg: '#dceee1', text: '#1c6b43', icon: '🌊' },
  continuous_flooding: { label: 'Tergenang kontinu (belum indikasi AWD)', bg: '#fbf0dc', text: '#8a5f18', icon: '💧' },
  borderline_ambiguous: { label: 'Pola campuran — tidak cukup tegas untuk disimpulkan, perlu konfirmasi lapangan.', bg: '#eae6d9', text: '#6b6047', icon: '⚠️' },
  insufficient_data: { label: 'Data belum cukup', bg: '#f1efe9', text: '#7a7568', icon: '◌' },
}
