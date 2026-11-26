-- ============================================================
-- AgriMRV — Migration v17: Kuantifikasi Hari Aerasi & Estimasi CO2e
-- Standar Verra VM0051 AWD Methane Reduction
-- ============================================================

-- 1. Tambahkan kolom ke tabel season_water_pattern_analysis
ALTER TABLE season_water_pattern_analysis ADD COLUMN IF NOT EXISTS total_aeration_days INT DEFAULT 0;
ALTER TABLE season_water_pattern_analysis ADD COLUMN IF NOT EXISTS estimated_co2e_tonnes NUMERIC DEFAULT 0;

-- 2. Update fungsi analisis pola air
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
  
  -- Variabel baru untuk Aeration Days
  v_prev_scan_date  date := NULL;
  v_aeration_days   int := 0;
  v_co2e_tonnes     numeric := 0;
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

    -- Hitung status mentah
    IF rec.sar_flood_index IS NOT NULL THEN
      v_sar_count := v_sar_count + 1;
      IF rec.sar_flood_index >= 0.28 THEN
        v_raw_state := 'basah';
      ELSIF rec.sar_flood_index <= 0.22 THEN
        v_raw_state := 'kering';
      END IF; -- 0.22-0.28: zona mati
    ELSE
      v_ndwi_count := v_ndwi_count + 1;
      v_raw_state := CASE WHEN rec.ndwi_score < -0.1 THEN 'kering' ELSE 'basah' END;
    END IF;

    -- Akumulasi hari aerasi jika lahan SEDANG dalam state 'kering'
    IF v_prev_scan_date IS NOT NULL AND v_confirmed_state = 'kering' THEN
      v_aeration_days := v_aeration_days + (rec.scan_date - v_prev_scan_date);
    END IF;
    
    v_prev_scan_date := rec.scan_date;

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

  -- Klasifikasi pola
  IF v_total_points < 5 THEN
    v_pattern := 'insufficient_data';
  ELSIF v_oscillations >= 5 THEN
    v_pattern := 'oscillating_awd_like';
  ELSIF v_oscillations >= 2 THEN
    v_pattern := 'borderline_ambiguous';
  ELSE
    v_pattern := 'continuous_flooding';
  END IF;
  
  -- Konversi CO2e (Asumsi kasar: 0.85 kg CH4 dicegah per hari kering * GWP 28 / 1000 = ton CO2e)
  v_co2e_tonnes := (v_aeration_days * 0.85 * 28.0) / 1000.0;

  v_note := format(
    '%s titik NDWI + %s titik SAR (total %s baris). Transisi: %s. Total Aerasi: %s Hari. Estimasi CO2e: %s Ton.',
    v_ndwi_count, v_sar_count, v_total_points, v_oscillations, v_aeration_days, ROUND(v_co2e_tonnes, 2)
  );

  INSERT INTO season_water_pattern_analysis (
    planting_season_id, pattern_detected, oscillation_count,
    ndwi_points_used, sar_points_used, confidence_note, calculated_at,
    total_aeration_days, estimated_co2e_tonnes
  ) VALUES (
    p_season_id, v_pattern, v_oscillations, v_ndwi_count, v_sar_count, v_note, now(),
    v_aeration_days, v_co2e_tonnes
  )
  ON CONFLICT (planting_season_id) DO UPDATE SET
    pattern_detected  = EXCLUDED.pattern_detected,
    oscillation_count = EXCLUDED.oscillation_count,
    ndwi_points_used  = EXCLUDED.ndwi_points_used,
    sar_points_used   = EXCLUDED.sar_points_used,
    confidence_note   = EXCLUDED.confidence_note,
    calculated_at     = EXCLUDED.calculated_at,
    total_aeration_days = EXCLUDED.total_aeration_days,
    estimated_co2e_tonnes = EXCLUDED.estimated_co2e_tonnes
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;
