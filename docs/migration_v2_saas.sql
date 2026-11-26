-- ============================================================
-- AgriMRV — Migration v2 (SaaS & Multi-Tenant)
-- Jalankan via Supabase SQL Editor
-- ============================================================

-- 1. Tabel Organisasi (Klien)
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'pending' check (status in ('pending','active','expired','suspended')),
  subscription_expires_at timestamptz,
  max_kawasan_limit integer not null default 5,
  max_area_ha_limit numeric not null default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Update Profil User
-- Tambah role superadmin untuk developer (kita)
alter table user_profiles drop constraint if exists user_profiles_role_check;
alter table user_profiles add constraint user_profiles_role_check check (role in ('superadmin', 'admin', 'auditor', 'pekaseh'));

alter table user_profiles add column if not exists organization_id uuid references organizations(id) on delete set null;

-- 3. Update Kawasan
alter table kawasan add column if not exists organization_id uuid references organizations(id) on delete cascade;

-- 4. RLS Organisasi
alter table organizations enable row level security;

-- Superadmin bisa lihat dan edit semua organisasi
drop policy if exists "superadmin_full_access_org" on organizations;
create policy "superadmin_full_access_org" on organizations for all
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'superadmin'));

-- User biasa hanya bisa lihat organisasinya sendiri
drop policy if exists "user_read_own_org" on organizations;
create policy "user_read_own_org" on organizations for select
  using (id = (select organization_id from user_profiles where id = auth.uid()));

-- Update RLS Kawasan agar user (admin/pekaseh) hanya melihat kawasan organisasinya
drop policy if exists "user_read_own_kawasan" on kawasan;
create policy "user_read_own_kawasan" on kawasan for select
  using (
    organization_id = (select organization_id from user_profiles where id = auth.uid()) 
    or exists (select 1 from user_profiles where id = auth.uid() and role = 'superadmin')
  );

drop policy if exists "admin_insert_own_kawasan" on kawasan;
create policy "admin_insert_own_kawasan" on kawasan for insert
  with check (
    organization_id = (select organization_id from user_profiles where id = auth.uid() and role = 'admin')
    or exists (select 1 from user_profiles where id = auth.uid() and role = 'superadmin')
  );

-- (Catatan: Kebijakan RLS lama yang global admin_full_access_kawasan harus disesuaikan nantinya jika butuh penguncian ketat)
