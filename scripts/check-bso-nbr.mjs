import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: plots } = await supabase.from('v_plots').select('id, farmer_name, nama_pemilik, nama_penggarap').ilike('farmer_name', '%BSO%')
console.log('Plot ditemukan:', plots)

if (plots && plots.length > 0) {
  const plotId = plots[0].id
  const { data: logs } = await supabase
    .from('satellite_logs')
    .select('scan_date, nbr_score, cloud_cover_percent')
    .eq('plot_id', plotId)
    .not('nbr_score', 'is', null)
    .order('scan_date', { ascending: true })
  console.log(`\nTotal baris dengan nbr_score terisi: ${logs?.length ?? 0}`)
  for (const l of logs ?? []) {
    const burnFlag = l.nbr_score < -0.25 ? '🔥 TERBAKAR (berat)' : l.nbr_score < 0.1 ? '⚠ kemungkinan terbakar ringan' : 'aman'
    console.log(`  ${l.scan_date}: NBR=${l.nbr_score} cloud=${l.cloud_cover_percent}% -> ${burnFlag}`)
  }
}
