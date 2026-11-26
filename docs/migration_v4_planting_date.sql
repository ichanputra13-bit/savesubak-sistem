-- migration_v4_planting_date
-- Nama query SQL Editor: 04_add_planting_date_plots
-- Tambah kolom tanggal tanam (nullable) ke tabel plots
-- Dipakai oleh logika adaptive scan interval di cron

ALTER TABLE plots
  ADD COLUMN IF NOT EXISTS planting_date DATE;

COMMENT ON COLUMN plots.planting_date IS
  'Tanggal tanam aktual musim ini. Kalau terisi, cron otomatis pakai interval intensif (6 hari) selama 120 hari ke depan.';
