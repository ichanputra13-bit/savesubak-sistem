-- ============================================================
-- AgriMRV — Migration v24: FIX "infinite recursion detected in policy
--   for relation user_profiles" — cek role lewat fungsi SECURITY DEFINER
-- Nama query SQL Editor: 24_fix_rls_recursion_is_admin
-- Verifikasi (jalankan TERPISAH sesudahnya):
--   docs/migration_v24_verifikasi.sql → nama query 24b_verifikasi_rls_recursion
-- ============================================================
-- Akar masalah (dikonfirmasi dari kode, bukan tebakan):
--   migration_v11 baris 49-50 membuat policy PADA tabel user_profiles:
--     CREATE POLICY "admin_full_access_user_profiles" ON user_profiles FOR ALL
--       USING (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));
--   Saat Postgres menerapkan RLS ke user_profiles, subquery di dalam policy
--   itu membaca user_profiles lagi → RLS user_profiles diterapkan lagi →
--   policy yang sama dievaluasi lagi → rekursi (error 42P17).
--   Semua policy di tabel LAIN (v1, v11, v12, v20) juga subquery ke
--   user_profiles, jadi ikut memicu rekursi yang sama → HTTP 500 di 10 dari
--   11 tabel saat diakses lewat anon key (direproduksi 23 Okt 2026). Satu-
--   satunya yang lolos, planting_seasons, memang tidak subquery ke
--   user_profiles (policy v6 hanya TO service_role).
--   Inventaris live (pg_policies, read-only, 23 Okt 2026): tepat 24 policy
--   yang subquery ke user_profiles — 19 di public + 5 di storage.objects —
--   SEMUANYA dicakup file ini. Tidak ada policy di luar file migration.
--
-- Dampak saat ini: belum terasa user, karena seluruh aplikasi (22 file)
-- memakai client service_role (bypass RLS) dan auth.users masih kosong.
-- Akan langsung memblokir semua akses begitu login/akses browser dipakai.
--
-- Perbaikan: cek role lewat fungsi SECURITY DEFINER (berjalan sebagai
-- pemilik tabel = bypass RLS, jadi tidak memicu policy user_profiles lagi).
-- Hasilnya SAMA KETATNYA dengan subquery lama: fungsi hanya melihat baris
-- milik auth.uid() — persis baris yang sebelumnya bisa dibaca lewat policy
-- self_read_own_profile. anon (auth.uid() = NULL) → is_admin() = false,
-- get_my_role() = NULL → semua policy berbasis role tetap tertolak.
-- TIDAK ada cek tambahan (mis. is_active) — semantik dipertahankan 1:1.
--
-- Fungsi dibuat dengan CREATE OR REPLACE (bukan DROP + CREATE): signature
-- tidak berubah (tanpa argumen, tipe return tetap), dan DROP akan GAGAL saat
-- dijalankan ulang karena policy di bawah bergantung pada fungsi ini.
-- Semua policy di-DROP IF EXISTS dulu lalu dibuat ulang (pola v1/v11).
-- Dibungkus BEGIN/COMMIT: kalau ada 1 statement gagal, SEMUA batal — tidak
-- ada keadaan setengah jalan di mana policy lama sudah terhapus.
--
-- Di luar cakupan (sengaja tidak disentuh):
--   - migration_v2_saas (organizations, user_read_own_kawasan,
--     admin_insert_own_kawasan): belum pernah dijalankan (tabel
--     organizations tidak ada di database, dikonfirmasi 31 Juli 2026).
--     Kalau kelak dijalankan, ganti subquery-nya dengan get_my_role() dulu.
--   - planting_seasons: policy v6 TO service_role, tidak menyentuh user_profiles.
--   - pekaseh_read_own_fieldlog: pakai created_by = auth.uid(), tanpa subquery.
--
-- Aman dijalankan ulang (idempotent).
-- ============================================================

BEGIN;

-- ============ 0. FUNGSI HELPER ============
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
$$;

COMMENT ON FUNCTION public.get_my_role() IS 'Role user yang sedang login (NULL untuk anon). SECURITY DEFINER supaya policy RLS tidak rekursif ke user_profiles — migration v24.';
COMMENT ON FUNCTION public.is_admin()    IS 'TRUE jika user yang sedang login ber-role admin. SECURITY DEFINER supaya policy RLS tidak rekursif ke user_profiles — migration v24.';

-- Catatan pemakaian di policy: dibungkus "(SELECT ...)" supaya Postgres
-- mengevaluasinya SEKALI per query (initPlan), bukan sekali per baris.


-- ============ 1. RLS TETAP AKTIF (idempotent, sekadar jaminan) ============
ALTER TABLE user_profiles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE kawasan                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE plots                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE satellite_logs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrv_carbon_records            ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrv_methodology_analysis      ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_logs                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE plot_ownership_history        ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_water_pattern_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_logs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE planting_seasons              ENABLE ROW LEVEL SECURITY;


-- ============ 2. user_profiles (sumber rekursi, dari v11) ============
-- self_read_own_profile DIPERTAHANKAN apa adanya (tidak ada subquery).
DROP POLICY IF EXISTS "self_read_own_profile" ON user_profiles;
CREATE POLICY "self_read_own_profile" ON user_profiles FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "admin_full_access_user_profiles" ON user_profiles;
CREATE POLICY "admin_full_access_user_profiles" ON user_profiles FOR ALL
  USING ((SELECT public.is_admin()));


-- ============ 3. Admin full access (dari v1, v11, v12, v20) ============
DROP POLICY IF EXISTS "admin_full_access_kawasan" ON kawasan;
CREATE POLICY "admin_full_access_kawasan" ON kawasan FOR ALL
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admin_full_access_plots" ON plots;
CREATE POLICY "admin_full_access_plots" ON plots FOR ALL
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admin_full_access_satlogs" ON satellite_logs;
CREATE POLICY "admin_full_access_satlogs" ON satellite_logs FOR ALL
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admin_full_access_carbon" ON mrv_carbon_records;
CREATE POLICY "admin_full_access_carbon" ON mrv_carbon_records FOR ALL
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admin_full_access_methodology" ON mrv_methodology_analysis;
CREATE POLICY "admin_full_access_methodology" ON mrv_methodology_analysis FOR ALL
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admin_full_access_fieldlogs" ON field_logs;
CREATE POLICY "admin_full_access_fieldlogs" ON field_logs FOR ALL
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admin_full_access_ownership_history" ON plot_ownership_history;
CREATE POLICY "admin_full_access_ownership_history" ON plot_ownership_history FOR ALL
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admin_full_access_water_pattern" ON season_water_pattern_analysis;
CREATE POLICY "admin_full_access_water_pattern" ON season_water_pattern_analysis FOR ALL
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admin_full_access_weather" ON weather_logs;
CREATE POLICY "admin_full_access_weather" ON weather_logs FOR ALL
  USING ((SELECT public.is_admin()));


-- ============ 4. Auditor (dari v1, v11, v12, v20) ============
DROP POLICY IF EXISTS "auditor_read_kawasan" ON kawasan;
CREATE POLICY "auditor_read_kawasan" ON kawasan FOR SELECT
  USING ((SELECT public.get_my_role()) = 'auditor');

DROP POLICY IF EXISTS "auditor_read_plots" ON plots;
CREATE POLICY "auditor_read_plots" ON plots FOR SELECT
  USING ((SELECT public.get_my_role()) = 'auditor');

DROP POLICY IF EXISTS "auditor_read_satlogs" ON satellite_logs;
CREATE POLICY "auditor_read_satlogs" ON satellite_logs FOR SELECT
  USING ((SELECT public.get_my_role()) = 'auditor');

DROP POLICY IF EXISTS "auditor_read_carbon" ON mrv_carbon_records;
CREATE POLICY "auditor_read_carbon" ON mrv_carbon_records FOR SELECT
  USING ((SELECT public.get_my_role()) = 'auditor');

DROP POLICY IF EXISTS "auditor_verify_carbon" ON mrv_carbon_records;
CREATE POLICY "auditor_verify_carbon" ON mrv_carbon_records FOR UPDATE
  USING ((SELECT public.get_my_role()) = 'auditor');

DROP POLICY IF EXISTS "auditor_read_ownership_history" ON plot_ownership_history;
CREATE POLICY "auditor_read_ownership_history" ON plot_ownership_history FOR SELECT
  USING ((SELECT public.get_my_role()) = 'auditor');

DROP POLICY IF EXISTS "auditor_read_water_pattern" ON season_water_pattern_analysis;
CREATE POLICY "auditor_read_water_pattern" ON season_water_pattern_analysis FOR SELECT
  USING ((SELECT public.get_my_role()) = 'auditor');

DROP POLICY IF EXISTS "auditor_read_weather" ON weather_logs;
CREATE POLICY "auditor_read_weather" ON weather_logs FOR SELECT
  USING ((SELECT public.get_my_role()) = 'auditor');


-- ============ 5. Pekaseh (dari v1) ============
DROP POLICY IF EXISTS "pekaseh_insert_fieldlog" ON field_logs;
CREATE POLICY "pekaseh_insert_fieldlog" ON field_logs FOR INSERT
  WITH CHECK ((SELECT public.get_my_role()) = 'pekaseh');

-- pekaseh_read_own_fieldlog (created_by = auth.uid()) tidak disentuh — tanpa subquery.


-- ============ 6. Storage policies (dari migration_v2_storage_buckets) ============
-- Hanya DIGANTI kalau policy-nya memang sudah ada di database — tidak
-- menambah akses baru seandainya migration storage belum pernah dijalankan.
-- Kalau role SQL Editor tidak punya hak mengubah storage.objects, blok ini
-- dibatalkan sendiri (NOTICE) tanpa membatalkan bagian 0-5 di atas. Dalam
-- kasus itu storage tetap BERFUNGSI: subquery lamanya ke user_profiles tidak
-- lagi rekursif karena policy user_profiles sendiri (bagian 2) sudah diperbaiki.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'admin_all_satellite_imagery') THEN
    DROP POLICY "admin_all_satellite_imagery" ON storage.objects;
    CREATE POLICY "admin_all_satellite_imagery" ON storage.objects FOR ALL
      USING (bucket_id = 'satellite-imagery' AND (SELECT public.is_admin()))
      WITH CHECK (bucket_id = 'satellite-imagery' AND (SELECT public.is_admin()));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'admin_all_field_photos') THEN
    DROP POLICY "admin_all_field_photos" ON storage.objects;
    CREATE POLICY "admin_all_field_photos" ON storage.objects FOR ALL
      USING (bucket_id = 'field-photos' AND (SELECT public.is_admin()))
      WITH CHECK (bucket_id = 'field-photos' AND (SELECT public.is_admin()));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'pekaseh_upload_field_photos') THEN
    DROP POLICY "pekaseh_upload_field_photos" ON storage.objects;
    CREATE POLICY "pekaseh_upload_field_photos" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'field-photos' AND (SELECT public.get_my_role()) = 'pekaseh');
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'auditor_read_satellite_imagery') THEN
    DROP POLICY "auditor_read_satellite_imagery" ON storage.objects;
    CREATE POLICY "auditor_read_satellite_imagery" ON storage.objects FOR SELECT
      USING (bucket_id = 'satellite-imagery' AND (SELECT public.get_my_role()) = 'auditor');
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'auditor_read_field_photos') THEN
    DROP POLICY "auditor_read_field_photos" ON storage.objects;
    CREATE POLICY "auditor_read_field_photos" ON storage.objects FOR SELECT
      USING (bucket_id = 'field-photos' AND (SELECT public.get_my_role()) = 'auditor');
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Storage policies TIDAK diganti (insufficient_privilege) — bagian lain tetap jalan, storage tetap berfungsi.';
END $$;

COMMIT;


-- ============ VERIFIKASI CEPAT (hasil query terakhir yang tampil) ============
-- Harus 0 baris: tidak ada lagi policy yang subquery langsung ke user_profiles.
-- Kalau ada baris muncul → policy dibuat di luar file migration (mis. lewat
-- dashboard) dan belum tercakup; laporkan nama policy-nya.
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
  AND (qual ILIKE '%user_profiles%' OR with_check ILIKE '%user_profiles%');
