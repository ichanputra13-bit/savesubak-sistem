-- ============================================================
-- AgriMRV — Migration v2: Storage Buckets
-- Nama query di SQL Editor: 02_storage_buckets_and_policies
-- Jalankan via Supabase SQL Editor setelah migration_v1.sql selesai
-- ============================================================


-- ============ 1. BUAT BUCKET (private) ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'satellite-imagery',
    'satellite-imagery',
    false,
    52428800,   -- 50 MB per file (citra satelit bisa besar)
    array['image/jpeg', 'image/png', 'image/tiff']
  ),
  (
    'field-photos',
    'field-photos',
    false,
    10485760,   -- 10 MB per file (foto dari HP petani)
    array['image/jpeg', 'image/png', 'image/heic']
  )
on conflict (id) do nothing;


-- ============ 2. RLS STORAGE — Admin (full access) ============
drop policy if exists "admin_all_satellite_imagery" on storage.objects;
create policy "admin_all_satellite_imagery"
  on storage.objects for all
  using (
    bucket_id = 'satellite-imagery'
    and exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    bucket_id = 'satellite-imagery'
    and exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "admin_all_field_photos" on storage.objects;
create policy "admin_all_field_photos"
  on storage.objects for all
  using (
    bucket_id = 'field-photos'
    and exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    bucket_id = 'field-photos'
    and exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );


-- ============ 3. RLS STORAGE — Pekaseh (upload field-photos saja) ============
drop policy if exists "pekaseh_upload_field_photos" on storage.objects;
create policy "pekaseh_upload_field_photos"
  on storage.objects for insert
  with check (
    bucket_id = 'field-photos'
    and exists (select 1 from user_profiles where id = auth.uid() and role = 'pekaseh')
  );


-- ============ 4. RLS STORAGE — Auditor (read kedua bucket) ============
-- Catatan: read via signed URL tidak butuh policy (signed URL bypass RLS).
-- Policy ini untuk akses langsung jika diperlukan di masa depan.
drop policy if exists "auditor_read_satellite_imagery" on storage.objects;
create policy "auditor_read_satellite_imagery"
  on storage.objects for select
  using (
    bucket_id = 'satellite-imagery'
    and exists (select 1 from user_profiles where id = auth.uid() and role = 'auditor')
  );

drop policy if exists "auditor_read_field_photos" on storage.objects;
create policy "auditor_read_field_photos"
  on storage.objects for select
  using (
    bucket_id = 'field-photos'
    and exists (select 1 from user_profiles where id = auth.uid() and role = 'auditor')
  );


-- ============ VERIFIKASI ============
select id, name, public from storage.buckets where id in ('satellite-imagery', 'field-photos');
