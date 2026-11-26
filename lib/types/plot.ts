export type WaterPatternType = 'oscillating_awd_like' | 'continuous_flooding' | 'borderline_ambiguous' | 'insufficient_data'

export interface WaterPatternAnalysis {
  id: string
  planting_season_id: string
  pattern_detected: WaterPatternType
  oscillation_count: number
  ndwi_points_used: number
  sar_points_used: number
  confidence_note: string | null
  calculated_at: string
  total_aeration_days?: number
  estimated_co2e_tonnes?: number
  dry_points_total?: number | null
  dry_points_with_rain?: number | null
  awd_intentionality_pct?: number | null
}

export interface PlantingSeason {
  id: string
  plot_id: string
  season_year: number
  season_number: number
  crop_variety: string | null
  planting_date: string
  estimated_harvest_date: string
  actual_harvest_date: string | null
  actual_harvest_kg: number | null
  status: 'aktif' | 'panen' | 'gagal-puso'
  notes: string | null
  water_pattern?: WaterPatternAnalysis | null
}

export interface SatelliteLog {
  id: string
  scan_date: string
  ndvi_score: number | null
  ndwi_score: number | null
  cloud_cover_percent: number | null
  estimated_phase: string | null
  true_color_path: string | null
  ndvi_heatmap_path: string | null
  ndwi_heatmap_path: string | null
  nbr_heatmap_path: string | null
  nbr_score: number | null
  dnbr_score: number | null
  dnbr_reference_scan_date: string | null
  sar_vv: number | null
  sar_vh: number | null
  sar_flood_index: number | null
  sar_orbit_direction: 'ASCENDING' | 'DESCENDING' | 'BOTH' | null
  sar_source: string | null
  ndvi_product_id: string | null
  ndvi_acquisition_datetime: string | null
  ndvi_platform: string | null
  sar_product_id: string | null
  sar_acquisition_datetime: string | null
  sar_platform: string | null
}

export interface WeatherLog {
  date: string
  rainfall_mm: number | null
  temp_avg_c: number | null
  humidity_avg_pct: number | null
}

export interface FieldLog {
  id: string
  log_type: 'photo' | 'harvest_actual' | 'anomaly_note'
  log_date: string
  photo_path: string | null
  harvest_kg: number | null
  note: string | null
  source: 'web' | 'telegram'
}

export interface PlotDetail {
  id: string
  kawasan_id: string
  kawasan_name: string
  farmer_name: string
  nama_penggarap: string | null
  nama_pemilik: string | null
  crop_variety: string | null
  area_ha: number
  scan_interval_days: number
  planting_date: string | null
  geo_data: { type: string; coordinates: number[][][] }
  status_lahan: 'organik' | 'konversi' | 'regenerative' | 'konvensional' | null
  nama_lso: string | null
  nomor_sertifikat: string | null
  tanggal_kadaluarsa: string | null
}

export interface OwnershipRecord {
  id: string
  plot_id: string
  nama_pemilik: string | null
  nama_penggarap: string | null
  tanggal_mulai: string
  tanggal_selesai: string | null
  notes: string | null
  created_at: string
}

export type LayerType = 'truecolor' | 'ndvi' | 'ndwi' | 'nbr' | 'landcategory'
