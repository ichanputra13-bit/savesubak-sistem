-- migration_v10_sar_columns.sql
-- Nama query SQL Editor: 10_add_sar_vv_vh_orbit
--
-- Menambah 3 kolom SAR mentah ke satellite_logs:
--   sar_vv              — backscatter VV (linear power, unit watt)
--   sar_vh              — backscatter VH (linear power, unit watt)
--   sar_orbit_direction — arah orbit: 'ASCENDING', 'DESCENDING', atau 'BOTH'
--                         (BOTH jika 2 pass pada hari yang sama, di-average sebelum disimpan)
--
-- sar_flood_index (VH/VV rasio) dan sar_source sudah ada dari migration v1.
-- Setelah migration ini: kolom SAR lengkap = vv, vh, flood_index, orbit_direction, source.

ALTER TABLE satellite_logs
  ADD COLUMN IF NOT EXISTS sar_vv              numeric,
  ADD COLUMN IF NOT EXISTS sar_vh              numeric,
  ADD COLUMN IF NOT EXISTS sar_orbit_direction text
    CHECK (sar_orbit_direction IN ('ASCENDING', 'DESCENDING', 'BOTH'));
