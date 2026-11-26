-- ============================================================
-- AgriMRV — Migration v12: Analisis Pola Pengairan Otomatis
-- Nama query SQL Editor: 12_season_water_pattern_analysis
--   (catatan: kalau nomor 12 sudah kepakai untuk query
--    "12_query_sar_aug_nov_2025", pakai 13 untuk migration ini)
-- ============================================================
-- Fitur: deteksi rule-based (IF-ELSE threshold, BUKAN AI/LLM) pola
-- pengairan 1 musim tanam dari data satelit (NDWI + SAR flood_index)
-- dalam rentang planting_date..actual_harvest_date (atau CURRENT_DATE
-- kalau belum panen). Hasil: 'oscillating_awd_like' (mengindikasikan
-- praktik AWD — basah-kering berulang), 'continuous_flooding'
-- (tergenang terus, cuma kering sekali di akhir/tidak sama sekali),
-- atau 'insufficient_data' (< 5 titik data).
--
-- Trigger otomatis saat actual_harvest_date diisi/diubah, PLUS bisa
-- dipanggil manual kapan saja (termasuk musim yang belum panen) lewat
-- RPC fn_analyze_season_water_pattern — dipakai tombol "Analisis Ulang
-- Pola" di UI.
--
-- Aman dijalankan ulang (idempotent).
-- ============================================================

-- ============ 1. TABEL ============
CREATE TABLE IF NOT EXISTS season_water_pattern_analysis (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  planting_season_id  uuid        NOT NULL UNIQUE REFERENCES planting_seasons(id) ON DELETE CASCADE,
  pattern_detected    text        NOT NULL CHECK (pattern_detected IN ('oscillating_awd_like', 'continuous_flooding', 'insufficient_data')),
  oscillation_count   int         NOT NULL DEFAULT 0,
  ndwi_points_used    int         NOT NULL DEFAULT 0,
  sar_points_used     int         NOT NULL DEFAULT 0,
  confidence_note     text,
  calculated_at       timestamptz NOT NULL DEFAULT now()
);
-- UNIQUE(planting_season_id) disengaja: 1 baris analisis per musim,
-- di-upsert (bukan riwayat) setiap kali dihitung ulang — ini metrik
-- turunan yang selalu bisa dihitung ulang dari satellite_logs, bukan
-- log historis kejadian.

CREATE INDEX IF NOT EXISTS season_water_pattern_season_id_idx
  ON season_water_pattern_analysis(planting_season_id);

-- ============ 2. RLS (WAJIB — checklist CLAUDE.md §7) ============
ALTER TABLE season_water_pattern_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_water_pattern" ON season_water_pattern_analysis;
CREATE POLICY "admin_full_access_water_pattern" ON season_water_pattern_analysis FOR ALL
  USING (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

DROP POLICY IF EXISTS "auditor_read_water_pattern" ON season_water_pattern_analysis;
CREATE POLICY "auditor_read_water_pattern" ON season_water_pattern_analysis FOR SELECT
  USING (exists (select 1 from user_profiles where id = auth.uid() and role = 'auditor'));

-- ============ 3. FUNGSI ANALISIS (dipakai trigger MAUPUN RPC manual) ============
CREATE OR REPLACE FUNCTION fn_analyze_season_water_pattern(p_season_id uuid)
RETURNS season_water_pattern_analysis
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_plot_id         uuid;
  v_start           date;
  v_end             date;
  v_ndwi_count      int := 0;
  v_sar_count       int := 0;
  v_total_points    int := 0;
  v_prev_state      text := NULL;
  v_oscillations    int := 0;
  v_pattern         text;
  v_note            text;
  v_result          season_water_pattern_analysis;
  rec               RECORD;
  v_state           text;
BEGIN
  SELECT plot_id, planting_date, COALESCE(actual_harvest_date, CURRENT_DATE)
    INTO v_plot_id, v_start, v_end
    FROM planting_seasons
    WHERE id = p_season_id;

  IF v_plot_id IS NULL THEN
    RAISE EXCEPTION 'planting_season % tidak ditemukan', p_season_id;
  END IF;

  -- Gabungkan NDWI + SAR jadi satu urutan kronologis basah/kering.
  -- SAR diprioritaskan di tanggal yang sama (lebih andal untuk deteksi
  -- genangan — tidak terganggu awan, lihat keputusan integrasi SAR
  -- sebelumnya). Threshold dipakai persis yang sudah ditetapkan di app:
  --   SAR rasio VH/VV >= 0.25  → basah (genangan sedang/tinggi)
  --   NDWI < -0.1              → kering
  -- (di luar itu dianggap basah/normal — sama seperti logic
  -- deriveInsights() di PlotDashboard.tsx)
  FOR rec IN
    SELECT scan_date, ndwi_score, sar_flood_index
    FROM satellite_logs
    WHERE plot_id = v_plot_id
      AND scan_date BETWEEN v_start AND v_end
      AND (ndwi_score IS NOT NULL OR sar_flood_index IS NOT NULL)
    ORDER BY scan_date ASC
  LOOP
    IF rec.sar_flood_index IS NOT NULL THEN
      v_state := CASE WHEN rec.sar_flood_index >= 0.25 THEN 'basah' ELSE 'kering' END;
      v_sar_count := v_sar_count + 1;
    ELSE
      v_state := CASE WHEN rec.ndwi_score < -0.1 THEN 'kering' ELSE 'basah' END;
      v_ndwi_count := v_ndwi_count + 1;
    END IF;

    v_total_points := v_total_points + 1;

    IF v_prev_state IS NOT NULL AND v_state <> v_prev_state THEN
      v_oscillations := v_oscillations + 1;
    END IF;
    v_prev_state := v_state;
  END LOOP;

  IF v_total_points < 5 THEN
    v_pattern := 'insufficient_data';
  ELSIF v_oscillations >= 2 THEN
    v_pattern := 'oscillating_awd_like';
  ELSE
    -- 0 transisi (basah terus) atau 1 transisi (basah lama lalu kering
    -- sekali di akhir, pola alami menjelang panen) — sama-sama BUKAN
    -- indikasi AWD aktif.
    v_pattern := 'continuous_flooding';
  END IF;

  v_note := format(
    '%s titik NDWI + %s titik SAR digabung kronologis (total %s, minimum 5 dibutuhkan). Threshold: SAR rasio VH/VV >= 0.25 = basah (diprioritaskan bila tersedia di tanggal sama), NDWI < -0.1 = kering. %s transisi basah/kering terdeteksi dalam rentang %s s/d %s.',
    v_ndwi_count, v_sar_count, v_total_points, v_oscillations, v_start, v_end
  );

  INSERT INTO season_water_pattern_analysis (
    planting_season_id, pattern_detected, oscillation_count,
    ndwi_points_used, sar_points_used, confidence_note, calculated_at
  ) VALUES (
    p_season_id, v_pattern, v_oscillations, v_ndwi_count, v_sar_count, v_note, now()
  )
  ON CONFLICT (planting_season_id) DO UPDATE SET
    pattern_detected  = EXCLUDED.pattern_detected,
    oscillation_count = EXCLUDED.oscillation_count,
    ndwi_points_used  = EXCLUDED.ndwi_points_used,
    sar_points_used   = EXCLUDED.sar_points_used,
    confidence_note   = EXCLUDED.confidence_note,
    calculated_at     = EXCLUDED.calculated_at
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_analyze_season_water_pattern(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_analyze_season_water_pattern(uuid) TO service_role;

-- ============ 4. TRIGGER — otomatis saat actual_harvest_date diisi ============
CREATE OR REPLACE FUNCTION trg_analyze_season_on_harvest()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.actual_harvest_date IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.actual_harvest_date IS DISTINCT FROM NEW.actual_harvest_date)
  THEN
    PERFORM fn_analyze_season_water_pattern(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_planting_seasons_water_analysis ON planting_seasons;
CREATE TRIGGER trg_planting_seasons_water_analysis
  AFTER INSERT OR UPDATE ON planting_seasons
  FOR EACH ROW
  EXECUTE FUNCTION trg_analyze_season_on_harvest();

-- ============ VERIFIKASI (jalankan setelah selesai) ============
-- Harus TIDAK muncul baris apapun (RLS aktif untuk tabel baru ini)
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false AND tablename = 'season_water_pattern_analysis';

-- Harus mengembalikan 2 baris (admin + auditor)
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'season_water_pattern_analysis';

-- Tes manual opsional (ganti <id> dengan id planting_seasons yang valid):
-- SELECT * FROM fn_analyze_season_water_pattern('<id>'::uuid);
