// Parser KML→petak untuk fitur Import dari KML. Pakai DOMParser bawaan
// browser (bukan @xmldom/xmldom) — file ini HANYA dipakai dari komponen
// client, tidak pernah diimpor di server (DOMParser tidak ada di Node).
import { kml } from '@tmcw/togeojson'
import area from '@turf/area'
import type { Feature, Polygon, MultiPolygon } from 'geojson'

export interface ParsedKmlPlot {
  tempId: string
  name: string
  geometry: Polygon
  areaHa: number
}

export function parseKmlText(kmlText: string): ParsedKmlPlot[] {
  const dom = new DOMParser().parseFromString(kmlText, 'text/xml')
  if (dom.getElementsByTagName('parsererror').length > 0) {
    throw new Error('File KML tidak valid atau rusak — gagal di-parse.')
  }

  // Fallback nama non-standar: sebagian file KML hasil ekspor aplikasi survei
  // lapangan pakai tag <n> alih-alih <name> KML standar. togeojson TIDAK
  // mengenali <n> (bukan elemen resmi skema KML), jadi dicari manual di sini.
  // HANYA dipakai kalau jumlah Placemark cocok PERSIS dengan jumlah polygon
  // hasil parse togeojson (berarti file flat tanpa folder/campuran geometri
  // lain) — supaya tidak salah pasang nama ke polygon yang salah kalau
  // strukturnya lebih kompleks dari itu.
  const placemarks = Array.from(dom.getElementsByTagName('Placemark'))
  const rawNameFallbacks = placemarks.map((pm) => {
    const nTag = pm.getElementsByTagName('n')[0]
    const text = nTag?.textContent?.trim()
    return text || null
  })

  const fc = kml(dom)
  const polygonFeatures = fc.features.filter(
    (f): f is Feature<Polygon | MultiPolygon> =>
      f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
  )
  const canUseRawFallback = rawNameFallbacks.length === polygonFeatures.length

  const results: ParsedKmlPlot[] = []
  let counter = 0

  for (let i = 0; i < polygonFeatures.length; i++) {
    const feature = polygonFeatures[i]
    const rawFallback = canUseRawFallback ? rawNameFallbacks[i] : null

    if (feature.geometry.type === 'Polygon') {
      if (!isValidRing(feature.geometry.coordinates[0])) continue // KML rusak/ring kosong — lewati, jangan crash
      counter++
      const name = resolvePlotName(feature.properties, rawFallback, counter)
      const geometry = stripZ(feature.geometry)
      results.push({
        tempId: `kml-${counter}`,
        name,
        geometry,
        areaHa: round3(area({ type: 'Feature', properties: {}, geometry }) / 10000),
      })
    } else {
      // MultiPolygon: skema project ini cuma dukung 1 polygon tunggal per
      // petak (geo_data kolomnya bertipe geometry(Polygon,4326) — lihat
      // migration_v1.sql baris 44), jadi tiap bagian dipecah jadi petak
      // terpisah.
      const baseName = resolvePlotName(feature.properties, rawFallback, counter + 1)
      const validParts = feature.geometry.coordinates.filter((polyCoords) => isValidRing(polyCoords[0]))
      validParts.forEach((polyCoords, idx) => {
        counter++
        const geometry = stripZ({ type: 'Polygon', coordinates: polyCoords })
        results.push({
          tempId: `kml-${counter}`,
          name: validParts.length > 1 ? `${baseName} (${idx + 1})` : baseName,
          geometry,
          areaHa: round3(area({ type: 'Feature', properties: {}, geometry }) / 10000),
        })
      })
    }
  }

  return results
}

// Ring polygon valid minimal butuh 4 titik (3 titik unik + penutup yang sama
// dengan titik awal) — KML yang rusak/placemark tanpa koordinat lengkap bisa
// menghasilkan ring kosong atau terlalu pendek. Tanpa pengecekan ini, ring
// semacam itu lolos ke hasil parse dan bikin crash di UI preview saat
// `coordinates[0].map(...)` dipanggil (mis. render polygon di peta Leaflet).
function isValidRing(ring: number[][] | undefined): ring is number[][] {
  return Array.isArray(ring) && ring.length >= 4
}

function resolvePlotName(
  properties: Record<string, unknown> | null,
  rawFallback: string | null,
  fallbackIndex: number
): string {
  const props = properties ?? {}
  if (typeof props.name === 'string' && props.name.trim()) return props.name.trim()
  if (rawFallback) return rawFallback
  return `Polygon ${fallbackIndex}`
}

// KML mengizinkan koordinat 3D ("lon,lat,alt") — kolom geo_data project ini
// 2D murni (geometry(Polygon,4326)), jadi altitude dibuang di sini supaya
// insert_plot tidak menerima dimensi Z yang tidak didukung skema.
function stripZ(geometry: Polygon): Polygon {
  return {
    type: 'Polygon',
    coordinates: geometry.coordinates.map((ring) => ring.map(([lng, lat]) => [lng, lat])),
  }
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000
}
