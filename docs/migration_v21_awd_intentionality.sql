-- ============================================================
-- AgriMRV/Sinagri — Migration v21: Bukti Intentionality AWD
-- (curah hujan vs kondisi lahan), rule-based, TANPA AI
-- Nama query SQL Editor: 21_awd_intentionality_evidence
-- ============================================================
-- Konteks (diminta user 18 Juli 2026): jadikan permanen analisis
-- "apakah titik lahan kering hasil deteksi satelit muncul PADAHAL
-- baru hujan lebat?" — kalau ya, itu bukti pengeringan AKTIF
-- (AWD sungguhan), bukan sekadar lahan kering karena memang tidak
-- hujan (kekeringan alami). Awalnya dites manual lewat
-- scripts/check-awd-intentionality.mjs, sekarang dipermanenkan.
--
-- LOGIC (murni IF-ELSE, tidak ada AI/LLM sama sekali — konsisten
-- dengan fn_analyze_season_water_pattern yang sudah ada):
--   UNTUK SETIAP titik satelit berstatus "kering":
--     jumlahkan curah hujan (weather_logs) dalam window 5 hari
--     SEBELUM tanggal scan itu (termasuk hari itu sendiri)
--     KALAU total hujan >= 5mm  → hitung sebagai "kering meski
--       ada hujan" (bukti pengeringan aktif)
--   awd_intentionality_pct = (jumlah titik "kering meski ada hujan")
--                             / (total titik "kering") x 100
--
-- KENAPA AMBANG 5mm dalam 5 hari: dipilih sebagai ambang hujan yang
-- cukup berarti untuk membuat tanah basah kalau dibiarkan alami
-- (bukan gerimis kecil yang menguap tanpa bekas) — ini KEPUTUSAN
-- PENALARAN DOMAIN, bukan hasil kalkulasi statistik (sama seperti
-- ambang oscillation_count=5 di migration v14) — WAJIB dikalibrasi
-- ulang begitu ada lebih banyak sampel/konfirmasi lapangan.
--
-- Hasil disimpan di kolom baru pada season_water_pattern_analysis
-- (BUKAN tabel terpisah) — supaya semua kesimpulan 1 musim tanam
-- tetap dalam 1 baris, konsisten dengan pola yang sudah ada.
-- ============================================================

ALTER TABLE season_water_pattern_analysis
  ADD COLUMN IF NOT EXISTS dry_points_total int,
  ADD COLUMN IF NOT EXISTS dry_points_with_rain int,
  ADD COLUMN IF NOT EXISTS awd_intentionality_pct numeric;

COMMENT ON COLUMN season_water_pattern_analysis.dry_points_total IS 'Jumlah titik scan berstatus kering (NDWI/SAR) dalam musim ini.';
COMMENT ON COLUMN season_water_pattern_analysis.dry_points_with_rain IS 'Dari titik kering di atas, berapa yang tetap kering PADAHAL ada hujan >=5mm dalam 5 hari sebelumnya — bukti pengeringan aktif.';
COMMENT ON COLUMN season_water_pattern_analysis.awd_intentionality_pct IS 'dry_points_with_rain / dry_points_total x 100. Makin tinggi = makin kuat bukti AWD sengaja/aktif, bukan kekeringan alami. Formula ilustratif, bukan sertifikasi resmi.';

CREATE OR REPLACE FUNCTION fn_analyze_season_water_pattern(p_season_id uuid)
RETURNS season_water_pattern_analysis
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_plot_id         uuid;
  v_start           date;
  v_end             date;
  v_area_ha         numeric;
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

  v_prev_scan_date  date := NULL;
  v_aeration_days   int := 0;
  v_co2e_tonnes     numeric := 0;
  v_ch4_gross_kg    numeric := 0;

  -- BARU v21 — bukti intentionality
  v_dry_total       int := 0;
  v_dry_with_rain   int := 0;
  v_rain_window     numeric;
  v_intentionality  numeric;

  c_ef_ch4_baseline CONSTANT numeric := 1.22;
  c_gwp_ch4         CONSTANT numeric := 27.0;
  c_net_to_gross    CONSTANT numeric := 0.653;
  c_rain_threshold  CONSTANT numeric := 5.0;  -- mm, dalam window 5 hari (lihat header migration)
  c_rain_window_days CONSTANT int := 5;
BEGIN
  SELECT plot_id, planting_date, COALESCE(actual_harvest_date, CURRENT_DATE)
    INTO v_plot_id, v_start, v_end
    FROM planting_seasons
    WHERE id = p_season_id;

  IF v_plot_id IS NULL THEN
    RAISE EXCEPTION 'planting_season % tidak ditemukan', p_season_id;
  END IF;

  SELECT area_ha INTO v_area_ha FROM plots WHERE id = v_plot_id;
  IF v_area_ha IS NULL OR v_area_ha <= 0 THEN
    v_area_ha := 1.0;
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
      END IF;
    ELSE
      v_ndwi_count := v_ndwi_count + 1;
      v_raw_state := CASE WHEN rec.ndwi_score < -0.1 THEN 'kering' ELSE 'basah' END;
    END IF;

    -- BARU v21 — cek hujan untuk setiap titik "kering" (raw, sebelum hysteresis,
    -- sama seperti scripts/check-awd-intentionality.mjs yang sudah dites manual)
    IF v_raw_state = 'kering' THEN
      v_dry_total := v_dry_total + 1;
      SELECT COALESCE(SUM(rainfall_mm), 0) INTO v_rain_window
        FROM weather_logs
        WHERE plot_id = v_plot_id
          AND date BETWEEN (rec.scan_date - c_rain_window_days) AND rec.scan_date;
      IF v_rain_window >= c_rain_threshold THEN
        v_dry_with_rain := v_dry_with_rain + 1;
      END IF;
    END IF;

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

  IF v_total_points < 5 THEN
    v_pattern := 'insufficient_data';
  ELSIF v_oscillations >= 5 THEN
    v_pattern := 'oscillating_awd_like';
  ELSIF v_oscillations >= 2 THEN
    v_pattern := 'borderline_ambiguous';
  ELSE
    v_pattern := 'continuous_flooding';
  END IF;

  v_ch4_gross_kg := v_aeration_days * c_ef_ch4_baseline * v_area_ha;
  v_co2e_tonnes  := (v_ch4_gross_kg * c_gwp_ch4 * c_net_to_gross) / 1000.0;

  v_intentionality := CASE WHEN v_dry_total > 0 THEN ROUND((v_dry_with_rain::numeric / v_dry_total) * 100, 1) ELSE NULL END;

  v_note := format(
    '%s titik NDWI + %s titik SAR (total %s baris). Transisi: %s. Total Aerasi: %s Hari. '
    'CH4 gross tercegah: %s kg. Estimasi CO2e NET: %s Ton. '
    'Bukti intentionality AWD: %s dari %s titik kering tetap kering meski ada hujan >=%smm (%s%%). '
    'FORMULA ILUSTRATIF — lihat update_owner.html untuk metodologi lengkap.',
    v_ndwi_count, v_sar_count, v_total_points, v_oscillations, v_aeration_days,
    ROUND(v_ch4_gross_kg, 2), ROUND(v_co2e_tonnes, 2),
    v_dry_with_rain, v_dry_total, c_rain_threshold, COALESCE(v_intentionality::text, 'n/a')
  );

  INSERT INTO season_water_pattern_analysis (
    planting_season_id, pattern_detected, oscillation_count,
    ndwi_points_used, sar_points_used, confidence_note, calculated_at,
    total_aeration_days, estimated_co2e_tonnes,
    dry_points_total, dry_points_with_rain, awd_intentionality_pct
  ) VALUES (
    p_season_id, v_pattern, v_oscillations, v_ndwi_count, v_sar_count, v_note, now(),
    v_aeration_days, v_co2e_tonnes,
    v_dry_total, v_dry_with_rain, v_intentionality
  )
  ON CONFLICT (planting_season_id) DO UPDATE SET
    pattern_detected  = EXCLUDED.pattern_detected,
    oscillation_count = EXCLUDED.oscillation_count,
    ndwi_points_used  = EXCLUDED.ndwi_points_used,
    sar_points_used   = EXCLUDED.sar_points_used,
    confidence_note   = EXCLUDED.confidence_note,
    calculated_at     = EXCLUDED.calculated_at,
    total_aeration_days = EXCLUDED.total_aeration_days,
    estimated_co2e_tonnes = EXCLUDED.estimated_co2e_tonnes,
    dry_points_total = EXCLUDED.dry_points_total,
    dry_points_with_rain = EXCLUDED.dry_points_with_rain,
    awd_intentionality_pct = EXCLUDED.awd_intentionality_pct
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- ============ VERIFIKASI ============
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'fn_analyze_season_water_pattern' AND routine_schema = 'public';

SELECT column_name FROM information_schema.columns
WHERE table_name = 'season_water_pattern_analysis' AND column_name LIKE 'dry_points%' OR column_name = 'awd_intentionality_pct';
