import { SENTINEL_RESX_DEG_10M_BALI, SENTINEL_RESY_DEG_10M_BALI } from './resolution'

// Konsolidasi Tahap 2 refactor (28 Juli 2026) — evalscript NDVI/NDWI/NBR
// (Statistical API) dan estimatePhase() SEBELUMNYA ditulis ulang di lokasi
// terpisah (scan manual, tarik baseline, cron harian lewat lib/sentinel-hub/
// ndvi.ts+ndwi.ts) — pola persis yang menyebabkan bug resx/resy sebelumnya
// perlu diperbaiki di 4 lokasi kode berbeda. Isi di bawah PERSIS SAMA
// (copy-paste) dengan yang sebelumnya duplikat di
// app/api/plots/[plotId]/scan/route.ts dan .../baseline/route.ts — TIDAK
// ADA logic/hasil yang diubah, cuma dipindah ke 1 sumber.

export const NDVI_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04","B08","SCL","dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "cloudMask", bands: 1, sampleType: "UINT8" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  var isCloud = (s.SCL === 3 || s.SCL === 8 || s.SCL === 9 || s.SCL === 10) ? 1 : 0;
  return { ndvi: [(s.B08-s.B04)/(s.B08+s.B04)], cloudMask: [isCloud], dataMask: [s.dataMask] };
}`

export const NDWI_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B03","B08","dataMask"] }],
    output: [
      { id: "ndwi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  return { ndwi: [(s.B03-s.B08)/(s.B03+s.B08)], dataMask: [s.dataMask] };
}`

export const NBR_STATS_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B08","B12","dataMask"] }],
    output: [
      { id: "nbr", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  return { nbr: [(s.B08-s.B12)/(s.B08+s.B12)], dataMask: [s.dataMask] };
}`

// Klasifikasi fase pertumbuhan dari NDVI (+ NDWI untuk beda vegetatif/generatif
// vs pematangan). SEBELUMNYA duplikat sebagai fungsi bernama identik di
// scan/route.ts & baseline/route.ts, dan sebagai blok if/else-if inline
// (logic sama persis) di cron/satellite-scan/route.ts.
export function estimatePhase(v: number, ndwi: number | null): string {
  if (v < 0.1) return 'kosong'
  if (v < 0.3) return 'semai'
  if (v < 0.5) return (ndwi !== null && ndwi < -0.35) ? 'pematangan' : 'vegetatif'
  if (v < 0.7) return (ndwi !== null && ndwi < -0.3)  ? 'pematangan' : 'generatif'
  return 'generatif'
}

// timeRange untuk Statistical API dengan aggregationInterval P1D, batas akhir
// EKSKLUSIF di tengah malam hari setelah `toDate`. Statistical API membuang
// interval P1D terakhir yang tidak penuh — dengan batas lama `T23:59:59Z`,
// hari terakhir selalu hilang (window 1 hari = kosong total, inilah kenapa
// cron harian tidak pernah dapat NDVI/NDWI). Dibuktikan 23 Okt 2026, plot
// Regenerative/001: 07-20..07-20T23:59:59Z → 0 interval; ..07-21T00:00:00Z →
// 1 interval (07-20); 07-15..07-20T23:59:59Z → cuma 07-15, 07-20 hilang.
export function statsTimeRange(fromDate: string, toDate: string) {
  const end = new Date(`${toDate}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 1)
  return { from: `${fromDate}T00:00:00Z`, to: `${end.toISOString().slice(0, 10)}T00:00:00Z` }
}

// Sentinel Statistical API — dipakai scan manual & tarik baseline untuk
// ambil rata-rata NDVI/NDWI/NBR per interval tanggal dalam 1 window.
// `outputId` tidak dipakai di body request (sama seperti versi asli di
// kedua lokasi sebelumnya) — dipertahankan apa adanya, bukan dihapus,
// supaya perubahan ini murni pemindahan lokasi kode.
export async function fetchSentinelStats(
  token: string,
  geoJsonPolygon: object,
  evalscript: string,
  outputId: string,
  fromDate: string,
  toDate: string
) {
  const body = {
    input: {
      bounds: {
        geometry: geoJsonPolygon,
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{ type: 'sentinel-2-l2a', dataFilter: { maxCloudCoverage: 100 } }],
    },
    aggregation: {
      timeRange: statsTimeRange(fromDate, toDate),
      aggregationInterval: { of: 'P1D' },
      evalscript,
      resx: SENTINEL_RESX_DEG_10M_BALI,
      resy: SENTINEL_RESY_DEG_10M_BALI,
    },
    calculations: { default: {} },
  }

  const res = await fetch('https://sh.dataspace.copernicus.eu/api/v1/statistics', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`Sentinel API ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return (json.data ?? []) as Array<{
    interval: { from: string; to: string }
    outputs: Record<string, { bands: Record<string, { stats: { mean: number } }> }>
  }>
}


// Pilih citra TERBAIK dari beberapa hari (26 Nov 2026). Sebelumnya scan manual
// ambil interval PALING AKHIR dan cron cuma lihat 1 hari (hari ini) — di musim
// hujan hasilnya hampir selalu awan 100%. Aturan: ambil citra terbaru yang
// awannya <= ambang; kalau tidak ada, ambil yang awannya paling sedikit
// (seri → yang terbaru). Interval tanpa NDVI (tidak ada lintasan) diabaikan.
type StatsInterval = Awaited<ReturnType<typeof fetchSentinelStats>>[number]
export function pickClearestInterval(intervals: StatsInterval[], cloudThreshold: number) {
  const withData = intervals
    .filter((d) => d.outputs?.ndvi?.bands?.B0?.stats?.mean != null && Number.isFinite(d.outputs.ndvi.bands.B0.stats.mean))
    .map((d) => ({ d, cloud: (d.outputs?.cloudMask?.bands?.B0?.stats?.mean ?? 1) * 100 }))
  if (withData.length === 0) return null
  const clear = withData.filter((x) => x.cloud <= cloudThreshold)
  if (clear.length > 0) return clear.at(-1)!.d
  return withData.reduce((best, x) => (x.cloud < best.cloud ? x : best), withData.at(-1)!).d
}
