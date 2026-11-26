'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import KawasanMap from '@/components/maps/KawasanMap'
import InfoTooltip from '@/components/plots/InfoTooltip'
import PhaseBadge from '@/components/plots/PhaseBadge'
import type { PlotData } from '@/components/maps/KawasanMapInner'
import { computePlotsCenter, plotCentroid, LAND_CATEGORY_LABEL } from '@/lib/plot-geo'
import { fmtDateLong as fmtDate } from '@/lib/format'

interface Kawasan {
  id: string
  name: string
  local_term: string | null
  region: string | null
  total_area_ha: number | null
}

interface KpiData {
  totalArea: number
  lastScanDate: string | null
  avgNdvi: number | null
  intensivePlots: number
}

interface Props {
  kawasan: Kawasan
  plots: PlotData[]
  kpi: KpiData
  boundaryGeojson: Record<string, unknown> | null
}

type SortColumnName = 'petani' | 'varietas' | 'luas' | 'scan'

function gmapsUrl(lat: number, lng: number) {
  return `https://maps.google.com/?q=${lat},${lng}`
}

export default function KawasanPageClient({ kawasan, plots, kpi, boundaryGeojson }: Props) {
  const router = useRouter()
  const [flyToggle, setFlyToggle] = useState(0)
  const [flyToPlot, setFlyToPlot] = useState<{ plotId: string; counter: number } | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // ── Scan semua petak di kawasan (26 Nov 2026) — satu per satu dengan jeda
  // supaya kuota Sentinel Hub aman & tidak kena batas waktu server. ──
  const [scanAll, setScanAll] = useState<{ done: number; total: number; ok: number; gagal: number; running: boolean } | null>(null)
  async function handleScanAll() {
    if (!window.confirm(`Scan ${plots.length} petak di ${kawasan.name}? Proses berjalan satu per satu (±10–20 detik per petak). Jangan tutup halaman ini.`)) return
    let ok = 0, gagal = 0
    setScanAll({ done: 0, total: plots.length, ok, gagal, running: true })
    for (let i = 0; i < plots.length; i++) {
      try {
        const res = await fetch(`/api/plots/${plots[i].id}/scan`, { method: 'POST' })
        if (res.ok) ok++; else gagal++
      } catch { gagal++ }
      setScanAll({ done: i + 1, total: plots.length, ok, gagal, running: i + 1 < plots.length })
      if (i + 1 < plots.length) await new Promise((r) => setTimeout(r, 1500))
    }
    router.refresh()
  }

  // ── Search + filter + sortir tabel/peta (client-side, data sudah dimuat) ──
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<'semua' | 'organik' | 'regenerative' | 'konversi' | 'konvensional' | 'null'>('semua')
  const [sortColumn, setSortColumn] = useState<SortColumnName | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const hasActiveFilter = searchQuery.trim() !== '' || filterCategory !== 'semua'

  function matchesFilter(plot: PlotData): boolean {
    const q = searchQuery.trim().toLowerCase()
    const namaMatch = !q ||
      (plot.nama_penggarap ?? plot.farmer_name ?? '').toLowerCase().includes(q) ||
      (plot.active_variety ?? plot.crop_variety ?? '').toLowerCase().includes(q)
    const catMatch =
      filterCategory === 'semua' ? true :
      filterCategory === 'null' ? !plot.status_lahan :
      plot.status_lahan === filterCategory
    return namaMatch && catMatch
  }

  const matchedIds = useMemo(
    () => new Set(plots.filter(matchesFilter).map((p) => p.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plots, searchQuery, filterCategory]
  )

  function handleSort(col: SortColumnName) {
    if (sortColumn === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(col)
      setSortDir('asc')
    }
  }

  function sortArrow(col: SortColumnName) {
    if (sortColumn !== col) return null
    return <span className="ml-0.5 text-gray-400">{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  const displayedPlots = useMemo(() => {
    const filtered = hasActiveFilter ? plots.filter((p) => matchedIds.has(p.id)) : plots
    if (!sortColumn) return filtered
    const sorted = [...filtered].sort((a, b) => {
      let av: string | number, bv: string | number
      switch (sortColumn) {
        case 'petani':
          av = (a.nama_penggarap ?? a.farmer_name ?? '').toLowerCase()
          bv = (b.nama_penggarap ?? b.farmer_name ?? '').toLowerCase()
          break
        case 'varietas':
          av = (a.active_variety ?? a.crop_variety ?? '').toLowerCase()
          bv = (b.active_variety ?? b.crop_variety ?? '').toLowerCase()
          break
        case 'luas':
          av = a.area_ha ?? 0
          bv = b.area_ha ?? 0
          break
        case 'scan':
          av = a.latest_scan_date ?? ''
          bv = b.latest_scan_date ?? ''
          break
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plots, hasActiveFilter, matchedIds, sortColumn, sortDir])

  const kawasanCenter = useMemo(() => computePlotsCenter(plots), [plots])

  async function handleDeletePlot(plotId: string) {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/plots/${plotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_deleted: true }),
      })
      if (!res.ok) {
        const json = await res.json()
        setDeleteError(json.error ?? 'Gagal menghapus')
        return
      }
      setDeleteConfirmId(null)
      router.refresh()
    } catch (err) {
      setDeleteError(String(err))
    } finally {
      setIsDeleting(false)
    }
  }

  function lihatLokasi() {
    setFlyToggle((v) => v + 1)
    document.getElementById('kawasan-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function lihatDashboard() {
    router.push(`/kawasan/${kawasan.id}`)
  }

  return (
    <>
    <main className="min-h-screen bg-paper">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/kawasan" className="hover:text-green-700 transition-colors">Kawasan</Link>
          <span>/</span>
          <Link href={`/kawasan/${kawasan.id}`} className="hover:text-green-700 transition-colors">{kawasan.name}</Link>
          <span>/</span>
          <span className="text-gray-800 font-medium">Kelola petak</span>
        </div>
        <div className="max-w-7xl mx-auto flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{kawasan.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {kawasan.local_term}
              {kawasan.region ? ` · ${kawasan.region}` : ''}
              {kawasan.total_area_ha ? ` · ${kawasan.total_area_ha} ha total` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Lokasi Gmaps Kawasan */}
            {kawasanCenter && (
              <a
                href={gmapsUrl(kawasanCenter[0], kawasanCenter[1])}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-700 text-sm text-gray-600 rounded-lg shadow-sm font-medium transition-all"
              >
                📍 Lokasi Gmaps Kawasan
              </a>
            )}

            {/* Lihat Lokasi */}
            <button
              onClick={lihatLokasi}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 hover:border-green-500 hover:text-green-700 text-sm text-gray-600 rounded-lg shadow-sm font-medium transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
              </svg>
              Lihat Lokasi
            </button>

            {/* Scan semua petak */}
            <button
              onClick={handleScanAll}
              disabled={scanAll?.running || plots.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 hover:border-green-500 hover:text-green-700 disabled:opacity-60 text-sm text-gray-600 rounded-lg shadow-sm font-medium transition-all"
              title="Ambil citra satelit terbaru untuk semua petak di kawasan ini"
            >
              {scanAll?.running
                ? `⟳ Scan ${scanAll.done}/${scanAll.total}…`
                : scanAll
                  ? `✓ Selesai: ${scanAll.ok} berhasil${scanAll.gagal ? `, ${scanAll.gagal} gagal` : ''}`
                  : '⟳ Scan semua petak'}
            </button>

            {/* Dashboard KPI */}
            <button
              onClick={lihatDashboard}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-sm rounded-lg shadow-sm font-medium transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
              </svg>
              Dashboard
            </button>

            {/* Hapus Kawasan */}
            <button
              onClick={async () => {
                if (window.confirm('Yakin ingin menghapus kawasan ini beserta seluruh petak di dalamnya?')) {
                  try {
                    const res = await fetch(`/api/kawasan/${kawasan.id}`, { method: 'DELETE' })
                    if (res.ok) {
                      router.push('/kawasan')
                      router.refresh()
                    } else {
                      const err = await res.json()
                      alert(`Gagal menghapus kawasan: ${err.error}`)
                    }
                  } catch (e) {
                    alert('Terjadi kesalahan saat menghapus kawasan.')
                  }
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-red-200 hover:bg-red-50 hover:text-red-700 text-sm text-red-600 rounded-lg shadow-sm font-medium transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Hapus
            </button>

            <div className="text-right ml-2">
              <p className="text-2xl font-bold text-green-700">{plots.length}</p>
              <p className="text-xs text-gray-500">Petak</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ── Peta ── */}
        <div id="kawasan-map" className="h-[520px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
          <KawasanMap
            kawasanId={kawasan.id}
            initialPlots={plots}
            flyToggle={flyToggle}
            flyToPlot={flyToPlot}
            region={kawasan.region ?? ''}
            boundaryGeojson={boundaryGeojson}
            matchedPlotIds={hasActiveFilter ? matchedIds : null}
          />
        </div>

        {/* ── KPI section ── */}
        <div id="kpi-section">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Ringkasan Kawasan</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-1">Total Petak</p>
              <p className="text-2xl font-bold text-gray-900">{plots.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-1">Total Luas Terdaftar</p>
              <p className="text-2xl font-bold text-gray-900">
                {kpi.totalArea > 0 ? kpi.totalArea.toFixed(3) : '—'}
                <span className="text-sm font-normal text-gray-500 ml-1">ha</span>
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-1 mb-1">
                <p className="text-xs text-gray-500">NDVI Rata-rata</p>
                <InfoTooltip title="Tentang NDVI Rata-rata">
                  <span>
                    Rata-rata NDVI dari scan terakhir semua petak di kawasan ini. Skala -1 sampai 1, makin tinggi makin sehat/hijau vegetasinya secara keseluruhan. Catatan: ini rata-rata gabungan — kondisi tiap petak individual bisa berbeda-beda.
                  </span>
                </InfoTooltip>
              </div>
              <p className="text-2xl font-bold text-green-700">
                {kpi.avgNdvi !== null ? kpi.avgNdvi.toFixed(3) : '—'}
              </p>
              {kpi.lastScanDate && (
                <p className="text-xs text-gray-400 mt-1">{fmtDate(kpi.lastScanDate)}</p>
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-1 mb-1">
                <p className="text-xs text-gray-500">Mode Intensif Aktif</p>
                <InfoTooltip title="Tentang Mode Intensif">
                  <span>
                    Petak masuk Mode Intensif (di-scan tiap 6 hari, lebih sering dari interval biasa 10 hari) kalau salah satu dari 2 hal ini terjadi: (1) tanggal tanam sudah diisi DAN masih dalam 120 hari sejak tanam — fase kritis awal pertumbuhan, ATAU (2) NDVI naik cepat, tanda tanaman baru mulai tumbuh aktif — ini terdeteksi otomatis dari data satelit, tidak perlu isi apa-apa. Jadi mengisi tanggal tanam bukan satu-satunya cara masuk Mode Intensif — kalau tidak diisi pun, sistem tetap bisa mendeteksinya lewat tren NDVI.
                  </span>
                </InfoTooltip>
              </div>
              <p className="text-2xl font-bold text-amber-600">{kpi.intensivePlots}</p>
              <p className="text-xs text-gray-400 mt-1">petak (interval 6 hari)</p>
            </div>
          </div>
        </div>

        {/* ── Daftar plot ── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Petak Lahan ({plots.length})
          </h2>

          {plots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="text-sm text-gray-400">
                Belum ada petak — klik <strong className="text-gray-600">+ Gambar Polygon Baru</strong> di peta.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {/* ── Toolbar: search + filter Jenis Lahan ── */}
              <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama petani atau varietas..."
                  className="flex-1 min-w-[200px] text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value as typeof filterCategory)}
                  className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                >
                  <option value="semua">Semua Jenis Lahan</option>
                  <option value="organik">{LAND_CATEGORY_LABEL.organik}</option>
                  <option value="regenerative">{LAND_CATEGORY_LABEL.regenerative}</option>
                  <option value="konversi">{LAND_CATEGORY_LABEL.konversi}</option>
                  <option value="konvensional">{LAND_CATEGORY_LABEL.konvensional}</option>
                  <option value="null">Belum Ditentukan</option>
                </select>
                {hasActiveFilter && (
                  <button
                    onClick={() => { setSearchQuery(''); setFilterCategory('semua') }}
                    className="text-xs text-gray-500 hover:text-red-600 px-2 py-1.5"
                  >
                    ✕ Reset filter
                  </button>
                )}
              </div>

              {displayedPlots.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-gray-400">Tidak ada petak yang cocok.</p>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500">
                      <th className="px-4 py-2.5 font-medium cursor-pointer select-none hover:text-gray-700" onClick={() => handleSort('petani')}>
                        Petani{sortArrow('petani')}
                      </th>
                      <th className="px-4 py-2.5 font-medium cursor-pointer select-none hover:text-gray-700" onClick={() => handleSort('varietas')}>
                        Varietas{sortArrow('varietas')}
                      </th>
                      <th className="px-4 py-2.5 font-medium cursor-pointer select-none hover:text-gray-700" onClick={() => handleSort('luas')}>
                        Luas{sortArrow('luas')}
                      </th>
                      <th className="px-4 py-2.5 font-medium">Koordinat</th>
                      <th className="px-4 py-2.5 font-medium">
                        <span className="flex items-center gap-1">
                          Fase Terkini
                          <InfoTooltip title="Tentang Fase Terkini">
                            <span>
                              Estimasi otomatis dari satu titik data satelit (NDVI/NDWI scan terakhir) — belum tentu mencerminkan kondisi lapangan sesungguhnya. Misalnya, lahan yang sudah dipanen bisa saja masih berlabel fase lama karena sistem belum bisa membedakan "menuju panen" dari "sudah dipanen". Mohon konfirmasi ke petani/pekaseh untuk kepastian.
                            </span>
                          </InfoTooltip>
                        </span>
                      </th>
                      <th className="px-4 py-2.5 font-medium cursor-pointer select-none hover:text-gray-700" onClick={() => handleSort('scan')}>
                        Scan Terakhir{sortArrow('scan')}
                      </th>
                      <th className="px-4 py-2.5 font-medium text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPlots.map((plot) => {
                      const center = plotCentroid(plot)
                      const displayName = plot.nama_penggarap ?? plot.farmer_name
                      const variety = plot.active_variety ?? plot.crop_variety

                      function goToPlot(e: React.MouseEvent) {
                        e.stopPropagation()
                        setFlyToPlot({ plotId: plot.id, counter: Date.now() })
                        document.getElementById('kawasan-map')?.scrollIntoView({ behavior: 'smooth' })
                      }

                      return (
                        <tr
                          key={plot.id}
                          onClick={goToPlot}
                          className="border-b border-gray-100 last:border-0 hover:bg-green-50/50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">{displayName}</td>
                          <td className="px-4 py-2.5 text-gray-600">
                            {variety ?? <span className="text-gray-400 italic">Belum diisi</span>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{plot.area_ha} ha</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {center ? (
                              <a
                                href={gmapsUrl(center[0], center[1])}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {center[0].toFixed(5)}, {center[1].toFixed(5)}
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <PhaseBadge
                              phase={plot.latest_phase}
                              cloudCover={plot.latest_cloud_cover}
                              fallbackPhase={plot.latest_valid_phase}
                              fallbackPhaseDate={plot.latest_valid_phase_date}
                            />
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                            {plot.latest_scan_date ? fmtDate(plot.latest_scan_date) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={goToPlot}
                                title="Lihat Lokasi"
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-green-700 hover:bg-green-50 transition-colors"
                              >
                                📍
                              </button>
                              <Link
                                href={`/kawasan/${kawasan.id}/plot/${plot.id}`}
                                onClick={(e) => e.stopPropagation()}
                                title="Dashboard"
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-green-700 hover:bg-green-50 transition-colors"
                              >
                                →
                              </Link>
                              <div className="relative">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === plot.id ? null : plot.id) }}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-sm leading-none"
                                  aria-label="Menu petak"
                                >
                                  ⋯
                                </button>
                                {menuOpenId === plot.id && (
                                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-md py-1 z-20 min-w-[130px]">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(plot.id); setMenuOpenId(null) }}
                                      className="w-full text-left text-xs px-3 py-2 text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      Hapus Petak
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}
        </div>

      </div>
    </main>

    {/* Overlay tutup menu */}
    {menuOpenId && (
      <div
        className="fixed inset-0 z-20"
        onClick={() => setMenuOpenId(null)}
        aria-hidden
      />
    )}

    {/* Dialog hapus petak — portal ke document.body agar bebas dari stacking context peta Leaflet */}
    {deleteConfirmId && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Hapus Petak?</h3>
          <p className="text-sm text-gray-600 mb-1">
            Petak <strong>{plots.find(p => p.id === deleteConfirmId)?.farmer_name}</strong> akan disembunyikan dari list dan peta.
          </p>
          <p className="text-xs text-gray-400 mb-5">
            Data histori satelit dan log panen terkait akan disembunyikan, bukan dihapus permanen dari database.
          </p>
          {deleteError && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{deleteError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => handleDeletePlot(deleteConfirmId)}
              disabled={isDeleting}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm py-2.5 rounded-xl font-semibold transition-colors"
            >
              {isDeleting ? 'Menghapus…' : 'Ya, Hapus'}
            </button>
            <button
              onClick={() => { setDeleteConfirmId(null); setDeleteError(null) }}
              disabled={isDeleting}
              className="flex-1 border border-gray-200 text-sm text-gray-600 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  )
}
