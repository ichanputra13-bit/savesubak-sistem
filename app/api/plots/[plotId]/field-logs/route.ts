import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props {
  params: Promise<{ plotId: string }>
}

export async function POST(request: NextRequest, { params }: Props) {
  const { plotId } = await params
  const formData = await request.formData()
  const file = formData.get('photo') as File | null
  const note = (formData.get('note') as string | null)?.trim() || null

  if (!file) {
    return NextResponse.json({ error: 'Foto wajib diisi' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const logId = crypto.randomUUID()
  const path = `${plotId}/${today}_${logId}.jpg`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadErr } = await supabase.storage
    .from('field-photos')
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: false })

  if (uploadErr) {
    return NextResponse.json({ error: `Gagal upload foto: ${uploadErr.message}` }, { status: 500 })
  }

  const { data, error: insertErr } = await supabase
    .from('field_logs')
    .insert({
      id: logId,
      plot_id: plotId,
      log_type: 'photo',
      log_date: today,
      photo_path: path,
      note,
      source: 'web',
    })
    .select()
    .single()

  if (insertErr) {
    // Foto sudah kepalang ke-upload — hapus lagi supaya tidak jadi sampah storage tanpa record
    await supabase.storage.from('field-photos').remove([path])
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ record: data })
}
