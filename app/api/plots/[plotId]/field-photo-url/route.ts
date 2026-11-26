import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props {
  params: Promise<{ plotId: string }>
}

// Signed URL on-demand, masa berlaku 1 jam — pola sama dengan truecolor-url.
export async function GET(request: NextRequest, { params }: Props) {
  const { plotId } = await params
  const path = request.nextUrl.searchParams.get('path')

  if (!path || !path.startsWith(`${plotId}/`)) {
    return NextResponse.json({ error: 'Path tidak valid' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from('field-photos')
    .createSignedUrl(path, 3600)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}
