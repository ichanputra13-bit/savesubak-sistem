'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface KawasanRow {
  id: string
  name: string
  local_term: string | null
  region: string | null
  total_area_ha: number | null
  plot_count: number
  // SUM(area_ha) petak DI KAWASAN INI SAJA (per-kawasan, dihitung server-side
  // di app/kawasan/page.tsx dari v_plots.area_ha) — BUKAN dari total_area_ha
  // di atas (kolom itu NULL untuk semua kawasan saat ini, dikonfirmasi lewat
  // investigasi Kuota Lahan 27 Juli 2026) dan BUKAN gabungan semua kawasan
  // seperti perhitungan Kuota Lahan di header (fitur terpisah).
  plot_area_ha: number
}

interface Props {
  kawasanList: KawasanRow[]
}

const LOCAL_TERM_OPTIONS = ['Subak', 'Kelompok Tani', 'Desa', 'Lainnya']

export default function KawasanListClient({ kawasanList }: Props) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [localTerm, setLocalTerm] = useState('Subak')
  const [localTermCustom, setLocalTermCustom] = useState('')
  const [region, setRegion] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setName('')
    setLocalTerm('Subak')
    setLocalTermCustom('')
    setRegion('')
    setError(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const effectiveLocalTerm = localTerm === 'Lainnya' ? localTermCustom.trim() : localTerm
    if (!name.trim() || !effectiveLocalTerm || !region.trim()) return

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/kawasan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), local_term: effectiveLocalTerm, region: region.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Gagal menyimpan')
        return
      }
      setShowCreate(false)
      resetForm()
      router.push(`/kawasan/${json.id}`)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <main className="min-h-screen bg-paper">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard Kawasan</h1>
              <p className="text-sm text-gray-500 mt-0.5">{kawasanList.length} kawasan terdaftar</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              + Tambah Kawasan
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6">
          {kawasanList.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-sm">Belum ada kawasan terdaftar.</p>
              <p className="text-xs mt-1">Klik &quot;+ Tambah Kawasan&quot; untuk mulai.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {kawasanList.map((k) => (
                <Link
                  key={k.id}
                  href={`/kawasan/${k.id}`}
                  className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-green-400 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">{k.name}</h3>
                    <span className="text-[10px] px-2 py-0.5 bg-green-50 text-green-700 rounded-full font-medium shrink-0">
                      {k.local_term ?? 'Kawasan'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{k.region ?? '—'}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                    <span>{k.plot_count} petak</span>
                    {k.plot_area_ha > 0 && <span>· {k.plot_area_ha.toFixed(3)} ha</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {showCreate && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full my-auto">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Tambah Kawasan Baru</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Nama Kawasan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Subak Jatiluwih, Kelompok Tani Sari Merta, …"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Jenis / Local Term <span className="text-red-500">*</span>
                </label>
                <select
                  value={localTerm}
                  onChange={(e) => setLocalTerm(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                >
                  {LOCAL_TERM_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {localTerm === 'Lainnya' && (
                  <input
                    type="text"
                    required
                    value={localTermCustom}
                    onChange={(e) => setLocalTermCustom(e.target.value)}
                    placeholder="Sebutkan istilah lokal…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-2 focus:outline-none focus:ring-1 focus:ring-green-400"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Region / Lokasi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="Tabanan, Bali"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm py-2.5 rounded-xl font-semibold transition-colors"
                >
                  {saving ? 'Menyimpan…' : 'Simpan Kawasan'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); resetForm() }}
                  disabled={saving}
                  className="flex-1 border border-gray-200 text-sm text-gray-600 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
