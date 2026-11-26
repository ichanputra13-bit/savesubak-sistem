/**
 * Tes validasi Sentinel-1 GRD — query VV/VH dua orbit + upsert ke DB
 *
 * Jalankan: node --env-file=.env.local scripts/test-sentinel1.mjs
 *
 * Logika:
 *  1. Request ASCENDING pass → kumpulkan tanggal & nilai
 *  2. Request DESCENDING pass → kumpulkan tanggal & nilai
 *  3. Merge per tanggal:
 *     - Hanya ascending   → orbit_direction = 'ASCENDING'
 *     - Hanya descending  → orbit_direction = 'DESCENDING'
 *     - Keduanya ada      → average VV/VH, orbit_direction = 'BOTH'
 *  4. Upsert ke satellite_logs plot Wayan Suparta (ID fix dari DB)
 *  5. Baca balik hasil dari DB untuk konfirmasi kolom tersimpan
 */

import { createClient } from '@supabase/supabase-js'

const PLOT_ID = 'fba25ed2-ab7d-467b-add7-488496c31dbf'  // wayan suparta

// Bounding box ~200m sekitar pusat petak Sangeh
const CENTER_LON = 115.211131
const CENTER_LAT = -8.487345
const OFFSET     = 0.0009

const POLYGON = {
  type: 'Polygon',
  coordinates: [[
    [CENTER_LON - OFFSET, CENTER_LAT - OFFSET],
    [CENTER_LON + OFFSET, CENTER_LAT - OFFSET],
    [CENTER_LON + OFFSET, CENTER_LAT + OFFSET],
    [CENTER_LON - OFFSET, CENTER_LAT + OFFSET],
    [CENTER_LON - OFFSET, CENTER_LAT - OFFSET],
  ]]
}

// Window 12 hari — cukup untuk dapat 2 pass tiap orbit
const today   = new Date()
const from    = new Date(today); from.setDate(from.getDate() - 12)
const fromStr = from.toISOString().split('T')[0]
const toStr   = today.toISOString().split('T')[0]

const EVALSCRIPT = `//VERSION=3
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
  return {
    VV:        [sample.VV],
    VH:        [sample.VH],
    flood_idx: [ratio],
    dataMask:  [sample.dataMask]
  };
}`

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function getToken() {
  const res = await fetch(
    'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     process.env.SENTINEL_CLIENT_ID,
        client_secret: process.env.SENTINEL_CLIENT_SECRET,
      })
    }
  )
  if (!res.ok) throw new Error(`Auth gagal: ${res.status} ${await res.text()}`)
  const j = await res.json()
  console.log(`✓ Token dapat (expires_in: ${j.expires_in}s)`)
  return j.access_token
}

// ─── Request 1 orbit direction ────────────────────────────────────────────────
async function fetchOrbit(token, orbitDirection) {
  const body = {
    input: {
      bounds: { geometry: POLYGON },
      data: [{
        type: 'sentinel-1-grd',
        dataFilter: {
          acquisitionMode: 'IW',
          polarization:    'DV',
          resolution:      'HIGH',
          orbitDirection:  orbitDirection   // 'ASCENDING' | 'DESCENDING'
        }
      }]
    },
    aggregation: {
      timeRange: {
        from: `${fromStr}T00:00:00Z`,
        to:   `${toStr}T23:59:59Z`
      },
      aggregationInterval: { of: 'P1D' },
      evalscript: EVALSCRIPT
    }
  }

  const res = await fetch(
    'https://sh.dataspace.copernicus.eu/api/v1/statistics',
    {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    }
  )
  const text = await res.text()
  if (!res.ok) throw new Error(`API error ${res.status} (${orbitDirection}): ${text}`)
  return JSON.parse(text)
}

// ─── Parse interval → map tanggal → { vv, vh, ratio } ────────────────────────
function parseIntervals(apiData) {
  const result = new Map()
  for (const interval of (apiData?.data ?? [])) {
    const vv  = interval.outputs?.VV?.bands?.B0?.stats?.mean
    const vh  = interval.outputs?.VH?.bands?.B0?.stats?.mean
    const rat = interval.outputs?.flood_idx?.bands?.B0?.stats?.mean
    if (vv == null || vh == null) continue  // skip noData
    const date = interval.interval?.from?.split('T')[0]
    if (date) result.set(date, { vv, vh, ratio: rat ?? (vv > 0 ? vh / vv : 0) })
  }
  return result
}

// ─── Merge ascending + descending per tanggal ─────────────────────────────────
function mergeOrbits(ascMap, descMap) {
  const merged = new Map()
  const allDates = new Set([...ascMap.keys(), ...descMap.keys()])
  for (const date of allDates) {
    const a = ascMap.get(date)
    const d = descMap.get(date)
    if (a && d) {
      // Keduanya ada pada hari yang sama — average
      merged.set(date, {
        vv:    (a.vv + d.vv) / 2,
        vh:    (a.vh + d.vh) / 2,
        ratio: ((a.ratio + d.ratio) / 2),
        orbit: 'BOTH'
      })
    } else if (a) {
      merged.set(date, { ...a, orbit: 'ASCENDING' })
    } else {
      merged.set(date, { ...d, orbit: 'DESCENDING' })
    }
  }
  return merged   // Map<date, { vv, vh, ratio, orbit }>
}

// ─── Upsert ke DB ─────────────────────────────────────────────────────────────
async function upsertToDB(supabase, mergedData) {
  const rows = []
  for (const [date, vals] of mergedData) {
    rows.push({
      plot_id:             PLOT_ID,
      scan_date:           date,
      sar_vv:              vals.vv,
      sar_vh:              vals.vh,
      sar_flood_index:     vals.ratio,
      sar_orbit_direction: vals.orbit,
      sar_source:          'sentinel-1',
    })
  }

  if (rows.length === 0) {
    console.log('\n⚠ Tidak ada data SAR untuk di-upsert.')
    return []
  }

  // onConflict: kalau (plot_id, scan_date) sudah ada (dari NDVI scan),
  // update HANYA kolom SAR — kolom NDVI/NDWI tidak disentuh.
  const { data, error } = await supabase
    .from('satellite_logs')
    .upsert(rows, {
      onConflict:        'plot_id,scan_date',
      ignoreDuplicates:  false    // update kolom SAR kalau ada konflik
    })
    .select('scan_date, sar_vv, sar_vh, sar_flood_index, sar_orbit_direction, sar_source')

  if (error) throw new Error(`Upsert gagal: ${error.message}`)
  return data ?? []
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log(`\nWindow: ${fromStr} → ${toStr}`)
console.log(`Plot  : wayan suparta (${PLOT_ID.slice(0, 8)})`)

const token = await getToken()

console.log('\nFetch ASCENDING orbit…')
const [ascRaw, descRaw] = await Promise.all([
  fetchOrbit(token, 'ASCENDING'),
  fetchOrbit(token, 'DESCENDING'),
])
console.log('Fetch DESCENDING orbit…')

const ascMap  = parseIntervals(ascRaw)
const descMap = parseIntervals(descRaw)

console.log(`\nPass ASCENDING  : ${ascMap.size} hari ditemukan`)
console.log(`Pass DESCENDING : ${descMap.size} hari ditemukan`)

const merged = mergeOrbits(ascMap, descMap)
console.log(`Setelah merge   : ${merged.size} tanggal unik\n`)

// Tampilkan data sebelum upsert
console.log('Data yang akan di-upsert:')
console.log('Tanggal       | Orbit      |    VV      |    VH      | VH/VV')
console.log('--------------+------------+------------+------------+--------')
for (const [date, v] of [...merged.entries()].sort()) {
  const fmt = (n) => n.toFixed(5).padStart(10)
  console.log(`${date}  | ${v.orbit.padEnd(10)} | ${fmt(v.vv)} | ${fmt(v.vh)} | ${v.ratio.toFixed(5)}`)
}

// ─── Upsert ke DB ─────────────────────────────────────────────────────────────
console.log('\nUpsert ke satellite_logs…')
const saved = await upsertToDB(supabase, merged)

if (saved.length === 0) {
  // upsert tidak return data — baca balik manual
  const { data: check } = await supabase
    .from('satellite_logs')
    .select('scan_date, sar_vv, sar_vh, sar_flood_index, sar_orbit_direction, sar_source')
    .eq('plot_id', PLOT_ID)
    .in('scan_date', [...merged.keys()])
    .order('scan_date')
  console.log('\n✓ Verifikasi dari DB (select balik):')
  for (const r of (check ?? [])) {
    console.log(`  ${r.scan_date} | ${r.sar_orbit_direction?.padEnd(10)} | vv=${r.sar_vv?.toFixed(5)} vh=${r.sar_vh?.toFixed(5)} idx=${r.sar_flood_index?.toFixed(5)} src=${r.sar_source}`)
  }
} else {
  console.log('\n✓ Tersimpan ke DB:')
  for (const r of saved) {
    console.log(`  ${r.scan_date} | ${r.sar_orbit_direction?.padEnd(10)} | vv=${r.sar_vv?.toFixed(5)} vh=${r.sar_vh?.toFixed(5)} idx=${r.sar_flood_index?.toFixed(5)} src=${r.sar_source}`)
  }
}

console.log('\n→ Kalau semua baris tercetak dengan nilai SAR: kolom baru OK, lanjut ke backfill.')
console.log('→ Kalau error "column does not exist": jalankan migration_v10 di Supabase SQL Editor dulu.\n')
