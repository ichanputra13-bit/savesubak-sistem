// Sentinel Hub Statistical/Process API: resx/resy di object "aggregation"/"output"
// diinterpretasikan dalam SATUAN CRS yang dipakai di bounds.properties.crs (dikonfirmasi
// dari contoh resmi Sentinel Hub — request dengan CRS UTM pakai resx/resy dalam meter,
// request dengan CRS EPSG:4326 pakai resx/resy dalam DERAJAT). Semua request di project
// ini pakai EPSG:4326 (geometry plot disimpan lon/lat derajat, bukan diproyeksikan ke
// UTM), jadi resx/resy WAJIB dalam derajat — bukan `10` mentah (itu akan dibaca "10
// derajat" ≈ 1.100 km, membuat 1 polygon petak kecil cuma dapat 1 sample pixel).
//
// Bug ditemukan 25 Juli 2026: resx/resy=10 dipakai langsung tanpa konversi di 4 lokasi
// (ndvi.ts, ndwi.ts, baseline/route.ts, scan/route.ts) sejak awal project (2023).
//
// Nilai di bawah dihitung dari formula panjang derajat lintang/bujur WGS84 (Snyder,
// "Map Projections — A Working Manual", dibulatkan ke presisi meter) pada lintang
// representatif Bali (~8.5°S — pulau Bali membentang -8.05° s/d -8.85°, variasi
// cos(lat) antar titik di pulau ini <0.15%, jadi 1 konstanta cukup akurat untuk
// seluruh wilayah project tanpa perlu hitung per-polygon):
//   panjang 1° lintang @ 8.5°  ≈ 110598.5 m  →  resy = 10 / 110598.5 = 0.00009042
//   panjang 1° bujur   @ 8.5°  ≈ 110104.9 m  →  resx = 10 / 110104.9 = 0.00009083
// Kalau project ini suatu saat menjangkau lintang jauh dari Bali (di luar ±1-2°),
// konstanta ini perlu dihitung ulang untuk lintang itu — cos(lat) berubah cukup besar
// di lintang tinggi (lihat komentar di atas: TIDAK valid dipakai sembarang lintang).
export const SENTINEL_RESX_DEG_10M_BALI = 0.00009083
export const SENTINEL_RESY_DEG_10M_BALI = 0.00009042
