-- ============================================================
-- AgriMRV — Migration v9: Pemilik / Penggarap + Riwayat Lahan
-- Nama query di SQL Editor: 09_ownership_history
-- ============================================================
-- Urutan kritis: ALTER TABLE plots → CREATE TABLE history →
--   INSERT seed → DROP/CREATE insert_plot → DROP/CREATE v_plots

-- 1. Tambah kolom nama_pemilik + nama_penggarap ke plots
ALTER TABLE plots
  ADD COLUMN IF NOT EXISTS nama_pemilik   text,
  ADD COLUMN IF NOT EXISTS nama_penggarap text;

-- 2. Backfill data lama dari kolom farmer_name
UPDATE plots SET nama_penggarap = farmer_name WHERE nama_penggarap IS NULL;
UPDATE plots SET nama_pemilik   = farmer_name WHERE nama_pemilik   IS NULL;

-- 3. Tabel riwayat kepemilikan / penggarapan
CREATE TABLE IF NOT EXISTS plot_ownership_history (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  plot_id          uuid        NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
  nama_pemilik     text,
  nama_penggarap   text,
  tanggal_mulai    date        NOT NULL DEFAULT CURRENT_DATE,
  tanggal_selesai  date,
  notes            text,
  created_at       timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT chk_tanggal CHECK (tanggal_selesai IS NULL OR tanggal_selesai >= tanggal_mulai)
);

CREATE INDEX IF NOT EXISTS plot_ownership_hist_plot_id_idx
  ON plot_ownership_history(plot_id);

ALTER TABLE plot_ownership_history ENABLE ROW LEVEL SECURITY;

-- 4. Seed initial history untuk plot yang sudah ada
INSERT INTO plot_ownership_history (plot_id, nama_pemilik, nama_penggarap, tanggal_mulai, notes)
SELECT id, nama_pemilik, nama_penggarap, CURRENT_DATE,
       'Initial record — backfill dari data sebelum migrasi v9'
FROM plots
WHERE is_deleted = false;

-- 5. Update RPC insert_plot: DROP lama (9 param dari v8), CREATE baru (11 param)
DROP FUNCTION IF EXISTS insert_plot(uuid, text, text, numeric, jsonb, text, text, text, date);

CREATE FUNCTION insert_plot(
  p_kawasan_id         uuid,
  p_farmer_name        text,       -- deprecated; pakai p_nama_penggarap. Dipertahankan untuk compat.
  p_crop_variety       text,
  p_area_ha            numeric,
  p_geo_data           jsonb,
  p_status_lahan       text DEFAULT NULL,
  p_nama_lso           text DEFAULT NULL,
  p_nomor_sertifikat   text DEFAULT NULL,
  p_tanggal_kadaluarsa date DEFAULT NULL,
  p_nama_pemilik       text DEFAULT NULL,
  p_nama_penggarap     text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  new_id        uuid;
  eff_penggarap text;
  eff_pemilik   text;
BEGIN
  -- Kalau nama_penggarap tidak diisi, fallback ke farmer_name (backward compat)
  eff_penggarap := COALESCE(p_nama_penggarap, p_farmer_name);
  -- Kalau nama_pemilik tidak diisi, default ke penggarap (pemilik = penggarap)
  eff_pemilik   := COALESCE(p_nama_pemilik, eff_penggarap);

  INSERT INTO plots (
    kawasan_id, farmer_name, crop_variety, area_ha, geo_data,
    status_lahan, nama_lso, nomor_sertifikat, tanggal_kadaluarsa,
    nama_pemilik, nama_penggarap
  )
  VALUES (
    p_kawasan_id,
    eff_penggarap,    -- farmer_name = penggarap, tetap terisi untuk backward compat
    p_crop_variety,
    p_area_ha,
    ST_SetSRID(ST_GeomFromGeoJSON(p_geo_data::text), 4326),
    p_status_lahan,
    p_nama_lso,
    p_nomor_sertifikat,
    p_tanggal_kadaluarsa,
    eff_pemilik,
    eff_penggarap
  )
  RETURNING id INTO new_id;

  -- Seed initial ownership record langsung di RPC (atomik)
  INSERT INTO plot_ownership_history (plot_id, nama_pemilik, nama_penggarap, tanggal_mulai)
  VALUES (new_id, eff_pemilik, eff_penggarap, CURRENT_DATE);

  RETURN json_build_object('id', new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION insert_plot(uuid, text, text, numeric, jsonb, text, text, text, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_plot(uuid, text, text, numeric, jsonb, text, text, text, date, text, text) TO service_role;

-- 6. Recreate v_plots: DROP dulu (bukan CREATE OR REPLACE — lihat catatan migration v8)
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
  p.nama_pemilik,
  p.nama_penggarap,
  p.status_lahan,
  p.nama_lso,
  p.nomor_sertifikat,
  p.tanggal_kadaluarsa,
  p.created_at,
  ST_AsGeoJSON(p.geo_data)::jsonb AS geo_data
FROM plots p
WHERE p.is_deleted = false;

-- Verifikasi
SELECT
  (SELECT COUNT(*) FROM plot_ownership_history) AS total_history_records,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'plots'
     AND column_name IN ('nama_pemilik', 'nama_penggarap')) AS new_plot_columns;
