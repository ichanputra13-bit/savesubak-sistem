import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findInternalCollisions, findExternalCollisions } from '@/lib/collision-detection'
import type { NamedGeometry, ExternalPlot, PolygonCollisionResult } from '@/lib/collision-detection'
import type { Polygon } from 'geojson'

interface RequestPolygon {
  tempId: string
  name: string
  geometry: Polygon
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const polygons: RequestPolygon[] = body.polygons

    if (!Array.isArray(polygons) || polygons.length === 0) {
      return NextResponse.json({ error: 'polygons wajib diisi' }, { status: 400 })
    }

    const candidates: NamedGeometry[] = polygons.map((p) => ({ id: p.tempId, name: p.name, geometry: p.geometry }))

    const supabase = createAdminClient()

    const [{ data: plots, error: plotsErr }, { data: kawasanList, error: kawasanErr }] = await Promise.all([
      supabase.from('v_plots').select('id, kawasan_id, farmer_name, nama_penggarap, geo_data'),
      supabase.from('kawasan').select('id, name'),
    ])

    if (plotsErr) return NextResponse.json({ error: plotsErr.message }, { status: 500 })
    if (kawasanErr) return NextResponse.json({ error: kawasanErr.message }, { status: 500 })

    const kawasanNameMap = new Map((kawasanList ?? []).map((k) => [k.id, k.name as string]))

    const existing: ExternalPlot[] = (plots ?? [])
      .filter((p) => p.geo_data)
      .map((p) => ({
        id: p.id,
        name: p.nama_penggarap ?? p.farmer_name,
        kawasanName: kawasanNameMap.get(p.kawasan_id) ?? 'Kawasan tidak diketahui',
        geometry: p.geo_data as Polygon,
      }))

    const internal = findInternalCollisions(candidates)
    const external = findExternalCollisions(candidates, existing)

    const results: PolygonCollisionResult[] = candidates.map((c) => ({
      tempId: c.id,
      internal: internal.get(c.id) ?? [],
      external: external.get(c.id) ?? [],
    }))

    return NextResponse.json({ results })
  } catch (error) {
    // Geometry KML rusak/tidak terduga (mis. ring kosong) bisa membuat fungsi
    // turf melempar exception, bukan cuma error Supabase — tanpa try/catch di
    // sini, itu akan lolos jadi 500 HTML generik Next.js, bukan JSON rapi yang
    // bisa dibaca client (lihat KmlImportModal.tsx, yang mengandalkan res.json()).
    const message = error instanceof Error ? error.message : 'Gagal memproses permintaan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
