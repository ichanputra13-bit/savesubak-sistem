import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface RouteParams { params: Promise<{ plotId: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { plotId } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('plot_ownership_history')
    .select('id, nama_pemilik, nama_penggarap, tanggal_mulai, tanggal_selesai, notes, created_at')
    .eq('plot_id', plotId)
    .order('tanggal_mulai', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ history: data ?? [] })
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { plotId } = await params
  const body = await req.json()
  const { nama_pemilik, nama_penggarap, tanggal_mulai, notes } = body

  if (!tanggal_mulai) {
    return NextResponse.json({ error: 'tanggal_mulai wajib diisi' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Auto-close: set tanggal_selesai pada record aktif (tanggal_selesai IS NULL)
  const { error: closeErr } = await supabase
    .from('plot_ownership_history')
    .update({ tanggal_selesai: tanggal_mulai })
    .eq('plot_id', plotId)
    .is('tanggal_selesai', null)

  if (closeErr) return NextResponse.json({ error: closeErr.message }, { status: 500 })

  // Insert record baru
  const { data: newRecord, error: insertErr } = await supabase
    .from('plot_ownership_history')
    .insert({
      plot_id: plotId,
      nama_pemilik: nama_pemilik || null,
      nama_penggarap: nama_penggarap || null,
      tanggal_mulai,
      notes: notes || null,
    })
    .select()
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Sync ke plots.nama_pemilik + nama_penggarap (nilai terkini)
  const updatePatch: Record<string, string | null> = {
    nama_pemilik: nama_pemilik || null,
    nama_penggarap: nama_penggarap || null,
  }
  if (nama_penggarap) updatePatch.farmer_name = nama_penggarap
  await supabase.from('plots').update(updatePatch).eq('id', plotId)

  return NextResponse.json({ record: newRecord })
}
