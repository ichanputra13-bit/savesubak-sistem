-- ============================================================
-- AgriMRV — Migration v13: FIX — Hysteresis + minimum persistensi
-- untuk deteksi pola pengairan (season_water_pattern_analysis)
-- Nama query SQL Editor: 13_water_pattern_hysteresis_fix
-- ============================================================
-- Konteks bug (08 Juli 2026): fn_analyze_season_water_pattern versi
-- v12 memakai SATU garis batas tegas (SAR >= 0.25 = basah, NDWI < -0.1
-- = kering) tanpa zona penyangga maupun syarat durasi minimum. Saat
-- diuji ke Musim 1/2026 (Wayan Suparta, plot fba25ed2), hasilnya
-- oscillation_count = 14 dalam ~3 bulan — dicurigai user terlalu
-- sensitif, lalu dibuktikan lewat audit data mentah:
--   (a) 4 dari 14 transisi terjadi pada nilai SAR cuma 0.004-0.04 dari
--       garis 0.25 — jelas fluktuasi/speckle noise SAR harian, bukan
--       perubahan kondisi lahan nyata.
--   (b) 6 dari 14 transisi terjadi TEPAT saat urutan data berpindah
--       dari titik SAR ke titik NDWI (atau sebaliknya) — dua sensor
--       beda threshold/skala disambung jadi satu urutan tanpa
--       rekonsiliasi, rawan menghasilkan "transisi" palsu.
-- Root cause: bukan bug logika (kode sudah sesuai desain awal), tapi
-- desain algoritma yang terlalu naif untuk data time-series remote
-- sensing yang secara inheren noisy di sekitar nilai batas.
--
-- Fix yang diputuskan user (kombinasi 2 dari 3 opsi yang diajukan):
--   1. Hysteresis/dead-band PADA SAR SAJA (NDWI threshold TIDAK
--      diubah, sesuai keputusan eksplisit): >=0.28 = basah,
--      <=0.22 = kering, 0.22-0.28 = zona mati (tidak mengubah status,
--      titik dilewati dari perhitungan transisi).
--   2. Minimum persistensi: status baru baru dihitung sebagai transisi
--      VALID kalau bertahan >= 2 titik keputusan berturut-turut
--      (menyaring lonjakan 1 titik).
--   (Opsi 3 — hitung NDWI & SAR terpisah lalu gabung — DITUNDA,
--    dievaluasi lagi kalau kombinasi 1+2 belum cukup.)
--
-- Signature fungsi TIDAK berubah (masih fn_analyze_season_water_pattern
-- (uuid) RETURNS season_water_pattern_analysis) — CREATE OR REPLACE
-- aman dipakai, tidak perlu DROP FUNCTION dulu (beda kasus dengan
-- migration v8 yang mengubah jumlah parameter).
--
-- Aman dijalankan ulang (idempotent). Trigger & tabel dari v12 TIDAK
-- perlu diubah — trigger cuma memanggil fungsi ini, otomatis pakai
-- versi baru begitu di-replace.
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
  v_ndwi_count      int := 0;
  v_sar_count       int := 0;
  v_total_points    int := 0;
  v_confirmed_state text := NULL;  -- status yang sudah "resmi" diakui
  v_candidate_state text := NULL;  -- status baru yang sedang diuji
  v_candidate_run   int := 0;      -- berapa titik berturut mendukung kandidat
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
      -- Hysteresis: 0.22-0.28 = zona mati, TIDAK memberi sinyal
      -- (v_raw_state tetap NULL, titik ini dilewati di bawah)
      IF rec.sar_flood_index >= 0.28 THEN
        v_raw_state := 'basah';
      ELSIF rec.sar_flood_index <= 0.22 THEN
        v_raw_state := 'kering';
      END IF;
    ELSE
      v_ndwi_count := v_ndwi_count + 1;
      v_raw_state := CASE WHEN rec.ndwi_score < -0.1 THEN 'kering' ELSE 'basah' END;
    END IF;

    IF v_raw_state IS NULL THEN
      CONTINUE; -- titik zona mati SAR — skip total dari logic status/transisi
    END IF;

    IF v_confirmed_state IS NULL THEN
      -- titik keputusan pertama menetapkan status awal — bukan transisi
      v_confirmed_state := v_raw_state;
      CONTINUE;
    END IF;

    IF v_raw_state = v_confirmed_state THEN
      -- konsisten dengan status resmi saat ini — batalkan kandidat yang
      -- mungkin sedang dibangun (lonjakan 1 titik sebelumnya terbukti noise)
      v_candidate_state := NULL;
      v_candidate_run := 0;
    ELSE
      IF v_candidate_state = v_raw_state THEN
        v_candidate_run := v_candidate_run + 1;
      ELSE
        v_candidate_state := v_raw_state;
        v_candidate_run := 1;
      END IF;

      -- Minimum persistensi: transisi baru VALID kalau status baru
      -- bertahan >= 2 titik keputusan berturut-turut
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
  ELSIF v_oscillations >= 2 THEN
    v_pattern := 'oscillating_awd_like';
  ELSE
    v_pattern := 'continuous_flooding';
  END IF;

  v_note := format(
    '%s titik NDWI + %s titik SAR (total %s baris, minimum 5 dibutuhkan). SAR pakai hysteresis: >=0.28 basah, <=0.22 kering, 0.22-0.28 diabaikan (dead-band, tidak dihitung sebagai sinyal). NDWI < -0.1 = kering (tanpa dead-band). Transisi hanya valid kalau status baru bertahan >=2 titik keputusan berturut-turut. %s transisi tervalidasi terdeteksi dalam rentang %s s/d %s.',
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

-- GRANT tidak perlu diulang — signature sama persis dengan v12, grant lama tetap berlaku.

-- ============ VERIFIKASI ============
-- Harus tetap 1 baris (fungsi ini tidak menambah/menghapus objek lain)
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'fn_analyze_season_water_pattern' AND routine_schema = 'public';
