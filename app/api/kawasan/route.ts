import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, local_term, region } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Nama kawasan wajib diisi' }, { status: 400 })
  }
  if (!local_term?.trim()) {
    return NextResponse.json({ error: 'Jenis/local term wajib diisi' }, { status: 400 })
  }
  if (!region?.trim()) {
    return NextResponse.json({ error: 'Region/lokasi wajib diisi' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('kawasan')
    .insert({ name: name.trim(), local_term: local_term.trim(), region: region.trim() })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
