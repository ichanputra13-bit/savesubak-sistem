-- ============================================================
-- AgriMRV — Migration v8: Status Lahan (self-declared)
-- Nama query di SQL Editor: 08_status_lahan_plots
-- ============================================================
-- JALANKAN SEBELUM DEPLOY kode yang menggunakan field ini.
-- Urutan kritis: ALTER TABLE → CREATE FUNCTION → CREATE VIEW

-- 1. Tambah kolom ke tabel plots
ALTER TABLE plots
  ADD COLUMN IF NOT EXISTS status_lahan       text
    CHECK (status_lahan IN ('organik', 'konversi', 'regenerative', 'konvensional')),
  ADD COLUMN IF NOT EXISTS nama_lso           text,
  ADD COLUMN IF NOT EXISTS nomor_sertifikat   text,
  ADD COLUMN IF NOT EXISTS tanggal_kadaluarsa date;

-- 2. Update RPC insert_plot — signature lama (5 param) di-drop dulu secara eksplisit,
--    baru CREATE yang baru (9 param). CREATE OR REPLACE tidak bisa dipakai langsung
--    karena Postgres membuat overload baru kalau signature berbeda, bukan menggantikan,
--    sehingga GRANT tanpa arglist menjadi ambigu dan transaction di-rollback.
DROP FUNCTION IF EXISTS insert_plot(uuid, text, text, numeric, jsonb);

CREATE FUNCTION insert_plot(
  p_kawasan_id         uuid,
  p_farmer_name        text,
  p_crop_variety       text,
  p_area_ha            numeric,
  p_geo_data           jsonb,
  p_status_lahan       text DEFAULT NULL,
  p_nama_lso           text DEFAULT NULL,
  p_nomor_sertifikat   text DEFAULT NULL,
  p_tanggal_kadaluarsa date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO plots (
    kawasan_id, farmer_name, crop_variety, area_ha, geo_data,
    status_lahan, nama_lso, nomor_sertifikat, tanggal_kadaluarsa
  )
  VALUES (
    p_kawasan_id,
    p_farmer_name,
    p_crop_variety,
    p_area_ha,
    ST_SetSRID(ST_GeomFromGeoJSON(p_geo_data::text), 4326),
    p_status_lahan,
    p_nama_lso,
    p_nomor_sertifikat,
    p_tanggal_kadaluarsa
  )
  RETURNING id INTO new_id;

  RETURN json_build_object('id', new_id);
END;
$$;

-- GRANT dengan arglist eksplisit — tidak ambigu meskipun nanti ada overload lain
GRANT EXECUTE ON FUNCTION insert_plot(uuid, text, text, numeric, jsonb, text, text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_plot(uuid, text, text, numeric, jsonb, text, text, text, date) TO service_role;

-- 3. Recreate v_plots view — DROP dulu (CREATE OR REPLACE tidak bisa mengubah urutan/posisi kolom),
--    baru CREATE fresh. Aman: tidak ada objek DB lain yang bergantung ke view ini (cek 2026-07-06).
DROP VIEW IF EXISTS v_plots;

CREATE VIEW v_plots
  WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.kawasan_id,
  p.farmer_name,
  p.crop_variety,
  p.area_ha,
  p.scan_interval_days,
  p.is_organic_certified,
  p.status_lahan,
  p.nama_lso,
  p.nomor_sertifikat,
  p.tanggal_kadaluarsa,
  p.created_at,
  ST_AsGeoJSON(p.geo_data)::jsonb AS geo_data
FROM plots p
WHERE p.is_deleted = false;

-- Verifikasi
SELECT column_name FROM information_schema.columns
WHERE table_name = 'plots'
  AND column_name IN ('status_lahan', 'nama_lso', 'nomor_sertifikat', 'tanggal_kadaluarsa')
ORDER BY column_name;
