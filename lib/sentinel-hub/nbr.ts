import { getSentinelToken } from './auth'
import type { SupabaseClient } from '@supabase/supabase-js'

export const nbrEvalscript = `
//VERSION=3
function setup() {
  return {
    input: ["B08", "B12", "dataMask"],
    output: { bands: 4 }
  };
}

function evaluatePixel(samples) {
  let nbr = (samples.B08 - samples.B12) / (samples.B08 + samples.B12);
  
  if (samples.dataMask === 0) {
    return [0, 0, 0, 0];
  }

  // High severity burn (Dark Red/Black)
  if (nbr < -0.25) return [0.3, 0.0, 0.0, 1];
  
  // Low-Moderate severity burn (Orange/Brown)
  if (nbr < 0.1) return [0.8, 0.4, 0.0, 1];
  
  // Unburned / Bare soil / Vegetation
  if (nbr < 0.3) return [0.0, 0.5, 0.0, 0.3]; // Healthy veg
  
  return [0.0, 0.8, 0.0, 0.5]; // Very healthy veg
}
`;

const OUTPUT_SIZE = 256

export async function fetchNbrImage(
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
      evalscript: nbrEvalscript,
    }),
  })

  if (!res.ok) return null
  const buffer = Buffer.from(await res.arrayBuffer())
  return buffer.length > 0 ? buffer : null
}

export async function uploadNbrImage(
  supabase: SupabaseClient,
  plotId: string,
  scanDate: string,
  buffer: Buffer
): Promise<string | null> {
  const year = scanDate.slice(0, 4)
  const path = `${plotId}/${year}/${scanDate}_nbr.png`
  const { error } = await supabase.storage
    .from('satellite-imagery')
    .upload(path, buffer, { contentType: 'image/png', upsert: true })
  if (error) return null
  return path
}
