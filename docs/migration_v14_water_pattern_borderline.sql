-- ============================================================
-- AgriMRV — Migration v14: Kategori ketiga borderline_ambiguous
-- untuk deteksi pola pengairan
-- Nama query SQL Editor: 14_water_pattern_borderline_category
-- ============================================================
-- Konteks (08 Juli 2026): setelah fix hysteresis (v13), 2 musim resmi
-- Wayan Suparta yang sudah dianalisis (Musim 2/2025: 3 transisi,
-- Musim 1/2026: 4 transisi) sama-sama tipis di atas ambang minimal 2
-- untuk 'oscillating_awd_like'. User menilai ini tidak cukup tegas
-- untuk disimpulkan sebagai AWD jelas — perlu kategori tengah yang
-- eksplisit menandai "sinyal campuran, butuh konfirmasi lapangan",
-- bukan dipaksa masuk salah satu dari 2 kategori ekstrem.
--
-- Skema baru (3 kategori dari sebelumnya 2):
--   0-1 transisi  → continuous_flooding
--   2-4 transisi  → borderline_ambiguous  (BARU)
--   >=5 transisi  → oscillating_awd_like
--
-- PENTING: ambang "5" adalah keputusan penalaran domain (siklus AWD
-- ketat ~5-10 harian dalam musim 90-130 hari idealnya menghasilkan
-- ~9-13 alternasi; angka 5 dipilih sebagai titik tengah yang jelas
-- lebih tinggi dari sekadar "1 siklus penuh terbukti" tapi masih
-- realistis untuk sampling 6-15 harian) — BUKAN hasil kalkulasi
-- statistik, karena sampel valid baru n=2 musim. Wajib dikalibrasi
-- ulang kalau sampel bertambah (lihat BRIEF_AgriMRV.md).
--
-- Signature fungsi tidak berubah → CREATE OR REPLACE aman.
-- CHECK constraint pattern_detected perlu diperbarui (nilai baru).
--
-- Aman dijalankan ulang (idempotent).
-- ============================================================

-- ============ 1. Update CHECK constraint (cari nama constraint
-- otomatis, jangan asumsikan nama persis — lebih aman) ============
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'season_water_pattern_analysis'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%pattern_detected%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE season_water_pattern_analysis DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE season_water_pattern_analysis
  ADD CONSTRAINT season_water_pattern_analysis_pattern_detected_check
  CHECK (pattern_detected IN ('oscillating_awd_like', 'continuous_flooding', 'borderline_ambiguous', 'insufficient_data'));

-- ============ 2. Update fungsi — logic klasifikasi 3 kategori ============
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
  v_confirmed_state text := NULL;
  v_candidate_state text := NULL;
  v_candidate_run   int := 0;
  v_oscillations    int := 0;
  v_pattern         text;
  v_note            text;
  v_result          season_water_pattern_analysis;
  rec               RECORD;
  v_raw_state       text;
BEGIN
  SELECT plot_id, planting_date, COALESCE(actual_harvest_date, CURRENT_DATE)
    INTO v_plot_id, v_start, v_end
    FROM planting_seasons
    WHERE id = p_season_id;

  IF v_plot_id IS NULL THEN
    RAISE EXCEPTION 'planting_season % tidak ditemukan', p_season_id;
  END IF;

  FOR rec IN
    SELECT scan_date, ndwi_score, sar_flood_index
    FROM satellite_logs
    WHERE plot_id = v_plot_id
      AND scan_date BETWEEN v_start AND v_end
      AND (ndwi_score IS NOT NULL OR sar_flood_index IS NOT NULL)
    ORDER BY scan_date ASC
  LOOP
    v_total_points := v_total_points + 1;
    v_raw_state := NULL;

    IF rec.sar_flood_index IS NOT NULL THEN
      v_sar_count := v_sar_count + 1;
      IF rec.sar_flood_index >= 0.28 THEN
        v_raw_state := 'basah';
      ELSIF rec.sar_flood_index <= 0.22 THEN
        v_raw_state := 'kering';
      END IF; -- 0.22-0.28: zona mati, v_raw_state tetap NULL
    ELSE
      v_ndwi_count := v_ndwi_count + 1;
      v_raw_state := CASE WHEN rec.ndwi_score < -0.1 THEN 'kering' ELSE 'basah' END;
    END IF;

    IF v_raw_state IS NULL THEN
      CONTINUE;
    END IF;

    IF v_confirmed_state IS NULL THEN
      v_confirmed_state := v_raw_state;
      CONTINUE;
    END IF;

    IF v_raw_state = v_confirmed_state THEN
      v_candidate_state := NULL;
      v_candidate_run := 0;
    ELSE
      IF v_candidate_state = v_raw_state THEN
        v_candidate_run := v_candidate_run + 1;
      ELSE
        v_candidate_state := v_raw_state;
        v_candidate_run := 1;
      END IF;

      IF v_candidate_run >= 2 THEN
        v_oscillations := v_oscillations + 1;
        v_confirmed_state := v_candidate_state;
        v_candidate_state := NULL;
        v_candidate_run := 0;
      END IF;
    END IF;
  END LOOP;

  -- Klasifikasi 3 kategori (v14) — lihat catatan ambang "5" di header migration
  IF v_total_points < 5 THEN
    v_pattern := 'insufficient_data';
  ELSIF v_oscillations >= 5 THEN
    v_pattern := 'oscillating_awd_like';
  ELSIF v_oscillations >= 2 THEN
    v_pattern := 'borderline_ambiguous';
  ELSE
    v_pattern := 'continuous_flooding';
  END IF;

  v_note := format(
    '%s titik NDWI + %s titik SAR (total %s baris, minimum 5 dibutuhkan). SAR pakai hysteresis: >=0.28 basah, <=0.22 kering, 0.22-0.28 diabaikan (dead-band). NDWI < -0.1 = kering (tanpa dead-band). Transisi hanya valid kalau status baru bertahan >=2 titik keputusan berturut-turut. Klasifikasi: 0-1 transisi=continuous_flooding, 2-4=borderline_ambiguous, >=5=oscillating_awd_like. %s transisi tervalidasi terdeteksi dalam rentang %s s/d %s.',
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

-- ============ VERIFIKASI ============
-- Harus menampilkan constraint baru dengan 4 nilai
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'season_water_pattern_analysis'::regclass AND contype = 'c';
