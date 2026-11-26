// Deteksi overlap antar-polygon — metodologi SAMA PERSIS dengan investigasi
// duplikasi lahan 23 Juli 2026 (Subak Sangeh vs Kelompok tani Sri Galih):
// @turf/boolean-intersects untuk cek cepat apakah 2 polygon bersinggungan sama
// sekali, lalu @turf/intersect + @turf/area untuk hitung persentase overlap
// presisi. Ambang 30% terbukti menangkap kandidat duplikasi nyata tanpa
// banyak false-positive dari petak yang cuma bertetangga (lihat PROJECT_LOG.md
// 23 Juli 2026).
//
// Dipakai KHUSUS untuk jalur import KML (mencegah duplikat BARU) — BUKAN
// pengganti "Opsi D" (peninjauan duplikat yang SUDAH ada di database), yang
// tetap rencana terpisah, belum dikerjakan.
import { intersect } from '@turf/intersect'
import { booleanIntersects } from '@turf/boolean-intersects'
import area from '@turf/area'
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson'

export const COLLISION_THRESHOLD_PERCENT = 30

export interface NamedGeometry {
  id: string
  name: string
  geometry: Polygon | MultiPolygon
}

export interface CollisionMatch {
  withId: string
  withName: string
  percent: number
}

export interface ExternalPlot {
  id: string
  name: string
  kawasanName: string
  geometry: Polygon | MultiPolygon
}

export interface ExternalCollisionMatch {
  plotId: string
  plotName: string
  kawasanName: string
  percent: number
}

// Bentuk hasil deteksi 2 lapis untuk 1 polygon — dipakai sebagai kontrak
// bersama antara API route (yang menghitung) dan komponen UI (yang
// menampilkan), supaya bentuknya tidak didefinisikan ulang di 2 tempat.
export interface PolygonCollisionResult {
  tempId: string
  internal: CollisionMatch[]
  external: ExternalCollisionMatch[]
}

function toFeature(geometry: Polygon | MultiPolygon): Feature<Polygon | MultiPolygon> {
  return { type: 'Feature', properties: {}, geometry }
}

// Persentase overlap dihitung dari luas irisan dibagi luas polygon A (bukan
// B) — konsisten dengan cara pesan ditampilkan ke user: "Polygon [A] ini X%
// tumpang tindih dengan [B]", bukan sebaliknya.
export function overlapPercent(geomA: Polygon | MultiPolygon, geomB: Polygon | MultiPolygon): number {
  const fA = toFeature(geomA)
  const fB = toFeature(geomB)

  if (!booleanIntersects(fA, fB)) return 0

  const fc: FeatureCollection<Polygon | MultiPolygon> = { type: 'FeatureCollection', features: [fA, fB] }
  const intersection = intersect(fc)
  if (!intersection) return 0

  const areaA = area(fA)
  if (areaA <= 0) return 0

  const intersectionArea = area(intersection)
  return Math.round((intersectionArea / areaA) * 1000) / 10
}

// LAPIS 1 — bandingkan semua polygon dalam file yang sama, satu-sama-lain (pairwise).
export function findInternalCollisions(items: NamedGeometry[]): Map<string, CollisionMatch[]> {
  const result = new Map<string, CollisionMatch[]>()

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const percent = overlapPercent(items[i].geometry, items[j].geometry)
      if (percent >= COLLISION_THRESHOLD_PERCENT) {
        addMatch(result, items[i].id, { withId: items[j].id, withName: items[j].name, percent })
        addMatch(result, items[j].id, { withId: items[i].id, withName: items[i].name, percent })
      }
    }
  }

  return result
}

// LAPIS 2 — bandingkan tiap polygon baru terhadap SEMUA petak yang sudah ada
// di database, lintas semua kawasan (bukan cuma kawasan tujuan import).
export function findExternalCollisions(
  candidates: NamedGeometry[],
  existing: ExternalPlot[]
): Map<string, ExternalCollisionMatch[]> {
  const result = new Map<string, ExternalCollisionMatch[]>()

  for (const candidate of candidates) {
    for (const plot of existing) {
      const percent = overlapPercent(candidate.geometry, plot.geometry)
      if (percent >= COLLISION_THRESHOLD_PERCENT) {
        const arr = result.get(candidate.id) ?? []
        arr.push({ plotId: plot.id, plotName: plot.name, kawasanName: plot.kawasanName, percent })
        result.set(candidate.id, arr)
      }
    }
  }

  return result
}

function addMatch(map: Map<string, CollisionMatch[]>, key: string, match: CollisionMatch) {
  const arr = map.get(key) ?? []
  arr.push(match)
  map.set(key, arr)
}
