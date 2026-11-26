import { getSentinelToken } from './auth'

export interface CatalogProduct {
  id: string
  datetime: string
  platform: string
}

interface CatalogFeature {
  id: string
  properties: { datetime: string; platform: string }
}

// Sentinel Hub Catalog API (STAC) — TERPISAH dari Statistical API.
// Statistical API cuma kasih angka agregat (mean NDVI dst), tidak
// menyertakan ID produk/tile resmi atau timestamp presisi akuisisi.
// Dipakai khusus untuk panel "Sumber Data / Verifikasi" — bukti bahwa
// data berasal dari citra satelit Copernicus asli, bisa diverifikasi
// independen siapa saja.
//
// Catatan: kalau geometri plot bersinggungan dengan >1 tile (dekat
// batas tile), API bisa balikin beberapa hasil untuk 1 tanggal yang
// sama — diambil hasil pertama saja (simplifikasi yang disengaja,
// tidak mempengaruhi angka NDVI/NDWI/SAR yang sudah dihitung terpisah
// lewat Statistical API).
export async function fetchCatalogProduct(
  geometry: unknown,
  date: string,
  collection: 'sentinel-2-l2a' | 'sentinel-1-grd'
): Promise<CatalogProduct | null> {
  const token = await getSentinelToken()

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

  if (!res.ok) {
    throw Object.assign(new Error(`Catalog API ${res.status}: ${(await res.text()).slice(0, 150)}`), {
      status: res.status,
    })
  }

  const data = await res.json()
  const feature = (data.features ?? [])[0] as CatalogFeature | undefined
  if (!feature) return null

  return {
    id: feature.id,
    datetime: feature.properties.datetime,
    platform: feature.properties.platform,
  }
}
