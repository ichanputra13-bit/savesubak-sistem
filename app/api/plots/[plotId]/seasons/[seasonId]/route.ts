import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ plotId: string; seasonId: string }> }
) {
  const { plotId, seasonId } = await params
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('planting_seasons')
    .delete()
    .eq('id', seasonId)
    .eq('plot_id', plotId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ plotId: string; seasonId: string }> }
) {
  const { plotId, seasonId } = await params
  const body = await req.json()

  const ALLOWED = ['actual_harvest_date', 'actual_harvest_kg', 'status', 'notes', 'crop_variety', 'planting_date']
  const patch: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Tidak ada field yang diupdate' }, { status: 400 })
  }

  // Kalau actual_harvest_date diisi tapi status tidak disertakan → otomatis 'panen'
  if (patch.actual_harvest_date && !('status' in body)) {
    patch.status = 'panen'
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('planting_seasons')
    .update(patch)
    .eq('id', seasonId)
    .eq('plot_id', plotId)
    .select('id, plot_id, season_year, season_number, crop_variety, planting_date, estimated_harvest_date, actual_harvest_date, actual_harvest_kg, status, notes')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ season: data })
}
