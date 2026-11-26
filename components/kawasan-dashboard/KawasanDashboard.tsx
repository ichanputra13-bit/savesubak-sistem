'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { DASH_CSS } from './dash.css'
import { moonEvents, rayaBetween, sasihMonths, wukuOf } from '@/lib/bali-calendar'
import type { MapPlot } from './DashMap'

const DashMap = dynamic(() => import('./DashMap'), { ssr: false, loading: () => <div style={{ height: '100%' }} /> })

export interface DashPlot {
  id: string; no: number; variety: string | null; area: number
  geo: { type: string; coordinates: number[][][] | number[][][][] } | null
  ndvi: number | null; ndviDate: string | null; lastImage: string | null; phase: string | null
  sar: { d: string; f: number }[]
  phases: { d: string; p: string }[]
  idx: { d: string; ndvi: number; ndwi: number | null }[]
}
export interface DashWeather { date: string; rain: number | null; temp: number | null; hum: number | null; et0: number | null; wind: number | null; windDir: number | null }
export interface DashSeason { plotId: string; year: number | null; num: number | null; variety: string | null; planting: string | null; estHarvest: string | null; harvest: string | null; harvestKg: number | null; status: string | null }

interface Props { kawasan: { id: string; name: string; sub: string }; plots: DashPlot[]; weather: DashWeather[]; seasons: DashSeason[] }

const DAY = 864e5
const WET = 0.25 // sar_flood_index > 0.25 = tergenang (sama dengan halaman petak)
const PHASE: Record<string, [string, string]> = {
  kosong: ['Bera / olah tanah', '#8d6e63'], semai: ['Semai / tanam', '#3fb6d3'], vegetatif: ['Vegetatif', '#8bc34a'],
  generatif: ['Generatif', '#f0a43a'], pematangan: ['Pematangan', '#e0703a'],
}
const umur = (v: string | null) => { const s = (v ?? '').toLowerCase(); return s.includes('merah') || s.includes('lokal') ? 145 : s.includes('mentik') ? 120 : 115 }
const nf = (x: number, d = 1) => x.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmt = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
const day0 = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const compass = (deg: number) => ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'][Math.round(deg / 45) % 8]

function rings(geo: DashPlot['geo']): [number, number][] {
  if (!geo) return []
  const c = geo.type === 'MultiPolygon' ? (geo.coordinates as number[][][][])[0]?.[0] : (geo.coordinates as number[][][])[0]
  return (c ?? []).map(([lng, lat]) => [lat, lng])
}

interface Forecast { temp: number; hum: number; wind: number; windDir: number; days: { d: string; rain: number; tmin: number; tmax: number; code: number }[] }
const wIcon = (c: number) => (c >= 95 ? '⛈' : c >= 61 ? '🌧' : c >= 51 ? '🌦' : c >= 3 ? '⛅' : c >= 1 ? '🌤' : '☀️')

export default function KawasanDashboard({ kawasan, plots, weather, seasons }: Props) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [layer, setLayer] = useState<'air' | 'fase' | 'ndvi'>('air')
  const [selId, setSelId] = useState<string | null>(plots[0]?.id ?? null)
  const [fc, setFc] = useState<Forecast | null>(null)
  const [done, setDone] = useState<Record<number, boolean>>({})
  const router = useRouter()
  const [scan, setScan] = useState<{ done: number; total: number; ok: number; gagal: number; running: boolean } | null>(null)
  async function scanAll() {
    if (!window.confirm(`Scan ${plots.length} petak di ${kawasan.name}? Berjalan satu per satu, jangan tutup halaman ini.`)) return
    let ok = 0, gagal = 0
    setScan({ done: 0, total: plots.length, ok, gagal, running: true })
    for (let i = 0; i < plots.length; i++) {
      try { const r = await fetch(`/api/plots/${plots[i].id}/scan`, { method: 'POST' }); if (r.ok) ok++; else gagal++ } catch { gagal++ }
      setScan({ done: i + 1, total: plots.length, ok, gagal, running: i + 1 < plots.length })
      if (i + 1 < plots.length) await new Promise((r) => setTimeout(r, 1500))
    }
    router.refresh()
  }
  const today = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }, [])

  useEffect(() => { try { const t = localStorage.getItem('ssd-theme'); if (t === 'light' || t === 'dark') setTheme(t) } catch {} }, [])
  const toggleTheme = () => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); try { localStorage.setItem('ssd-theme', t) } catch {} }

  // titik tengah kawasan untuk prakiraan cuaca
  const center = useMemo(() => { const pts = plots.flatMap((p) => rings(p.geo)); return pts.length ? [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length] : null }, [plots])
  useEffect(() => {
    if (!center) return
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${center[0].toFixed(4)}&longitude=${center[1].toFixed(4)}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,weather_code&forecast_days=4&wind_speed_unit=ms&timezone=Asia%2FMakassar`
    fetch(u).then((r) => r.json()).then((j) => setFc({
      temp: j.current.temperature_2m, hum: j.current.relative_humidity_2m, wind: j.current.wind_speed_10m, windDir: j.current.wind_direction_10m,
      days: j.daily.time.map((d: string, i: number) => ({ d, rain: j.daily.precipitation_sum[i], tmin: j.daily.temperature_2m_min[i], tmax: j.daily.temperature_2m_max[i], code: j.daily.weather_code[i] })),
    })).catch(() => {})
  }, [center])

  // ── turunan per petak ──
  const P = useMemo(() => plots.map((p) => {
    const lastSar = p.sar.at(-1) ?? null
    const wet = lastSar ? lastSar.f > WET : null
    const states = p.sar.map((s) => s.f > WET)
    const awd = states.includes(true) && states.includes(false)
    let dryRun = 0; for (let i = p.sar.length - 1; i >= 0 && p.sar[i].f <= WET; i--) dryRun = Math.round((+today - +day0(p.sar[i].d)) / DAY)
    const ss = seasons.filter((s) => s.plotId === p.id)
    const active = [...ss].reverse().find((s) => s.status === 'aktif' && s.planting) ?? null
    const lastDone = [...ss].reverse().find((s) => s.harvestKg && s.harvestKg > 0) ?? null
    const variety = active?.variety ?? p.variety
    const tanam = active?.planting ? day0(active.planting) : null
    const panen = active?.estHarvest ? day0(active.estHarvest) : tanam ? new Date(+tanam + umur(variety) * DAY) : null
    const prod = lastDone && p.area > 0 ? (lastDone.harvestKg as number) / 1000 / p.area : null
    return { ...p, wet, awd, dryRun, variety, tanam, panen, prod, confirmed: !!active }
  }), [plots, seasons, today])

  const sel = P.find((p) => p.id === selId) ?? P[0]
  const color = (p: typeof P[number]) => layer === 'air' ? (p.wet == null ? '#9e9e9e' : p.wet ? '#3fb6d3' : '#c9a46a')
    : layer === 'fase' ? (PHASE[p.phase ?? '']?.[1] ?? '#9e9e9e')
    : p.ndvi == null ? '#9e9e9e' : p.ndvi > 0.7 ? '#2e7d32' : p.ndvi > 0.55 ? '#66bb6a' : p.ndvi > 0.4 ? '#cddc39' : '#f0a43a'
  const legend: [string, string][] = layer === 'air' ? [['#3fb6d3', 'Tergenang'], ['#c9a46a', 'Kering (AWD)'], ['#9e9e9e', 'Belum ada data radar']]
    : layer === 'fase' ? [...Object.values(PHASE).map(([l, c]) => [c, l] as [string, string]), ['#9e9e9e', 'Belum terbaca']]
    : [['#2e7d32', 'Sangat hijau'], ['#66bb6a', 'Hijau'], ['#cddc39', 'Sedang'], ['#f0a43a', 'Rendah'], ['#9e9e9e', 'Tak ada citra cerah']]
  const mapPlots: MapPlot[] = P.map((p) => ({ id: p.id, label: `Petak ${p.no}`, rings: rings(p.geo), color: color(p), selected: p.id === sel?.id }))

  // ── ringkasan ──
  const area = P.reduce((a, p) => a + p.area, 0)
  const withNdvi = P.filter((p) => p.ndvi != null)
  const avgNdvi = withNdvi.length ? withNdvi.reduce((a, p) => a + (p.ndvi as number), 0) / withNdvi.length : null
  const nWet = P.filter((p) => p.wet === true).length, nDry = P.filter((p) => p.wet === false).length
  const withSar = P.filter((p) => p.sar.length >= 2)
  const awdPct = withSar.length ? Math.round((withSar.filter((p) => p.awd).length / withSar.length) * 100) : null
  // Perkiraan sederhana (bukan untuk klaim/audit): IPCC faktor dasar 1,22 kg CH4/ha/hari,
  // AWD mengurangi ±45%, dihitung untuk 60 hari pemantauan, GWP CH4 = 27.
  const co2 = P.filter((p) => p.awd).reduce((a, p) => a + p.area * 1.22 * 60 * 0.45 * 27 / 1000, 0)
  const withProd = P.filter((p) => p.prod != null)
  const prodArea = withProd.reduce((a, p) => a + p.area, 0)
  const avgProd = prodArea ? withProd.reduce((a, p) => a + (p.prod as number) * p.area, 0) / prodArea : null
  const estHasil = avgProd != null ? P.reduce((a, p) => a + p.area * (p.prod ?? avgProd), 0) : null
  const best = withProd.reduce<typeof P[number] | null>((b, p) => (!b || (p.prod as number) > (b.prod as number) ? p : b), null)
  const nextPanen = P.map((p) => p.panen).filter((d): d is Date => !!d && d >= today).sort((a, b) => +a - +b)[0] ?? null

  // ── cuaca ──
  const last = weather.at(-1) ?? null
  const w7 = weather.slice(-7)
  const rain7 = w7.reduce((a, w) => a + (w.rain ?? 0), 0), et7 = w7.reduce((a, w) => a + (w.et0 ?? 0), 0)
  const bal7 = rain7 - et7
  const heavy = (last?.rain ?? 0) >= 50

  // ── kalender Bali ──
  const moons = useMemo(() => moonEvents(new Date(+today - 40 * DAY), new Date(+today + 400 * DAY)), [today])
  const nextMoon = moons.find((m) => m.d >= today)
  const calFrom = new Date(today.getFullYear(), today.getMonth(), 1)
  const calTo = new Date(+calFrom + 365 * DAY)
  const { months, nyepi } = useMemo(() => sasihMonths(calFrom, calTo), [+calFrom]) // eslint-disable-line react-hooks/exhaustive-deps
  const M = months.slice(0, 12)
  const curSasih = months.find((m) => today >= m.s && today <= m.e)
  const raya = useMemo(() => rayaBetween(new Date(+today - 400 * DAY), new Date(+today + 400 * DAY)), [today])
  const nextRaya = raya.find((r) => r.d >= today)

  // ── saran untuk pekaseh ──
  const todos: { t: string; s: string; tag: string }[] = []
  const dryButRain = P.filter((p) => p.wet === false && bal7 > 20)
  if (dryButRain.length) todos.push({ t: `Cek saluran Petak ${dryButRain.slice(0, 6).map((p) => p.no).join(', ')}`, s: `Hujan 7 hari surplus ${nf(bal7, 0)} mm tapi radar masih membaca kering — sengaja AWD atau saluran tersumbat?`, tag: 'air' })
  const soon = P.filter((p) => p.panen && +p.panen - +today <= 14 * DAY && p.panen >= today)
  if (soon.length) todos.push({ t: `Siapkan panen Petak ${soon.map((p) => p.no).join(', ')}`, s: `Perkiraan panen ≤ 14 hari (${fmt(soon[0].panen as Date)}). Siapkan tenaga & jadwal.`, tag: 'panen' })
  if (heavy) todos.push({ t: 'Hujan lebat — cek pematang & pembuangan', s: `${nf(last?.rain ?? 0, 0)} mm dalam sehari terakhir.`, tag: 'cuaca' })
  if (fc) { const dry3 = fc.days.slice(1).filter((d) => d.rain < 5).length; if (dry3 >= 2) todos.push({ t: 'Waktu baik untuk pengeringan AWD', s: `${dry3} dari 3 hari ke depan diprakirakan hampir tanpa hujan.`, tag: 'air' }) }
  const noImg = P.filter((p) => !p.ndviDate || +today - +day0(p.ndviDate) > 30 * DAY)
  if (noImg.length) todos.push({ t: `${noImg.length} petak belum dapat citra cerah > 30 hari`, s: 'Musim hujan — status air tetap dipantau lewat radar. Tekan "Scan semua petak" di halaman kawasan untuk mencoba lagi.', tag: 'satelit' })
  if (nextMoon) todos.push({ t: `${nextMoon.t} ${fmt(nextMoon.d)}${nextRaya && +nextRaya.d - +today < 30 * DAY ? ` · ${nextRaya.t} ${fmt(nextRaya.d)}` : ''}`, s: 'Perhatikan jadwal upacara subak & kegiatan di sawah.', tag: 'kalender' })

  // ── kalender air 30 hari ──
  const N = 30
  const days = [...Array(N)].map((_, i) => new Date(+today - (N - 1 - i) * DAY))
  const rainBy = new Map(weather.map((w) => [w.date, w.rain ?? 0]))
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  function cell(p: typeof P[number], d: Date) {
    const k = key(d)
    const obs = p.sar.find((s) => s.d === k)
    if (obs) return { c: obs.f > WET ? 'var(--w)' : 'var(--dry)', o: 1, t: obs.f > WET ? 'tergenang (radar)' : 'kering (radar)' }
    const prev = [...p.sar].reverse().find((s) => day0(s.d) < d && +d - +day0(s.d) <= 6 * DAY)
    if (prev) return { c: prev.f > WET ? 'var(--w)' : 'var(--dry)', o: 0.35, t: 'perkiraan dari pengamatan sebelumnya' }
    return { c: 'var(--line)', o: 1, t: 'tidak ada data' }
  }

  // ── lajur musim tanam ──
  const tanamDates = P.map((p) => p.tanam).filter((d): d is Date => !!d).sort((a, b) => +a - +b)
  const segs: { n: string; s: Date; e: Date; c: string; ok: boolean }[] = []
  if (tanamDates.length) {
    const t0 = tanamDates[Math.floor(tanamDates.length / 2)] // median tanggal tanam kawasan
    const u = umur(P[0]?.variety ?? null)
    const add = (n: string, a: number, b: number, c: string, ok: boolean) => segs.push({ n, s: new Date(+t0 + a * DAY), e: new Date(+t0 + b * DAY), c, ok })
    add('Olah tanah', -25, 0, '#8d6e63', false); add('Tanam', 0, 7, '#3fb6d3', true); add('Vegetatif', 7, Math.round(u * 0.55), '#8bc34a', false)
    add('Generatif', Math.round(u * 0.55), u - 10, '#f0a43a', false); add('Panen', u - 10, u + 5, '#e0703a', false)
    add('Olah tanah', u + 20, u + 45, '#8d6e63', false); add('Tanam (musim berikut)', u + 45, u + 52, '#3fb6d3', false)
    add('Vegetatif', u + 52, u + 52 + Math.round(u * 0.55), '#8bc34a', false); add('Generatif', u + 52 + Math.round(u * 0.55), u + 52 + u - 10, '#f0a43a', false); add('Panen', u + 52 + u - 10, u + 52 + u + 5, '#e0703a', false)
  }
  const s0 = M[0]?.s ?? calFrom, s1 = M.at(-1)?.e ?? calTo
  const pc = (d: Date) => Math.max(0, Math.min(100, ((+d - +s0) / (+s1 - +s0)) * 100))
  const rayaCal = raya.filter((r) => r.d >= s0 && r.d <= s1).concat(nyepi.map((d) => ({ t: 'Nyepi', d }))).sort((a, b) => +a.d - +b.d)

  // ── grafik: produktivitas per musim ──
  const areaOf = new Map(P.map((p) => [p.id, p.area]))
  const seasonMap = new Map<string, { kg: number; ha: number; d: Date }>()
  for (const x of seasons) {
    if (!x.harvestKg || x.harvestKg <= 0) continue
    const d = x.harvest ? day0(x.harvest) : x.estHarvest ? day0(x.estHarvest) : null
    if (!d) continue
    const label = x.year && x.num ? `MT ${x.num} ${x.year}` : d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
    const cur = seasonMap.get(label) ?? { kg: 0, ha: 0, d }
    cur.kg += x.harvestKg; cur.ha += areaOf.get(x.plotId) ?? 0; if (d > cur.d) cur.d = d
    seasonMap.set(label, cur)
  }
  const prodSeries = [...seasonMap.entries()].filter(([, v]) => v.ha > 0).map(([l, v]) => ({ l, v: v.kg / 1000 / v.ha, d: v.d })).sort((a, b) => +a.d - +b.d).slice(-8)
  const maxProd = Math.max(1, ...prodSeries.map((x) => x.v))

  // ── grafik: NDVI & NDWI rata-rata kawasan per minggu (citra cerah saja) ──
  const W = 13
  const idxSeries = [...Array(W)].map((_, i) => {
    const e = new Date(+today - (W - 1 - i) * 7 * DAY), s = new Date(+e - 6 * DAY)
    const obs = P.flatMap((p) => p.idx.filter((x) => { const d = day0(x.d); return d >= s && d <= e }))
    const nv = obs.map((o) => o.ndvi), nw = obs.map((o) => o.ndwi).filter((x): x is number => x != null)
    return { s, ndvi: nv.length ? nv.reduce((a, b) => a + b, 0) / nv.length : null, ndwi: nw.length ? nw.reduce((a, b) => a + b, 0) / nw.length : null, n: obs.length }
  })
  const CW = 520, CH = 200, padL = 34, padB = 22
  const xAt = (i: number) => padL + (i * (CW - padL - 10)) / (W - 1)
  const yAt = (v: number) => 8 + ((1 - (v + 0.5) / 1.5) * (CH - padB - 8)) // sumbu -0,5 … 1,0
  const path = (k: 'ndvi' | 'ndwi') => idxSeries.map((x, i) => (x[k] == null ? null : `${xAt(i)},${yAt(x[k] as number)}`)).filter(Boolean).join(' ')

  return (
    <div className="ssd" data-theme={theme}>
      <style>{DASH_CSS}</style>
      <div className="hdr">
        <div style={{ background: '#fff', borderRadius: 12, padding: 3, display: 'flex' }}><Image src="/logo-save-subak.png" alt="Save Subak" width={40} height={40} unoptimized /></div>
        <div><h1>{kawasan.name}</h1><div className="mut" style={{ fontSize: 12 }}>{kawasan.sub || 'Save Subak Sistem'} · {P.length} petak · {nf(area, 2)} ha</div></div>
        <div style={{ marginLeft: 'auto' }} className="row">
          <Link href="/kawasan" className="ghost">← Semua kawasan</Link>
          <Link href={`/kawasan/${kawasan.id}/kelola`} className="ghost">⚙ Kelola petak</Link>
          <button className="btn" onClick={scanAll} disabled={scan?.running || plots.length === 0}>
            {scan?.running ? `⟳ Scan ${scan.done}/${scan.total}…` : scan ? `✓ ${scan.ok} berhasil${scan.gagal ? `, ${scan.gagal} gagal` : ''}` : '⟳ Scan semua petak'}
          </button>
          <button className="ghost" onClick={toggleTheme} title="Ganti mode">{theme === 'dark' ? '☀︎ Terang' : '☾ Gelap'}</button>
        </div>
      </div>
      <div className="terr" />

      <div className="wrap">
        <div className="strip full">
          {[
            ['Cuaca sekarang', fc ? `${wIcon(fc.days[0]?.code ?? 2)} ${nf(fc.temp, 0)}°C` : last?.temp != null ? `${nf(last.temp, 0)}°C` : '–', fc ? `lembap ${nf(fc.hum, 0)}%` : 'rata-rata harian'],
            ['Hujan kemarin', last?.rain != null ? `${nf(last.rain, 1)} mm` : '–', heavy ? 'lebat — cek pembuangan' : last ? fmt(day0(last.date)) : '', heavy ? 'hot' : ''],
            ['Angin', fc ? <span key="w"><span style={{ display: 'inline-block', transform: `rotate(${fc.windDir + 90}deg)` }}>➤</span> {nf(fc.wind, 1)} m/s</span> : '–', fc ? `dari ${compass(fc.windDir)}` : ''],
            ['Neraca air 7 hari', w7.length ? `${bal7 >= 0 ? '+' : ''}${nf(bal7, 0)} mm` : '–', w7.length ? (bal7 >= 10 ? 'surplus · irigasi tidak perlu' : bal7 <= -10 ? 'defisit · perlu irigasi' : 'seimbang') : 'belum ada data'],
            ['Prakiraan 3 hari', fc ? fc.days.slice(1).map((d) => wIcon(d.code)).join(' ') : '–', fc ? fc.days.slice(1).map((d) => `${nf(d.rain, 0)}`).join(' · ') + ' mm' : ''],
            ['Sasih', curSasih ? `Sasih ${curSasih.name}` : '–', `Wuku ${wukuOf(today)}`],
            ['Berikutnya', nextMoon ? `${nextMoon.t === 'Purnama' ? '🌕' : '🌑'} ${nextMoon.t} ${fmt(nextMoon.d)}` : '–', nextRaya ? `${nextRaya.t} ${fmt(nextRaya.d)}` : ''],
          ].map((c, i) => (
            <div key={i} className={`chip ${c[3] ?? ''}`}><div className="l">{c[0]}</div><div className="v">{c[1]}</div><div className="s">{c[2]}</div></div>
          ))}
        </div>

        <section className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Peta petak</h3>
            <div className="tabs">{(['air', 'fase', 'ndvi'] as const).map((l) => <button key={l} className={layer === l ? 'on' : ''} onClick={() => setLayer(l)}>{l === 'air' ? 'Air' : l === 'fase' ? 'Fase' : 'Kehijauan'}</button>)}</div>
          </div>
          <div style={{ height: 430, marginTop: 12 }}><DashMap plots={mapPlots} onPick={setSelId} /></div>
          <div className="row note">{legend.map(([c, l]) => <span key={l}><span className="dot" style={{ background: c }} />{l}</span>)}</div>

          <h3 style={{ marginTop: 18 }}>Data petak lahan</h3>
          <div className="sum">
            {[
              ['Rata-rata produktivitas kawasan', avgProd != null ? `${nf(avgProd)} t/ha` : '–', avgProd != null ? 'GKP · musim lalu' : 'belum ada catatan panen'],
              ['Perkiraan panen musim ini', estHasil != null ? `${nf(estHasil)} t` : '–', `GKP · ${nf(area, 2)} ha`],
              ['Petak terbaik', best ? `Petak ${best.no}` : '–', best ? `${nf(best.prod as number)} t/ha` : ''],
              ['Panen terdekat', nextPanen ? fmt(nextPanen) : '–', nextPanen ? `${Math.round((+nextPanen - +today) / DAY)} hari lagi` : 'tanggal tanam belum diisi'],
            ].map((k) => <div key={k[0]} className="k"><div className="l">{k[0]}</div><div className="v">{k[1]}</div><div className="l">{k[2]}</div></div>)}
          </div>
          <div className="scroll10">
          <table className="pt">
            <thead><tr><th>Petak</th><th>Luas</th><th>Tanaman</th><th>Tanam</th><th>Perkiraan panen</th><th>Produktivitas lalu</th></tr></thead>
            <tbody>
              {P.map((p) => (
                <tr key={p.id} className={p.id === sel?.id ? 'sel' : ''} onClick={() => setSelId(p.id)}>
                  <td><span className="dot" style={{ background: color(p) }} /><b>Petak {p.no}</b></td>
                  <td>{nf(p.area, 2)} ha</td>
                  <td>Padi {p.variety ?? '–'} {p.phase && <span className="tag">{PHASE[p.phase]?.[0] ?? p.phase}</span>}</td>
                  <td>{p.tanam ? `${fmt(p.tanam)} ✓` : <span className="mut">belum diisi</span>}</td>
                  <td>{p.panen ? <>{fmt(p.panen)} <span className="mut">({Math.round((+p.panen - +today) / DAY) > 0 ? `${Math.round((+p.panen - +today) / DAY)} hari lagi` : 'sudah lewat'})</span></> : '–'}</td>
                  <td>{p.prod != null ? <><b>{nf(p.prod)} t/ha</b><span className="pbar"><i style={{ width: `${Math.min(100, (p.prod / 8) * 100)}%` }} /></span></> : <span className="mut">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="note">{P.length > 10 ? `${P.length} petak — gulir tabel untuk melihat semua. ` : ''}Produktivitas = hasil panen GKP per ha musim terakhir yang tercatat. Tanggal tanam ✓ = dari data musim tanam; perkiraan panen = tanggal tanam + umur varietas.</div>
        </section>

        <aside>
          <div className="card">
            <h3>Saran untuk pekaseh</h3>
            <ul className="todo">
              {todos.map((t, i) => (
                <li key={i} className={done[i] ? 'done' : ''}><input type="checkbox" checked={!!done[i]} onChange={(e) => setDone({ ...done, [i]: e.target.checked })} />
                  <div><b>{t.t} <span className="tag">{t.tag}</span></b><span>{t.s}</span></div></li>
              ))}
            </ul>
            <div className="note">Disusun otomatis dari citra satelit, radar, cuaca & kalender.</div>
          </div>

          {sel && (
            <div className="card" style={{ marginTop: 14 }}>
              <h3>Info petak lahan</h3>
              <div className="row" style={{ justifyContent: 'space-between' }}><b style={{ fontSize: 18 }}>Petak {sel.no}</b>
                <span className="tag" style={{ color: sel.wet == null ? undefined : sel.wet ? '#3fb6d3' : '#c9a46a' }}>{sel.wet == null ? 'Belum ada radar' : sel.wet ? 'Tergenang' : 'Kering'}</span></div>
              <div className="kpis" style={{ marginTop: 8 }}>
                <div className="k"><div className="l">Luas</div><b>{nf(sel.area, 2)} ha</b></div>
                <div className="k"><div className="l">Varietas</div><b>{sel.variety ?? '–'}</b></div>
                <div className="k"><div className="l">Fase</div><b>{PHASE[sel.phase ?? '']?.[0] ?? '–'}</b></div>
                <div className="k"><div className="l">Kehijauan (NDVI)</div><b>{sel.ndvi != null ? nf(sel.ndvi, 2) : '–'}</b></div>
                <div className="k"><div className="l">Kering beruntun</div><b>{sel.wet === false ? `${sel.dryRun} hari` : '0 hari'}</b></div>
                <div className="k"><div className="l">Perkiraan panen</div><b>{sel.panen ? fmt(sel.panen) : '–'}</b></div>
                <div className="k"><div className="l">Produktivitas lalu</div><b>{sel.prod != null ? `${nf(sel.prod)} t/ha` : '–'}</b></div>
                <div className="k"><div className="l">Citra cerah terakhir</div><b>{sel.ndviDate ? fmt(day0(sel.ndviDate)) : '–'}</b></div>
              </div>
              <Link href={`/kawasan/${kawasan.id}/plot/${sel.id}`} className="btn" style={{ display: 'block', textAlign: 'center', marginTop: 10 }}>Buka detail petak →</Link>
            </div>
          )}

          <div className="card" style={{ marginTop: 14 }}>
            <h3>Ringkasan kawasan</h3>
            <div className="kpis">
              <div className="k"><div className="l">Kehijauan rata-rata</div><div className="v">{avgNdvi != null ? nf(avgNdvi, 2) : '–'}</div></div>
              <div className="k"><div className="l">Tergenang / kering</div><div className="v">{nWet} / {nDry}</div></div>
              <div className="k"><div className="l">Pola AWD terpenuhi</div><div className="v">{awdPct != null ? `${awdPct}%` : '–'}</div></div>
              <div className="k"><div className="l">Perkiraan emisi dihindari</div><div className="v">{nf(co2)} t</div><div className="l">CO₂e · 60 hari · perkiraan</div></div>
            </div>
          </div>
        </aside>

        <div className="card full">
          <div className="charts2">
            <div>
              <h3>Produktivitas rata-rata per musim</h3>
              {prodSeries.length === 0 ? <div className="mut" style={{ padding: '30px 0' }}>Belum ada catatan hasil panen di kawasan ini.</div> : (
                <div className="pbars">
                  {prodSeries.map((x) => (
                    <div key={x.l} className="pcol" title={`${x.l}: ${nf(x.v)} t/ha GKP`}>
                      <b>{nf(x.v)}</b>
                      <div className="pb"><div style={{ height: `${(x.v / maxProd) * 100}%` }} /></div>
                      <span>{x.l}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="note">t/ha GKP = total hasil panen ÷ luas petak yang dipanen, per musim tanam.</div>
            </div>
            <div>
              <h3>Kehijauan (NDVI) & air (NDWI) · 13 minggu</h3>
              <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" style={{ display: 'block' }}>
                {[-0.5, 0, 0.5, 1].map((v) => <g key={v}><line x1={padL} x2={CW - 10} y1={yAt(v)} y2={yAt(v)} stroke="var(--line)" /><text x={4} y={yAt(v) + 4} fontSize="10" fill="var(--mut)">{nf(v, 1)}</text></g>)}
                <polyline points={path('ndvi')} fill="none" stroke="#8bc34a" strokeWidth={2.5} />
                <polyline points={path('ndwi')} fill="none" stroke="#3fb6d3" strokeWidth={2.5} strokeDasharray="5 4" />
                {idxSeries.map((x, i) => <g key={i}>
                  {x.ndvi != null && <circle cx={xAt(i)} cy={yAt(x.ndvi)} r={3.5} fill="#8bc34a"><title>{`${fmt(x.s)} · NDVI ${nf(x.ndvi, 2)} (${x.n} citra)`}</title></circle>}
                  {x.ndwi != null && <circle cx={xAt(i)} cy={yAt(x.ndwi)} r={3} fill="#3fb6d3"><title>{`${fmt(x.s)} · NDWI ${nf(x.ndwi, 2)}`}</title></circle>}
                  {i % 3 === 0 && <text x={xAt(i)} y={CH - 6} fontSize="10" fill="var(--mut)" textAnchor="middle">{fmt(x.s)}</text>}
                </g>)}
              </svg>
              <div className="row note"><span><span className="dot" style={{ background: '#8bc34a' }} />NDVI — makin tinggi makin hijau</span><span><span className="dot" style={{ background: '#3fb6d3' }} />NDWI — makin tinggi makin basah</span><span>· rata-rata citra cerah per minggu</span></div>
            </div>
          </div>
        </div>

        <div className="card full">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Kalender air per petak · 30 hari terakhir</h3>
            <div className="mut" style={{ fontSize: 12 }}><span className="dot" style={{ background: 'var(--w)' }} />tergenang <span className="dot" style={{ background: 'var(--dry)', marginLeft: 8 }} />kering <span className="dot" style={{ background: 'var(--line)', marginLeft: 8 }} />tak ada data · warna pudar = perkiraan · batang atas = hujan harian</div>
          </div>
          <div className="wc" style={{ marginTop: 10, gridTemplateColumns: `70px repeat(${N}, minmax(0,1fr))` }}>
            <div className="n">Hujan</div>
            {days.map((d) => { const r = rainBy.get(key(d)) ?? 0; return <div key={+d} style={{ height: 30, display: 'flex', alignItems: 'flex-end' }} title={`${fmt(d)} · ${nf(r, 1)} mm`}><div style={{ width: '100%', height: Math.min(30, r / 2), background: 'var(--w)', opacity: 0.55, borderRadius: '2px 2px 0 0' }} /></div> })}
          </div>
          <div className="wc wcbody" style={{ marginTop: 2, gridTemplateColumns: `70px repeat(${N}, minmax(0,1fr))` }}>
            {P.map((p) => [<div key={p.id + 'n'} className="n">Petak {p.no}</div>, ...days.map((d) => { const c = cell(p, d); return <div key={p.id + +d} className="c" style={{ background: c.c, opacity: c.o }} title={`Petak ${p.no} · ${fmt(d)} · ${c.t}`} /> })])}
          </div>
          <div className="wc" style={{ marginTop: 2, gridTemplateColumns: `70px repeat(${N}, minmax(0,1fr))` }}>
            <div />
            {days.map((d, i) => <div key={'l' + i} className="mut" style={{ textAlign: 'center' }}>{i % 5 === 0 ? d.getDate() : ''}</div>)}
          </div>
          {P.length > 10 && <div className="note">{P.length} petak — gulir untuk melihat semua.</div>}
        </div>

        <div className="card full">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Kalender sasih & musim tanam · 12 bulan</h3>
            <div className="mut" style={{ fontSize: 12 }}><span style={{ border: '2px dashed var(--mut)', padding: '0 8px', borderRadius: 4 }}>perkiraan sistem</span> &nbsp; <span style={{ background: 'var(--g)', color: '#fff', padding: '1px 8px', borderRadius: 4 }}>dari data musim tanam</span></div>
          </div>
          <div className="ss" style={{ marginTop: 12 }}>
            <div className="lab">Sasih</div>
            {M.map((m) => <div key={+m.s} className="hd">{m.name}<small>{fmt(m.s)} – {fmt(m.e)}</small></div>)}
            <div className="lab">Bulan</div>
            {M.map((m) => <div key={'b' + +m.s}>{moons.filter((x) => x.d >= m.s && x.d <= m.e).map((x) => <span key={+x.d} className="ev">{x.t === 'Purnama' ? '🌕' : '🌑'} {fmt(x.d)}</span>)}</div>)}
            <div className="lab">Hari raya</div>
            {M.map((m) => <div key={'r' + +m.s}>{rayaCal.filter((r) => r.d >= m.s && r.d <= m.e).map((r) => <span key={r.t + +r.d} className="ev" title={r.t}>✦ {r.t} {fmt(r.d)}</span>)}</div>)}
            <div className="lab">Musim tanam</div>
            <div className="lane">
              {segs.length === 0 && <div className="mut" style={{ padding: 12 }}>Tanggal tanam belum diisi — perkiraan musim akan muncul setelah ada data musim tanam.</div>}
              {segs.filter((x) => x.e >= s0 && x.s <= s1).map((x, i) => (
                <div key={i} className={`seg ${x.ok ? '' : 'est'}`} style={{ left: `${pc(x.s)}%`, width: `${Math.max(1, pc(x.e) - pc(x.s))}%`, background: x.c, borderColor: x.c }} title={`${x.n} ${fmt(x.s)}–${fmt(x.e)} · ${x.ok ? 'dari data musim tanam' : 'perkiraan sistem'}`}>{x.ok ? '✓ ' : ''}{x.n}</div>
              ))}
              <div className="today" style={{ left: `${pc(today)}%` }} title="Hari ini" />
            </div>
          </div>
          <div className="note">Purnama/Tilem dihitung dari posisi bulan; sasih & hari raya dari kalender Saka dan pawukon. Sesekali bisa bergeser 1 hari (ngunaratri) — cocokkan dengan kalender Bali cetak. Konfirmasi tahap oleh pekaseh tersedia setelah fitur login.</div>
        </div>
      </div>
    </div>
  )
}
