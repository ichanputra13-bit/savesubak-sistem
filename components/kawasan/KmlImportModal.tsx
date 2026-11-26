'use client'

import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, Polygon as LeafletPolygon, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { parseKmlText, type ParsedKmlPlot } from '@/lib/kml-parser'
import type { CollisionMatch, ExternalCollisionMatch, PolygonCollisionResult } from '@/lib/collision-detection'

interface PreviewPlot extends ParsedKmlPlot {
  checked: boolean
  internal: CollisionMatch[]
  external: ExternalCollisionMatch[]
}

interface SaveResult { tempId: string; name: string; ok: boolean; error?: string }

interface Props {
  kawasanId: string
  onImported: () => void
}

function FitBounds({ plots }: { plots: PreviewPlot[] }) {
  const map = useMap()
  useMemo(() => {
    if (plots.length === 0) return
    const latlngs = plots.flatMap((p) =>
      p.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])
    )
    if (latlngs.length > 0) map.fitBounds(L.latLngBounds(latlngs), { padding: [24, 24] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plots.length])
  return null
}

function plotColor(p: PreviewPlot): string {
  const hasCollision = p.internal.length > 0 || p.external.length > 0
  if (hasCollision) return p.checked ? '#dc2626' /* merah — tetap diimpor meski collision */ : '#f59e0b' /* amber — collision, dilewati */
  return p.checked ? '#16a34a' /* hijau — bersih, dipilih */ : '#9ca3af' /* abu — bersih tapi di-uncheck manual */
}

export default function KmlImportModal({ kawasanId, onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'parsing' | 'checking' | 'preview' | 'saving' | 'done'>('idle')
  const [plots, setPlots] = useState<PreviewPlot[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saveResults, setSaveResults] = useState<SaveResult[]>([])

  function reset() {
    setPhase('idle')
    setPlots([])
    setError(null)
    setSaveResults([])
    setOpen(false)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // supaya bisa pilih file yang sama lagi kalau mau
    if (!file) return

    setOpen(true)
    setError(null)
    setPhase('parsing')

    try {
      const text = await file.text()
      const parsed = parseKmlText(text)
      if (parsed.length === 0) {
        setError('Tidak ada polygon yang terbaca dari file ini.')
        setPhase('idle')
        return
      }

      setPhase('checking')
      const res = await fetch('/api/kml-import/check-collisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          polygons: parsed.map((p) => ({ tempId: p.tempId, name: p.name, geometry: p.geometry })),
        }),
      })

      let collisionResults: PolygonCollisionResult[] = []
      if (res.ok) {
        const json = await res.json()
        collisionResults = json.results ?? []
      } else {
        // Deteksi collision gagal TIDAK boleh menghentikan preview total —
        // tampilkan tetap tapi tanpa info collision, dengan peringatan.
        setError('Peringatan: pengecekan tumpang tindih gagal dijalankan — cek manual dulu sebelum import.')
      }
      const collisionMap = new Map(collisionResults.map((r) => [r.tempId, r]))

      const withCollision: PreviewPlot[] = parsed.map((p) => {
        const c = collisionMap.get(p.tempId)
        const hasCollision = (c?.internal.length ?? 0) > 0 || (c?.external.length ?? 0) > 0
        return {
          ...p,
          checked: !hasCollision, // polygon TANPA collision otomatis tercentang
          internal: c?.internal ?? [],
          external: c?.external ?? [],
        }
      })

      setPlots(withCollision)
      setPhase('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses file KML')
      setPhase('idle')
    }
  }

  function updatePlot(tempId: string, patch: Partial<PreviewPlot>) {
    setPlots((prev) => prev.map((p) => (p.tempId === tempId ? { ...p, ...patch } : p)))
  }

  async function handleConfirmImport() {
    const toImport = plots.filter((p) => p.checked)
    if (toImport.length === 0) return

    setPhase('saving')
    const results: SaveResult[] = []

    // Satu per satu (bukan bulk) — supaya kalau 1 gagal, sisanya tetap tersimpan.
    for (const p of toImport) {
      try {
        const res = await fetch('/api/plots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kawasan_id: kawasanId,
            nama_penggarap: p.name,
            area_ha: p.areaHa,
            geo_data: p.geometry,
          }),
        })
        if (res.ok) {
          results.push({ tempId: p.tempId, name: p.name, ok: true })
        } else {
          const json = await res.json().catch(() => ({}))
          results.push({ tempId: p.tempId, name: p.name, ok: false, error: json.error ?? 'Gagal menyimpan' })
        }
      } catch (err) {
        results.push({ tempId: p.tempId, name: p.name, ok: false, error: String(err) })
      }
    }

    setSaveResults(results)
    setPhase('done')
    onImported()
  }

  function handleClose() {
    reset()
  }

  const checkedCount = plots.filter((p) => p.checked).length
  const collisionCount = plots.filter((p) => p.internal.length > 0 || p.external.length > 0).length

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".kml"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="px-4 py-2 rounded-lg text-sm font-semibold shadow-md bg-white border border-gray-200 hover:border-green-600 hover:text-green-700 text-gray-700 transition-colors"
      >
        📥 Import dari KML
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Import Petak dari KML</h3>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {(phase === 'parsing' || phase === 'checking') && (
                <div className="text-center py-12 text-gray-500 text-sm">
                  {phase === 'parsing' ? 'Membaca file KML…' : 'Mengecek kemungkinan lahan tumpang tindih…'}
                </div>
              )}

              {error && phase === 'idle' && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              {phase === 'preview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Peta preview */}
                  <div className="h-[420px] rounded-xl overflow-hidden border border-gray-200">
                    <MapContainer center={[-8.4095, 115.1889]} zoom={13} className="h-full w-full">
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        maxZoom={19}
                        maxNativeZoom={18}
                      />
                      <FitBounds plots={plots} />
                      {plots.map((p) => (
                        <LeafletPolygon
                          key={p.tempId}
                          positions={p.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])}
                          pathOptions={{ color: plotColor(p), fillColor: plotColor(p), fillOpacity: 0.35, weight: 2 }}
                        />
                      ))}
                    </MapContainer>
                  </div>

                  {/* List petak */}
                  <div className="space-y-3">
                    {error && (
                      <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">{error}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      {plots.length} polygon terbaca · {collisionCount > 0 ? `⚠️ ${collisionCount} ada indikasi tumpang tindih · ` : ''}
                      {checkedCount} akan diimpor
                    </p>
                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {plots.map((p) => {
                        const hasCollision = p.internal.length > 0 || p.external.length > 0
                        return (
                          <div
                            key={p.tempId}
                            className={`rounded-xl border p-3 ${hasCollision ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200 bg-white'}`}
                          >
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={p.checked}
                                onChange={(e) => updatePlot(p.tempId, { checked: e.target.checked })}
                                className="mt-2 w-4 h-4"
                              />
                              <div className="flex-1 min-w-0">
                                <input
                                  type="text"
                                  value={p.name}
                                  onChange={(e) => updatePlot(p.tempId, { name: e.target.value })}
                                  className="w-full text-sm font-medium border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                                <p className="text-xs text-gray-400 mt-1">{p.areaHa} ha</p>

                                {hasCollision && (
                                  <div className="mt-2 space-y-1.5">
                                    {p.internal.map((m) => (
                                      <p key={m.withId} className="text-[11px] text-amber-800 bg-amber-100 px-2 py-1 rounded-md">
                                        ⚠️ Tumpang tindih {m.percent}% dengan <strong>{m.withName}</strong> dalam file ini — mungkin duplikat, cek dulu.
                                      </p>
                                    ))}
                                    {p.external.map((m) => (
                                      <p key={m.plotId} className="text-[11px] text-red-800 bg-red-100 px-2 py-1 rounded-md">
                                        ⚠️ {m.percent}% tumpang tindih dengan petak <strong>{m.plotName}</strong> yang sudah ada di kawasan <strong>{m.kawasanName}</strong>.
                                      </p>
                                    ))}
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => updatePlot(p.tempId, { checked: true })}
                                        className={`text-[11px] px-2 py-1 rounded-md font-medium ${p.checked ? 'bg-red-600 text-white' : 'bg-white border border-red-300 text-red-700 hover:bg-red-50'}`}
                                      >
                                        Tetap Import
                                      </button>
                                      <button
                                        onClick={() => updatePlot(p.tempId, { checked: false })}
                                        className={`text-[11px] px-2 py-1 rounded-md font-medium ${!p.checked ? 'bg-gray-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                      >
                                        Lewati Polygon Ini
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {phase === 'saving' && (
                <div className="text-center py-12 text-gray-500 text-sm">Menyimpan petak satu per satu…</div>
              )}

              {phase === 'done' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-800 mb-3">
                    Hasil import: {saveResults.filter((r) => r.ok).length}/{saveResults.length} berhasil
                  </p>
                  {saveResults.map((r) => (
                    <div
                      key={r.tempId}
                      className={`text-sm px-3 py-2 rounded-lg ${r.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
                    >
                      {r.ok ? '✅' : '❌'} {r.name}{!r.ok && r.error ? ` — ${r.error}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer aksi */}
            {phase === 'preview' && (
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
                <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">
                  Batal
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={checkedCount === 0}
                  className="px-4 py-2 text-sm font-semibold bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white rounded-lg"
                >
                  Konfirmasi Import ({checkedCount})
                </button>
              </div>
            )}
            {phase === 'done' && (
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
                <button onClick={handleClose} className="px-4 py-2 text-sm font-semibold bg-green-700 hover:bg-green-800 text-white rounded-lg">
                  Tutup
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
