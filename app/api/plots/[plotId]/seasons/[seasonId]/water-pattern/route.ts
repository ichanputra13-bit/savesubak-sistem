import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Trigger manual "Analisis Ulang Pola" — panggil fungsi rule-based yang
// sama dipakai trigger otomatis saat actual_harvest_date diisi. Aman
// dipanggil kapan saja, termasuk musim yang belum panen (pakai data
// sampai hari ini).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ plotId: string; seasonId: string }> }
) {
  const { seasonId } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc('fn_analyze_season_water_pattern', {
    p_season_id: seasonId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ water_pattern: data })
}
