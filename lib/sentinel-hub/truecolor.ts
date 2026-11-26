import { getSentinelToken } from './auth'
import type { SupabaseClient } from '@supabase/supabase-js'

// Evalscript true color standar (B04/B03/B02 dengan gain 2.5x) — divalidasi
// manual 09 Juli 2026 lewat Process API terhadap geometri plot Wayan Suparta,
// hasil visual masuk akal (hijau tua konsisten dengan NDVI tinggi tanggal itu).
// Output PNG 4 band (RGB + dataMask sebagai alpha) — bukan JPEG 3 band — supaya
// area di luar polygon plot (di dalam bounding box persegi) benar-benar
// transparan, bukan kotak hitam. Ditemukan & diperbaiki 09 Juli 2026 lewat
// verifikasi visual screenshot: JPEG tidak dukung alpha, area luar polygon
// jadi hitam pekat menutupi peta dasar.
const TRUECOLOR_EVALSCRIPT = `//VERSION=3
function setup() {
  return { input: ["B02", "B03", "B04", "dataMask"], output: { bands: 4 } };
}
function evaluatePixel(sample) {
  return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02, sample.dataMask];
}`

// 256x256 (bukan 512x512) — diputuskan 09 Juli 2026: petak kecil (<1ha) cuma
// beberapa piksel asli di resolusi native Sentinel-2 10m, jadi 512 cuma bikin
// file lebih besar tanpa nambah detail nyata (blocky-nya sama saja).
const OUTPUT_SIZE = 256

export async function fetchTrueColorImage(
  geometry: { type: string; coordinates: number[][][] },
  date: string
): Promise<Buffer | null> {
  const token = await getSentinelToken()
  const res = await fetch('https://sh.dataspace.copernicus.eu/api/v1/process', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'image/png' },
    body: JSON.stringify({
      input: {
        bounds: { geometry, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } },
        data: [{
          type: 'sentinel-2-l2a',
          dataFilter: { timeRange: { from: `${date}T00:00:00Z`, to: `${date}T23:59:59Z` }, maxCloudCoverage: 100 },
        }],
      },
      output: {
        width: OUTPUT_SIZE,
        height: OUTPUT_SIZE,
        responses: [{ identifier: 'default', format: { type: 'image/png' } }],
      },
      evalscript: TRUECOLOR_EVALSCRIPT,
    }),
  })

  if (!res.ok) return null
  const buffer = Buffer.from(await res.arrayBuffer())
  return buffer.length > 0 ? buffer : null
}

// Path pattern per TECHNICAL_DESIGN_Tahap3.md §3.6 ({plot_id}/{year}/{scan_date}_truecolor.___)
// dengan 1 deviasi: ekstensi .png bukan .jpg — diputuskan 09 Juli 2026 demi
// transparansi asli di luar bentuk polygon (lihat catatan di TRUECOLOR_EVALSCRIPT).
export async function uploadTrueColorImage(
  supabase: SupabaseClient,
  plotId: string,
  scanDate: string,
  buffer: Buffer
): Promise<string | null> {
  const year = scanDate.slice(0, 4)
  const path = `${plotId}/${year}/${scanDate}_truecolor.png`
  const { error } = await supabase.storage
    .from('satellite-imagery')
    .upload(path, buffer, { contentType: 'image/png', upsert: true })
  if (error) return null
  return path
}
