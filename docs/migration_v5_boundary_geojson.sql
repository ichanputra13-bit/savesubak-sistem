-- Migration v5: tambah kolom boundary_geojson di tabel kawasan
-- Nama query Supabase SQL Editor: 05_add_boundary_geojson_kawasan
-- Tujuan: cache polygon batas desa dari Nominatim OSM agar tidak perlu
--         re-fetch setiap halaman dibuka. Diisi otomatis pertama kali
--         Nominatim berhasil return data valid (admin_level desa, bbox <100km²).

ALTER TABLE kawasan ADD COLUMN IF NOT EXISTS boundary_geojson JSONB;

-- Struktur JSON yang disimpan (dokumentasi, bukan constraint):
-- {
--   "geom":        { "type": "Polygon"|"MultiPolygon", "coordinates": [...] },
--   "bbox":        ["minlat", "maxlat", "minlon", "maxlon"],
--   "name":        "Sangeh",
--   "admin_level": "7"
-- }
