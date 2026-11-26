import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ kawasanId: string }> | { kawasanId: string } }
) {
  const supabase = createAdminClient()
  
  // Resolve params if it's a Promise (Next.js 15+ route handlers)
  const resolvedParams = await params
  
  const { error } = await supabase
    .from('kawasan')
    .delete()
    .eq('id', resolvedParams.kawasanId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
