import { createAdminClient } from '@/lib/supabase/admin'
import KawasanListClient from '@/components/kawasan/KawasanListClient'

export default async function KawasanListPage() {
  const supabase = createAdminClient()

  const { data: kawasanList } = await supabase
    .from('kawasan')
    .select('id, name, local_term, region, total_area_ha, created_at')
    .order('created_at', { ascending: false })

  const kawasanIds = (kawasanList ?? []).map((k) => k.id)
  const { data: plotRows } = kawasanIds.length > 0
    ? await supabase.from('v_plots').select('kawasan_id, area_ha').in('kawasan_id', kawasanIds)
    : { data: [] as { kawasan_id: string; area_ha: number | null }[] }

  const countMap = new Map<string, number>()
  // Dihitung LANGSUNG dari area_ha tiap petak per kawasan — BUKAN dari
  // kolom kawasan.total_area_ha (dikonfirmasi NULL untuk semua kawasan saat
  // ini, lihat investigasi Kuota Lahan 27 Juli 2026), sama seperti pola
  // yang sudah dipakai app/kawasan/[kawasanId]/page.tsx untuk kartu "Total
  // Luas Terdaftar" di dalam halaman 1 kawasan.
  const areaMap = new Map<string, number>()
  for (const p of (plotRows ?? [])) {
    countMap.set(p.kawasan_id, (countMap.get(p.kawasan_id) ?? 0) + 1)
    areaMap.set(p.kawasan_id, (areaMap.get(p.kawasan_id) ?? 0) + (p.area_ha ?? 0))
  }

  const enriched = (kawasanList ?? []).map((k) => ({
    ...k,
    plot_count: countMap.get(k.id) ?? 0,
    plot_area_ha: areaMap.get(k.id) ?? 0,
  }))

  return <KawasanListClient kawasanList={enriched} />
}
