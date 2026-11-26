/**
 * Backfill 2 tahun data NDVI+NDWI ke satellite_logs
 * Jalankan: node scripts/backfill-satellite.mjs
 *
 * Features:
 * - Resume: skip interval yang scan_date-nya sudah ada di DB
 * - Retry dengan backoff bertahap kalau kena 429
 * - Early stop kalau rate limit 3x berturut-turut (setelah semua retry habis)
 * - Delay 6 detik antar interval
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

const PLOT_ID      = process.argv[2] || 'fba25ed2-ab7d-467b-add7-488496c31dbf'
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

// ── Evalscripts ──────────────────────────────────────────────────────────────
// cloud_cover_percent dari band SCL (deteksi awan/bayangan/cirrus SUNGGUHAN),
// bukan dataMask (cuma "ada data sensor", bukan deteksi awan) — bug ditemukan
// 08 Juli 2026 (lihat lib/sentinel-hub/ndvi.ts untuk detail).
const NDVI_EVAL = `//VERSION=3
function setup(){return{input:[{bands:["B04","B08","SCL","dataMask"]}],output:[{id:"ndvi",bands:1,sampleType:"FLOAT32"},{id:"cloudMask",bands:1,sampleType:"UINT8"},{id:"dataMask",bands:1}]};}
function evaluatePixel(s){var isCloud=(s.SCL===3||s.SCL===8||s.SCL===9||s.SCL===10)?1:0;return{ndvi:[(s.B08-s.B04)/(s.B08+s.B04)],cloudMask:[isCloud],dataMask:[s.dataMask]};}`

const NDWI_EVAL = `//VERSION=3
function setup(){return{input:[{bands:["B03","B08","dataMask"]}],output:[{id:"ndwi",bands:1,sampleType:"FLOAT32"},{id:"dataMask",bands:1}]};}
function evaluatePixel(s){return{ndwi:[(s.B03-s.B08)/(s.B03+s.B08)],dataMask:[s.dataMask]};}`

// ── Sentinel Stats API (satu call, lempar error dengan .status) ──────────────
async function fetchStats(geometry, evalscript, fromDate, toDate) {
  const token = await getToken()
  const res = await fetch('https://sh.dataspace.copernicus.eu/api/v1/statistics', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: {
        bounds: { geometry, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } },
        data: [{ type: 'sentinel-2-l2a', dataFilter: { maxCloudCoverage: 100 } }],
      },
      aggregation: {
        // Batas akhir = tengah malam hari berikutnya (eksklusif); T23:59:59Z
        // membuat hari terakhir dibuang Statistical API (lihat statsTimeRange
        // di lib/sentinel-hub/formulas.ts)
        timeRange: { from: `${fromDate}T00:00:00Z`, to: `${nextDay(toDate)}T00:00:00Z` },
        aggregationInterval: { of: 'P1D' },
        evalscript,
        resx: 10,
        resy: 10,
      },
      calculations: { default: {} },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw Object.assign(new Error(`Stats API ${res.status}: ${text.slice(0, 120)}`), { status: res.status })
  }
  return (await res.json()).data ?? []
}

// ── Fetch NDVI+NDWI dengan retry backoff ─────────────────────────────────────
// Retry delays: 30s → 60s → 120s. Setelah 3 retry tetap 429 → lempar error.
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000]

async function fetchBothWithRetry(geometry, from, to) {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const [ndviData, ndwiData] = await Promise.all([
        fetchStats(geometry, NDVI_EVAL, from, to),
        fetchStats(geometry, NDWI_EVAL, from, to),
      ])
      return { ndviData, ndwiData }
    } catch (err) {
      const is429 = err.status === 429
      if (is429 && attempt < RETRY_DELAYS_MS.length) {
        const waitSec = RETRY_DELAYS_MS[attempt] / 1000
        process.stdout.write(`\n     ⏳ 429 rate limit — tunggu ${waitSec}s (retry ${attempt + 1}/${RETRY_DELAYS_MS.length})... `)
        await sleep(RETRY_DELAYS_MS[attempt])
        continue
      }
      throw err // bukan 429, atau sudah habis retry
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
function estimatePhase(v, ndwi) {
  if (v < 0.1) return 'kosong'
  if (v < 0.3) return 'semai'
  if (v < 0.5) return (ndwi !== null && ndwi < -0.35) ? 'pematangan' : 'vegetatif'
  if (v < 0.7) return (ndwi !== null && ndwi < -0.3)  ? 'pematangan' : 'generatif'
  return 'pematangan'
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function dateStr(d) { return d.toISOString().split('T')[0] }
function nextDay(s) { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return dateStr(d) }
function round4(v) { return Math.round(v * 10000) / 10000 }

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('══════════════════════════════════════════════════════')
  console.log('  Backfill Satelit — Plot Wayan Suparta (2 tahun)')
  console.log('  Delay: 6 detik | Retry 429: 30s → 60s → 120s')
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

  // 2. Ambil semua scan_date yang sudah ada di DB (untuk resume)
  process.stdout.write('Mengambil data existing dari satellite_logs... ')
  const existing = await sbGet(`satellite_logs?plot_id=eq.${PLOT_ID}&select=scan_date&order=scan_date.asc`)
  const existingDates = new Set(existing.map(r => r.scan_date))
  console.log(`✓ ${existingDates.size} tanggal sudah ada di DB`)

  // 3. Generate interval 15-hari dari 2 tahun lalu sampai hari ini
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = new Date(today.getTime() - 730 * 86400000)
  const intervals = []
  let cur = new Date(start)
  while (cur < today) {
    const next = new Date(cur.getTime() + 15 * 86400000)
    const to = next > today ? today : next
    intervals.push({ from: dateStr(cur), to: dateStr(to) })
    cur = next
  }

  // 4. Filter: skip interval yang scan_date-nya sudah ada
  const pending = intervals.filter(({ from, to }) => {
    for (const d of existingDates) if (d >= from && d <= to) return false
    return true
  })

  const skipped = intervals.length - pending.length
  console.log(`\nTotal interval  : ${intervals.length}`)
  console.log(`Sudah ada di DB : ${skipped} (di-skip)`)
  console.log(`Perlu diproses  : ${pending.length}`)
  if (pending.length > 0) {
    console.log(`Mulai dari      : ${pending[0].from}`)
    console.log(`Estimasi waktu  : ~${Math.ceil(pending.length * 6 / 60)} menit (tanpa retry)`)
  }
  console.log()

  if (pending.length === 0) {
    console.log('✓ Semua interval sudah ada di DB — tidak ada yang perlu diproses.')
    return
  }

  let ok = 0, cloudy = 0, noData = 0, failed = 0
  let consecutiveFails429 = 0
  const MAX_CONSECUTIVE_429 = 3

  for (let i = 0; i < pending.length; i++) {
    const { from, to } = pending[i]
    const label = `[${String(i + 1).padStart(2)}/${pending.length}] ${from} → ${to}`
    process.stdout.write(`${label}  `)

    try {
      const { ndviData, ndwiData } = await fetchBothWithRetry(geometry, from, to)

      // Pilih interval terakhir dengan data NDVI valid
      const validNdvi = ndviData.filter(d => d.outputs?.ndvi?.bands?.B0?.stats?.mean != null).at(-1)
      if (!validNdvi) {
        console.log('⬜ tidak ada data citra')
        noData++
        consecutiveFails429 = 0
        continue
      }

      const scanDate  = validNdvi.interval.from.split('T')[0]
      const ndviMean  = validNdvi.outputs.ndvi.bands.B0.stats.mean
      const cloudMaskMean = validNdvi.outputs.cloudMask?.bands?.B0?.stats?.mean ?? 0
      const cloudPct  = Math.round(cloudMaskMean * 1000) / 10
      const matchNdwi = ndwiData.find(d => d.interval.from.split('T')[0] === scanDate)
      const ndwiMean  = matchNdwi?.outputs?.ndwi?.bands?.B0?.stats?.mean ?? null
      const phase     = cloudPct <= 15 ? estimatePhase(ndviMean, ndwiMean) : null

      await sbUpsert('satellite_logs', {
        plot_id: PLOT_ID,
        scan_date: scanDate,
        ndvi_score: round4(ndviMean),
        ndwi_score: ndwiMean !== null ? round4(ndwiMean) : null,
        cloud_cover_percent: cloudPct,
        estimated_phase: phase,
      }, 'plot_id,scan_date')

      if (cloudPct > 15) {
        console.log(`☁  cloud=${cloudPct}% NDVI=${ndviMean.toFixed(3)} — ${scanDate}`)
        cloudy++
      } else {
        console.log(`✓  NDVI=${ndviMean.toFixed(3)} NDWI=${(ndwiMean ?? 0).toFixed(3)} cloud=${cloudPct}% [${phase}] — ${scanDate}`)
        ok++
      }
      consecutiveFails429 = 0

    } catch (err) {
      const is429 = err.status === 429 || err.message.includes('429')
      if (is429) {
        consecutiveFails429++
        console.log(`✗  rate limit 429 (semua retry habis) — ${consecutiveFails429}/${MAX_CONSECUTIVE_429} berturut-turut`)
        if (consecutiveFails429 >= MAX_CONSECUTIVE_429) {
          console.log('\n🛑  Rate limit 3x berturut-turut setelah retry — berhenti lebih awal.')
          console.log('    Coba lagi nanti (disarankan: tunggu 30-60 menit atau besok).')
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

    if (i < pending.length - 1) await sleep(6_000)
  }

  const total = ok + cloudy + noData + failed
  console.log('\n══════════════════════════════════════════════════════')
  console.log(`  Selesai — ${total}/${pending.length} interval diproses (${skipped} di-skip/sudah ada)`)
  console.log('══════════════════════════════════════════════════════')
  console.log(`  ✓  Berhasil (cloud ≤15%)   : ${ok}`)
  console.log(`  ☁  Cloudy (>15%, tersimpan) : ${cloudy}`)
  console.log(`  ⬜ Tidak ada data citra     : ${noData}`)
  console.log(`  ✗  Gagal/skip              : ${failed}`)
  console.log('══════════════════════════════════════════════════════')
  if (failed > 0) {
    console.log('\n  Jalankan ulang script untuk melanjutkan dari titik yang tersisa.')
    console.log('  Data yang sudah berhasil TIDAK akan diproses ulang (resume otomatis).')
  }
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message)
  process.exit(1)
})
