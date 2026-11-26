import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ kawasanId: string }> }
) {
  const { kawasanId } = await params
  const body = await request.json()
  const { boundary_geojson } = body

  if (!boundary_geojson || typeof boundary_geojson !== 'object') {
    return NextResponse.json({ error: 'boundary_geojson harus object' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('kawasan')
    .update({ boundary_geojson })
    .eq('id', kawasanId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
