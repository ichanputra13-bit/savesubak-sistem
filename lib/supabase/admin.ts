import { createClient } from '@supabase/supabase-js'

// Client dengan service_role key — bypass RLS.
// HANYA dipakai di server (API routes, Server Components).
// JANGAN import file ini di komponen browser ('use client').
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
