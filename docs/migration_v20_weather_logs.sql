-- ============================================================
-- AgriMRV/Sinagri — Migration v20: Tabel weather_logs (Open-Meteo)
-- Nama query SQL Editor: 20_weather_logs_open_meteo
-- ============================================================
-- Konteks: layer cuaca (curah hujan prioritas utama) per-petak,
-- sumber Open-Meteo (gratis, tanpa API key, archive-api.open-meteo.com).
-- Diikat ke plot lewat titik tengah (centroid) polygon + tanggal —
-- pola sama persis dengan cara satellite_logs diikat ke plot.
--
-- Tervalidasi manual dulu sebelum migration ini (sesuai pola project:
-- "tes manual 1 titik sebelum integrasi penuh"): request nyata ke
-- archive-api.open-meteo.com pakai koordinat plot Wayan Suparta
-- (-8.41415, 115.19996) untuk 1-18 Juli 2026 — berhasil, termasuk
-- tanggal HARI INI (tidak ada lag data seperti dikhawatirkan di awal
-- untuk arsip reanalysis ERA5).
--
-- Wajib checklist RLS (CLAUDE.md §7): ENABLE RLS + minimal 1 policy
-- + verifikasi di migration yang sama — tabel baru TIDAK BOLEH publicly
-- accessible sejak awal (insiden user_profiles 07 Juli jangan terulang).
-- ============================================================

CREATE TABLE IF NOT EXISTS weather_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id uuid NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
  date date NOT NULL,
  rainfall_mm numeric,
  temp_avg_c numeric,
  humidity_avg_pct numeric,
  source text NOT NULL DEFAULT 'open-meteo',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plot_id, date)
);

COMMENT ON TABLE weather_logs IS 'Data cuaca harian per petak dari Open-Meteo (gratis, tanpa API key). Diikat via centroid polygon plot + tanggal.';
COMMENT ON COLUMN weather_logs.rainfall_mm IS 'Curah hujan harian (mm) — prioritas utama, dipakai untuk bukti intentionality praktik AWD.';
COMMENT ON COLUMN weather_logs.source IS 'Selalu open-meteo untuk saat ini — kolom disiapkan kalau nanti ganti/tambah provider.';

CREATE INDEX IF NOT EXISTS idx_weather_logs_plot_date ON weather_logs (plot_id, date DESC);

-- ============ RLS (wajib, lihat CLAUDE.md §7) ============
ALTER TABLE weather_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_weather" ON weather_logs;
CREATE POLICY "admin_full_access_weather" ON weather_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "auditor_read_weather" ON weather_logs;
CREATE POLICY "auditor_read_weather" ON weather_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'auditor'));

-- ============ VERIFIKASI (wajib, bukan asumsi) ============
-- Harus mengembalikan 1 baris, rowsecurity = true
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'weather_logs';

-- Harus mengembalikan minimal 2 baris (kedua policy di atas)
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'weather_logs';
