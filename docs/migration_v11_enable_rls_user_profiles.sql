-- ============================================================
-- AgriMRV — Migration v11: FIX KEAMANAN — Enable RLS di user_profiles
--   + lengkapi policy plot_ownership_history (RLS aktif sejak v9,
--     tapi belum pernah punya policy sama sekali)
-- Nama query SQL Editor: 11_enable_rls_user_profiles
-- ============================================================
-- Konteks: Supabase mengirim email peringatan "Table publicly
-- accessible" untuk project ini. Audit migration_v1.sql
-- mengkonfirmasi root cause: tabel `user_profiles` DIBUAT di v1
-- tapi TIDAK PERNAH masuk daftar `alter table ... enable row level
-- security` (baris 127-132 migration_v1.sql hanya mencakup 6 dari
-- 7 tabel — user_profiles terlewat). Semua tabel LAIN (kawasan,
-- plots, satellite_logs, mrv_carbon_records,
-- mrv_methodology_analysis, field_logs, planting_seasons,
-- plot_ownership_history) sudah RLS aktif sejak awal.
--
-- Dikonfirmasi user lewat query verifikasi: hasil hanya 2 tabel
-- tanpa RLS — `spatial_ref_sys` (tabel bawaan ekstensi PostGIS,
-- bukan milik kita, false positive standar, SENGAJA TIDAK disentuh)
-- dan `user_profiles` (dikonfirmasi jadi target fix ini).
--
-- Dampak sebelum fix: siapa pun yang tahu URL project + anon key
-- (anon key bersifat publik, dipakai di browser) bisa langsung
-- SELECT * FROM user_profiles via REST API tanpa autentikasi —
-- bocor full_name, role, phone, telegram_id semua user terdaftar.
--
-- Aman dijalankan ulang (idempotent).
-- ============================================================

-- 1. Aktifkan RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Policy: user boleh baca profil sendiri
-- PENTING: policy ini WAJIB ada sebelum/bersamaan dengan policy admin di bawah.
-- Semua policy admin di tabel LAIN (kawasan, plots, dst) mengecek role via
-- "exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')".
-- Subquery itu sendiri tunduk pada RLS user_profiles. Tanpa policy self-read ini,
-- subquery tersebut tidak akan pernah menemukan baris apa pun (deadlock: untuk
-- membuktikan "saya admin" butuh baca baris sendiri, tapi baca baris sendiri
-- butuh sudah terbukti admin) — service_role (dipakai admin client di server)
-- tidak terpengaruh karena bypass RLS, tapi query dari browser (anon/authenticated
-- key) akan macet tanpa policy ini.
DROP POLICY IF EXISTS "self_read_own_profile" ON user_profiles;
CREATE POLICY "self_read_own_profile" ON user_profiles FOR SELECT
  USING (id = auth.uid());

-- 3. Policy: admin full access (pola sama seperti tabel lain)
DROP POLICY IF EXISTS "admin_full_access_user_profiles" ON user_profiles;
CREATE POLICY "admin_full_access_user_profiles" ON user_profiles FOR ALL
  USING (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

-- Catatan: TIDAK ada policy insert/update untuk role 'pekaseh'/'auditor' atas
-- baris user lain, dan TIDAK ada self-update — user tidak boleh mengubah role
-- sendiri lewat client. Provisioning/perubahan role dilakukan admin (service_role,
-- bypass RLS) via dashboard atau endpoint server. Bisa diperluas nanti kalau
-- ada kebutuhan self-service edit profil (nama/telepon) tanpa izinkan ubah role.


-- ============ 4. Lengkapi policy plot_ownership_history ============
-- RLS sudah ENABLE sejak migration_v9, tapi belum pernah ada policy —
-- artinya sejak v9 tabel ini deny-all untuk anon/authenticated (bukan celah
-- keamanan, tapi juga tidak bisa diakses admin/auditor lewat client key,
-- hanya lewat service_role di server). Pola policy disamakan dengan `plots`:
-- admin full access, auditor read-only.
DROP POLICY IF EXISTS "admin_full_access_ownership_history" ON plot_ownership_history;
CREATE POLICY "admin_full_access_ownership_history" ON plot_ownership_history FOR ALL
  USING (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

DROP POLICY IF EXISTS "auditor_read_ownership_history" ON plot_ownership_history;
CREATE POLICY "auditor_read_ownership_history" ON plot_ownership_history FOR SELECT
  USING (exists (select 1 from user_profiles where id = auth.uid() and role = 'auditor'));

-- ============ VERIFIKASI (jalankan setelah selesai) ============
-- Harus mengembalikan hanya 1 baris: spatial_ref_sys (PostGIS bawaan, aman diabaikan)
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;

-- Harus mengembalikan >= 2 baris untuk plot_ownership_history (admin + auditor)
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'plot_ownership_history';
