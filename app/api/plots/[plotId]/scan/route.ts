import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSentinelToken } from '@/lib/sentinel-hub/auth'
import { getEffectiveScanInterval } from '@/lib/adaptive-scan'
import { fetchCatalogProduct } from '@/lib/sentinel-hub/catalog'
import { fetchTrueColorImage, uploadTrueColorImage } from '@/lib/sentinel-hub/truecolor'
import { fetchNbrImage, uploadNbrImage } from '@/lib/sentinel-hub/nbr'
import { recomputeDnbrForPlot } from '@/lib/dnbr'
import { CLOUD_COVER_THRESHOLD } from '@/lib/plot-geo'
import {
  pickClearestInterval,
  NDVI_EVALSCRIPT,
  NDWI_EVALSCRIPT,
  NBR_STATS_EVALSCRIPT,
  estimatePhase,
  fetchSentinelStats,
} from '@/lib/sentinel-hub/formulas'

// Evalscript NDVI/NDWI/NBR + estimatePhase() dikonsolidasi ke
// lib/sentinel-hub/formulas.ts (Tahap 2 refactor, 28 Juli 2026) — dulu
// duplikat persis di sini dan di app/api/plots/[plotId]/baseline/route.ts.
// cloud_cover_percent dari band SCL (deteksi awan/bayangan/cirrus SUNGGUHAN
// per-piksel) — bukan dari dataMask (cuma "ada data sensor", bukan deteksi
// awan). Lihat lib/sentinel-hub/ndvi.ts untuk konteks bug 08 Juli 2026.

interface Props {
  params: Promise<{ plotId: string }>
}

export async function POST(_req: NextRequest, { params }: Props) {
  const { plotId } = await params
  const supabase = createAdminClient()

  // Ambil geo_data (GeoJSON) dari v_plots + planting_date dari musim aktif (planting_seasons)
  const [{ data: plot, error: plotErr }, { data: activeSeason }] = await Promise.all([
    supabase.from('v_plots').select('id, geo_data, scan_interval_days').eq('id', plotId).single(),
    supabase.from('planting_seasons').select('planting_date').eq('plot_id', plotId).eq('status', 'aktif').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  if (plotErr || !plot) {
    return NextResponse.json({ error: 'Plot tidak ditemukan' }, { status: 404 })
  }

  // Ambil 3 scan terakhir untuk deteksi tren adaptif
  const { data: recentLogs } = await supabase
    .from('satellite_logs')
    .select('scan_date, ndvi_score')
    .eq('plot_id', plotId)
    .order('scan_date', { ascending: false })
    .limit(3)

  const adaptive = getEffectiveScanInterval(
    { scan_interval_days: plot.scan_interval_days, planting_date: activeSeason?.planting_date ?? null },
    [...(recentLogs ?? [])].reverse()
  )

  // Window: 30 hari ke belakang dari hari ini untuk tangkap citra terbaru
  const today = new Date()
  const toDate = today.toISOString().split('T')[0]
  const fromDate = new Date(today.getTime() - 30 * 86400000).toISOString().split('T')[0]

  // Token diambil sekali lalu dipakai bersama (getSentinelToken() sudah
  // cache in-memory, jadi ini tidak mengubah nilai token yang dipakai —
  // sebelumnya fetchStats lokal file ini memanggil getSentinelToken()
  // sendiri per-panggilan, 3x concurrent, hasil token tetap identik).
  const token = await getSentinelToken()
  const [ndviIntervals, ndwiIntervals, nbrIntervals] = await Promise.all([
    fetchSentinelStats(token, plot.geo_data, NDVI_EVALSCRIPT, 'ndvi', fromDate, toDate),
    fetchSentinelStats(token, plot.geo_data, NDWI_EVALSCRIPT, 'ndwi', fromDate, toDate),
    fetchSentinelStats(token, plot.geo_data, NBR_STATS_EVALSCRIPT, 'nbr', fromDate, toDate),
  ])

  // Pilih citra paling cerah (terbaru yang awan <= ambang; kalau tidak ada,
  // yang awannya paling sedikit) — lihat pickClearestInterval di formulas.ts
  const validNdvi = pickClearestInterval(ndviIntervals, CLOUD_COVER_THRESHOLD)

  if (!validNdvi) {
    return NextResponse.json({ error: 'Tidak ada data Sentinel-2 dalam 30 hari terakhir untuk lokasi ini' }, { status: 422 })
  }

  const scanDate = validNdvi.interval.from.split('T')[0]
  const ndviMean = validNdvi.outputs.ndvi.bands.B0.stats.mean
  const cloudMaskMean = validNdvi.outputs.cloudMask?.bands?.B0?.stats?.mean ?? 0
  const cloudPct = Math.round(cloudMaskMean * 1000) / 10

  // Ambil NDWI dari interval tanggal yang sama
  const matchNdwi = ndwiIntervals.find((d) => d.interval.from.split('T')[0] === scanDate)
  const ndwiMean = matchNdwi?.outputs?.ndwi?.bands?.B0?.stats?.mean ?? null

  // Ambil NBR dari interval tanggal yang sama
  const matchNbr = nbrIntervals.find((d) => d.interval.from.split('T')[0] === scanDate)
  const nbrMean = matchNbr?.outputs?.nbr?.bands?.B0?.stats?.mean ?? null

  const isValid = cloudPct <= CLOUD_COVER_THRESHOLD
  const estimated_phase = isValid ? estimatePhase(ndviMean, ndwiMean) : null

  // Metadata verifikasi (Catalog API) — terpisah dari Statistical API di atas.
  // Kegagalan di sini tidak boleh menggagalkan scan utama (silent fallback null).
  const catalogProduct = await fetchCatalogProduct(plot.geo_data, scanDate, 'sentinel-2-l2a').catch(() => null)

  // Citra True Color (Process API, beda dari Statistical API di atas) — dibuat
  // untuk scan BARU saja (belum backfill histori, keputusan 09 Juli 2026).
  // Kegagalan di sini tidak boleh menggagalkan scan utama (silent fallback null).
  const trueColorPath = await fetchTrueColorImage(plot.geo_data, scanDate)
    .then((buf) => (buf ? uploadTrueColorImage(supabase, plotId, scanDate, buf) : null))
    .catch(() => null)

  const nbrHeatmapPath = await fetchNbrImage(plot.geo_data, scanDate)
    .then((buf) => (buf ? uploadNbrImage(supabase, plotId, scanDate, buf) : null))
    .catch(() => null)

  const { data: inserted, error: insertErr } = await supabase
    .from('satellite_logs')
    .upsert(
      {
        plot_id: plotId,
        scan_date: scanDate,
        ndvi_score: Math.round(ndviMean * 10000) / 10000,
        ndwi_score: ndwiMean !== null ? Math.round(ndwiMean * 10000) / 10000 : null,
        nbr_score: nbrMean !== null ? Math.round(nbrMean * 10000) / 10000 : null,
        cloud_cover_percent: cloudPct,
        estimated_phase,
        ndvi_product_id: catalogProduct?.id ?? null,
        ndvi_acquisition_datetime: catalogProduct?.datetime ?? null,
        ndvi_platform: catalogProduct?.platform ?? null,
        true_color_path: trueColorPath,
        nbr_heatmap_path: nbrHeatmapPath,
      },
      { onConflict: 'plot_id,scan_date' }
    )
    .select('id, scan_date, ndvi_score, ndwi_score, nbr_score, cloud_cover_percent, estimated_phase, true_color_path, nbr_heatmap_path')
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Hitung ulang dNBR (selisih NBR antar-scan) untuk seluruh histori petak
  // ini — pelengkap ambang absolut NBR, lihat lib/dnbr.ts. Kegagalan di
  // sini tidak boleh menggagalkan scan utama.
  await recomputeDnbrForPlot(supabase, plotId).catch(() => null)

  return NextResponse.json({
    ok: true,
    scan: inserted,
    adaptive: {
      mode: adaptive.mode,
      effective_interval_days: adaptive.interval,
      reason: adaptive.reason,
      planting_date: activeSeason?.planting_date ?? null,
    },
  })
}
