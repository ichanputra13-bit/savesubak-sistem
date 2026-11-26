import { redirect } from 'next/navigation'

// Dashboard sekarang jadi halaman utama kawasan (26 Nov 2026).
export default async function Page({ params }: { params: Promise<{ kawasanId: string }> }) {
  const { kawasanId } = await params
  redirect(`/kawasan/${kawasanId}`)
}
