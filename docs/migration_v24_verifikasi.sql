-- ============================================================
-- AgriMRV — Verifikasi migration v24 (fix rekursi RLS user_profiles)
-- Nama query SQL Editor: 24b_verifikasi_rls_recursion
-- Jalankan SETELAH 24_fix_rls_recursion_is_admin sukses.
-- ============================================================
-- Per 23 Okt 2026 auth.users DAN user_profiles masih KOSONG (0 baris,
-- dicek read-only), jadi tidak ada user sungguhan untuk dites. Skrip ini
-- membuat 4 user UJI sementara (admin, auditor, 2 pekaseh) di dalam
-- sub-transaksi yang SELALU DIBATALKAN di akhir — tidak ada data yang
-- tertinggal, termasuk kalau tes gagal di tengah jalan.
--
-- Tiap role disimulasikan dengan SET LOCAL ROLE + request.jwt.claims (cara
-- yang sama dengan PostgREST saat request dari browser), lalu RESET ROLE.
-- Tidak pakai BEGIN/ROLLBACK di luar karena SQL Editor hanya menampilkan
-- hasil statement terakhir.
--
-- Cara baca hasil:
--   - Kalau ada tes GAGAL → query BERHENTI dengan ERROR "VERIFIKASI GAGAL: ..."
--     (rekursi juga akan muncul sebagai ERROR 42P17 di sini).
--   - Kalau semua LULUS → tabel hasil terakhir menampilkan 8 baris "LULUS".
-- ============================================================

DROP TABLE IF EXISTS _v24_hasil;
CREATE TEMP TABLE _v24_hasil (no int, tes text, hasil text);

DO $$
DECLARE
  v_admin    uuid := gen_random_uuid();
  v_auditor  uuid := gen_random_uuid();
  v_pekaseh  uuid := gen_random_uuid();
  v_pekaseh2 uuid := gen_random_uuid();
  n_total    int;
  n_kawasan  int;
  n          int;
  n_lain     int;
  b          boolean;
  r          text[] := '{}';
BEGIN
  BEGIN  -- sub-transaksi: semua isi di bawah DIBATALKAN di akhir
    INSERT INTO auth.users (id, email) VALUES
      (v_admin,    'v24-admin@uji.invalid'),
      (v_auditor,  'v24-auditor@uji.invalid'),
      (v_pekaseh,  'v24-pekaseh@uji.invalid'),
      (v_pekaseh2, 'v24-pekaseh2@uji.invalid');
    -- ON CONFLICT: kalau ada trigger auth.users yang otomatis membuat profil
    INSERT INTO public.user_profiles (id, full_name, role) VALUES
      (v_admin,    'UJI v24 admin',    'admin'),
      (v_auditor,  'UJI v24 auditor',  'auditor'),
      (v_pekaseh,  'UJI v24 pekaseh',  'pekaseh'),
      (v_pekaseh2, 'UJI v24 pekaseh2', 'pekaseh')
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

    -- Angka pembanding sebagai role SQL Editor (pemilik tabel, bypass RLS)
    SELECT count(*) INTO n_total   FROM public.user_profiles;
    SELECT count(*) INTO n_kawasan FROM public.kawasan;

    -- ---------- (a) ADMIN ----------
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.user_profiles;
    SELECT count(*) INTO n_lain FROM public.kawasan;
    SELECT public.is_admin() INTO b;
    EXECUTE 'RESET ROLE';
    IF n <> n_total OR n_lain <> n_kawasan OR NOT b THEN
      RAISE EXCEPTION 'VERIFIKASI GAGAL (a): admin lihat %/% profil, %/% kawasan, is_admin=%', n, n_total, n_lain, n_kawasan, b;
    END IF;
    r := r || format('LULUS — %s/%s profil, %s/%s kawasan, is_admin()=true, tanpa error', n, n_total, n_lain, n_kawasan);

    -- ---------- (b) ANON ----------
    PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    EXECUTE 'SET LOCAL ROLE anon';
    SELECT count(*) INTO n FROM public.user_profiles;
    SELECT count(*) INTO n_lain FROM public.kawasan;
    SELECT public.is_admin() INTO b;
    EXECUTE 'RESET ROLE';
    IF n <> 0 OR n_lain <> 0 OR b THEN
      RAISE EXCEPTION 'VERIFIKASI GAGAL (b): anon lihat % profil, % kawasan, is_admin=%', n, n_lain, b;
    END IF;
    r := r || 'LULUS — 0 profil, 0 kawasan, is_admin()=false, tanpa error'::text;

    -- ---------- (c) PEKASEH: hanya profil sendiri ----------
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_pekaseh, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.user_profiles;
    SELECT count(*) INTO n_lain FROM public.user_profiles WHERE id <> v_pekaseh;
    SELECT public.is_admin() INTO b;
    EXECUTE 'RESET ROLE';
    IF n <> 1 OR n_lain <> 0 OR b THEN
      RAISE EXCEPTION 'VERIFIKASI GAGAL (c): pekaseh lihat % profil (% milik orang lain), is_admin=%', n, n_lain, b;
    END IF;
    r := r || 'LULUS — 1 profil (miliknya), 0 milik orang lain, is_admin()=false'::text;

    -- ---------- (c2) PEKASEH: tidak bisa baca kawasan (sama seperti sebelum v24) ----------
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.kawasan;
    EXECUTE 'RESET ROLE';
    IF n <> 0 THEN
      RAISE EXCEPTION 'VERIFIKASI GAGAL (c2): pekaseh bisa baca % kawasan', n;
    END IF;
    r := r || 'LULUS — 0 kawasan (tidak ada policy baca kawasan untuk pekaseh)'::text;

    -- ---------- (d) AUDITOR: baca kawasan, hanya profil sendiri ----------
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auditor, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.kawasan;
    SELECT count(*) INTO n_lain FROM public.user_profiles;
    EXECUTE 'RESET ROLE';
    IF n <> n_kawasan OR n_lain <> 1 THEN
      RAISE EXCEPTION 'VERIFIKASI GAGAL (d): auditor lihat %/% kawasan, % profil', n, n_kawasan, n_lain;
    END IF;
    r := r || format('LULUS — %s/%s kawasan, 1 profil (miliknya)', n, n_kawasan);

    RAISE EXCEPTION USING MESSAGE = '__v24_batalkan_data_uji__';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> '__v24_batalkan_data_uji__' THEN RAISE; END IF;
  END;

  INSERT INTO _v24_hasil VALUES
    (1, '(a) admin: SELECT user_profiles & kawasan',  r[1]),
    (2, '(b) anon: tidak bisa membaca',               r[2]),
    (3, '(c) pekaseh: hanya profil sendiri',          r[3]),
    (4, '(c2) pekaseh: SELECT kawasan',               r[4]),
    (5, '(d) auditor: SELECT kawasan & profil',       r[5]);
END $$;

-- ---------- (e) data uji benar-benar terhapus ----------
INSERT INTO _v24_hasil
SELECT 6, '(e) data uji tidak tertinggal',
       CASE WHEN count(*) = 0 THEN 'LULUS — 0 user uji tersisa' ELSE 'GAGAL — ' || count(*) || ' user uji tersisa' END
FROM auth.users WHERE email LIKE 'v24-%@uji.invalid';

-- ---------- (f) RLS aktif di semua tabel aplikasi ----------
INSERT INTO _v24_hasil
SELECT 7, '(f) tabel public tanpa RLS (selain spatial_ref_sys)',
       CASE WHEN count(*) = 0 THEN 'LULUS — tidak ada' ELSE 'GAGAL — ' || string_agg(tablename, ', ') END
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false AND tablename <> 'spatial_ref_sys';

-- ---------- (g) tidak ada policy yang masih subquery langsung ke user_profiles ----------
INSERT INTO _v24_hasil
SELECT 8, '(g) policy masih subquery ke user_profiles',
       CASE WHEN count(*) = 0 THEN 'LULUS — tidak ada'
            ELSE 'PERIKSA — ' || string_agg(schemaname || '.' || tablename || ':' || policyname, ', ') END
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
  AND (qual ILIKE '%user_profiles%' OR with_check ILIKE '%user_profiles%');

SELECT no, tes, hasil FROM _v24_hasil ORDER BY no;
