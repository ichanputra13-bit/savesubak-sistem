import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import PlotDashboard from '@/components/plots/PlotDashboard'
import type { OwnershipRecord, PlotDetail, SatelliteLog, FieldLog, PlantingSeason, WaterPatternAnalysis, WeatherLog } from '@/lib/types/plot'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ kawasanId: string; plotId: string }>
}

export default async function PlotDetailPage({ params }: Props) {
  const { kawasanId, plotId } = await params
  const supabase = createAdminClient()

  const { data: plot } = await supabase
    .from('v_plots')
    .select('id, kawasan_id, farmer_name, crop_variety, area_ha, scan_interval_days, geo_data')
    .eq('id', plotId)
    .eq('kawasan_id', kawasanId)
    .single()

  if (!plot) notFound()

  // Ambil weather_logs bertahap (pagination) — batas default PostgREST di
  // project ini (Max Rows) memotong hasil walau .limit() client diset lebih
  // tinggi. Backfill 3 tahun = ~1094 baris, di atas batas 1000 default,
  // jadi harus di-page supaya 90+ hari TERAKHIR (paling relevan) tidak
  // diam-diam hilang. Ditemukan &amp; dibuktikan 18 Juli 2026.
  async function fetchAllWeatherLogs() {
    const pageSize = 1000
    const all: WeatherLog[] = []
    for (let page = 0; ; page++) {
      const { data, error } = await supabase
        .from('weather_logs')
        .select('date, rainfall_mm, temp_avg_c, humidity_avg_pct')
        .eq('plot_id', plotId)
        .order('date', { ascending: true })
        .range(page * pageSize, page * pageSize + pageSize - 1)
      if (error || !data) break
      all.push(...(data as WeatherLog[]))
      if (data.length < pageSize) break
    }
    return all
  }

  const [{ data: kawasan }, { data: satLogs }, { data: fieldLogs }, { data: plotRaw }, { data: seasons }, { data: ownershipRaw }, weatherRaw] =
    await Promise.all([
      supabase.from('kawasan').select('id, name').eq('id', kawasanId).single(),
      supabase
        .from('satellite_logs')
        .select('id, scan_date, ndvi_score, ndwi_score, nbr_score, dnbr_score, dnbr_reference_scan_date, cloud_cover_percent, estimated_phase, true_color_path, ndvi_heatmap_path, ndwi_heatmap_path, nbr_heatmap_path, sar_vv, sar_vh, sar_flood_index, sar_orbit_direction, sar_source')
        .eq('plot_id', plotId)
        .order('scan_date', { ascending: true }),
      supabase
        .from('field_logs')
        .select('id, log_type, log_date, photo_path, harvest_kg, note, source')
        .eq('plot_id', plotId)
        .order('log_date', { ascending: false }),
      supabase.from('plots').select('planting_date, status_lahan, nama_lso, nomor_sertifikat, tanggal_kadaluarsa, nama_pemilik, nama_penggarap').eq('id', plotId).single(),
      supabase
        .from('planting_seasons')
        .select('id, plot_id, season_year, season_number, crop_variety, planting_date, estimated_harvest_date, actual_harvest_date, actual_harvest_kg, status, notes')
        .eq('plot_id', plotId)
        .order('season_year', { ascending: false })
        .order('season_number', { ascending: false }),
      supabase
        .from('plot_ownership_history')
        .select('id, nama_pemilik, nama_penggarap, tanggal_mulai, tanggal_selesai, notes, created_at')
        .eq('plot_id', plotId)
        .order('tanggal_mulai', { ascending: false }),
      fetchAllWeatherLogs(),
    ])

  // Metadata verifikasi sumber (Catalog API, migration_v15) — query TERPISAH
  // dan graceful degradation, sama alasannya dengan season_water_pattern_analysis
  // di bawah: kolom baru, migration belum tentu sudah dijalankan user.
  const satLogIds = (satLogs ?? []).map((l) => l.id)
  const sourceMetaById = new Map<string, {
    ndvi_product_id: string | null; ndvi_acquisition_datetime: string | null; ndvi_platform: string | null
    sar_product_id: string | null; sar_acquisition_datetime: string | null; sar_platform: string | null
  }>()
  if (satLogIds.length > 0) {
    const { data: sourceMeta } = await supabase
      .from('satellite_logs')
      .select('id, ndvi_product_id, ndvi_acquisition_datetime, ndvi_platform, sar_product_id, sar_acquisition_datetime, sar_platform')
      .in('id', satLogIds)
    for (const m of (sourceMeta ?? [])) {
      sourceMetaById.set(m.id, m as {
        ndvi_product_id: string | null; ndvi_acquisition_datetime: string | null; ndvi_platform: string | null
        sar_product_id: string | null; sar_acquisition_datetime: string | null; sar_platform: string | null
      })
    }
  }
  const satLogsWithSourceMeta = (satLogs ?? []).map((l) => ({
    ...l,
    ...(sourceMetaById.get(l.id) ?? {
      ndvi_product_id: null, ndvi_acquisition_datetime: null, ndvi_platform: null,
      sar_product_id: null, sar_acquisition_datetime: null, sar_platform: null,
    }),
  }))

  // Analisis pola pengairan — query TERPISAH dan graceful degradation:
  // tabel season_water_pattern_analysis baru (migration_v12), belum tentu
  // sudah dijalankan user saat kode ini deploy. Kalau query error (tabel
  // belum ada), fallback ke map kosong — jangan sampai halaman 404/crash
  // (pelajaran dari insiden boundary_geojson 04 Juli 2026, CLAUDE.md §6).
  const seasonIds = (seasons ?? []).map((s) => s.id)
  const waterPatternBySeasonId = new Map<string, WaterPatternAnalysis>()
  if (seasonIds.length > 0) {
    const { data: waterPatterns } = await supabase
      .from('season_water_pattern_analysis')
      .select('id, planting_season_id, pattern_detected, oscillation_count, ndwi_points_used, sar_points_used, confidence_note, calculated_at, total_aeration_days, estimated_co2e_tonnes, dry_points_total, dry_points_with_rain, awd_intentionality_pct')
      .in('planting_season_id', seasonIds)
    for (const wp of (waterPatterns ?? []) as WaterPatternAnalysis[]) {
      waterPatternBySeasonId.set(wp.planting_season_id, wp)
    }
  }
  const seasonsWithWaterPattern = (seasons ?? []).map((s) => ({
    ...s,
    water_pattern: waterPatternBySeasonId.get(s.id) ?? null,
  }))

  const plotDetail: PlotDetail = {
    id: plot.id,
    kawasan_id: plot.kawasan_id,
    kawasan_name: kawasan?.name ?? kawasanId,
    farmer_name: plot.farmer_name,
    crop_variety: plot.crop_variety ?? null,
    area_ha: plot.area_ha,
    scan_interval_days: plot.scan_interval_days ?? 14,
    planting_date: plotRaw?.planting_date ?? null,
    geo_data: plot.geo_data,
    status_lahan: (plotRaw as { status_lahan?: PlotDetail['status_lahan'] } | null)?.status_lahan ?? null,
    nama_lso: (plotRaw as { nama_lso?: string | null } | null)?.nama_lso ?? null,
    nomor_sertifikat: (plotRaw as { nomor_sertifikat?: string | null } | null)?.nomor_sertifikat ?? null,
    tanggal_kadaluarsa: (plotRaw as { tanggal_kadaluarsa?: string | null } | null)?.tanggal_kadaluarsa ?? null,
    nama_pemilik: (plotRaw as { nama_pemilik?: string | null } | null)?.nama_pemilik ?? null,
    nama_penggarap: (plotRaw as { nama_penggarap?: string | null } | null)?.nama_penggarap ?? null,
  }

  return (
    <PlotDashboard
      plot={plotDetail}
      satelliteLogs={satLogsWithSourceMeta as SatelliteLog[]}
      fieldLogs={(fieldLogs ?? []) as FieldLog[]}
      plantingSeasons={seasonsWithWaterPattern as PlantingSeason[]}
      ownershipHistory={(ownershipRaw ?? []) as OwnershipRecord[]}
      weatherLogs={weatherRaw}
    />
  )
}
