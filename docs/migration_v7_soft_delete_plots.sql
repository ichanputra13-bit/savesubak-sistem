-- Nama: 07_soft_delete_plots
-- Tujuan: Tambah kolom is_deleted di tabel plots (soft delete).
--         Plot yang dihapus disembunyikan dari semua query via v_plots,
--         data historis (satellite_logs, planting_seasons, dll) tetap ada di DB.

ALTER TABLE plots ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- Index parsial — hanya untuk baris yang belum dihapus (yang paling sering di-query)
CREATE INDEX IF NOT EXISTS plots_not_deleted_idx ON plots(id) WHERE is_deleted = false;

-- Recreate v_plots view — tambah filter WHERE is_deleted = false
-- Ini memastikan semua query yang pakai v_plots otomatis tidak melihat plot yang dihapus
CREATE OR REPLACE VIEW v_plots
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
  p.created_at,
  ST_AsGeoJSON(p.geo_data)::jsonb AS geo_data
FROM plots p
WHERE p.is_deleted = false;
