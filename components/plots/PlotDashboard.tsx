'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import NdviTrendChart from '@/components/charts/NdviTrendChart'
import NbrTrendChart from '@/components/charts/NbrTrendChart'
import SarTrendChart from '@/components/charts/SarTrendChart'
import WeatherTrendChart from '@/components/charts/WeatherTrendChart'
import DateRangeControl from '@/components/charts/DateRangeControl'
import InfoTooltip from '@/components/plots/InfoTooltip'
import BurnIndicatorBadge from '@/components/plots/BurnIndicatorBadge'
import { LAND_CATEGORY_COLORS, LAND_CATEGORY_NULL_COLOR, LAND_CATEGORY_LABEL, CLOUD_COVER_THRESHOLD } from '@/lib/plot-geo'
import { classifyBurnIndication, type HarvestDateInput } from '@/lib/dnbr'
import { fmtDateLong as fmtDate } from '@/lib/format'
import {
  deriveInsights, formatPlatform, fmtPreciseDatetime, seasonCloudStats, phaseBadgeText,
  polygonCentroid, copernicusBrowserUrl, scoreChip, ndviColor, ndwiColor, nbrColor, WATER_PATTERN_LABEL,
} from '@/lib/plot-insights'
import type { FieldLog, LayerType, OwnershipRecord, PlantingSeason, PlotDetail, SatelliteLog, WeatherLog } from '@/lib/types/plot'

const PlotMap = dynamic(() => import('@/components/maps/PlotMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-gray-100 animate-pulse rounded-xl flex items-center justify-center text-gray-400 text-sm">
      Memuat peta…
    </div>
  ),
})

interface Props {
  plot: PlotDetail
  satelliteLogs: SatelliteLog[]
  fieldLogs: FieldLog[]
  plantingSeasons: PlantingSeason[]
  ownershipHistory: OwnershipRecord[]
  weatherLogs: WeatherLog[]
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PlotDashboard({ plot, satelliteLogs, fieldLogs, plantingSeasons, ownershipHistory, weatherLogs }: Props) {
  const router = useRouter()
  // satellite_logs disatukan NDVI+SAR — baris SAR-only (ndvi_score/ndwi_score
  // null) harus disaring keluar sebelum masuk ke chart/state NDVI, kalau tidak
  // Recharts (connectNulls={false}) memutus garis jadi titik-titik lepas begitu
  // baris SAR jauh lebih banyak dari baris NDVI (lihat PROJECT_LOG 08 Jul 2026).
  const ndviLogsOnly = useMemo(
    () => satelliteLogs.filter((l) => l.ndvi_score !== null || l.ndwi_score !== null),
    [satelliteLogs]
  )
  const latestScan = ndviLogsOnly[ndviLogsOnly.length - 1] ?? null
  const [activeScanId, setActiveScanId] = useState<string | null>(latestScan?.id ?? null)
  const [ndviRangeFiltered, setNdviRangeFiltered] = useState<SatelliteLog[]>(ndviLogsOnly)
  const sarLogsOnly = useMemo(() => satelliteLogs.filter((l) => l.sar_flood_index != null), [satelliteLogs])
  const [sarActiveId, setSarActiveId] = useState<string | null>(sarLogsOnly[sarLogsOnly.length - 1]?.id ?? null)
  const [sarRangeFiltered, setSarRangeFiltered] = useState<SatelliteLog[]>(sarLogsOnly)
  const [activeLayer, setActiveLayer] = useState<LayerType>('ndvi')
  const [trueColorUrl, setTrueColorUrl] = useState<string | null>(null)
  const [nbrUrl, setNbrUrl] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'foto' | 'musim' | 'kepemilikan' | 'karbon'>('foto')
  const [isScanning, setIsScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Form tambah musim tanam
  const [showAddSeason, setShowAddSeason] = useState(false)
  const [addYear, setAddYear] = useState(new Date().getFullYear())
  const [addNumber, setAddNumber] = useState(1)
  const [addVariety, setAddVariety] = useState('')
  const [addDate, setAddDate] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Form catat panen (keyed by seasonId)
  const [harvestSeasonId, setHarvestSeasonId] = useState<string | null>(null)
  const [harvestDate, setHarvestDate] = useState('')
  const [harvestKg, setHarvestKg] = useState('')
  const [harvestSaving, setHarvestSaving] = useState(false)
  const [harvestError, setHarvestError] = useState<string | null>(null)

  // Hapus petak (soft delete)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Edit batas lahan
  const [isEditingBoundary, setIsEditingBoundary] = useState(false)
  const [pendingGeoData, setPendingGeoData] = useState<{ type: 'Polygon'; coordinates: number[][][] } | null>(null)
  const [pendingAreaHa, setPendingAreaHa] = useState<number | null>(null)
  const [isSavingBoundary, setIsSavingBoundary] = useState(false)
  const [boundaryError, setBoundaryError] = useState<string | null>(null)

  // Edit musim tanam
  const [editSeasonId, setEditSeasonId] = useState<string | null>(null)
  const [editVariety, setEditVariety] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editHarvestDate, setEditHarvestDate] = useState('')
  const [editHarvestKg, setEditHarvestKg] = useState('')
  const [editStatus, setEditStatus] = useState<'aktif' | 'panen' | 'gagal-puso'>('aktif')
  const [editNotes, setEditNotes] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Hapus musim tanam (hard delete)
  const [deleteSeasonId, setDeleteSeasonId] = useState<string | null>(null)
  const [deletingSeasonId, setDeletingSeasonId] = useState(false)
  const [deleteSeasonError, setDeleteSeasonError] = useState<string | null>(null)

  // Analisis pola pengairan (rule-based, manual re-trigger)
  const [analyzingSeasonId, setAnalyzingSeasonId] = useState<string | null>(null)
  const [analyzeError, setAnalyzeError] = useState<{ seasonId: string; message: string } | null>(null)

  // Tarik baseline historis (Fase 3)
  const [isPullingBaseline, setIsPullingBaseline] = useState(false)
  const [baselineMsg, setBaselineMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Tarik baseline cuaca historis (Open-Meteo) — pola sama dengan baseline satelit
  const [isPullingWeatherBaseline, setIsPullingWeatherBaseline] = useState(false)
  const [weatherBaselineMsg, setWeatherBaselineMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Upload foto lapangan
  const [showUploadPhoto, setShowUploadPhoto] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoNote, setPhotoNote] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null)
  const [editNoteValue, setEditNoteValue] = useState('')
  const [editNoteSaving, setEditNoteSaving] = useState(false)
  const [editNoteError, setEditNoteError] = useState<string | null>(null)
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null)
  const [deletingPhoto, setDeletingPhoto] = useState(false)
  const [deletePhotoError, setDeletePhotoError] = useState<string | null>(null)
  const [enlargedPhotoUrl, setEnlargedPhotoUrl] = useState<string | null>(null)

  // Riwayat kepemilikan
  const [showAddOwnership, setShowAddOwnership] = useState(false)
  const [ownershipPemilik, setOwnershipPemilik] = useState('')
  const [ownershipPenggarap, setOwnershipPenggarap] = useState('')
  const [ownershipDate, setOwnershipDate] = useState(() => new Date().toISOString().split('T')[0])
  const [ownershipNotes, setOwnershipNotes] = useState('')
  const [ownershipSaving, setOwnershipSaving] = useState(false)
  const [ownershipError, setOwnershipError] = useState<string | null>(null)

  // Edit status lahan
  const [showEditStatusLahan, setShowEditStatusLahan] = useState(false)
  const [editStatusLahan, setEditStatusLahan] = useState<string>('')
  const [editNamaLso, setEditNamaLso] = useState('')
  const [editNomorSertifikat, setEditNomorSertifikat] = useState('')
  const [editTanggalKadaluarsa, setEditTanggalKadaluarsa] = useState('')
  const [editStatusLahanSaving, setEditStatusLahanSaving] = useState(false)
  const [editStatusLahanError, setEditStatusLahanError] = useState<string | null>(null)

  async function triggerScan() {
    setIsScanning(true)
    setScanMsg(null)
    try {
      const res = await fetch(`/api/plots/${plot.id}/scan`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setScanMsg({ ok: false, text: json.error ?? 'Scan gagal' })
      } else {
        setScanMsg({ ok: true, text: `Scan berhasil — ${json.scan.scan_date} · NDVI ${json.scan.ndvi_score ?? '—'} · Fase: ${json.scan.estimated_phase ?? '—'}` })
        router.refresh()
      }
    } catch (e) {
      setScanMsg({ ok: false, text: String(e) })
    } finally {
      setIsScanning(false)
    }
  }

  async function handlePullBaseline() {
    setIsPullingBaseline(true)
    setBaselineMsg(null)
    try {
      const res = await fetch(`/api/plots/${plot.id}/baseline`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setBaselineMsg({ ok: false, text: json.error ?? 'Gagal menarik data' })
      } else {
        setBaselineMsg({ ok: true, text: json.message })
        router.refresh()
      }
    } catch (e) {
      setBaselineMsg({ ok: false, text: String(e) })
    } finally {
      setIsPullingBaseline(false)
    }
  }

  async function handlePullWeatherBaseline() {
    setIsPullingWeatherBaseline(true)
    setWeatherBaselineMsg(null)
    try {
      const res = await fetch(`/api/plots/${plot.id}/weather-baseline`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setWeatherBaselineMsg({ ok: false, text: json.error ?? 'Gagal menarik data' })
      } else {
        setWeatherBaselineMsg({ ok: true, text: json.message })
        router.refresh()
      }
    } catch (e) {
      setWeatherBaselineMsg({ ok: false, text: String(e) })
    } finally {
      setIsPullingWeatherBaseline(false)
    }
  }

  const activeScan = useMemo(
    () => satelliteLogs.find((l) => l.id === activeScanId) ?? latestScan,
    [activeScanId, satelliteLogs, latestScan]
  )

  // Indikator Pembakaran Gabungan — dNBR + kecocokan waktu panen, lihat
  // lib/dnbr.ts. Ambil SEMUA tanggal panen dari SEMUA musim tanam petak ini
  // (bukan cuma musim aktif) — flag dNBR dari tanggal lama tetap perlu
  // dicocokkan ke musim yang relevan waktu itu.
  const burnIndication = useMemo(() => {
    if (!activeScan) return null
    const harvestDates: HarvestDateInput[] = plantingSeasons
      .map((s) => {
        const date = s.actual_harvest_date ?? s.estimated_harvest_date
        return date ? { date, isEstimated: !s.actual_harvest_date } : null
      })
      .filter((h): h is HarvestDateInput => h !== null)
    return classifyBurnIndication(
      activeScan.dnbr_score,
      activeScan.dnbr_reference_scan_date,
      activeScan.scan_date,
      harvestDates
    )
  }, [activeScan, plantingSeasons])

  // Baris scan yang jadi pembanding dNBR — dicari dari satelliteLogs yang
  // sudah di-fetch (bukan query baru), dipakai BurnIndicatorBadge untuk
  // "Lihat Detail Analisis" (angka NBR/NDVI mentah di kedua tanggal).
  const burnReferenceScan = useMemo(
    () => satelliteLogs.find((l) => l.scan_date === activeScan?.dnbr_reference_scan_date) ?? null,
    [satelliteLogs, activeScan]
  )

  // Musim aktif = status 'aktif', tayang paling atas (already sorted newest-first)
  const activeSeason = plantingSeasons.find((s) => s.status === 'aktif') ?? plantingSeasons[0] ?? null

  // Signed URL True Color — on-demand, TIDAK disimpan (expired 1 jam), cuma
  // di-fetch saat layer True Color aktif dan scan yang dipilih punya path.
  useEffect(() => {
    const path = activeScan?.true_color_path
    if (activeLayer !== 'truecolor' || !path) {
      setTrueColorUrl(null)
      return
    }
    let cancelled = false
    fetch(`/api/plots/${plot.id}/truecolor-url?path=${encodeURIComponent(path)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelled) setTrueColorUrl(json?.url ?? null) })
      .catch(() => { if (!cancelled) setTrueColorUrl(null) })
    return () => { cancelled = true }
  }, [activeLayer, activeScan?.true_color_path, plot.id])

  // Signed URL NBR — on-demand
  useEffect(() => {
    const path = activeScan?.nbr_heatmap_path
    if (activeLayer !== 'nbr' || !path) {
      setNbrUrl(null)
      return
    }
    let cancelled = false
    fetch(`/api/plots/${plot.id}/truecolor-url?path=${encodeURIComponent(path)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelled) setNbrUrl(json?.url ?? null) })
      .catch(() => { if (!cancelled) setNbrUrl(null) })
    return () => { cancelled = true }
  }, [activeLayer, activeScan?.nbr_heatmap_path, plot.id])

  // Signed URL foto lapangan — fetch semua sekaligus saat tab Foto aktif
  useEffect(() => {
    if (activeTab !== 'foto') return
    const paths = fieldLogs.filter((l) => l.log_type === 'photo' && l.photo_path).map((l) => l.photo_path as string)
    if (paths.length === 0) return
    let cancelled = false
    Promise.all(
      paths.map((path) =>
        fetch(`/api/plots/${plot.id}/field-photo-url?path=${encodeURIComponent(path)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((json) => [path, json?.url ?? null] as const)
          .catch(() => [path, null] as const)
      )
    ).then((results) => {
      if (cancelled) return
      setPhotoUrls(Object.fromEntries(results.filter(([, url]) => url)))
    })
    return () => { cancelled = true }
  }, [activeTab, fieldLogs, plot.id])

  async function handleAddSeason(e: React.FormEvent) {
    e.preventDefault()
    if (!addDate) return
    setAddSaving(true)
    setAddError(null)
    try {
      const res = await fetch(`/api/plots/${plot.id}/seasons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_year: addYear,
          season_number: addNumber,
          crop_variety: addVariety || null,
          planting_date: addDate,
          notes: addNotes || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setAddError(json.error ?? 'Gagal menyimpan'); return }
      setShowAddSeason(false)
      setAddVariety(''); setAddDate(''); setAddNotes('')
      router.refresh()
    } catch (err) {
      setAddError(String(err))
    } finally {
      setAddSaving(false)
    }
  }

  async function handleRecordHarvest(e: React.FormEvent, seasonId: string) {
    e.preventDefault()
    if (!harvestDate) return
    setHarvestSaving(true)
    setHarvestError(null)
    try {
      const res = await fetch(`/api/plots/${plot.id}/seasons/${seasonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actual_harvest_date: harvestDate,
          actual_harvest_kg: harvestKg ? parseFloat(harvestKg) : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setHarvestError(json.error ?? 'Gagal menyimpan'); return }
      setHarvestSeasonId(null)
      setHarvestDate(''); setHarvestKg('')
      router.refresh()
    } catch (err) {
      setHarvestError(String(err))
    } finally {
      setHarvestSaving(false)
    }
  }

  async function handleDeletePlot() {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/plots/${plot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_deleted: true }),
      })
      if (!res.ok) {
        const json = await res.json()
        setDeleteError(json.error ?? 'Gagal menghapus')
        return
      }
      router.push(`/kawasan/${plot.kawasan_id}`)
    } catch (err) {
      setDeleteError(String(err))
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleSaveBoundary() {
    if (!pendingGeoData || pendingAreaHa === null) return
    setIsSavingBoundary(true)
    setBoundaryError(null)
    try {
      const res = await fetch(`/api/plots/${plot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geo_data: pendingGeoData, area_ha: pendingAreaHa }),
      })
      if (!res.ok) {
        const json = await res.json()
        setBoundaryError(json.error ?? 'Gagal menyimpan')
        return
      }
      setIsEditingBoundary(false)
      setPendingGeoData(null)
      setPendingAreaHa(null)
      router.refresh()
    } catch (err) {
      setBoundaryError(String(err))
    } finally {
      setIsSavingBoundary(false)
    }
  }

  function openEditSeason(season: PlantingSeason) {
    setEditSeasonId(season.id)
    setEditVariety(season.crop_variety ?? '')
    setEditDate(season.planting_date)
    setEditHarvestDate(season.actual_harvest_date ?? '')
    setEditHarvestKg(season.actual_harvest_kg?.toString() ?? '')
    setEditStatus(season.status)
    setEditNotes(season.notes ?? '')
    setEditError(null)
  }

  async function handleEditSeason(e: React.FormEvent) {
    e.preventDefault()
    if (!editSeasonId) return
    setEditSaving(true)
    setEditError(null)
    try {
      const body: Record<string, unknown> = {
        crop_variety: editVariety || null,
        planting_date: editDate,
        status: editStatus,
        notes: editNotes || null,
      }
      if (editHarvestDate) {
        body.actual_harvest_date = editHarvestDate
        body.actual_harvest_kg = editHarvestKg ? parseFloat(editHarvestKg) : null
      } else {
        body.actual_harvest_date = null
        body.actual_harvest_kg = null
      }
      const res = await fetch(`/api/plots/${plot.id}/seasons/${editSeasonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json()
        setEditError(json.error ?? 'Gagal menyimpan')
        return
      }
      setEditSeasonId(null)
      router.refresh()
    } catch (err) {
      setEditError(String(err))
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeleteSeason(seasonId: string) {
    setDeletingSeasonId(true)
    setDeleteSeasonError(null)
    try {
      const res = await fetch(`/api/plots/${plot.id}/seasons/${seasonId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json()
        setDeleteSeasonError(json.error ?? 'Gagal menghapus')
        return
      }
      setDeleteSeasonId(null)
      router.refresh()
    } catch (err) {
      setDeleteSeasonError(String(err))
    } finally {
      setDeletingSeasonId(false)
    }
  }

  async function handleAnalyzeWaterPattern(seasonId: string) {
    setAnalyzingSeasonId(seasonId)
    setAnalyzeError(null)
    try {
      const res = await fetch(`/api/plots/${plot.id}/seasons/${seasonId}/water-pattern`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok) {
        setAnalyzeError({ seasonId, message: json.error ?? 'Gagal menganalisis' })
        return
      }
      router.refresh()
    } catch (err) {
      setAnalyzeError({ seasonId, message: String(err) })
    } finally {
      setAnalyzingSeasonId(null)
    }
  }

  // Kompres foto di browser sebelum upload — resize ke maks 1600px sisi
  // terpanjang + re-encode JPEG kualitas 0.75. Tidak perlu library tambahan
  // (Canvas API bawaan browser), konsisten dengan prinsip "jangan nambah
  // dependency kalau tidak perlu" di project ini.
  async function compressImage(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file)
    const maxSide = 1600
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Gagal kompres foto'))), 'image/jpeg', 0.75)
    })
  }

  async function handleUploadPhoto(e: React.FormEvent) {
    e.preventDefault()
    if (!photoFile) { setPhotoError('Pilih foto dulu'); return }
    setPhotoUploading(true)
    setPhotoError(null)
    try {
      const compressed = await compressImage(photoFile)
      const form = new FormData()
      form.append('photo', compressed, 'photo.jpg')
      form.append('note', photoNote)

      const res = await fetch(`/api/plots/${plot.id}/field-logs`, { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) { setPhotoError(json.error ?? 'Gagal upload'); return }

      setShowUploadPhoto(false)
      setPhotoFile(null)
      setPhotoNote('')
      router.refresh()
    } catch (err) {
      setPhotoError(String(err))
    } finally {
      setPhotoUploading(false)
    }
  }

  async function handleEditNote(e: React.FormEvent, logId: string) {
    e.preventDefault()
    setEditNoteSaving(true)
    setEditNoteError(null)
    try {
      const res = await fetch(`/api/plots/${plot.id}/field-logs/${logId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: editNoteValue }),
      })
      const json = await res.json()
      if (!res.ok) { setEditNoteError(json.error ?? 'Gagal menyimpan'); return }
      setEditingPhotoId(null)
      router.refresh()
    } catch (err) {
      setEditNoteError(String(err))
    } finally {
      setEditNoteSaving(false)
    }
  }

  async function handleDeletePhoto(logId: string) {
    setDeletingPhoto(true)
    setDeletePhotoError(null)
    try {
      const res = await fetch(`/api/plots/${plot.id}/field-logs/${logId}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        setDeletePhotoError(json.error ?? 'Gagal menghapus')
        return
      }
      setDeletePhotoId(null)
      router.refresh()
    } catch (err) {
      setDeletePhotoError(String(err))
    } finally {
      setDeletingPhoto(false)
    }
  }

  async function handleAddOwnership(e: React.FormEvent) {
    e.preventDefault()
    if (!ownershipDate) return
    setOwnershipSaving(true)
    setOwnershipError(null)
    try {
      const res = await fetch(`/api/plots/${plot.id}/ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_pemilik: ownershipPemilik || null,
          nama_penggarap: ownershipPenggarap || null,
          tanggal_mulai: ownershipDate,
          notes: ownershipNotes || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setOwnershipError(json.error ?? 'Gagal menyimpan'); return }
      setShowAddOwnership(false)
      setOwnershipPemilik('')
      setOwnershipPenggarap('')
      setOwnershipNotes('')
      router.refresh()
    } catch (err) {
      setOwnershipError(String(err))
    } finally {
      setOwnershipSaving(false)
    }
  }

  async function handleEditStatusLahan(e: React.FormEvent) {
    e.preventDefault()
    setEditStatusLahanSaving(true)
    setEditStatusLahanError(null)
    try {
      const res = await fetch(`/api/plots/${plot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status_lahan: editStatusLahan || null,
          nama_lso: editNamaLso.trim() || null,
          nomor_sertifikat: editNomorSertifikat.trim() || null,
          tanggal_kadaluarsa: editTanggalKadaluarsa || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setEditStatusLahanError(json.error ?? 'Gagal menyimpan'); return }
      setShowEditStatusLahan(false)
      router.refresh()
    } catch (err) {
      setEditStatusLahanError(String(err))
    } finally {
      setEditStatusLahanSaving(false)
    }
  }

  const insights = useMemo(() => deriveInsights(activeScan ?? null, plot, activeSeason), [activeScan, plot, activeSeason])
  const plotCentroidXY = useMemo(() => polygonCentroid(plot.geo_data), [plot.geo_data])

  // SAR: cari log terbaru yang punya data radar (mungkin beda tanggal dari activeScan)
  const latestSarLog = useMemo(
    () => [...satelliteLogs].reverse().find(l => l.sar_vv != null) ?? null,
    [satelliteLogs]
  )

  // Titik SAR yang sedang dipilih via slider — fallback ke data radar terbaru
  const sarSelectedLog = useMemo(
    () => sarLogsOnly.find((l) => l.id === sarActiveId) ?? latestSarLog,
    [sarLogsOnly, sarActiveId, latestSarLog]
  )

  const LAYERS: { id: LayerType; label: string }[] = [
    { id: 'ndvi', label: 'NDVI' },
    { id: 'ndwi', label: 'NDWI' },
    { id: 'nbr', label: 'NBR' },
    { id: 'truecolor', label: 'True Color' },
    { id: 'landcategory', label: 'Jenis Lahan' },
  ]

  const TABS = [
    { id: 'foto' as const, label: 'Foto Lapangan' },
    { id: 'musim' as const, label: 'Musim Tanam' },
    { id: 'kepemilikan' as const, label: 'Kepemilikan' },
    { id: 'karbon' as const, label: 'Karbon' },
  ]

  return (
    <>
    <div className="min-h-screen bg-paper">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/kawasan" className="hover:text-green-700 transition-colors">Kawasan</Link>
            <span>/</span>
            <Link href={`/kawasan/${plot.kawasan_id}`} className="hover:text-green-700 transition-colors">
              {plot.kawasan_name}
            </Link>
            <span>/</span>
            <span className="text-gray-800 font-medium">{plot.farmer_name}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {plot.nama_penggarap ?? plot.farmer_name}
              </h1>
              {/* Label pemilik/penggarap: tampilkan 2 baris kalau beda orang, 1 baris kalau sama */}
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                {plot.nama_pemilik && plot.nama_pemilik !== (plot.nama_penggarap ?? plot.farmer_name) ? (
                  <>
                    <span>Penggarap</span>
                    <span>·</span>
                    <span>Pemilik lahan: <span className="font-medium text-gray-700">{plot.nama_pemilik}</span></span>
                  </>
                ) : (
                  <span>Pemilik &amp; Penggarap</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {(activeSeason?.crop_variety ?? plot.crop_variety) && (
                  <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-2.5 py-0.5 rounded-full font-medium">
                    {activeSeason?.crop_variety ?? plot.crop_variety}
                  </span>
                )}
                <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full">
                  {plot.area_ha} ha
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full">
                  Scan setiap {plot.scan_interval_days} hari
                </span>
                {(activeSeason?.planting_date ?? plot.planting_date) && (
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-0.5 rounded-full">
                    Tanam: {fmtDate(activeSeason?.planting_date ?? plot.planting_date!)}
                  </span>
                )}
                <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full font-mono">
                  {plot.id.slice(0, 8)}
                </span>
                {/* Status lahan + tombol edit */}
                <span className="flex items-center gap-1.5">
                  {plot.status_lahan ? (
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                      plot.status_lahan === 'organik'      ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      plot.status_lahan === 'konversi'     ? 'bg-amber-50 text-amber-700 border-amber-100' :
                      plot.status_lahan === 'regenerative' ? 'bg-teal-50 text-teal-700 border-teal-100' :
                      'bg-gray-100 text-gray-600 border-gray-200'
                    }`}>
                      {plot.status_lahan === 'organik'      ? 'Organik' :
                       plot.status_lahan === 'konversi'     ? 'Konversi' :
                       plot.status_lahan === 'regenerative' ? 'Regenerative' :
                       'Konvensional'}
                    </span>
                  ) : null}
                  {plot.nama_lso && (
                    <span className="text-xs text-gray-400">
                      LSO: {plot.nama_lso}
                      {plot.nomor_sertifikat && <> · {plot.nomor_sertifikat}</>}
                      {plot.tanggal_kadaluarsa && <> · exp {fmtDate(plot.tanggal_kadaluarsa)}</>}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setEditStatusLahan(plot.status_lahan ?? '')
                      setEditNamaLso(plot.nama_lso ?? '')
                      setEditNomorSertifikat(plot.nomor_sertifikat ?? '')
                      setEditTanggalKadaluarsa(plot.tanggal_kadaluarsa ?? '')
                      setEditStatusLahanError(null)
                      setShowEditStatusLahan(true)
                    }}
                    className="text-[10px] text-gray-400 hover:text-blue-600 px-1.5 py-0.5 border border-gray-200 hover:border-blue-300 rounded-md transition-colors"
                    title="Edit status lahan"
                  >
                    Edit
                  </button>
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {latestScan && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Scan terakhir</p>
                  <p className="text-sm font-semibold text-gray-800">{fmtDate(latestScan.scan_date)}</p>
                </div>
              )}
              <button
                onClick={triggerScan}
                disabled={isScanning}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-700 hover:bg-green-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                {isScanning ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Memindai…
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0 1 15.6-6.4M20 15a9 9 0 0 1-15.6 6.4" />
                    </svg>
                    Picu Scan Satelit
                  </>
                )}
              </button>
              {scanMsg && (
                <p className={`text-xs px-3 py-1.5 rounded-lg max-w-xs text-right ${
                  scanMsg.ok
                    ? 'bg-green-50 text-green-800 border border-green-100'
                    : 'bg-red-50 text-red-700 border border-red-100'
                }`}>
                  {scanMsg.text}
                </p>
              )}
              <button
                onClick={() => { setShowDeleteConfirm(true); setDeleteError(null) }}
                className="text-xs text-red-500 hover:text-red-700 hover:underline transition-colors mt-1 text-right"
              >
                Hapus Petak
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">

        {/* ── Hero: peta asli ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="relative h-[420px]">
            <PlotMap
              geoData={plot.geo_data}
              activeScan={activeScan ?? null}
              activeLayer={activeLayer}
              editMode={isEditingBoundary}
              onEditChange={(geo, areaHa) => {
                setPendingGeoData(geo)
                setPendingAreaHa(areaHa)
              }}
              trueColorUrl={trueColorUrl}
              nbrUrl={nbrUrl}
              statusLahan={plot.status_lahan}
            />

            {/* Badge fase mengambang — dark overlay + dot live. Diposisikan di bawah
                kontrol zoom Leaflet (top-left, ~10px margin + 2x26px tombol ≈ 62px
                tinggi) supaya tidak tertumpuk/menutupi tombol +/-. */}
            <div className="absolute top-20 left-3 z-[1000] flex items-center gap-1.5 bg-black/70 backdrop-blur-sm text-white text-xs font-medium pl-2 pr-3 py-1.5 rounded-full shadow-lg">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              {phaseBadgeText(activeScan ?? null)}
            </div>

            {/* Kontrol mengambang pojok kanan atas */}
            {isEditingBoundary ? (
              <div className="absolute top-3 right-3 z-[1000] max-w-[80%]">
                <span className="text-xs font-medium text-white bg-orange-600/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
                  Mode Edit Batas — drag titik sudut, klik kanan vertex untuk hapus
                </span>
              </div>
            ) : (
              <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
                <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm rounded-full shadow-md border border-gray-200 px-1 py-1">
                  {LAYERS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setActiveLayer(l.id)}
                      className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
                        activeLayer === l.id
                          ? 'bg-green-700 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setIsEditingBoundary(true); setBoundaryError(null) }}
                  className="text-xs px-3 py-1.5 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-full text-gray-600 hover:border-green-500 hover:text-green-700 shadow-md transition-colors"
                >
                  Edit Batas
                </button>
              </div>
            )}

            {activeLayer === 'truecolor' && !isEditingBoundary && !activeScan?.true_color_path && (
              <div className="absolute top-14 right-3 z-[1000]">
                <span className="text-xs text-amber-800 bg-amber-100/95 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-md">
                  Citra RGB belum tersedia untuk scan ini
                </span>
              </div>
            )}
          </div>

          {/* Footer: save/cancel edit ATAU legend warna layer */}
          {isEditingBoundary ? (
            <div className="px-4 py-3 border-t border-orange-100 bg-orange-50 space-y-2">
              {pendingAreaHa !== null && (
                <p className="text-xs text-gray-700">
                  Luas baru:{' '}
                  <span className="font-semibold">{pendingAreaHa} ha</span>
                  <span className="text-gray-400 ml-1">(dihitung ulang otomatis)</span>
                </p>
              )}
              {boundaryError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg">
                  {boundaryError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveBoundary}
                  disabled={isSavingBoundary || !pendingGeoData}
                  className="flex-1 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-xs py-2 rounded-lg font-semibold transition-colors"
                >
                  {isSavingBoundary ? 'Menyimpan…' : 'Simpan Perubahan'}
                </button>
                <button
                  onClick={() => {
                    setIsEditingBoundary(false)
                    setBoundaryError(null)
                    setPendingGeoData(null)
                    setPendingAreaHa(null)
                  }}
                  disabled={isSavingBoundary}
                  className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : activeLayer === 'landcategory' ? (
            <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3 flex-wrap">
              <span className="text-xs text-gray-400">Warna polygon = Jenis Lahan</span>
              <div className="flex items-center gap-3 ml-auto flex-wrap">
                {(['organik', 'regenerative', 'konversi', 'konvensional'] as const).map((cat) => (
                  <div key={cat} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ background: LAND_CATEGORY_COLORS[cat] }} />
                    <span className="text-[10px] text-gray-500">{LAND_CATEGORY_LABEL[cat]}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: LAND_CATEGORY_NULL_COLOR }} />
                  <span className="text-[10px] text-gray-500">Belum ditentukan</span>
                </div>
              </div>
            </div>
          ) : activeLayer !== 'truecolor' ? (
            <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3">
              <span className="text-xs text-gray-400">
                {activeLayer === 'ndvi' ? 'Warna polygon = NDVI' : activeLayer === 'ndwi' ? 'Warna polygon = NDWI' : 'Warna polygon = NBR'}
              </span>
              <div className="flex items-center gap-1 ml-auto">
                <div className="flex items-center gap-1 mr-3 border-r border-gray-200 pr-3">
                  <div className="w-5 h-3 rounded-sm bg-gray-400" />
                  <span className="text-[10px] text-gray-400">Awan / No Data</span>
                </div>
                {(activeLayer === 'ndvi'
                  ? ['#fde68a', '#bef264', '#4ade80', '#16a34a', '#14532d']
                  : activeLayer === 'ndwi'
                  ? ['#fde68a', '#bae6fd', '#60a5fa', '#2563eb', '#1e3a8a']
                  : ['#7f1d1d', '#ea580c', '#84cc16', '#16a34a']
                ).map((c, i) => (
                  <div key={i} className="w-5 h-3 rounded-sm" style={{ background: c }} />
                ))}
                <span className="text-xs text-gray-400 ml-1">
                  {activeLayer === 'ndvi' ? 'rendah → tinggi' : activeLayer === 'ndwi' ? 'kering → basah' : 'terbakar → hijau'}
                </span>
              </div>
            </div>
          ) : (
            <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Citra RGB (True Color)
              </span>
              <span className="text-[10px] text-gray-400 border-l border-gray-200 pl-2 leading-tight">
                {(() => {
                  if (!activeScan) return 'Foto asli satelit (RGB).';
                  if ((activeScan.cloud_cover_percent ?? 0) > CLOUD_COVER_THRESHOLD) {
                    return `☁️ Terdeteksi awan tinggi (${activeScan.cloud_cover_percent}%). Wajar jika area tertutup kabut putih atau bayangan awan (hitam pekat).`;
                  }
                  if (activeScan.estimated_phase === 'kosong' || activeScan.estimated_phase === 'semai') {
                    return '☀️ Kondisi cerah. Fase awal/persiapan lahan, wajar jika didominasi warna coklat tanah atau genangan air (gelap).';
                  }
                  if (activeScan.estimated_phase === 'vegetatif' || activeScan.estimated_phase === 'generatif') {
                    return '☀️ Kondisi cerah. Tanaman sedang tumbuh, area seharusnya didominasi warna hijau alami.';
                  }
                  if (activeScan.estimated_phase === 'pematangan') {
                    return '☀️ Kondisi cerah. Fase pematangan/panen, area mungkin terlihat kekuningan atau hijau pudar.';
                  }
                  return 'Foto asli satelit (RGB).';
                })()}
              </span>
            </div>
          )}
        </div>

        {/* ── Strip 5 statistik ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {scoreChip(activeScan?.ndvi_score ?? null, 'NDVI', ndviColor, {
              title: 'Tentang NDVI',
              body: 'Normalized Difference Vegetation Index — mengukur kehijauan/kesehatan tanaman dari pantulan cahaya. Skala -1 sampai 1, makin tinggi makin sehat/lebat vegetasinya.',
            })}
            {scoreChip(activeScan?.ndwi_score ?? null, 'NDWI', ndwiColor, {
              title: 'Tentang NDWI',
              body: 'Normalized Difference Water Index — mendeteksi kandungan air di permukaan lahan. Skala -1 sampai 1, mendekati 1 = tergenang air, mendekati -1 = kering.',
            })}
            {scoreChip(activeScan?.nbr_score ?? null, 'NBR', nbrColor, {
              title: 'Tentang NBR (Pembakaran)',
              body: 'Normalized Burn Ratio — mendeteksi luka bakar di lahan jerami. Nilai sangat negatif (Merah Gelap) mengindikasikan baru saja terbakar.',
            })}
            <div className="flex flex-col items-center px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
              <span className="flex items-center gap-1 text-xs text-gray-500">
                VH/VV
                <InfoTooltip title="Tentang Rasio VH/VV">
                  <span>
                    Rasio backscatter VH/VV dari radar Sentinel-1 (SAR) — indeks genangan air. Nilai tinggi (&gt;0.4) mengindikasikan potensi genangan/banjir, nilai rendah (&lt;0.25) menunjukkan lahan relatif kering. Radar menembus awan, jadi selalu tersedia meski musim hujan.
                  </span>
                </InfoTooltip>
              </span>
              <span
                className="text-xl font-bold mt-0.5"
                style={{
                  color: sarSelectedLog?.sar_flood_index == null ? '#9ca3af' :
                    sarSelectedLog.sar_flood_index > 0.4 ? '#1d4ed8' :
                    sarSelectedLog.sar_flood_index > 0.25 ? '#0284c7' : '#b45309',
                }}
              >
                {sarSelectedLog?.sar_flood_index != null ? sarSelectedLog.sar_flood_index.toFixed(3) : '—'}
              </span>
            </div>
            <div className="flex flex-col items-center px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
              <span className="flex items-center gap-1 text-xs text-gray-500">
                Orbit
                <InfoTooltip title="Tentang Arah Orbit SAR">
                  <span>
                    Arah lintasan satelit Sentinel-1 saat akuisisi data. ASCENDING = satelit bergerak naik ke utara, DESCENDING = turun ke selatan. BOTH berarti dua pass di hari yang sama, nilainya dirata-rata. Interval akuisisi ±6 hari.
                  </span>
                </InfoTooltip>
              </span>
              <span className="text-sm font-bold mt-1.5 text-gray-700">
                {sarSelectedLog?.sar_orbit_direction ?? '—'}
              </span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400 border-t border-gray-100 pt-2">
            <span className="flex items-center gap-1">
              Tutupan awan:{' '}
              {activeScan?.cloud_cover_percent != null ? `${activeScan.cloud_cover_percent.toFixed(1)}%` : '—'}
              <InfoTooltip>Angka indeks di atas tetap muncul karena satelit mengukur awan secara visual, namun sistem menyatakannya tidak valid untuk dianalisis.</InfoTooltip>
              {sarSelectedLog && <> · Data radar per {fmtDate(sarSelectedLog.scan_date)}</>}
            </span>
            <span>* Fase &amp; indeks: estimasi otomatis dari satu titik data satelit, bukan standar agronomi resmi — belum tentu mencerminkan kondisi lapangan (mis. lahan sudah dipanen bisa saja masih berlabel fase lama). Konfirmasi ke petani/pekaseh untuk kepastian.</span>
          </div>
        </div>

        {/* ── Panel Sumber Data / Verifikasi ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-1">
            📡 Sumber Data &amp; Verifikasi
          </h3>
          <p className="text-[11px] text-gray-500 mb-3">
            Sumber: <strong className="text-gray-700">Copernicus Data Space Ecosystem</strong> (ESA / Uni Eropa) — data satelit publik, bisa diverifikasi siapa saja secara independen.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Sentinel-2 — NDVI/NDWI */}
            <div className="border border-gray-100 rounded-xl p-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-700 mb-2">🛰️ Citra Optik (Sentinel-2)</p>
              {activeScan ? (
                <div className="space-y-1 text-[11px]">
                  <p className="flex justify-between gap-2">
                    <span className="text-gray-400">Satelit</span>
                    <span className="font-medium text-gray-700">{formatPlatform(activeScan.ndvi_platform)}</span>
                  </p>
                  <p className="flex flex-col gap-0.5">
                    <span className="text-gray-400">ID Produk</span>
                    <span className="font-mono text-gray-700 break-all">{activeScan.ndvi_product_id ?? '—'}</span>
                  </p>
                  <p className="flex justify-between gap-2">
                    <span className="text-gray-400">Akuisisi</span>
                    <span className="font-medium text-gray-700 text-right">{fmtPreciseDatetime(activeScan.ndvi_acquisition_datetime)}</span>
                  </p>
                  <p className="flex justify-between gap-2">
                    <span className="text-gray-400">Tutupan awan</span>
                    <span className="font-medium text-gray-700">
                      {activeScan.cloud_cover_percent != null ? `${activeScan.cloud_cover_percent.toFixed(1)}%` : '—'}
                    </span>
                  </p>
                  {!activeScan.ndvi_product_id && (
                    <p className="text-amber-600 italic pt-1">Metadata resmi belum tersedia untuk scan ini.</p>
                  )}
                  {plotCentroidXY && (
                    <a
                      href={copernicusBrowserUrl(plotCentroidXY[0], plotCentroidXY[1], activeScan.scan_date)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                    >
                      🔍 Verifikasi Independen di Copernicus Browser →
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400 italic">Belum ada scan optik</p>
              )}
            </div>

            {/* Sentinel-1 — SAR */}
            <div className="border border-blue-100 rounded-xl p-3 bg-blue-50/40">
              <p className="text-xs font-semibold text-gray-700 mb-2">📡 Citra Radar (Sentinel-1)</p>
              {sarSelectedLog ? (
                <div className="space-y-1 text-[11px]">
                  <p className="flex justify-between gap-2">
                    <span className="text-gray-400">Satelit</span>
                    <span className="font-medium text-gray-700">{formatPlatform(sarSelectedLog.sar_platform)}</span>
                  </p>
                  <p className="flex flex-col gap-0.5">
                    <span className="text-gray-400">ID Produk</span>
                    <span className="font-mono text-gray-700 break-all">{sarSelectedLog.sar_product_id ?? '—'}</span>
                  </p>
                  <p className="flex justify-between gap-2">
                    <span className="text-gray-400">Akuisisi</span>
                    <span className="font-medium text-gray-700 text-right">{fmtPreciseDatetime(sarSelectedLog.sar_acquisition_datetime)}</span>
                  </p>
                  <p className="flex justify-between gap-2">
                    <span className="text-gray-400">Orbit</span>
                    <span className="font-medium text-gray-700">{sarSelectedLog.sar_orbit_direction ?? '—'}</span>
                  </p>
                  {!sarSelectedLog.sar_product_id && (
                    <p className="text-amber-600 italic pt-1">Metadata resmi belum tersedia untuk scan ini.</p>
                  )}
                  {plotCentroidXY && (
                    <a
                      href={copernicusBrowserUrl(plotCentroidXY[0], plotCentroidXY[1], sarSelectedLog.scan_date)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                    >
                      🔍 Verifikasi Independen di Copernicus Browser →
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400 italic">Belum ada data radar</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Left column: chart ── */}
          <div className="lg:col-span-3 space-y-4">

            {/* NDVI trend chart */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Tren NDVI & NDWI
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  ({ndviRangeFiltered.length} dari {ndviLogsOnly.length} scan)
                </span>
              </h3>
              <NdviTrendChart
                logs={ndviRangeFiltered}
                activeScanId={activeScanId}
                onSelect={setActiveScanId}
              />
              <div className="mt-3">
                <DateRangeControl
                  items={ndviLogsOnly}
                  getDate={(l) => l.scan_date}
                  getId={(l) => l.id}
                  activeId={activeScanId}
                  onSelect={setActiveScanId}
                  onRangeChange={setNdviRangeFiltered}
                  accent="green"
                />
              </div>
            </div>

            {/* NBR trend chart */}
            <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                Tren NBR (Indikasi Pembakaran)
                <span className="text-xs text-orange-400 font-normal">
                  ({ndviRangeFiltered.length} dari {ndviLogsOnly.length} scan)
                </span>
              </h3>
              <p className="text-[11px] text-gray-400 mb-3">
                Garis merah putus = ambang pembakaran lahan ringan hingga berat (-0.25 ke bawah)
              </p>
              <NbrTrendChart logs={ndviRangeFiltered} activeScanId={activeScanId} onSelect={setActiveScanId} />
              {/* No separate date control needed, syncs with NDVI */}
              <div className="mt-3">
                <BurnIndicatorBadge
                  result={burnIndication}
                  currentScan={activeScan ? { scan_date: activeScan.scan_date, nbr_score: activeScan.nbr_score, ndvi_score: activeScan.ndvi_score } : null}
                  referenceScan={burnReferenceScan ? { scan_date: burnReferenceScan.scan_date, nbr_score: burnReferenceScan.nbr_score, ndvi_score: burnReferenceScan.ndvi_score } : null}
                />
              </div>
            </div>

            {/* SAR trend chart */}
            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                Tren Radar SAR (Sentinel-1)
                <span className="text-xs text-blue-400 font-normal">
                  ({sarRangeFiltered.length} dari {sarLogsOnly.length} pass)
                </span>
              </h3>
              <p className="text-[11px] text-gray-400 mb-3">
                Garis biru putus = ambang genangan sedang (0.25) &amp; tinggi (0.40) · interval akuisisi ±6 hari
              </p>
              <SarTrendChart logs={sarRangeFiltered} activeScanId={sarActiveId} onSelect={setSarActiveId} />
              <div className="mt-3">
                <DateRangeControl
                  items={sarLogsOnly}
                  getDate={(l) => l.scan_date}
                  getId={(l) => l.id}
                  activeId={sarActiveId}
                  onSelect={setSarActiveId}
                  onRangeChange={setSarRangeFiltered}
                  accent="blue"
                />
              </div>
            </div>

            {/* Cuaca (Open-Meteo) */}
            <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                Curah Hujan
              </h3>
              <p className="text-[11px] text-gray-400 mb-3">
                Data cuaca independen dari citra satelit — dipakai sebagai bukti pendukung praktik AWD (bukan kekeringan alami)
              </p>
              <WeatherTrendChart logs={weatherLogs} />
            </div>
          </div>

          {/* ── Right column: insights + tabs ── */}
          <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-4 lg:self-start">

            {/* Insight panel */}
            <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-1.5">
                <span>Analisis Otomatis</span>
                <span className="text-xs font-normal text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                  rule-based
                </span>
              </h3>
              <p className="text-[10px] text-green-700/70 -mt-1 mb-2">
                * Estimasi otomatis dari satu titik data satelit — belum tentu mencerminkan kondisi lapangan sesungguhnya (mis. lahan sudah dipanen bisa saja masih berlabel fase lama). Konfirmasi ke petani/pekaseh untuk kepastian.
              </p>
              <ul className="space-y-2">
                {insights.map((ins, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="mt-0.5 shrink-0">
                      {ins.level === 'warning' ? '⚠️' : ins.level === 'success' ? '✅' : 'ℹ️'}
                    </span>
                    <span className={
                      ins.level === 'warning' ? 'text-amber-800' :
                      ins.level === 'success' ? 'text-green-800' :
                      'text-gray-700'
                    }>
                      {ins.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex border-b border-gray-100">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex-1 text-xs font-medium py-3 transition-colors ${
                      activeTab === t.id
                        ? 'text-green-700 border-b-2 border-green-700 bg-green-50/50'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {activeTab === 'foto' && (
                  <div className="space-y-3">
                    {!showUploadPhoto ? (
                      <button
                        onClick={() => { setPhotoFile(null); setPhotoNote(''); setPhotoError(null); setShowUploadPhoto(true) }}
                        className="w-full py-2 text-xs border border-dashed border-green-300 text-green-700 hover:bg-green-50 rounded-lg transition-colors font-medium"
                      >
                        + Upload Foto Lapangan
                      </button>
                    ) : (
                      <form onSubmit={handleUploadPhoto} className="bg-green-50 border border-green-100 rounded-xl p-3 space-y-2.5">
                        <p className="text-xs font-semibold text-green-800">Foto Baru</p>
                        <p className="text-[10px] text-green-600">Tanggal upload otomatis tercatat hari ini. Foto dikompres otomatis sebelum dikirim.</p>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Foto</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                            className="w-full text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Keterangan Kegiatan</label>
                          <textarea
                            value={photoNote}
                            onChange={(e) => setPhotoNote(e.target.value)}
                            placeholder="contoh: pemupukan, pengeringan lahan, dst"
                            rows={2}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                          />
                        </div>
                        {photoError && <p className="text-[10px] text-red-600 bg-red-50 px-2 py-1 rounded">{photoError}</p>}
                        <div className="flex gap-2">
                          <button type="submit" disabled={photoUploading} className="flex-1 bg-green-700 text-white text-xs py-1.5 rounded-lg disabled:opacity-50">
                            {photoUploading ? 'Mengunggah…' : 'Simpan'}
                          </button>
                          <button type="button" onClick={() => setShowUploadPhoto(false)} className="flex-1 border border-gray-300 text-gray-600 text-xs py-1.5 rounded-lg">
                            Batal
                          </button>
                        </div>
                      </form>
                    )}

                    {fieldLogs.filter((l) => l.log_type === 'photo').length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center">
                        Belum ada foto lapangan
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {fieldLogs
                          .filter((l) => l.log_type === 'photo')
                          .map((l) => {
                            const url = l.photo_path ? photoUrls[l.photo_path] : undefined
                            return (
                            <li key={l.id} className="flex gap-3 text-sm border-b border-gray-100 pb-3 last:border-0">
                              {url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={url}
                                  alt="Foto lapangan"
                                  onClick={() => setEnlargedPhotoUrl(url)}
                                  className="w-16 h-16 rounded-lg object-cover shrink-0 border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center text-gray-300 text-[10px]">Memuat…</div>
                              )}
                              <div className="flex-1 min-w-0">
                                <span className="text-xs text-gray-400 block">{fmtDate(l.log_date)}</span>
                                {editingPhotoId === l.id ? (
                                  <form onSubmit={(e) => handleEditNote(e, l.id)} className="mt-1 space-y-1.5">
                                    <textarea
                                      value={editNoteValue}
                                      onChange={(e) => setEditNoteValue(e.target.value)}
                                      rows={2}
                                      className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                                    />
                                    {editNoteError && <p className="text-[10px] text-red-600">{editNoteError}</p>}
                                    <div className="flex gap-1.5">
                                      <button type="submit" disabled={editNoteSaving} className="text-[10px] bg-green-700 text-white px-2 py-1 rounded disabled:opacity-50">
                                        {editNoteSaving ? 'Menyimpan…' : 'Simpan'}
                                      </button>
                                      <button type="button" onClick={() => setEditingPhotoId(null)} className="text-[10px] border border-gray-300 text-gray-600 px-2 py-1 rounded">
                                        Batal
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  <>
                                    <span className="text-gray-700 block">{l.note ?? '—'}</span>
                                    <div className="flex gap-3 mt-1">
                                      <button
                                        onClick={() => { setEditingPhotoId(l.id); setEditNoteValue(l.note ?? ''); setEditNoteError(null) }}
                                        className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
                                      >
                                        Edit Keterangan
                                      </button>
                                      <button
                                        onClick={() => { setDeletePhotoId(l.id); setDeletePhotoError(null) }}
                                        className="text-[10px] text-red-600 hover:text-red-800 font-medium"
                                      >
                                        Hapus
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </li>
                          )})}
                      </ul>
                    )}
                  </div>
                )}

                {activeTab === 'musim' && (
                  <div className="space-y-3">
                    {/* Tombol / form tambah musim */}
                    {!showAddSeason ? (
                      <button
                        onClick={() => {
                          const thisYear = new Date().getFullYear()
                          const thisYearSeasons = plantingSeasons.filter((s) => s.season_year === thisYear)
                          const maxNum = thisYearSeasons.length > 0
                            ? Math.max(...thisYearSeasons.map((s) => s.season_number))
                            : 0
                          setAddYear(thisYear)
                          setAddNumber(Math.min(maxNum + 1, 3))
                          setAddDate('')
                          setAddVariety('')
                          setAddNotes('')
                          setAddError(null)
                          setShowAddSeason(true)
                        }}
                        className="w-full py-2 text-xs border border-dashed border-green-300 text-green-700 hover:bg-green-50 rounded-lg transition-colors font-medium"
                      >
                        + Tambah Musim Tanam Baru
                      </button>
                    ) : (
                      <form onSubmit={handleAddSeason} className="bg-green-50 border border-green-100 rounded-xl p-3 space-y-2.5">
                        <p className="text-xs font-semibold text-green-800">Musim Tanam Baru</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Tahun</label>
                            <input
                              type="number"
                              value={addYear}
                              onChange={(e) => setAddYear(Number(e.target.value))}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Musim ke-</label>
                            <select
                              value={addNumber}
                              onChange={(e) => setAddNumber(Number(e.target.value))}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                            >
                              <option value={1}>1</option>
                              <option value={2}>2</option>
                              <option value={3}>3</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Tanggal Tanam <span className="text-red-500">*</span></label>
                          <input
                            type="date"
                            required
                            value={addDate}
                            onChange={(e) => setAddDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Varietas</label>
                          <input
                            type="text"
                            placeholder="contoh: Mentik Susu, IR64"
                            value={addVariety}
                            onChange={(e) => setAddVariety(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                        </div>
                        {addError && (
                          <p className="text-[10px] text-red-600 bg-red-50 px-2 py-1 rounded">{addError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={addSaving || !addDate}
                            className="flex-1 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-xs py-1.5 rounded-lg font-medium transition-colors"
                          >
                            {addSaving ? 'Menyimpan…' : 'Simpan'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAddSeason(false)}
                            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                          >
                            Batal
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Daftar musim tanam */}
                    {plantingSeasons.length === 0 ? (
                      <p className="text-xs text-gray-400 py-3 text-center">
                        Belum ada musim tanam tercatat
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {plantingSeasons.map((season) => {
                          const statusColor =
                            season.status === 'aktif' ? 'bg-green-100 text-green-700' :
                            season.status === 'panen' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-500'
                          const isHarvestOpen = harvestSeasonId === season.id
                          const cloudStats = seasonCloudStats(satelliteLogs, season.planting_date, season.actual_harvest_date)

                          return (
                            <div key={season.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-800">
                                  Musim {season.season_number}/{season.season_year}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                                    {season.status}
                                  </span>
                                  <button
                                    onClick={() => openEditSeason(season)}
                                    className="text-[10px] text-blue-500 hover:text-blue-700 hover:underline"
                                  >
                                    Edit
                                  </button>
                                  <span className="text-gray-300 text-[10px]">·</span>
                                  <button
                                    onClick={() => { setDeleteSeasonId(season.id); setDeleteSeasonError(null) }}
                                    className="text-[10px] text-red-400 hover:text-red-600 hover:underline"
                                  >
                                    Hapus
                                  </button>
                                </div>
                              </div>

                              {season.crop_variety && (
                                <p className="text-xs text-gray-600">
                                  <span className="text-gray-400">Varietas: </span>{season.crop_variety}
                                </p>
                              )}

                              <p className="text-xs text-gray-600">
                                <span className="text-gray-400">Tanam: </span>{fmtDate(season.planting_date)}
                                <span className="text-gray-400 mx-1">→ Est. panen:</span>
                                {fmtDate(season.estimated_harvest_date)}
                              </p>

                              {season.actual_harvest_date && (
                                <p className="text-xs text-blue-700 font-medium">
                                  Panen: {fmtDate(season.actual_harvest_date)}
                                  {season.actual_harvest_kg != null && (
                                    <span className="ml-2 font-normal text-gray-600">
                                      · {season.actual_harvest_kg.toLocaleString('id-ID')} kg
                                    </span>
                                  )}
                                </p>
                              )}

                              {cloudStats.total > 0 && (
                                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-1">
                                  ☁ {cloudStats.cloudy} dari {cloudStats.total} scan optik ketutup awan ({cloudStats.pct}%) — gunakan data SAR sebagai cadangan
                                </p>
                              )}

                              {/* Tombol / form catat panen — hanya untuk musim aktif yang belum dipanen */}
                              {season.status === 'aktif' && !season.actual_harvest_date && (
                                <>
                                  {!isHarvestOpen ? (
                                    <button
                                      onClick={() => {
                                        setHarvestSeasonId(season.id)
                                        setHarvestDate('')
                                        setHarvestKg('')
                                        setHarvestError(null)
                                      }}
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-medium mt-1"
                                    >
                                      Catat Panen →
                                    </button>
                                  ) : (
                                    <form
                                      onSubmit={(e) => handleRecordHarvest(e, season.id)}
                                      className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-2.5 space-y-2"
                                    >
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="block text-[10px] text-gray-500 mb-1">Tgl Panen <span className="text-red-500">*</span></label>
                                          <input
                                            type="date"
                                            required
                                            value={harvestDate}
                                            onChange={(e) => setHarvestDate(e.target.value)}
                                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] text-gray-500 mb-1">Hasil (kg)</label>
                                          <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            placeholder="0"
                                            value={harvestKg}
                                            onChange={(e) => setHarvestKg(e.target.value)}
                                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                                          />
                                        </div>
                                      </div>
                                      {harvestError && (
                                        <p className="text-[10px] text-red-600">{harvestError}</p>
                                      )}
                                      <div className="flex gap-1.5">
                                        <button
                                          type="submit"
                                          disabled={harvestSaving || !harvestDate}
                                          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[10px] py-1.5 rounded font-medium"
                                        >
                                          {harvestSaving ? 'Menyimpan…' : 'Simpan Panen'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setHarvestSeasonId(null)}
                                          className="px-2 py-1 text-[10px] border border-gray-200 rounded text-gray-600 hover:bg-gray-50"
                                        >
                                          Batal
                                        </button>
                                      </div>
                                    </form>
                                  )}
                                </>
                              )}

                              {/* Analisis pola pengairan otomatis (rule-based) */}
                              <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-medium text-gray-500">Pola Pengairan (otomatis)</span>
                                  <button
                                    onClick={() => handleAnalyzeWaterPattern(season.id)}
                                    disabled={analyzingSeasonId === season.id}
                                    className="text-[10px] text-blue-600 hover:text-blue-800 disabled:opacity-50 font-medium"
                                  >
                                    {analyzingSeasonId === season.id ? 'Menganalisis…' : 'Analisis Ulang Pola'}
                                  </button>
                                </div>

                                {season.water_pattern ? (
                                  <div
                                    className="rounded-lg px-2.5 py-2 space-y-1"
                                    style={{ backgroundColor: WATER_PATTERN_LABEL[season.water_pattern.pattern_detected].bg }}
                                  >
                                    <p
                                      className="text-xs font-semibold"
                                      style={{ color: WATER_PATTERN_LABEL[season.water_pattern.pattern_detected].text }}
                                    >
                                      {WATER_PATTERN_LABEL[season.water_pattern.pattern_detected].icon}{' '}
                                      {WATER_PATTERN_LABEL[season.water_pattern.pattern_detected].label}
                                    </p>
                                    <p className="text-[10px] text-gray-600">
                                      {season.water_pattern.oscillation_count} transisi basah/kering · {season.water_pattern.ndwi_points_used} titik NDWI + {season.water_pattern.sar_points_used} titik SAR · dihitung {fmtDate(season.water_pattern.calculated_at)}
                                    </p>
                                    {season.water_pattern.awd_intentionality_pct != null && (
                                      <p className="text-[10px] text-gray-700 flex items-center gap-1">
                                        <span className="font-semibold">{season.water_pattern.awd_intentionality_pct}% bukti pengeringan aktif</span>
                                        <span className="text-gray-400">
                                          ({season.water_pattern.dry_points_with_rain} dari {season.water_pattern.dry_points_total} titik kering tetap kering meski ada hujan)
                                        </span>
                                        <InfoTooltip title="Bukti Intentionality AWD">
                                          <span>
                                            Untuk tiap titik lahan terdeteksi kering, dicek: ada hujan ≥5mm dalam 5 hari sebelumnya atau tidak?
                                            Kalau kering PADAHAL baru hujan, itu tanda lahan sengaja dikeringkan (AWD aktif) — bukan kering alami
                                            karena memang tidak hujan. Makin tinggi persentasenya, makin kuat buktinya.
                                          </span>
                                        </InfoTooltip>
                                      </p>
                                    )}
                                    <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1 leading-relaxed">
                                      ⚠️ Indikasi otomatis dari data satelit, bukan konfirmasi final — perlu validasi lapangan.
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-gray-400 italic">Belum dianalisis</p>
                                )}

                                {analyzeError?.seasonId === season.id && (
                                  <p className="text-[10px] text-red-600 bg-red-50 px-2 py-1 rounded">{analyzeError.message}</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'kepemilikan' && (
                  <div className="space-y-3">
                    {/* Tombol tambah perubahan */}
                    {!showAddOwnership ? (
                      <button
                        onClick={() => {
                          setOwnershipPemilik(plot.nama_pemilik ?? '')
                          setOwnershipPenggarap(plot.nama_penggarap ?? plot.farmer_name)
                          setOwnershipDate(new Date().toISOString().split('T')[0])
                          setOwnershipNotes('')
                          setOwnershipError(null)
                          setShowAddOwnership(true)
                        }}
                        className="w-full py-2 text-xs border border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                      >
                        + Catat Perubahan Pemilik / Penggarap
                      </button>
                    ) : (
                      <form onSubmit={handleAddOwnership} className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2.5">
                        <p className="text-xs font-semibold text-blue-800">Perubahan Baru</p>
                        <p className="text-[10px] text-blue-600 leading-relaxed">
                          Entri aktif sebelumnya akan otomatis ditutup pada tanggal mulai yang diisi di bawah.
                        </p>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Nama Penggarap</label>
                          <input
                            type="text"
                            value={ownershipPenggarap}
                            onChange={(e) => setOwnershipPenggarap(e.target.value)}
                            placeholder="Nama yang menggarap lahan"
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Nama Pemilik Lahan</label>
                          <input
                            type="text"
                            value={ownershipPemilik}
                            onChange={(e) => setOwnershipPemilik(e.target.value)}
                            placeholder="Kosongkan jika sama dengan penggarap"
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Berlaku Mulai <span className="text-red-500">*</span></label>
                          <input
                            type="date"
                            required
                            value={ownershipDate}
                            onChange={(e) => setOwnershipDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Catatan (alasan perubahan)</label>
                          <textarea
                            value={ownershipNotes}
                            onChange={(e) => setOwnershipNotes(e.target.value)}
                            rows={2}
                            placeholder="contoh: warisan, sewa, jual-beli, dll."
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                          />
                        </div>
                        {ownershipError && (
                          <p className="text-[10px] text-red-600 bg-red-50 px-2 py-1 rounded">{ownershipError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={ownershipSaving || !ownershipDate}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs py-1.5 rounded-lg font-medium transition-colors"
                          >
                            {ownershipSaving ? 'Menyimpan…' : 'Simpan'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAddOwnership(false)}
                            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                          >
                            Batal
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Riwayat */}
                    {ownershipHistory.length === 0 ? (
                      <p className="text-xs text-gray-400 py-3 text-center">Belum ada riwayat kepemilikan</p>
                    ) : (
                      <div className="space-y-2">
                        {ownershipHistory.map((rec) => {
                          const isActive = !rec.tanggal_selesai
                          return (
                            <div
                              key={rec.id}
                              className={`border rounded-xl p-3 space-y-1 ${
                                isActive ? 'border-blue-100 bg-blue-50' : 'border-gray-100 bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-800">
                                  {rec.nama_penggarap ?? '—'}
                                </span>
                                {isActive && (
                                  <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                                    Aktif
                                  </span>
                                )}
                              </div>
                              {rec.nama_pemilik && rec.nama_pemilik !== rec.nama_penggarap && (
                                <p className="text-[10px] text-gray-500">
                                  Pemilik: <span className="text-gray-700">{rec.nama_pemilik}</span>
                                </p>
                              )}
                              <p className="text-[10px] text-gray-400">
                                {fmtDate(rec.tanggal_mulai)}
                                {rec.tanggal_selesai
                                  ? <> → {fmtDate(rec.tanggal_selesai)}</>
                                  : <> → sekarang</>}
                              </p>
                              {rec.notes && (
                                <p className="text-[10px] text-gray-500 italic">{rec.notes}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'karbon' && (
                  <div className="space-y-4">

                    {/* ⚠ Banner disclaimer permanen */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 space-y-0.5">
                      <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide">
                        ESTIMASI INTERNAL — BELUM TERVALIDASI
                      </p>
                      <p className="text-[10px] text-amber-700 leading-relaxed">
                        Tidak sah untuk klaim atau jual kredit karbon.
                        Additionality belum dikonfirmasi.
                      </p>
                    </div>

                    {/* Tombol tarik baseline 3 tahun dihapus (26 Nov 2026, keputusan Ichan): scan otomatis harian tetap menyimpan histori. */}

                    {/* 2. Kuantifikasi Hari Aerasi (AWD Tracker) & Estimasi CO2e */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex flex-col justify-center">
                        <div className="flex items-center gap-1 text-xs font-semibold text-emerald-800 mb-1">
                          Total Hari Aerasi
                        </div>
                        <span className="text-2xl font-bold text-emerald-600">
                          {activeSeason?.water_pattern?.total_aeration_days ?? 0} <span className="text-sm font-normal text-emerald-700">Hari Kering</span>
                        </span>
                        <p className="text-[10px] text-emerald-600/80 mt-1 leading-tight">Dibuktikan oleh Radar VV</p>
                      </div>

                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1">
                          NET CO₂e
                          <InfoTooltip title="Tentang NET CO₂e">
                            <span className="block space-y-2">
                              <span className="block">
                                <strong>CO₂e</strong> (Carbon Dioxide Equivalent) adalah satuan untuk menyatakan efek pemanasan gabungan CH₄ dan N₂O dalam setara CO₂.
                              </span>
                              <span className="block font-mono bg-white/10 rounded-lg px-3 py-2 text-[11px]">
                                NET CO₂e =<br />
                                (CH₄ dicegah × GWP 27 × 0.653 netting N₂O)
                              </span>
                            </span>
                          </InfoTooltip>
                        </div>
                        <span className="text-2xl font-bold text-gray-800">
                          {activeSeason?.water_pattern?.estimated_co2e_tonnes != null ? Number(activeSeason.water_pattern.estimated_co2e_tonnes).toFixed(2) : '—'} <span className="text-sm font-normal text-gray-500">Ton CO₂e</span>
                        </span>
                        <p className="text-[10px] text-gray-400 mt-1 leading-tight">Estimasi konversi CH₄</p>
                      </div>
                    </div>

                    {/* Badge ketidakpastian — angka Hari Aerasi/CO2e di atas dihitung
                        dari data mentah yang SAMA dengan klasifikasi Pola Pengairan
                        di tab Musim Tanam, jadi ikut mewarisi ketidakpastian itu kalau
                        polanya sendiri belum tegas (borderline/insufficient). Reuse
                        warna WATER_PATTERN_LABEL.borderline_ambiguous untuk konsisten
                        dengan badge di tab Musim Tanam. */}
                    {(activeSeason?.water_pattern?.pattern_detected === 'borderline_ambiguous' ||
                      activeSeason?.water_pattern?.pattern_detected === 'insufficient_data') && (
                      <div
                        className="rounded-lg px-2.5 py-1.5 text-[10px] leading-tight"
                        style={{ backgroundColor: WATER_PATTERN_LABEL.borderline_ambiguous.bg, color: WATER_PATTERN_LABEL.borderline_ambiguous.text }}
                      >
                        ⚠️ Berdasarkan pola pengairan yang belum tegas — lihat tab Musim Tanam
                      </div>
                    )}

                    {/* Input status checklist (Disesuaikan ke standar Verra) */}
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500">Kelengkapan Data Verra VM0051:</p>
                      {([
                        { label: `Pelacakan Poligon (${plot.area_ha} ha)`, done: true, placeholder: false },
                        { label: 'Data Baseline (Historis 3 Tahun)', done: satelliteLogs.some(l => l.sar_source === 'Sentinel-1 (Baseline API)'), placeholder: !satelliteLogs.some(l => l.sar_source === 'Sentinel-1 (Baseline API)') },
                        { label: 'Log AWD Tracker (Satelit Radar VV)', done: (activeSeason?.water_pattern?.sar_points_used ?? 0) > 0, placeholder: (activeSeason?.water_pattern?.sar_points_used ?? 0) === 0 },
                      ] as { label: string; done: boolean; placeholder: boolean }[]).map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className={`mt-px shrink-0 ${
                            item.done ? 'text-green-500' :
                            item.placeholder ? 'text-amber-500' :
                            'text-gray-300'
                          }`}>
                            {item.done ? '✓' : item.placeholder ? '⏳' : '○'}
                          </span>
                          <span className={
                            item.done ? 'text-gray-700' :
                            item.placeholder ? 'text-amber-700 font-medium' :
                            'text-gray-400'
                          }>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>

                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>

    {/* ═══ PORTAL DIALOGS — render ke document.body, bebas dari stacking context apapun ═══ */}

    {/* Dialog hapus petak */}
    {showDeleteConfirm && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Hapus Petak?</h3>
          <p className="text-sm text-gray-600 mb-1">
            Petak <strong>{plot.nama_penggarap ?? plot.farmer_name}</strong> akan disembunyikan dari list dan peta.
          </p>
          <p className="text-xs text-gray-400 mb-5">
            Data histori satelit dan log panen terkait akan disembunyikan, bukan dihapus permanen dari database.
          </p>
          {deleteError && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{deleteError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleDeletePlot}
              disabled={isDeleting}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm py-2.5 rounded-xl font-semibold transition-colors"
            >
              {isDeleting ? 'Menghapus…' : 'Ya, Hapus'}
            </button>
            <button
              onClick={() => { setShowDeleteConfirm(false); setDeleteError(null) }}
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

    {/* Dialog edit musim tanam */}
    {editSeasonId && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full my-auto">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Edit Musim Tanam</h3>
          <form onSubmit={handleEditSeason} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Varietas</label>
                <input
                  type="text"
                  value={editVariety}
                  onChange={(e) => setEditVariety(e.target.value)}
                  placeholder="Ciherang, IR64, …"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'aktif' | 'panen' | 'gagal-puso')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                >
                  <option value="aktif">aktif</option>
                  <option value="panen">panen</option>
                  <option value="gagal-puso">gagal-puso</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tanggal Tanam <span className="text-red-500">*</span></label>
              <input
                type="date"
                required
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tgl Panen Aktual</label>
                <input
                  type="date"
                  value={editHarvestDate}
                  onChange={(e) => setEditHarvestDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Hasil Panen (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editHarvestKg}
                  onChange={(e) => setEditHarvestKg(e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Catatan</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                placeholder="Opsional"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400 resize-none"
              />
            </div>
            {editError && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={editSaving || !editDate}
                className="flex-1 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm py-2.5 rounded-xl font-semibold transition-colors"
              >
                {editSaving ? 'Menyimpan…' : 'Simpan Perubahan'}
              </button>
              <button
                type="button"
                onClick={() => setEditSeasonId(null)}
                disabled={editSaving}
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

    {/* Lightbox — perbesar foto lapangan */}
    {enlargedPhotoUrl && typeof document !== 'undefined' && createPortal(
      <div
        className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 cursor-zoom-out"
        onClick={() => setEnlargedPhotoUrl(null)}
      >
        <button
          onClick={() => setEnlargedPhotoUrl(null)}
          className="absolute top-4 right-4 text-white text-2xl w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
        >
          ×
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={enlargedPhotoUrl}
          alt="Foto lapangan diperbesar"
          className="max-w-full max-h-full rounded-lg object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>,
      document.body
    )}

    {/* Dialog hapus foto lapangan */}
    {deletePhotoId && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Hapus Foto Lapangan?</h3>
          <p className="text-sm text-gray-600 mb-5">
            Foto dan keterangannya akan dihapus permanen dari database dan storage. Tindakan ini tidak bisa dibatalkan.
          </p>
          {deletePhotoError && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{deletePhotoError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => handleDeletePhoto(deletePhotoId)}
              disabled={deletingPhoto}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm py-2.5 rounded-xl font-semibold transition-colors"
            >
              {deletingPhoto ? 'Menghapus…' : 'Ya, Hapus Permanen'}
            </button>
            <button
              onClick={() => { setDeletePhotoId(null); setDeletePhotoError(null) }}
              disabled={deletingPhoto}
              className="flex-1 border border-gray-200 text-sm text-gray-600 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* Dialog hapus musim tanam */}
    {deleteSeasonId && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Hapus Musim Tanam?</h3>
          <p className="text-sm text-gray-600 mb-5">
            Data musim tanam ini akan dihapus permanen dari database. Tindakan ini tidak bisa dibatalkan.
          </p>
          {deleteSeasonError && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{deleteSeasonError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => handleDeleteSeason(deleteSeasonId)}
              disabled={deletingSeasonId}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm py-2.5 rounded-xl font-semibold transition-colors"
            >
              {deletingSeasonId ? 'Menghapus…' : 'Ya, Hapus Permanen'}
            </button>
            <button
              onClick={() => { setDeleteSeasonId(null); setDeleteSeasonError(null) }}
              disabled={deletingSeasonId}
              className="flex-1 border border-gray-200 text-sm text-gray-600 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    {/* Dialog edit status lahan */}
    {showEditStatusLahan && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full my-auto">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Edit Status Lahan</h3>
          <p className="text-xs text-gray-400 mb-4">
            Status ini berdasarkan pengakuan/dokumen petani, bukan hasil deteksi satelit.
          </p>
          <form onSubmit={handleEditStatusLahan} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status Lahan</label>
              <select
                value={editStatusLahan}
                onChange={(e) => setEditStatusLahan(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
              >
                <option value="">— Tidak diset —</option>
                <option value="organik">Organik</option>
                <option value="konversi">Konversi</option>
                <option value="regenerative">Regenerative</option>
                <option value="konvensional">Konvensional</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nama LSO / Badan Sertifikasi</label>
              <input
                type="text"
                value={editNamaLso}
                onChange={(e) => setEditNamaLso(e.target.value)}
                placeholder="contoh: Kertha Bali Sejahtera"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nomor Sertifikat</label>
              <input
                type="text"
                value={editNomorSertifikat}
                onChange={(e) => setEditNomorSertifikat(e.target.value)}
                placeholder="contoh: LSO-ORG-2024-0042"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal Kadaluarsa Sertifikat</label>
              <input
                type="date"
                value={editTanggalKadaluarsa}
                onChange={(e) => setEditTanggalKadaluarsa(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
              />
            </div>
            {editStatusLahanError && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editStatusLahanError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={editStatusLahanSaving}
                className="flex-1 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm py-2.5 rounded-xl font-semibold transition-colors"
              >
                {editStatusLahanSaving ? 'Menyimpan…' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={() => setShowEditStatusLahan(false)}
                disabled={editStatusLahanSaving}
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
