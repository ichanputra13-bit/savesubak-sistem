import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('season_water_pattern_analysis').select('*')
  return NextResponse.json({ data, error })
}
