/**
 * Audit ulang cloud_cover_percent baris satellite_logs yang SUDAH ADA,
 * pakai evalscript SCL-based yang benar (bukan dataMask lama yang salah).
 * Jalankan: node scripts/audit-cloud-cover.mjs <PLOT_ID>
 *
 * Konteks bug (08 Juli 2026): cloud_cover_percent lama dihitung dari
 * dataMask (cuma "ada data sensor", BUKAN deteksi awan) — scan 26 Mei
 * 2026 Budidaya BSO dilaporkan 0% awan padahal SCL-based recompute
 * menunjukkan 100% awan di area petak. NDVI/NDWI yang rusak akibat awan
 * salah lolos validasi, salah diklasifikasi "kosong" padahal padi ada.
 *
 * Script ini TIDAK mengubah ndvi_score/ndwi_score (nilai mentah historis
 * dipertahankan apa adanya) — cuma:
 * 1. Update cloud_cover_percent ke nilai SCL-based yang benar
 * 2. Kalau ternyata cloud_cover_percent baru > 15% (dulunya dianggap
 *    valid <=15%): set estimated_phase = null (tandai tidak bisa
 *    dipercaya untuk interpretasi fase, TANPA menghapus data mentah)
 *
 * Delay 3 detik antar baris, retry backoff 429/500.
 */

import { readFileSync } from 'fs'

function loadEnv() {
  try {
    const content = readFileSync('.env.local', 'utf-8')
    const env = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      env[key] = val
    }
    return env
  } catch {
    console.error('❌ Gagal membaca .env.local — jalankan dari root project')
    process.exit(1)
  }
}
const env = loadEnv()

const PLOT_ID      = process.argv[2] || 'fba25ed2-ab7d-467b-add7-488496c31dbf'
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const SENTINEL_ID  = env.SENTINEL_CLIENT_ID
const SENTINEL_SEC = env.SENTINEL_CLIENT_SECRET

for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SUPABASE_KEY, SENTINEL_CLIENT_ID: SENTINEL_ID, SENTINEL_CLIENT_SECRET: SENTINEL_SEC })) {
  if (!v) { console.error(`❌ Env var tidak ditemukan`); process.exit(1) }
}

let _token = null
async function getToken() {
  const now = Date.now()
  if (_token && now < _token.expiresAt - 60_000) return _token.value
  const res = await fetch('https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: SENTINEL_ID, client_secret: SENTINEL_SEC }),
  })
  if (!res.ok) throw Object.assign(new Error(`Auth ${res.status}`), { status: res.status })
  const d = await res.json()
  _token = { value: d.access_token, expiresAt: now + d.expires_in * 1000 }
  return _token.value
}

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase GET ${res.status}: ${await res.text()}`)
  return res.json()
}

async function sbPatch(id, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/satellite_logs?id=eq.${id}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Supabase PATCH ${res.status}: ${await res.text()}`)
}

const SCL_EVAL = `//VERSION=3
function setup(){return{input:[{bands:["B04","B08","SCL","dataMask"]}],output:[{id:"ndvi",bands:1,sampleType:"FLOAT32"},{id:"cloudMask",bands:1,sampleType:"UINT8"},{id:"dataMask",bands:1}]};}
function evaluatePixel(s){var isCloud=(s.SCL===3||s.SCL===8||s.SCL===9||s.SCL===10)?1:0;return{ndvi:[(s.B08-s.B04)/(s.B08+s.B04)],cloudMask:[isCloud],dataMask:[s.dataMask]};}`

// Rentang 1-hari-persis (from=to=tanggal sama) kadang dikembalikan KOSONG oleh
// Statistical API (ditemukan saat debugging 08 Juli 2026) — pakai window 2 hari
// supaya P1D punya cukup ruang bikin interval, lalu cari interval yang match.
async function fetchCloudForDate(geometry, date) {
  const token = await getToken()
  const to = new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0]
  const res = await fetch('https://sh.dataspace.copernicus.eu/api/v1/statistics', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { bounds: { geometry, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } }, data: [{ type: 'sentinel-2-l2a', dataFilter: { maxCloudCoverage: 100 } }] },
      aggregation: { timeRange: { from: `${date}T00:00:00Z`, to: `${to}T23:59:59Z` }, aggregationInterval: { of: 'P1D' }, evalscript: SCL_EVAL, resx: 10, resy: 10 },
      calculations: { default: {} },
    }),
  })
  if (!res.ok) throw Object.assign(new Error(`Stats API ${res.status}: ${(await res.text()).slice(0, 120)}`), { status: res.status })
  const data = await res.json()
  const interval = (data.data ?? []).find((d) => d.interval.from.split('T')[0] === date)
  const cloudMean = interval?.outputs?.cloudMask?.bands?.B0?.stats?.mean
  return cloudMean != null ? Math.round(cloudMean * 1000) / 10 : null
}

async function withRetry(fn) {
  const delays = [30_000, 60_000, 120_000]
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try { return await fn() } catch (err) {
      if ((err.status === 429 || err.status === 500) && attempt < delays.length) {
        console.log(`  ⏳ HTTP ${err.status}, retry ${attempt + 1}/${delays.length} dalam ${delays[attempt] / 1000}s...`)
        await new Promise((r) => setTimeout(r, delays[attempt]))
        continue
      }
      throw err
    }
  }
}

async function main() {
  console.log('═'.repeat(70))
  console.log('  Audit Cloud Cover (SCL-based) — koreksi histori satellite_logs')
  console.log(`  Plot: ${PLOT_ID}`)
  console.log('═'.repeat(70))
  console.log()

  const plotRows = await sbGet(`v_plots?id=eq.${PLOT_ID}&select=geo_data`)
  const geometry = plotRows[0]?.geo_data
  if (!geometry) { console.error('❌ Plot tidak ditemukan'); process.exit(1) }

  const rows = await sbGet(
    `satellite_logs?plot_id=eq.${PLOT_ID}&ndvi_score=not.is.null&select=id,scan_date,ndvi_score,ndwi_score,cloud_cover_percent,estimated_phase&order=scan_date.asc`
  )

  console.log(`Total baris dengan NDVI: ${rows.length}`)
  console.log(`Estimasi waktu: ~${Math.ceil(rows.length * 3 / 60)} menit (tanpa retry)`)
  console.log()

  let checked = 0, reclassified = 0, corrected = 0, unchanged = 0, noData = 0, failed = 0

  for (const [i, r] of rows.entries()) {
    try {
      const newCloud = await withRetry(() => fetchCloudForDate(geometry, r.scan_date))
      checked++

      if (newCloud === null) {
        console.log(`[${i + 1}/${rows.length}] ${r.scan_date} ⬜ tidak dapat data ulang dari Statistical API`)
        noData++
        await new Promise((res) => setTimeout(res, 3000))
        continue
      }

      const wasValid = r.cloud_cover_percent != null && r.cloud_cover_percent <= 15 && r.estimated_phase !== null
      const nowValid = newCloud <= 15

      if (wasValid && !nowValid) {
        // MISCLASSIFIED — sebelumnya lolos validasi (cloud lama rendah), ternyata cloud asli tinggi
        await sbPatch(r.id, { cloud_cover_percent: newCloud, estimated_phase: null })
        console.log(`[${i + 1}/${rows.length}] ${r.scan_date} 🔴 RECLASSIFIED — cloud lama=${r.cloud_cover_percent}% → baru=${newCloud}% | fase lama="${r.estimated_phase}" → null (NDVI=${r.ndvi_score}, NDWI=${r.ndwi_score} tetap disimpan)`)
        reclassified++
      } else if (r.cloud_cover_percent !== newCloud) {
        // Angka berubah tapi kesimpulan validitas sama — cuma koreksi kosmetik
        await sbPatch(r.id, { cloud_cover_percent: newCloud })
        console.log(`[${i + 1}/${rows.length}] ${r.scan_date} ✓ cloud dikoreksi ${r.cloud_cover_percent ?? '—'}% → ${newCloud}% (fase tidak berubah: "${r.estimated_phase}")`)
        corrected++
      } else {
        console.log(`[${i + 1}/${rows.length}] ${r.scan_date} ✓ tidak berubah (${newCloud}%)`)
        unchanged++
      }
    } catch (err) {
      console.log(`[${i + 1}/${rows.length}] ${r.scan_date} ✗ ${String(err.message).slice(0, 100)}`)
      failed++
    }
    await new Promise((res) => setTimeout(res, 3000))
  }

  console.log()
  console.log('═'.repeat(70))
  console.log(`  Selesai — ${checked}/${rows.length} baris dicek`)
  console.log('═'.repeat(70))
  console.log(`  🔴 Direklasifikasi (fase lama salah, sekarang null) : ${reclassified}`)
  console.log(`  ✓  Cloud dikoreksi (validitas tidak berubah)        : ${corrected}`)
  console.log(`  ✓  Tidak berubah                                    : ${unchanged}`)
  console.log(`  ⬜ Tidak dapat data ulang                           : ${noData}`)
  console.log(`  ✗  Gagal                                            : ${failed}`)
  console.log('═'.repeat(70))
}

main().catch((err) => { console.error('❌ Fatal:', err); process.exit(1) })
