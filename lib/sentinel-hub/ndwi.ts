import { getSentinelToken } from './auth'
import { SENTINEL_RESX_DEG_10M_BALI, SENTINEL_RESY_DEG_10M_BALI } from './resolution'
import { NDWI_EVALSCRIPT as EVALSCRIPT, statsTimeRange } from './formulas'

// NDWI = (B03 - B08) / (B03 + B08)  — band hijau vs NIR, untuk deteksi air
// Evalscript dikonsolidasi ke lib/sentinel-hub/formulas.ts (Tahap 2
// refactor, 28 Juli 2026) — identik secara matematis dengan versi
// sebelumnya di file ini, cuma 1 sumber sama dengan scan/baseline route.

export async function fetchNdwi(
  geoJsonPolygon: object,
  scanDate: string
): Promise<number | null> {
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
    throw new Error(`NDWI request failed (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.data?.[0]?.outputs?.ndwi?.bands?.B0?.stats?.mean ?? null
}
