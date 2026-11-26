/**
 * Backfill 2 tahun data Sentinel-1 SAR (VV, VH, orbit) ke satellite_logs
 * Jalankan: node scripts/backfill-sar.mjs
 *
 * Features:
 * - Interval 6 hari (Sentinel-1C+1D revisit nominal sejak Juli 2026)
 * - Dua orbit per interval: ASCENDING + DESCENDING, merge per tanggal
 * - Resume: skip interval yang sudah ada minimal 1 baris sar_vv IS NOT NULL di DB
 * - Retry dengan backoff bertahap kalau kena 429
 * - Early stop kalau rate limit 3x berturut-turut
 * - Delay 8 detik antar interval (2 API calls per interval → lebih lambat dari NDVI)
 */

import { readFileSync } from 'fs'

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const content = readFileSync('.env.local', 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      process.env[key] = val
    }
  } catch {
    console.error('❌ Gagal membaca .env.local — jalankan dari root project')
    process.exit(1)
  }
}
loadEnv()

const PLOT_ID      = process.argv[2] || 'fba25ed2-ab7d-467b-add7-488496c31dbf'  // default: Wayan Suparta
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SENTINEL_ID  = process.env.SENTINEL_CLIENT_ID
const SENTINEL_SEC = process.env.SENTINEL_CLIENT_SECRET

for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SUPABASE_KEY, SENTINEL_CLIENT_ID: SENTINEL_ID, SENTINEL_CLIENT_SECRET: SENTINEL_SEC })) {
  if (!v) { console.error(`❌ Env var ${k} tidak ditemukan`); process.exit(1) }
}

// ── Sentinel Hub OAuth ───────────────────────────────────────────────────────
let _token = null

async function getToken() {
  const now = Date.now()
  if (_token && now < _token.expiresAt - 60_000) return _token.value
  const res = await fetch(
    'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: SENTINEL_ID, client_secret: SENTINEL_SEC }),
    }
  )
  if (!res.ok) throw Object.assign(new Error(`Sentinel Auth ${res.status}: ${await res.text()}`), { status: res.status })
  const d = await res.json()
  _token = { value: d.access_token, expiresAt: now + d.expires_in * 1000 }
  return _token.value
}

// ── Evalscript ───────────────────────────────────────────────────────────────
const SAR_EVAL = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VV", "VH", "dataMask"], units: "LINEAR_POWER" }],
    output: [
      { id: "VV",        bands: 1, sampleType: "FLOAT32" },
      { id: "VH",        bands: 1, sampleType: "FLOAT32" },
      { id: "flood_idx", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask",  bands: 1, sampleType: "UINT8"   }
    ]
  };
}
function evaluatePixel(sample) {
  const ratio = (sample.VV > 0) ? (sample.VH / sample.VV) : 0;
  return { VV: [sample.VV], VH: [sample.VH], flood_idx: [ratio], dataMask: [sample.dataMask] };
}`

// ── Fetch satu orbit direction ───────────────────────────────────────────────
async function fetchOrbit(geometry, orbitDirection, from, to) {
  const token = await getToken()
  const res = await fetch('https://sh.dataspace.copernicus.eu/api/v1/statistics', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: {
        bounds: { geometry },
        data: [{ type: 'sentinel-1-grd', dataFilter: { acquisitionMode: 'IW', polarization: 'DV', resolution: 'HIGH', orbitDirection } }],
      },
      aggregation: {
        // Batas akhir = tengah malam hari berikutnya (eksklusif); T23:59:59Z
        // membuat hari terakhir dibuang Statistical API (lihat statsTimeRange
        // di lib/sentinel-hub/formulas.ts)
        timeRange: { from: `${from}T00:00:00Z`, to: `${nextDay(to)}T00:00:00Z` },
        aggregationInterval: { of: 'P1D' },
        evalscript: SAR_EVAL,
      },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw Object.assign(new Error(`SAR API ${res.status} (${orbitDirection}): ${text.slice(0, 120)}`), { status: res.status })
  }
  const out = new Map()
  for (const interval of (await res.json()).data ?? []) {
    const vv = interval.outputs?.VV?.bands?.B0?.stats?.mean
    const vh = interval.outputs?.VH?.bands?.B0?.stats?.mean
    if (vv == null || vh == null) continue
    const fi = interval.outputs?.flood_idx?.bands?.B0?.stats?.mean ?? (vv > 0 ? vh / vv : 0)
    const date = interval.interval?.from?.split('T')[0]
    if (date) out.set(date, { vv, vh, flood_index: fi })
  }
  return out
}

// ── Fetch + merge dua orbit, dengan retry backoff ────────────────────────────
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000]

async function fetchSarWithRetry(geometry, from, to) {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const [ascMap, descMap] = await Promise.all([
        fetchOrbit(geometry, 'ASCENDING', from, to),
        fetchOrbit(geometry, 'DESCENDING', from, to),
      ])

      const allDates = new Set([...ascMap.keys(), ...descMap.keys()])
      const results = []
      for (const date of [...allDates].sort()) {
        const a = ascMap.get(date)
        const d = descMap.get(date)
        if (a && d) {
          results.push({ date, vv: (a.vv + d.vv) / 2, vh: (a.vh + d.vh) / 2, flood_index: (a.flood_index + d.flood_index) / 2, orbit: 'BOTH' })
        } else if (a) {
          results.push({ date, ...a, orbit: 'ASCENDING' })
        } else {
          results.push({ date, ...d, orbit: 'DESCENDING' })
        }
      }
      return results
    } catch (err) {
      const is429 = err.status === 429
      if (is429 && attempt < RETRY_DELAYS_MS.length) {
        const waitSec = RETRY_DELAYS_MS[attempt] / 1000
        process.stdout.write(`\n     ⏳ 429 rate limit — tunggu ${waitSec}s (retry ${attempt + 1}/${RETRY_DELAYS_MS.length})... `)
        await sleep(RETRY_DELAYS_MS[attempt])
        continue
      }
      throw err
    }
  }
}

// ── Supabase REST ────────────────────────────────────────────────────────────
const SB_HDR = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SB_HDR })
  if (!res.ok) throw new Error(`Supabase GET ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function sbUpsert(table, row, onConflict) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: { ...SB_HDR, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`Supabase upsert ${table}: ${res.status} ${await res.text()}`)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function dateStr(d) { return d.toISOString().split('T')[0] }
function nextDay(s) { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return dateStr(d) }
function round4(v) { return Math.round(v * 10000) / 10000 }

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('══════════════════════════════════════════════════════')
  console.log('  Backfill SAR Sentinel-1 — Plot Wayan Suparta (2 tahun)')
  console.log('  Interval: 6 hari | 2 orbit per interval | Delay: 8 detik')
  console.log('══════════════════════════════════════════════════════\n')

  // 1. Ambil polygon plot
  process.stdout.write('Mengambil polygon plot... ')
  const plotRows = await sbGet(`v_plots?id=eq.${PLOT_ID}&select=geo_data`)
  if (!plotRows.length || !plotRows[0].geo_data) {
    console.error('\n❌ Plot tidak ditemukan')
    process.exit(1)
  }
  const geometry = plotRows[0].geo_data
  console.log(`✓ (${geometry.type}, ${geometry.coordinates[0].length} titik)`)

  // 2. Ambil semua scan_date yang sudah punya SAR data (untuk resume)
  process.stdout.write('Mengambil SAR existing dari satellite_logs... ')
  const existing = await sbGet(
    `satellite_logs?plot_id=eq.${PLOT_ID}&sar_vv=not.is.null&select=scan_date&order=scan_date.asc`
  )
  const existingSarDates = new Set(existing.map(r => r.scan_date))
  console.log(`✓ ${existingSarDates.size} tanggal sudah punya data SAR`)

  // 3. Generate interval 6-hari dari 2 tahun lalu sampai hari ini
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = new Date(today.getTime() - 730 * 86400000)
  const intervals = []
  let cur = new Date(start)
  while (cur < today) {
    const next = new Date(cur.getTime() + 6 * 86400000)
    const to = next > today ? today : next
    intervals.push({ from: dateStr(cur), to: dateStr(to) })
    cur = next
  }

  // 4. Filter: skip interval yang sudah punya SAR data di DB
  const pending = intervals.filter(({ from, to }) => {
    for (const d of existingSarDates) if (d >= from && d <= to) return false
    return true
  })

  const skipped = intervals.length - pending.length
  console.log(`\nTotal interval (6 hari) : ${intervals.length}`)
  console.log(`Sudah ada SAR di DB     : ${skipped} (di-skip)`)
  console.log(`Perlu diproses          : ${pending.length}`)
  if (pending.length > 0) {
    console.log(`Mulai dari              : ${pending[0].from}`)
    console.log(`Estimasi waktu          : ~${Math.ceil(pending.length * 8 / 60)} menit (tanpa retry)`)
  }
  console.log()

  if (pending.length === 0) {
    console.log('✓ Semua interval sudah punya SAR data — tidak ada yang perlu diproses.')
    return
  }

  let passTotal = 0, noData = 0, failed = 0
  let consecutiveFails429 = 0
  const MAX_CONSECUTIVE_429 = 3

  for (let i = 0; i < pending.length; i++) {
    const { from, to } = pending[i]
    const label = `[${String(i + 1).padStart(3)}/${pending.length}] ${from} → ${to}`
    process.stdout.write(`${label}  `)

    try {
      const results = await fetchSarWithRetry(geometry, from, to)

      if (results.length === 0) {
        console.log('⬜ tidak ada pass SAR')
        noData++
        consecutiveFails429 = 0
        continue
      }

      for (const r of results) {
        await sbUpsert('satellite_logs', {
          plot_id:             PLOT_ID,
          scan_date:           r.date,
          sar_vv:              round4(r.vv),
          sar_vh:              round4(r.vh),
          sar_flood_index:     round4(r.flood_index),
          sar_orbit_direction: r.orbit,
          sar_source:          'sentinel-1',
        }, 'plot_id,scan_date')
      }

      const summary = results.map(r => `${r.date}(${r.orbit[0]})`).join(' ')
      console.log(`✓  ${results.length} pass: ${summary}`)
      passTotal += results.length
      consecutiveFails429 = 0

    } catch (err) {
      const is429 = err.status === 429 || err.message.includes('429')
      if (is429) {
        consecutiveFails429++
        console.log(`✗  rate limit 429 (semua retry habis) — ${consecutiveFails429}/${MAX_CONSECUTIVE_429} berturut-turut`)
        if (consecutiveFails429 >= MAX_CONSECUTIVE_429) {
          console.log('\n🛑  Rate limit 3x berturut-turut — berhenti lebih awal.')
          console.log(`    Lanjutkan dari interval: ${from}`)
          failed += pending.length - i
          break
        }
      } else {
        consecutiveFails429 = 0
        console.log(`✗  ${err.message.slice(0, 80)}`)
      }
      failed++
    }

    if (i < pending.length - 1) await sleep(8_000)
  }

  const processed = passTotal > 0 || noData > 0 ? pending.length - failed : 0
  console.log('\n══════════════════════════════════════════════════════')
  console.log(`  Selesai — ${processed}/${pending.length} interval diproses (${skipped} di-skip)`)
  console.log('══════════════════════════════════════════════════════')
  console.log(`  ✓  SAR pass tersimpan  : ${passTotal}`)
  console.log(`  ⬜ Tidak ada pass SAR  : ${noData}`)
  console.log(`  ✗  Gagal/skip          : ${failed}`)
  console.log('══════════════════════════════════════════════════════')
  if (failed > 0) {
    console.log('\n  Jalankan ulang script untuk melanjutkan dari titik yang tersisa.')
    console.log('  Interval yang sudah berhasil TIDAK akan diproses ulang (resume otomatis).')
  }
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message)
  process.exit(1)
})
