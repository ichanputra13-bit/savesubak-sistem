import { NextResponse, type NextRequest } from 'next/server'

// Gembok sementara untuk demo online (belum ada sistem login).
// Aktif hanya kalau env DEMO_PASSWORD diisi (di Vercel). Di laptop (tanpa env) tidak aktif.
// /api/cron dikecualikan karena sudah dilindungi CRON_SECRET.
export function proxy(request: NextRequest) {
  const password = process.env.DEMO_PASSWORD
  if (!password) return NextResponse.next()

  const header = request.headers.get('authorization') ?? ''
  if (header.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6))
      const pass = decoded.slice(decoded.indexOf(':') + 1)
      if (pass === password) return NextResponse.next()
    } catch {}
  }
  return new NextResponse('Masukkan password demo Save Subak.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Save Subak", charset="UTF-8"' },
  })
}

export const config = {
  matcher: ['/((?!api/cron|_next/static|_next/image|favicon.ico).*)'],
}
