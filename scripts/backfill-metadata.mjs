/**
 * Backfill metadata verifikasi (ID produk resmi + timestamp presisi) dari
 * Sentinel Hub Catalog API ke baris satellite_logs yang SUDAH ADA (historis).
 * Jalankan: node scripts/backfill-metadata.mjs <PLOT_ID>
 *
 * Beda dari backfill-satellite.mjs/backfill-sar.mjs: script ini TIDAK
 * menghitung ulang NDVI/NDWI/SAR (nilai lama tidak disentuh) — cuma
 * melengkapi ndvi_product_id/ndvi_acquisition_datetime/ndvi_platform dan
 * sar_product_id/sar_acquisition_datetime/sar_platform lewat Catalog API
 * (STAC), untuk baris yang scan_date-nya sudah punya ndvi_score atau
 * sar_flood_index tapi belum punya metadata verifikasi.
 *
 * Features:
 * - Resume: hanya proses baris yang product_id-nya masih NULL
 * - Retry dengan backoff bertahap kalau kena 429/500
 * - Delay 3 detik antar baris
 */

import { readFileSync } from 'fs'

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

let _token = null
async function getToken() {
  const now = Date.now()
  if (_token && now < _token.expiresAt - 60_000) return _token.value
  const res = await fetch('https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: SENTINEL_ID, client_secret: SENTINEL_SEC }),
  })
  if (!res.ok) throw Object.assign(new Error(`Sentinel Auth ${res.status}: ${await res.text()}`), { status: res.status })
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
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Supabase PATCH ${res.status}: ${await res.text()}`)
}

async function fetchCatalogProduct(geometry, date, collection) {
  const token = await getToken()
  const res = await fetch('https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      collections: [collection],
      datetime: `${date}T00:00:00Z/${date}T23:59:59Z`,
      intersects: geometry,
      limit: 5,
    }),
  })
  if (!res.ok) throw Object.assign(new Error(`Catalog API ${res.status}: ${(await res.text()).slice(0, 150)}`), { status: res.status })
  const data = await res.json()
  const feature = (data.features ?? [])[0]
  if (!feature) return null
  return { id: feature.id, datetime: feature.properties.datetime, platform: feature.properties.platform }
}

async function withRetry(fn, label) {
  const delays = [30_000, 60_000, 120_000]
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status = err.status
      if ((status === 429 || status === 500) && attempt < delays.length) {
        const wait = delays[attempt]
        console.log(`  ⏳ ${label}: HTTP ${status}, retry ${attempt + 1}/${delays.length} dalam ${wait / 1000}s...`)
        await new Promise((r) => setTimeout(r, wait))
        continue
      }
      throw err
    }
  }
}

async function main() {
  console.log('═'.repeat(60))
  console.log('  Backfill Metadata Verifikasi (Catalog API)')
  console.log(`  Plot: ${PLOT_ID}`)
  console.log('═'.repeat(60))
  console.log()

  const plotRows = await sbGet(`v_plots?id=eq.${PLOT_ID}&select=geo_data`)
  const geometry = plotRows[0]?.geo_data
  if (!geometry) { console.error('❌ Plot tidak ditemukan atau geo_data kosong'); process.exit(1) }
  console.log('Mengambil polygon plot... ✓')

  const rows = await sbGet(
    `satellite_logs?plot_id=eq.${PLOT_ID}&select=id,scan_date,ndvi_score,sar_flood_index,ndvi_product_id,sar_product_id&order=scan_date.asc`
  )

  const ndviTodo = rows.filter((r) => r.ndvi_score !== null && r.ndvi_product_id === null)
  const sarTodo = rows.filter((r) => r.sar_flood_index !== null && r.sar_product_id === null)
  const total = ndviTodo.length + sarTodo.length

  console.log(`Total baris satellite_logs : ${rows.length}`)
  console.log(`Perlu metadata NDVI (S2)   : ${ndviTodo.length}`)
  console.log(`Perlu metadata SAR (S1)    : ${sarTodo.length}`)
  console.log(`Total panggilan Catalog API: ${total}`)
  console.log(`Estimasi waktu             : ~${Math.ceil(total * 3 / 60)} menit (tanpa retry)`)
  console.log()

  let ok = 0, noProduct = 0, failed = 0, i = 0

  for (const r of ndviTodo) {
    i++
    try {
      const product = await withRetry(() => fetchCatalogProduct(geometry, r.scan_date, 'sentinel-2-l2a'), r.scan_date)
      if (product) {
        await sbPatch(r.id, {
          ndvi_product_id: product.id,
          ndvi_acquisition_datetime: product.datetime,
          ndvi_platform: product.platform,
        })
        console.log(`[${i}/${total}] NDVI ${r.scan_date} ✓ ${product.id.slice(0, 40)}... (${product.platform})`)
        ok++
      } else {
        console.log(`[${i}/${total}] NDVI ${r.scan_date} ⬜ tidak ada produk ditemukan di Catalog`)
        noProduct++
      }
    } catch (err) {
      console.log(`[${i}/${total}] NDVI ${r.scan_date} ✗ ${String(err.message).slice(0, 100)}`)
      failed++
    }
    await new Promise((res) => setTimeout(res, 3000))
  }

  for (const r of sarTodo) {
    i++
    try {
      const product = await withRetry(() => fetchCatalogProduct(geometry, r.scan_date, 'sentinel-1-grd'), r.scan_date)
      if (product) {
        await sbPatch(r.id, {
          sar_product_id: product.id,
          sar_acquisition_datetime: product.datetime,
          sar_platform: product.platform,
        })
        console.log(`[${i}/${total}] SAR  ${r.scan_date} ✓ ${product.id.slice(0, 40)}... (${product.platform})`)
        ok++
      } else {
        console.log(`[${i}/${total}] SAR  ${r.scan_date} ⬜ tidak ada produk ditemukan di Catalog`)
        noProduct++
      }
    } catch (err) {
      console.log(`[${i}/${total}] SAR  ${r.scan_date} ✗ ${String(err.message).slice(0, 100)}`)
      failed++
    }
    await new Promise((res) => setTimeout(res, 3000))
  }

  console.log()
  console.log('═'.repeat(60))
  console.log(`  Selesai — ${total}/${total} baris diproses`)
  console.log('═'.repeat(60))
  console.log(`  ✓  Metadata tersimpan : ${ok}`)
  console.log(`  ⬜ Tidak ada produk   : ${noProduct}`)
  console.log(`  ✗  Gagal              : ${failed}`)
  console.log('═'.repeat(60))
}

main().catch((err) => { console.error('❌ Fatal:', err); process.exit(1) })
