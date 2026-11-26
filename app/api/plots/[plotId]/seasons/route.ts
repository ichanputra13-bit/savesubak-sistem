import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ plotId: string }> }) {
  const { plotId } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('planting_seasons')
    .select('id, plot_id, season_year, season_number, crop_variety, planting_date, estimated_harvest_date, actual_harvest_date, actual_harvest_kg, status, notes')
    .eq('plot_id', plotId)
    .order('season_year', { ascending: false })
    .order('season_number', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ seasons: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ plotId: string }> }) {
  const { plotId } = await params
  const body = await req.json()
  const { season_year, season_number, crop_variety, planting_date, notes } = body

  if (!season_year || !season_number || !planting_date) {
    return NextResponse.json(
      { error: 'season_year, season_number, dan planting_date wajib diisi' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('planting_seasons')
    .insert({
      plot_id: plotId,
      season_year: Number(season_year),
      season_number: Number(season_number),
      crop_variety: crop_variety || null,
      planting_date,
      notes: notes || null,
    })
    .select('id, plot_id, season_year, season_number, crop_variety, planting_date, estimated_harvest_date, actual_harvest_date, actual_harvest_kg, status, notes')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ season: data }, { status: 201 })
}
