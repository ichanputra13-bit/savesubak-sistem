import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ plotId: string }> }
) {
  const { plotId } = await params
  const body = await req.json()

  const ALLOWED = ['is_deleted', 'geo_data', 'area_ha', 'status_lahan', 'nama_lso', 'nomor_sertifikat', 'tanggal_kadaluarsa'] as const
  const patch: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Tidak ada field yang diupdate' }, { status: 400 })
  }
  if ('is_deleted' in patch && typeof patch.is_deleted !== 'boolean') {
    return NextResponse.json({ error: 'Field is_deleted harus boolean' }, { status: 400 })
  }
  const VALID_STATUS = ['organik', 'konversi', 'regenerative', 'konvensional']
  if ('status_lahan' in patch && patch.status_lahan !== null && !VALID_STATUS.includes(patch.status_lahan as string)) {
    return NextResponse.json({ error: 'status_lahan tidak valid' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('plots')
    .update(patch)
    .eq('id', plotId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
