import { getSentinelToken } from './auth'
import { SENTINEL_RESX_DEG_10M_BALI, SENTINEL_RESY_DEG_10M_BALI } from './resolution'
import { CLOUD_COVER_THRESHOLD } from '@/lib/plot-geo'
import { NDVI_EVALSCRIPT as EVALSCRIPT, statsTimeRange } from './formulas'

// cloud_cover_percent dihitung dari band SCL (Scene Classification Layer)
// Sentinel-2 L2A — mendeteksi awan/bayangan/cirrus SUNGGUHAN per-piksel di
// area polygon. SEBELUMNYA dihitung dari "dataMask" (cuma menandai piksel
// punya data sensor, BUKAN deteksi awan) — bug ditemukan 08 Juli 2026:
// scan 26 Mei 2026 Budidaya BSO dilaporkan 0% awan padahal cloud cover
// resmi Copernicus 42%, menyebabkan NDVI rusak-akibat-awan salah lolos
// validasi dan salah diklasifikasi "kosong" padahal padi masih ada.
// SCL: 3=cloud shadow, 8=cloud medium prob, 9=cloud high prob, 10=thin cirrus
// Evalscript dikonsolidasi ke lib/sentinel-hub/formulas.ts (Tahap 2 refactor,
// 28 Juli 2026) — sebelumnya versi lokal file ini beda teks (parameter
// bernama `samples`) tapi identik secara matematis dengan versi yang dipakai
// scan/route.ts & baseline/route.ts (parameter `s`); sekarang 1 sumber sama.

export interface NdviResult {
  ndvi_score: number | null
  cloud_cover_percent: number | null
  is_valid: boolean
}

export async function fetchNdvi(
  geoJsonPolygon: object,
  scanDate: string
): Promise<NdviResult> {
  const token = await getSentinelToken()

  const body = {
    input: {
      bounds: {
        geometry: geoJsonPolygon,
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [
        {
          type: 'sentinel-2-l2a',
          dataFilter: { maxCloudCoverage: 100 },
        },
      ],
    },
    aggregation: {
      timeRange: statsTimeRange(scanDate, scanDate),
      aggregationInterval: { of: 'P1D' },
      evalscript: EVALSCRIPT,
      resx: SENTINEL_RESX_DEG_10M_BALI,
      resy: SENTINEL_RESY_DEG_10M_BALI,
    },
    calculations: { default: {} },
  }

  const res = await fetch('https://sh.dataspace.copernicus.eu/api/v1/statistics', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`NDVI request failed (${res.status}): ${err}`)
  }

  const data = await res.json()
  const interval = data.data?.[0]

  if (!interval) return { ndvi_score: null, cloud_cover_percent: null, is_valid: false }

  const ndviMean = interval.outputs?.ndvi?.bands?.B0?.stats?.mean ?? null
  const cloudCover = interval.outputs?.cloudMask?.bands?.B0?.stats?.mean != null
    ? interval.outputs.cloudMask.bands.B0.stats.mean * 100
    : null

  const is_valid = cloudCover !== null && cloudCover <= CLOUD_COVER_THRESHOLD

  return {
    ndvi_score: ndviMean,
    cloud_cover_percent: cloudCover !== null ? Math.round(cloudCover * 10) / 10 : null,
    is_valid,
  }
}
