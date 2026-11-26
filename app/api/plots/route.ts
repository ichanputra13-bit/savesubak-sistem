import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const kawasan_id = request.nextUrl.searchParams.get('kawasan_id')
  if (!kawasan_id) return NextResponse.json({ error: 'kawasan_id required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: plots, error } = await supabase
    .from('v_plots')
    .select('id, farmer_name, crop_variety, area_ha, geo_data')
    .eq('kawasan_id', kawasan_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plots })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    kawasan_id, crop_variety, area_ha, geo_data,
    status_lahan, nama_lso, nomor_sertifikat, tanggal_kadaluarsa,
    nama_pemilik, nama_penggarap,
  } = body

  // nama_penggarap adalah nama field baru; farmer_name diterima sebagai fallback lama
  const effectivePenggarap: string | undefined = nama_penggarap || body.farmer_name
  if (!kawasan_id || !effectivePenggarap || !area_ha || !geo_data) {
    return NextResponse.json({ error: 'Field wajib tidak lengkap' }, { status: 400 })
  }

  const VALID_STATUS = ['organik', 'konversi', 'regenerative', 'konvensional']
  if (status_lahan != null && !VALID_STATUS.includes(status_lahan)) {
    return NextResponse.json({ error: 'status_lahan tidak valid' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc('insert_plot', {
    p_kawasan_id: kawasan_id,
    p_farmer_name: effectivePenggarap.trim(),
    p_crop_variety: crop_variety?.trim() || null,
    p_area_ha: area_ha,
    p_geo_data: geo_data,
    p_status_lahan: status_lahan || null,
    p_nama_lso: nama_lso?.trim() || null,
    p_nomor_sertifikat: nomor_sertifikat?.trim() || null,
    p_tanggal_kadaluarsa: tanggal_kadaluarsa || null,
    p_nama_pemilik: nama_pemilik?.trim() || null,
    p_nama_penggarap: effectivePenggarap.trim(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
