const INTENSIVE_INTERVAL_DAYS = 6
const INTENSIVE_WINDOW_DAYS = 120

// Threshold deteksi tren NDVI: bera → awal pertumbuhan
const NDVI_LOW_THRESHOLD = 0.2
const NDVI_HIGH_THRESHOLD = 0.3

export interface AdaptiveIntervalResult {
  interval: number
  mode: 'intensive_planting' | 'intensive_ndvi' | 'normal'
  reason: string
}

/**
 * Tentukan interval scan efektif untuk sebuah plot.
 *
 * Priority:
 * 1. planting_date terisi + hari ini dalam window 0–120 hari → mode intensif
 * 2. Tren NDVI naik signifikan (<0.2 → >0.3) dalam 2 scan terakhir → mode intensif
 * 3. Fallback: scan_interval_days normal dari tabel plots
 */
export function getEffectiveScanInterval(
  plot: { scan_interval_days: number; planting_date?: string | null },
  recentLogs: Array<{ scan_date: string; ndvi_score: number | null }>
): AdaptiveIntervalResult {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // ── Mode 1: planting_date eksplisit ──────────────────────────────────────────
  if (plot.planting_date) {
    const plantDate = new Date(plot.planting_date)
    plantDate.setHours(0, 0, 0, 0)
    const endIntensive = new Date(plantDate.getTime() + INTENSIVE_WINDOW_DAYS * 86400000)
    const daysIn = Math.floor((today.getTime() - plantDate.getTime()) / 86400000)

    if (today >= plantDate && today <= endIntensive) {
      return {
        interval: INTENSIVE_INTERVAL_DAYS,
        mode: 'intensive_planting',
        reason: `Hari ke-${daysIn} dari tanggal tanam (window intensif 120 hari)`,
      }
    }
  }

  // ── Mode 2: deteksi tren NDVI ─────────────────────────────────────────────
  if (recentLogs.length >= 2) {
    const sorted = [...recentLogs]
      .filter((l) => l.ndvi_score !== null)
      .sort((a, b) => a.scan_date.localeCompare(b.scan_date))

    if (sorted.length >= 2) {
      const prev = sorted[sorted.length - 2]
      const last = sorted[sorted.length - 1]
      const prevNdvi = prev.ndvi_score!
      const lastNdvi = last.ndvi_score!

      if (prevNdvi < NDVI_LOW_THRESHOLD && lastNdvi > NDVI_HIGH_THRESHOLD) {
        return {
          interval: INTENSIVE_INTERVAL_DAYS,
          mode: 'intensive_ndvi',
          reason: `NDVI naik signifikan (${prevNdvi.toFixed(2)} → ${lastNdvi.toFixed(2)}) — terdeteksi awal pertumbuhan`,
        }
      }
    }
  }

  // ── Fallback: interval statis ─────────────────────────────────────────────
  return {
    interval: plot.scan_interval_days,
    mode: 'normal',
    reason: `Interval normal ${plot.scan_interval_days} hari`,
  }
}
