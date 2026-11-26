-- Nama: 06_create_planting_seasons
-- Tujuan: Tabel musim tanam terpisah — menggantikan crop_variety dan
--         planting_date yang sebelumnya permanen di tabel plots.
--         Data historis tiap musim tanam kini tersimpan rapi per musim.

CREATE TABLE IF NOT EXISTS planting_seasons (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  plot_id              uuid        NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
  season_year          int         NOT NULL,
  season_number        int         NOT NULL CHECK (season_number BETWEEN 1 AND 3),
  crop_variety         text,
  planting_date        date        NOT NULL,
  -- estimated_harvest_date dihitung otomatis: tanam + 110 hari
  estimated_harvest_date date GENERATED ALWAYS AS (planting_date + 110) STORED,
  actual_harvest_date  date,
  actual_harvest_kg    numeric(10,2),
  status               text        NOT NULL DEFAULT 'aktif'
                                   CHECK (status IN ('aktif', 'panen', 'gagal-puso')),
  notes                text,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planting_seasons_plot_id_idx
  ON planting_seasons(plot_id);

-- Satu plot hanya bisa punya 1 entri per musim (year + number)
CREATE UNIQUE INDEX IF NOT EXISTS planting_seasons_plot_season_uidx
  ON planting_seasons(plot_id, season_year, season_number);

ALTER TABLE planting_seasons ENABLE ROW LEVEL SECURITY;

-- Admin (service_role) bisa semua operasi
CREATE POLICY "admin_all" ON planting_seasons
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Kolom lama di plots di-deprecate tapi tidak di-drop (backward compat sementara)
COMMENT ON COLUMN plots.crop_variety   IS 'DEPRECATED — gunakan planting_seasons.crop_variety';
COMMENT ON COLUMN plots.planting_date  IS 'DEPRECATED — gunakan planting_seasons';
