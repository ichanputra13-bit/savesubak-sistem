-- ============================================================
-- AgriMRV/Sinagri — Migration v19: FIX — Formula CO2e kembali ke
-- NET CH4-N2O (regresi dari migration v18 diperbaiki)
-- Nama query SQL Editor: 19_co2e_net_ch4_n2o_fix
-- ============================================================
-- Konteks (18 Juli 2026, ditemukan Claude Code saat audit formula
-- prioritas user): migration v18 ("PERBAIKAN RUMUS CO2e") JUSTRU MUNDUR
-- dari keputusan yang sudah disepakati di BRIEF_AgriMRV.md (v1.1,
-- 03 Juli 2026):
--   1. v18 cuma menghitung CH4 yang tercegah, TANPA mengurangi kenaikan
--      N2O — padahal BRIEF v1.1 eksplisit menyebut ini "berisiko
--      overstate klaim CO2e" dan itu justru syarat wajib Verra VM0051
--      (metodologi yang v18 klaim jadi acuan perbaikannya).
--   2. v18 pakai GWP CH4 = 28 (IPCC AR5) padahal seluruh dokumen project
--      lain sudah sepakat GWP = 27 (IPCC AR6) — dua standar beda dipakai
--      campur di codebase yang sama.
--
-- SUMBER ANGKA (semua dicantumkan supaya bisa dirujuk saat presentasi):
--  - Baseline EF CH4 lahan tergenang terus-menerus, Asia Tenggara:
--    1.22 kg CH4/ha/hari — IPCC 2019 Refinement to 2006 IPCC Guidelines
--    for National GHG Inventories, Volume 4 Chapter 5 (Cropland),
--    default Tier 1 regional Asia Tenggara.
--    (Catatan: angka "1.2" yang sudah ada di v18 SANGAT DEKAT ke angka
--    resmi ini — kemungkinan besar sumbernya sama, cuma sebelumnya
--    tidak dicantumkan rujukannya dan dipakai tanpa netting N2O.)
--  - GWP100 CH4 = 27, GWP100 N2O = 273 — IPCC AR6 (2021), konsisten
--    dengan seluruh formula karbon lain di project ini.
--  - Rasio net-to-gross GWP untuk AWD (faktor koreksi N2O): meta-analysis
--    lintas iklim & tipe tanah melaporkan reduksi CH4 gross ~64.5%
--    tapi reduksi GWP NET (CH4 turun dikurangi N2O naik) cuma ~42.1%.
--    Dipakai sebagai faktor diskon 42.1/64.5 ≈ 0.653 terhadap estimasi
--    CH4 gross, untuk mendekati efek NET tanpa perlu baseline N2O
--    terpisah per plot (belum ada kolom terukur untuk itu di skema
--    saat ini — beda dengan mrv_carbon_records yang punya field
--    baseline_n2o_kg/additional_n2o_kg eksplisit).
--    Sumber: meta-analysis AWD irrigation effects on CH4 & N2O
--    emissions across climates/soil types (dicari & dikonfirmasi
--    18 Juli 2026 — lihat update_owner.html section Rumus untuk
--    detail sitasi lengkap).
--
-- CATATAN PENTING: ini TETAP formula ILUSTRATIF (bukan hasil
-- pengukuran lapangan langsung / LCA bersertifikasi), sama seperti
-- seluruh angka karbon lain di project ini sejak awal. Faktor diskon
-- 0.653 adalah pendekatan generik lintas-region, BUKAN kalibrasi
-- spesifik untuk kondisi tanah/iklim Bali — wajib direview qualified
-- GHG accountant sebelum dipakai untuk klaim resmi/audit Verra
-- sungguhan.
--
-- DAMPAK KE DATA LAMA: baris `season_water_pattern_analysis` yang
-- sudah pernah dihitung pakai formula v18 (buggy) punya
-- `estimated_co2e_tonnes` yang SALAH (overstated, tanpa netting N2O,
-- GWP salah generasi) — perlu di-recalculate ulang (tombol "Analisis
-- Ulang Pola" di UI, atau panggil fn_analyze_season_water_pattern
-- manual per season_id) supaya angka lama tidak dipakai lagi.
--
-- Signature fungsi TIDAK berubah — CREATE OR REPLACE aman dipakai.
-- Aman dijalankan ulang (idempotent).
-- ============================================================

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

  -- Konstanta bersumber (lihat header migration untuk sitasi lengkap)
  c_ef_ch4_baseline CONSTANT numeric := 1.22;   -- kg CH4/ha/hari, IPCC 2019 Refinement, Asia Tenggara
  c_gwp_ch4         CONSTANT numeric := 27.0;   -- GWP100, IPCC AR6
  c_net_to_gross    CONSTANT numeric := 0.653;  -- faktor diskon N2O, meta-analysis AWD (42.1% net / 64.5% gross)
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
      END IF; -- 0.22-0.28: zona mati (belum diverifikasi ke kondisi lapangan riil — lihat update_owner.html)
    ELSE
      v_ndwi_count := v_ndwi_count + 1;
      v_raw_state := CASE WHEN rec.ndwi_score < -0.1 THEN 'kering' ELSE 'basah' END;
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

  -- =========================================================================
  -- FORMULA CO2e v19 — NET CH4-N2O (fix regresi v18, lihat header migration)
  -- =========================================================================
  v_ch4_gross_kg := v_aeration_days * c_ef_ch4_baseline * v_area_ha;
  v_co2e_tonnes  := (v_ch4_gross_kg * c_gwp_ch4 * c_net_to_gross) / 1000.0;

  v_note := format(
    '%s titik NDWI + %s titik SAR (total %s baris). Transisi: %s. Total Aerasi: %s Hari. '
    'CH4 gross tercegah: %s kg (EF %s kg/ha/hari x %s ha). Estimasi CO2e NET (setelah faktor koreksi N2O %s): %s Ton. '
    'FORMULA ILUSTRATIF — lihat update_owner.html untuk sitasi lengkap, wajib review qualified GHG accountant sebelum klaim resmi.',
    v_ndwi_count, v_sar_count, v_total_points, v_oscillations, v_aeration_days,
    ROUND(v_ch4_gross_kg, 2), c_ef_ch4_baseline, v_area_ha, c_net_to_gross, ROUND(v_co2e_tonnes, 2)
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

-- GRANT tidak perlu diulang — signature sama persis dengan v18, grant lama tetap berlaku.

-- ============ VERIFIKASI ============
-- Harus tetap 1 baris
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'fn_analyze_season_water_pattern' AND routine_schema = 'public';

-- Cek konstanta ter-embed benar (jalankan manual, harus muncul di source function)
SELECT prosrc LIKE '%1.22%' AS ada_ef_ch4,
       prosrc LIKE '%27.0%' AS ada_gwp_ch4_ar6,
       prosrc LIKE '%0.653%' AS ada_faktor_n2o
FROM pg_proc WHERE proname = 'fn_analyze_season_water_pattern';
