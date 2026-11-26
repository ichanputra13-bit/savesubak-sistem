import { getSentinelToken } from './auth'
import { statsTimeRange } from './formulas'

export interface SarDayResult {
  date: string
  vv: number
  vh: number
  flood_index: number
  orbit_direction: 'ASCENDING' | 'DESCENDING' | 'BOTH'
}

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

async function fetchOrbitStats(
  token: string,
  geometry: unknown,
  fromDate: string,
  toDate: string,
  orbitDirection: 'ASCENDING' | 'DESCENDING'
): Promise<Map<string, { vv: number; vh: number; flood_index: number }>> {
  const res = await fetch('https://sh.dataspace.copernicus.eu/api/v1/statistics', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: {
        bounds: { geometry },
        data: [{
          type: 'sentinel-1-grd',
          dataFilter: { acquisitionMode: 'IW', polarization: 'DV', resolution: 'HIGH', orbitDirection },
        }],
      },
      aggregation: {
        timeRange: statsTimeRange(fromDate, toDate),
        aggregationInterval: { of: 'P1D' },
        evalscript: EVALSCRIPT,
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw Object.assign(new Error(`SAR Stats API ${res.status}: ${text.slice(0, 120)}`), { status: res.status })
  }

  const out = new Map<string, { vv: number; vh: number; flood_index: number }>()
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

/**
 * Fetch Sentinel-1 GRD data (VV, VH, VH/VV rasio) untuk semua pass dalam window.
 * Query ascending + descending secara paralel, merge per tanggal.
 * Bila kedua orbit hit pada hari yang sama: average nilai, orbit_direction = 'BOTH'.
 */
export async function fetchSar(
  geometry: unknown,
  fromDate: string,
  toDate: string
): Promise<SarDayResult[]> {
  const token = await getSentinelToken()
  const [ascMap, descMap] = await Promise.all([
    fetchOrbitStats(token, geometry, fromDate, toDate, 'ASCENDING'),
    fetchOrbitStats(token, geometry, fromDate, toDate, 'DESCENDING'),
  ])

  const allDates = new Set([...ascMap.keys(), ...descMap.keys()])
  const results: SarDayResult[] = []

  for (const date of [...allDates].sort()) {
    const a = ascMap.get(date)
    const d = descMap.get(date)
    if (a && d) {
      results.push({
        date,
        vv:           (a.vv + d.vv) / 2,
        vh:           (a.vh + d.vh) / 2,
        flood_index:  (a.flood_index + d.flood_index) / 2,
        orbit_direction: 'BOTH',
      })
    } else if (a) {
      results.push({ date, ...a, orbit_direction: 'ASCENDING' })
    } else if (d) {
      results.push({ date, ...d, orbit_direction: 'DESCENDING' })
    }
  }

  return results
}
