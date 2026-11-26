import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import KawasanPageClient from '@/components/kawasan/KawasanPageClient'

interface Props {
  params: Promise<{ kawasanId: string }>
}

export default async function KawasanDetailPage({ params }: Props) {
  const { kawasanId } = await params
  const supabase = createAdminClient()

  const [{ data: kawasan }, { data: plots }] = await Promise.all([
    supabase
      .from('kawasan')
      .select('id, name, local_term, region, total_area_ha')
      .eq('id', kawasanId)
      .single(),
    supabase
      .from('v_plots')
      .select('id, farmer_name, crop_variety, area_ha, geo_data, status_lahan, nama_penggarap, nama_pemilik')
      .eq('kawasan_id', kawasanId)
      .order('created_at', { ascending: true }),
  ])

  if (!kawasan) notFound()

  // boundary_geojson di-query terpisah — graceful degradation kalau kolom belum ada
  // (migration 05 belum dijalankan → null, halaman tetap load, Nominatim jadi fallback)
  const { data: boundaryRow } = await supabase
    .from('kawasan')
    .select('boundary_geojson')
    .eq('id', kawasanId)
    .single()
  const boundaryGeojson = (boundaryRow?.boundary_geojson as Record<string, unknown>) ?? null

  const plotIds = (plots ?? []).map((p) => p.id)

  // KPI + tooltip data: ambil satellite_logs dan planting_seasons aktif
  const [latestLogs, activeSeasons] = await Promise.all([
    plotIds.length > 0
      ? supabase
          .from('satellite_logs')
          .select('plot_id, scan_date, ndvi_score, ndwi_score, nbr_score, nbr_heatmap_path, cloud_cover_percent, estimated_phase')
          .in('plot_id', plotIds)
          .order('scan_date', { ascending: false })
      : Promise.resolve({ data: [] }),
    plotIds.length > 0
      ? supabase
          .from('planting_seasons')
          .select('plot_id, planting_date, crop_variety')
          .in('plot_id', plotIds)
          .eq('status', 'aktif')
      : Promise.resolve({ data: [] }),
  ])

  // Per-plot: ambil scan terbaru (log sudah diorder DESC, ambil first occurrence).
  // `phase` di sini SENGAJA tetap bisa null (fase scan paling baru apa adanya,
  // termasuk kalau tertutup awan) — dipakai buat "latest_scan_date" tetap jujur
  // menunjukkan kapan TERAKHIR dicoba, bukan kapan terakhir fase-nya valid.
  const latestScanPerPlot = new Map<string, {
    ndvi: number | null;
    ndwi: number | null;
    nbr: number | null;
    cloudCover: number | null;
    phase: string | null;
    scan_date: string;
  }>()
  // Per-plot: baris PALING BARU yang estimated_phase-nya TIDAK null — dicari
  // mundur lewat riwayat (skip baris berawan/invalid), supaya tampilan ringkasan
  // kawasan tidak kehilangan histori fase valid cuma karena scan TERBARU
  // kebetulan tertutup awan (akar masalah kasus MM04/MM05 "Belum ada scan").
  const latestValidPhasePerPlot = new Map<string, { phase: string; date: string }>()
  for (const log of (latestLogs.data ?? [])) {
    if (!latestScanPerPlot.has(log.plot_id)) {
      latestScanPerPlot.set(log.plot_id, {
        ndvi: log.ndvi_score,
        ndwi: log.ndwi_score,
        nbr: log.nbr_score,
        cloudCover: log.cloud_cover_percent,
        phase: log.estimated_phase,
        scan_date: log.scan_date,
      })
    }
    if (log.estimated_phase && !latestValidPhasePerPlot.has(log.plot_id)) {
      latestValidPhasePerPlot.set(log.plot_id, { phase: log.estimated_phase, date: log.scan_date })
    }
  }

  // Per-plot: varietas dari musim aktif
  const activeVarietyPerPlot = new Map<string, string | null>()
  for (const s of (activeSeasons.data ?? [])) {
    activeVarietyPerPlot.set(s.plot_id, s.crop_variety ?? null)
  }

  // Rata-rata NDVI dari scan terbaru per plot (KPI)
  const ndviValues = [...latestScanPerPlot.values()]
    .map(v => v.ndvi)
    .filter((v): v is number => v !== null)
  const avgNdvi = ndviValues.length > 0
    ? Math.round((ndviValues.reduce((s, v) => s + v, 0) / ndviValues.length) * 1000) / 1000
    : null

  const lastScanDate = (latestLogs.data ?? [])[0]?.scan_date ?? null

  // Petak mode intensif: ada planting_seasons aktif dengan planting_date dalam 120 hari terakhir
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const intensivePlots = (activeSeasons.data ?? []).filter((s: { planting_date: string }) => {
    const planted = new Date(s.planting_date)
    const end = new Date(planted.getTime() + 120 * 86400000)
    return today >= planted && today <= end
  }).length

  const totalArea = (plots ?? []).reduce((s, p) => s + (p.area_ha ?? 0), 0)

  // Enrich plots dengan data tooltip per-petak
  const enrichedPlots = (plots ?? []).map((p) => ({
    ...p,
    active_variety: activeVarietyPerPlot.get(p.id) ?? null,
    latest_ndvi: latestScanPerPlot.get(p.id)?.ndvi ?? null,
    latest_ndwi: latestScanPerPlot.get(p.id)?.ndwi ?? null,
    latest_nbr: latestScanPerPlot.get(p.id)?.nbr ?? null,
    latest_cloud_cover: latestScanPerPlot.get(p.id)?.cloudCover ?? null,
    latest_phase: latestScanPerPlot.get(p.id)?.phase ?? null,
    latest_scan_date: latestScanPerPlot.get(p.id)?.scan_date ?? null,
    latest_valid_phase: latestValidPhasePerPlot.get(p.id)?.phase ?? null,
    latest_valid_phase_date: latestValidPhasePerPlot.get(p.id)?.date ?? null,
    status_lahan: (p as { status_lahan?: string | null }).status_lahan ?? null,
    nama_penggarap: (p as { nama_penggarap?: string | null }).nama_penggarap ?? null,
    nama_pemilik: (p as { nama_pemilik?: string | null }).nama_pemilik ?? null,
  }))

  return (
    <KawasanPageClient
      kawasan={kawasan}
      plots={enrichedPlots}
      kpi={{ totalArea, lastScanDate, avgNdvi, intensivePlots }}
      boundaryGeojson={boundaryGeojson}
    />
  )
}
