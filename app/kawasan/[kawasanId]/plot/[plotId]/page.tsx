import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import PlotSimple, { type SimpleLog, type SimpleField, type SimpleSeason } from '@/components/plots/PlotSimple'

// Halaman petak sederhana (27 Nov 2026) — untuk petani/PPL: lihat kondisi &
// isi data lapangan. Versi lengkap lama tetap ada di /kelola (admin).
export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ kawasanId: string; plotId: string }> }

export default async function PlotPage({ params }: Props) {
  const { kawasanId, plotId } = await params
  const supabase = createAdminClient()

  const since = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10)
  const [{ data: plot }, { data: kawasan }, { data: siblings }, { data: logs }, { data: fields }, { data: seasons }] = await Promise.all([
    supabase.from('v_plots').select('id, kawasan_id, crop_variety, area_ha, geo_data').eq('id', plotId).eq('kawasan_id', kawasanId).single(),
    supabase.from('kawasan').select('id, name').eq('id', kawasanId).single(),
    supabase.from('v_plots').select('id').eq('kawasan_id', kawasanId).order('created_at', { ascending: true }),
    supabase.from('satellite_logs').select('scan_date, ndvi_score, ndwi_score, cloud_cover_percent, sar_flood_index, estimated_phase')
      .eq('plot_id', plotId).gte('scan_date', since).order('scan_date', { ascending: true }),
    supabase.from('field_logs').select('id, log_date, photo_path, note').eq('plot_id', plotId).order('log_date', { ascending: false }).limit(30),
    supabase.from('planting_seasons').select('id, season_year, season_number, crop_variety, planting_date, estimated_harvest_date, actual_harvest_date, actual_harvest_kg, status')
      .eq('plot_id', plotId).order('planting_date', { ascending: false }),
  ])
  if (!plot || !kawasan) notFound()

  const no = (siblings ?? []).findIndex((s) => s.id === plotId) + 1

  return (
    <PlotSimple
      kawasan={{ id: kawasan.id, name: kawasan.name }}
      plot={{ id: plot.id, no, variety: plot.crop_variety ?? null, area: plot.area_ha ?? 0, geo: plot.geo_data as never }}
      logs={(logs ?? []) as SimpleLog[]}
      fields={(fields ?? []) as SimpleField[]}
      seasons={(seasons ?? []) as SimpleSeason[]}
    />
  )
}
