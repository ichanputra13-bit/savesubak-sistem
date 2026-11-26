import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props {
  params: Promise<{ plotId: string; logId: string }>
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const { plotId, logId } = await params
  const body = await request.json()
  const note = typeof body.note === 'string' ? body.note.trim() || null : undefined

  if (note === undefined) {
    return NextResponse.json({ error: 'Tidak ada field yang diupdate' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('field_logs')
    .update({ note })
    .eq('id', logId)
    .eq('plot_id', plotId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: Props) {
  const { plotId, logId } = await params
  const supabase = createAdminClient()

  const { data: log, error: fetchErr } = await supabase
    .from('field_logs')
    .select('photo_path')
    .eq('id', logId)
    .eq('plot_id', plotId)
    .single()

  if (fetchErr || !log) {
    return NextResponse.json({ error: fetchErr?.message ?? 'Data tidak ditemukan' }, { status: 404 })
  }

  const { error: deleteErr } = await supabase
    .from('field_logs')
    .delete()
    .eq('id', logId)
    .eq('plot_id', plotId)

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  // Hapus file storage SETELAH record DB berhasil dihapus — kalau urutan
  // dibalik dan delete DB gagal, kita bisa kehilangan foto tanpa alasan jelas.
  if (log.photo_path) {
    await supabase.storage.from('field-photos').remove([log.photo_path])
  }

  return NextResponse.json({ ok: true })
}
