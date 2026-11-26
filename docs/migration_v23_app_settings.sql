-- Migration v23: Tabel app_settings (key/value config sederhana)
--
-- Latar belakang: indikator "Kuota Lahan X/100 Ha" di header aplikasi
-- (components/layout/AppTopbar.tsx) SELAMA INI hardcode statis (angka 45
-- dan 100 literal di kode, tidak pernah berubah mengikuti data apapun) —
-- ditemukan lewat investigasi 27 Juli 2026 (lihat PROJECT_LOG.md), user
-- curiga angka itu palsu dan terbukti benar. Migration ini menyediakan
-- tempat menyimpan ANGKA BATAS MAKSIMAL (bukan angka terpakai — itu
-- dihitung langsung dari SUM(plots.area_ha), tidak perlu disimpan) supaya
-- bisa diubah tanpa deploy ulang kode.
--
-- Tabel ini GENERIK (key text, value text) untuk pengaturan aplikasi kecil
-- lain di masa depan juga, TAPI baris pertama yang dipakai cuma
-- 'max_quota_ha'. Dicek dulu (27 Juli 2026): TIDAK ADA tabel settings
-- serupa yang sudah ada di project ini, jadi ini pola baru, bukan
-- duplikasi dari yang sudah ada.
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Nilai default 'max_quota_ha' = 100 — SENGAJA SAMA dengan angka hardcode
-- lama supaya TIDAK ADA perubahan tampilan mendadak begitu migration ini
-- dijalankan (baru berubah kalau baris ini nanti diedit manual).
insert into app_settings (key, value)
values ('max_quota_ha', '100')
on conflict (key) do nothing;

-- RLS wajib untuk tabel baru (CLAUDE.md §7) — baca PUBLIK (belum ada
-- sistem login/role yang bisa dipakai untuk membatasi siapa boleh lihat
-- angka kuota ini, dan ini bukan data sensitif), TIDAK ADA policy
-- INSERT/UPDATE untuk anon/authenticated — perubahan nilai HANYA lewat
-- service role (SQL Editor manual atau, nanti, endpoint admin khusus).
alter table app_settings enable row level security;

drop policy if exists "app_settings_public_read" on app_settings;
create policy "app_settings_public_read" on app_settings
  for select
  using (true);

-- ⚠️ CATATAN WAJIB DIBACA UNTUK DEVELOPER BERIKUTNYA (jangan dihapus):
-- app_settings.max_quota_ha SENGAJA 1 baris GLOBAL — berlaku sama untuk
-- SEMUA user/organisasi yang membuka aplikasi, BUKAN per-organisasi.
-- Ini KEPUTUSAN SEMENTARA, bukan desain final — dipakai karena sistem
-- auth multi-role & multi-tenant BELUM SELESAI dibangun. Migration
-- docs/migration_v2_saas.sql SUDAH merancang kolom yang SEHARUSNYA jadi
-- rumah permanen nilai ini: organizations.max_area_ha_limit (default 100,
-- PERSIS sama dengan default di sini) — TAPI tabel organizations itu
-- SENDIRI belum pernah dijalankan ke database sampai migration ini ditulis
-- (dikonfirmasi lewat query langsung, 27 Juli 2026 — lihat PROJECT_LOG.md).
--
-- BEGITU auth multi-role & tabel organizations SIAP dan BENAR-BENAR
-- dijalankan: pindahkan logic kuota dari app_settings.max_quota_ha (1
-- nilai global) ke organizations.max_area_ha_limit (1 nilai PER
-- organisasi), dan hapus baris 'max_quota_ha' dari tabel ini. JANGAN
-- membangun fitur baru di atas app_settings.max_quota_ha yang
-- mengasumsikan nilainya akan tetap global selamanya.

-- Verifikasi RLS benar-benar aktif untuk tabel baru ini (bukan asumsi,
-- CLAUDE.md §7)
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'app_settings';
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'app_settings';

-- Verifikasi baris default tersimpan
SELECT key, value FROM app_settings WHERE key = 'max_quota_ha';
