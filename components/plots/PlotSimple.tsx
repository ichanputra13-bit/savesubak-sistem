'use client'

// Halaman petak sederhana (27 Nov 2026) — gaya sama dengan dashboard kawasan.
// Isi: kondisi petak dalam kata-kata, 1 grafik riwayat, foto & catatan
// lapangan, musim tanam & catat panen. Fitur teknis (NBR, scan manual, edit
// batas, kepemilikan, MRV) ada di halaman /kelola.

import dynamic from 'next/dynamic'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { DASH_CSS } from '@/components/kawasan-dashboard/dash.css'

const DashMap = dynamic(() => import('@/components/kawasan-dashboard/DashMap'), { ssr: false, loading: () => <div style={{ height: '100%' }} /> })

export interface SimpleLog { scan_date: string; ndvi_score: number | null; ndwi_score: number | null; cloud_cover_percent: number | null; sar_flood_index: number | null; estimated_phase: string | null }
export interface SimpleField { id: string; log_date: string; photo_path: string | null; note: string | null }
export interface SimpleSeason { id: string; season_year: number; season_number: number; crop_variety: string | null; planting_date: string | null; estimated_harvest_date: string | null; actual_harvest_date: string | null; actual_harvest_kg: number | null; status: string | null }

interface Props {
  kawasan: { id: string; name: string }
  plot: { id: string; no: number; variety: string | null; area: number; geo: { type: string; coordinates: number[][][] | number[][][][] } | null }
  logs: SimpleLog[]; fields: SimpleField[]; seasons: SimpleSeason[]
}

const DAY = 864e5
const WET = 0.25
const CLEAR = 15
const PHASE: Record<string, string> = { kosong: 'Bera / olah tanah', semai: 'Semai / baru tanam', vegetatif: 'Vegetatif (tumbuh)', generatif: 'Generatif (bunting/berbunga)', pematangan: 'Pematangan (menguning)' }
const umur = (v: string | null) => { const s = (v ?? '').toLowerCase(); return s.includes('merah') || s.includes('lokal') ? 145 : s.includes('mentik') ? 120 : 115 }
const nf = (x: number, d = 1) => x.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmt = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const day0 = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const hijau = (v: number) => (v > 0.7 ? ['Sangat hijau', '#2e7d32'] : v > 0.55 ? ['Hijau', '#66bb6a'] : v > 0.4 ? ['Hijau sedang', '#cddc39'] : v > 0.2 ? ['Kurang hijau', '#f0a43a'] : ['Tanah terbuka / bera', '#8d6e63'])

function rings(geo: Props['plot']['geo']): [number, number][] {
  if (!geo) return []
  const c = geo.type === 'MultiPolygon' ? (geo.coordinates as number[][][][])[0]?.[0] : (geo.coordinates as number[][][])[0]
  return (c ?? []).map(([lng, lat]) => [lat, lng])
}

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Gagal kompres foto'))), 'image/jpeg', 0.75))
}

export default function PlotSimple({ kawasan, plot, logs, fields, seasons }: Props) {
  const router = useRouter()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [menu, setMenu] = useState(false)
  const [mapMode, setMapMode] = useState<'foto' | 'hijau'>('foto')
  useEffect(() => { try { const t = localStorage.getItem('ssd-theme'); if (t === 'light' || t === 'dark') setTheme(t) } catch {} }, [])
  const toggleTheme = () => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); try { localStorage.setItem('ssd-theme', t) } catch {} }
  const today = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }, [])

  // ── kondisi ──
  const clear = logs.filter((l) => l.ndvi_score != null && (l.cloud_cover_percent ?? 100) <= CLEAR)
  const lastClear = clear.at(-1) ?? null
  const sar = logs.filter((l) => l.sar_flood_index != null)
  const lastSar = sar.at(-1) ?? null
  const wet = lastSar ? (lastSar.sar_flood_index as number) > WET : null
  let dryDays = 0
  if (wet === false) { for (let i = sar.length - 1; i >= 0 && (sar[i].sar_flood_index as number) <= WET; i--) dryDays = Math.round((+today - +day0(sar[i].scan_date)) / DAY) }
  const phase = [...logs].reverse().find((l) => l.estimated_phase)?.estimated_phase ?? null
  const active = seasons.find((s) => s.status === 'aktif') ?? null
  const variety = active?.crop_variety ?? plot.variety
  const tanam = active?.planting_date ? day0(active.planting_date) : null
  const panen = active?.estimated_harvest_date ? day0(active.estimated_harvest_date) : tanam ? new Date(+tanam + umur(variety) * DAY) : null
  const hv = lastClear ? hijau(lastClear.ndvi_score as number) : null

  // ── peta ──
  const mapPlots = [{ id: plot.id, label: `Petak ${plot.no}`, rings: rings(plot.geo), color: mapMode === 'hijau' && hv ? hv[1] : 'rgba(255,255,255,0.05)', selected: true }]

  // ── grafik 90 hari ──
  const from = new Date(+today - 90 * DAY)
  const CW = 560, CH = 170, pl = 30
  const xAt = (d: Date) => pl + ((+d - +from) / (+today - +from)) * (CW - pl - 8)
  const yAt = (v: number) => 10 + (1 - Math.max(0, Math.min(1, v))) * (CH - 60)
  const pts = clear.filter((l) => day0(l.scan_date) >= from)
  const sarPts = sar.filter((l) => day0(l.scan_date) >= from)

  // ── foto ──
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    fields.filter((f) => f.photo_path).slice(0, 12).forEach((f) => {
      fetch(`/api/plots/${plot.id}/field-photo-url?path=${encodeURIComponent(f.photo_path as string)}`).then((r) => r.json()).then((j) => j.url && setUrls((u) => ({ ...u, [f.id]: j.url }))).catch(() => {})
    })
  }, [fields, plot.id])
  const [showFoto, setShowFoto] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function kirimFoto(e: React.FormEvent) {
    e.preventDefault(); if (!file) { setErr('Pilih foto dulu'); return }
    setBusy(true); setErr(null)
    try {
      const form = new FormData(); form.append('photo', await compressImage(file), 'photo.jpg'); form.append('note', note)
      const r = await fetch(`/api/plots/${plot.id}/field-logs`, { method: 'POST', body: form }); const j = await r.json()
      if (!r.ok) { setErr(j.error ?? 'Gagal upload'); return }
      setShowFoto(false); setFile(null); setNote(''); router.refresh()
    } catch (x) { setErr(String(x)) } finally { setBusy(false) }
  }

  // ── musim tanam ──
  const [showMusim, setShowMusim] = useState(false)
  const [mTgl, setMTgl] = useState(''); const [mVar, setMVar] = useState(plot.variety ?? '')
  const [mNo, setMNo] = useState(1); const [mThn, setMThn] = useState(today.getFullYear())
  async function simpanMusim(e: React.FormEvent) {
    e.preventDefault(); if (!mTgl) return
    setBusy(true); setErr(null)
    try {
      const r = await fetch(`/api/plots/${plot.id}/seasons`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ season_year: mThn, season_number: mNo, crop_variety: mVar || null, planting_date: mTgl }) })
      const j = await r.json(); if (!r.ok) { setErr(j.error ?? 'Gagal menyimpan'); return }
      setShowMusim(false); setMTgl(''); router.refresh()
    } catch (x) { setErr(String(x)) } finally { setBusy(false) }
  }
  const [panenId, setPanenId] = useState<string | null>(null)
  const [pTgl, setPTgl] = useState(''); const [pKg, setPKg] = useState('')
  async function simpanPanen(e: React.FormEvent, id: string) {
    e.preventDefault(); if (!pTgl) return
    setBusy(true); setErr(null)
    try {
      const r = await fetch(`/api/plots/${plot.id}/seasons/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actual_harvest_date: pTgl, actual_harvest_kg: pKg ? parseFloat(pKg.replace(',', '.')) : null }) })
      const j = await r.json(); if (!r.ok) { setErr(j.error ?? 'Gagal menyimpan'); return }
      setPanenId(null); setPTgl(''); setPKg(''); router.refresh()
    } catch (x) { setErr(String(x)) } finally { setBusy(false) }
  }

  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--ink)', fontSize: 15, marginTop: 4 }
  const label: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--mut)', marginTop: 10 }

  return (
    <div className="ssd" data-theme={theme}>
      <style>{DASH_CSS + PS_CSS}</style>
      <div className="hdr">
        <Link href={`/kawasan/${kawasan.id}`} className="ghost" aria-label="Kembali">←</Link>
        <div style={{ background: '#fff', borderRadius: 12, padding: 3, display: 'flex' }}><Image src="/logo-save-subak.png" alt="Save Subak" width={34} height={34} unoptimized /></div>
        <div><h1>Petak {plot.no}</h1><div className="mut" style={{ fontSize: 12 }}>{kawasan.name} · {nf(plot.area, 2)} ha · Padi {variety ?? '–'}</div></div>
        <button className="ghost hamb" onClick={() => setMenu(!menu)} aria-label="Menu">☰</button>
        <div className={`row hdr-act ${menu ? 'open' : ''}`}>
          <Link href={`/kawasan/${kawasan.id}/plot/${plot.id}/kelola`} className="ghost">⚙ Kelola lengkap (admin)</Link>
          <button className="ghost" onClick={toggleTheme}>{theme === 'dark' ? '☀︎ Terang' : '☾ Gelap'}</button>
        </div>
      </div>
      <div className="terr" />

      <div className="ps">
        {/* Kondisi sekarang */}
        <div className="card">
          <h3>Kondisi sekarang</h3>
          <div className="kpis">
            <div className="k"><div className="l">Tanaman</div><div className="v" style={{ color: hv?.[1] }}>{hv ? hv[0] : 'Belum ada citra cerah'}</div><div className="l">{lastClear ? `citra ${fmt(day0(lastClear.scan_date))}` : 'musim hujan — tertutup awan'}</div></div>
            <div className="k"><div className="l">Air di sawah</div><div className="v" style={{ color: wet == null ? undefined : wet ? '#3fb6d3' : '#c9a46a' }}>{wet == null ? 'Belum ada data' : wet ? 'Tergenang' : 'Kering'}</div><div className="l">{wet === false ? `±${dryDays} hari kering` : lastSar ? `radar ${fmt(day0(lastSar.scan_date))}` : ''}</div></div>
            <div className="k"><div className="l">Fase</div><div className="v">{phase ? PHASE[phase] ?? phase : '–'}</div><div className="l">perkiraan dari satelit</div></div>
            <div className="k"><div className="l">Perkiraan panen</div><div className="v">{panen ? fmt(panen) : '–'}</div><div className="l">{panen ? `${Math.max(0, Math.round((+panen - +today) / DAY))} hari lagi` : 'isi tanggal tanam di bawah'}</div></div>
          </div>
        </div>

        {/* Peta */}
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Peta petak</h3>
            <div className="tabs"><button className={mapMode === 'foto' ? 'on' : ''} onClick={() => setMapMode('foto')}>Foto satelit</button><button className={mapMode === 'hijau' ? 'on' : ''} onClick={() => setMapMode('hijau')}>Kehijauan</button></div>
          </div>
          <div className="mapbox" style={{ height: 300 }}><DashMap plots={mapPlots} onPick={() => {}} /></div>
        </div>

        {/* Grafik */}
        <div className="card">
          <h3>Riwayat 3 bulan</h3>
          <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" style={{ display: 'block' }}>
            {[0, 0.5, 1].map((v) => <g key={v}><line x1={pl} x2={CW - 8} y1={yAt(v)} y2={yAt(v)} stroke="var(--line)" /><text x={2} y={yAt(v) + 4} fontSize="10" fill="var(--mut)">{nf(v, 1)}</text></g>)}
            <polyline points={pts.map((l) => `${xAt(day0(l.scan_date))},${yAt(l.ndvi_score as number)}`).join(' ')} fill="none" stroke="#8bc34a" strokeWidth={2.5} />
            {pts.map((l) => <circle key={l.scan_date} cx={xAt(day0(l.scan_date))} cy={yAt(l.ndvi_score as number)} r={4} fill="#8bc34a"><title>{`${fmt(day0(l.scan_date))} · kehijauan ${nf(l.ndvi_score as number, 2)}`}</title></circle>)}
            <text x={pl} y={CH - 34} fontSize="10" fill="var(--mut)">Air (radar)</text>
            {sarPts.map((l) => <rect key={'s' + l.scan_date} x={xAt(day0(l.scan_date)) - 5} y={CH - 28} width={10} height={12} rx={2} fill={(l.sar_flood_index as number) > WET ? '#3fb6d3' : '#c9a46a'}><title>{`${fmt(day0(l.scan_date))} · ${(l.sar_flood_index as number) > WET ? 'tergenang' : 'kering'}`}</title></rect>)}
            {[0, 30, 60, 90].map((dd) => { const d = new Date(+from + dd * DAY); return <text key={dd} x={xAt(d)} y={CH - 4} fontSize="10" fill="var(--mut)" textAnchor="middle">{d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</text> })}
          </svg>
          <div className="row note"><span><span className="dot" style={{ background: '#8bc34a' }} />Kehijauan (citra cerah)</span><span><span className="dot" style={{ background: '#3fb6d3' }} />Tergenang</span><span><span className="dot" style={{ background: '#c9a46a' }} />Kering</span></div>
          {pts.length === 0 && <div className="note">Belum ada citra cerah 3 bulan terakhir (tertutup awan). Status air tetap terpantau lewat radar.</div>}
        </div>

        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

        {/* Musim tanam */}
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}><h3 style={{ margin: 0 }}>Musim tanam & panen</h3>{!showMusim && <button className="btn" onClick={() => setShowMusim(true)}>+ Musim baru</button>}</div>
          {showMusim && (
            <form onSubmit={simpanMusim} className="form">
              <label style={label}>Tanggal tanam<input type="date" required value={mTgl} onChange={(e) => setMTgl(e.target.value)} style={input} /></label>
              <label style={label}>Varietas<input value={mVar} onChange={(e) => setMVar(e.target.value)} placeholder="mis. Cigeulis" style={input} /></label>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <label style={{ ...label, flex: 1 }}>Musim ke-<select value={mNo} onChange={(e) => setMNo(+e.target.value)} style={input}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
                <label style={{ ...label, flex: 1 }}>Tahun<input type="number" value={mThn} onChange={(e) => setMThn(+e.target.value)} style={input} /></label>
              </div>
              <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}><button type="button" className="ghost" onClick={() => setShowMusim(false)}>Batal</button><button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
            </form>
          )}
          {seasons.length === 0 && !showMusim && <div className="mut" style={{ marginTop: 10 }}>Belum ada data musim tanam. Tekan “+ Musim baru” untuk mengisi tanggal tanam.</div>}
          {seasons.map((s) => {
            const t = s.planting_date ? day0(s.planting_date) : null
            const ep = s.estimated_harvest_date ? day0(s.estimated_harvest_date) : t ? new Date(+t + umur(s.crop_variety) * DAY) : null
            const prod = s.actual_harvest_kg && plot.area > 0 ? s.actual_harvest_kg / 1000 / plot.area : null
            return (
              <div key={s.id} className="season">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <b>MT {s.season_number} · {s.season_year} <span className="tag">{s.status === 'aktif' ? 'sedang berjalan' : s.status === 'panen' ? 'sudah panen' : s.status}</span></b>
                  <span className="mut">Padi {s.crop_variety ?? '–'}</span>
                </div>
                <div className="pgrid">
                  <span>Tanam<b>{t ? fmt(t) : '–'}</b></span>
                  <span>{s.actual_harvest_date ? 'Panen' : 'Perkiraan panen'}<b>{s.actual_harvest_date ? fmt(day0(s.actual_harvest_date)) : ep ? fmt(ep) : '–'}</b></span>
                  <span>Hasil<b>{s.actual_harvest_kg ? `${nf(s.actual_harvest_kg, 0)} kg` : '–'}</b></span>
                  <span>Produktivitas<b>{prod != null ? `${nf(prod)} t/ha` : '–'}</b></span>
                </div>
                {s.status === 'aktif' && !s.actual_harvest_date && (panenId === s.id ? (
                  <form onSubmit={(e) => simpanPanen(e, s.id)} className="form">
                    <label style={label}>Tanggal panen<input type="date" required value={pTgl} onChange={(e) => setPTgl(e.target.value)} style={input} /></label>
                    <label style={label}>Hasil panen (kg GKP)<input inputMode="decimal" value={pKg} onChange={(e) => setPKg(e.target.value)} placeholder="mis. 2500" style={input} /></label>
                    <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}><button type="button" className="ghost" onClick={() => setPanenId(null)}>Batal</button><button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan panen'}</button></div>
                  </form>
                ) : <button className="ghost" style={{ marginTop: 10, width: '100%' }} onClick={() => { setPanenId(s.id); setPTgl(today.toISOString().slice(0, 10)) }}>🌾 Catat hasil panen</button>)}
              </div>
            )
          })}
        </div>

        {/* Foto & catatan */}
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}><h3 style={{ margin: 0 }}>Foto & catatan lapangan</h3>{!showFoto && <button className="btn" onClick={() => setShowFoto(true)}>📷 Tambah</button>}</div>
          {showFoto && (
            <form onSubmit={kirimFoto} className="form">
              <label style={label}>Foto<input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={input} /></label>
              <label style={label}>Catatan (boleh kosong)<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="mis. air irigasi kecil, ada hama wereng di pojok utara" style={input} /></label>
              <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}><button type="button" className="ghost" onClick={() => setShowFoto(false)}>Batal</button><button className="btn" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim'}</button></div>
            </form>
          )}
          {fields.length === 0 && !showFoto && <div className="mut" style={{ marginTop: 10 }}>Belum ada foto atau catatan.</div>}
          <div className="fotos">
            {fields.map((f) => (
              <div key={f.id} className="foto">
                {f.photo_path ? (urls[f.id] ? <a href={urls[f.id]} target="_blank" rel="noreferrer"><img src={urls[f.id]} alt="" /></a> : <div className="ph" />) : null}
                <div><b>{fmt(day0(f.log_date))}</b>{f.note && <span>{f.note}</span>}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const PS_CSS = `
.ssd .ps{max-width:760px;margin:0 auto;padding:16px;display:flex;flex-direction:column;gap:14px}
.ssd .ps .kpis .v{font-size:16px}
.ssd .season{background:var(--card2);border-radius:12px;padding:12px;margin-top:10px}
.ssd .form{background:var(--card2);border-radius:12px;padding:4px 12px 12px;margin-top:10px}
.ssd .fotos{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:12px}
.ssd .foto{background:var(--card2);border-radius:12px;overflow:hidden;font-size:12px}
.ssd .foto img,.ssd .foto .ph{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:var(--chip)}
.ssd .foto>div{padding:8px 10px}.ssd .foto b{display:block}.ssd .foto span{color:var(--mut)}
.ssd .ps .hamb{display:block}.ssd .hdr .hdr-act{display:none}
.ssd .hdr .hdr-act.open{display:flex;width:100%;flex-direction:column;align-items:stretch}
`
