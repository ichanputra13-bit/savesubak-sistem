// Helper geometri plot yang TIDAK bergantung pada Leaflet/react-leaflet —
// aman diimpor dari server component maupun client component manapun
// (termasuk yang di-SSR), beda dengan KawasanMapInner.tsx yang browser-only.

export interface PlotGeoJSON {
  type: 'Polygon'
  coordinates: number[][][]
}

interface PlotWithGeo {
  geo_data?: PlotGeoJSON | null
}

export function computePlotsCenter(plots: PlotWithGeo[]): [number, number] | null {
  let sumLat = 0, sumLng = 0, count = 0
  for (const plot of plots) {
    if (!plot.geo_data?.coordinates?.[0]) continue
    for (const [lng, lat] of plot.geo_data.coordinates[0]) {
      sumLat += lat; sumLng += lng; count++
    }
  }
  return count > 0 ? [sumLat / count, sumLng / count] : null
}

export function plotCentroid(plot: PlotWithGeo): [number, number] | null {
  const ring = plot.geo_data?.coordinates?.[0]
  if (!ring || ring.length === 0) return null
  return [
    ring.reduce((s, [, lat]) => s + lat, 0) / ring.length,
    ring.reduce((s, [lng]) => s + lng, 0) / ring.length,
  ]
}

export const PHASE_LABEL: Record<string, string> = {
  kosong: 'Lahan kosong',
  semai: 'Semai',
  vegetatif: 'Vegetatif',
  generatif: 'Generatif',
  pematangan: 'Pematangan',
}

// Warna badge fase sesuai prototype — per fase punya kombinasi bg+teks sendiri
export const PHASE_BADGE_STYLE: Record<string, { bg: string; text: string }> = {
  pematangan: { bg: '#dceee1', text: '#1c6b43' },
  semai: { bg: '#fbf0dc', text: '#8a5f18' },
  vegetatif: { bg: '#e4eff5', text: '#1c5f8a' },
  generatif: { bg: '#dceee1', text: '#219653' },
}

// Fallback untuk fase 'kosong' atau saat belum ada scan sama sekali
export const PHASE_BADGE_EMPTY = { bg: '#f1efe9', text: '#7a7568' }

// Warna kategorikal (bukan gradien) untuk mode peta "Jenis Lahan" — 1 warna
// tetap per status_lahan. Dipakai baik oleh PlotMapInner.tsx (warna polygon)
// maupun PlotDashboard.tsx (legenda) dari 1 sumber yang sama, supaya tidak
// didefinisikan dobel dan berisiko tidak sinkron.
export const LAND_CATEGORY_COLORS: Record<string, string> = {
  organik: '#90EE90',       // hijau muda
  regenerative: '#3b82f6',  // biru medium — sengaja lebih jenuh dari #ADD8E6 lama, supaya beda jelas dari abu-abu #9ca3af (belum ditentukan)
  konversi: '#14532d',      // hijau tua — sengaja beda jelas dari hijau muda organik
  konvensional: '#f97316',  // oranye
}
export const LAND_CATEGORY_NULL_COLOR = '#9ca3af' // abu-abu netral — belum ditentukan

export const LAND_CATEGORY_LABEL: Record<string, string> = {
  organik: 'Organik',
  regenerative: 'Regenerative',
  konversi: 'Konversi',
  konvensional: 'Konvensional',
}

export function statusLahanToColor(v: string | null | undefined): string {
  if (!v) return LAND_CATEGORY_NULL_COLOR
  return LAND_CATEGORY_COLORS[v] ?? LAND_CATEGORY_NULL_COLOR
}

// Ambang tutupan awan (%) di atas mana 1 scan dianggap tidak reliabel untuk
// dipakai (NDVI/NDWI/NBR/estimated_phase) — dipakai konsisten di fetch data
// (lib/sentinel-hub/ndvi.ts, app/api/plots/*/scan & baseline route) MAUPUN
// tampilan (chart, peta, insight) supaya keduanya selalu sinkron.
export const CLOUD_COVER_THRESHOLD = 15
