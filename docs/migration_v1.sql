-- ============================================================
-- AgriMRV — Migration v1
-- Jalankan via Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fxuexjlvmbswnddwlbey/sql/new
--
-- Urutan: Extensions → Tables → Indexes → RLS
-- Aman dijalankan ulang (semua pakai IF NOT EXISTS / DROP POLICY IF EXISTS)
-- ============================================================


-- ============ 1. EXTENSIONS ============
create extension if not exists postgis;


-- ============ 2. TABLES ============

create table if not exists user_profiles (
  id uuid primary key references auth.users(id),
  full_name text not null,
  role text not null check (role in ('admin','auditor','pekaseh')),
  phone text,
  telegram_id text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists kawasan (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  local_term text not null default 'Kawasan',
  region text,
  boundary geometry(Polygon, 4326),
  total_area_ha numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists plots (
  id uuid primary key default gen_random_uuid(),
  kawasan_id uuid not null references kawasan(id) on delete cascade,
  farmer_name text not null,
  crop_variety text,
  area_ha numeric not null,
  geo_data geometry(Polygon, 4326) not null,
  is_organic_certified boolean default false,
  scan_interval_days integer not null default 10,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- satellite_logs sudah termasuk kolom SAR (§3.9)
create table if not exists satellite_logs (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references plots(id) on delete cascade,
  scan_date date not null,
  cloud_cover_percent numeric,
  ndvi_score numeric,
  ndwi_score numeric,
  estimated_phase text check (estimated_phase in ('semai','vegetatif','generatif','pematangan','kosong')),
  true_color_path text,
  ndvi_heatmap_path text,
  ndwi_heatmap_path text,
  sar_flood_index numeric,
  sar_source text default 'sentinel-1',
  created_at timestamptz default now(),
  unique(plot_id, scan_date)
);

-- mrv_carbon_records sudah pakai formula NET CH4-N2O v1.1 (§3.8)
create table if not exists mrv_carbon_records (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references plots(id) on delete cascade,
  season_start_date date not null,
  season_end_date date,
  baseline_ch4_kg numeric,
  dry_ratio numeric,
  prevented_ch4_kg numeric,
  baseline_n2o_kg numeric,
  additional_n2o_kg numeric,
  co2e_kg numeric,
  methodology_ref text default 'internal-illustrative',
  status text not null default 'draft' check (status in ('draft','verified','retired')),
  verified_by uuid references user_profiles(id),
  verified_at timestamptz,
  is_registered_for_trading boolean default false,
  methodology_note text default 'Formula ilustratif — belum bersertifikasi resmi. CO2e dihitung NET setelah memperhitungkan kenaikan N2O akibat AWD.',
  created_at timestamptz default now()
);

-- mrv_methodology_analysis: analisis multi-metodologi (§3.8B)
create table if not exists mrv_methodology_analysis (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references plots(id) on delete cascade,
  season_start_date date not null,
  season_end_date date,
  methodology_name text not null,
  co2e_kg numeric not null,
  calculation_detail jsonb,
  notes text,
  created_at timestamptz default now(),
  unique(plot_id, season_start_date, methodology_name)
);

create table if not exists field_logs (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references plots(id) on delete cascade,
  log_type text not null check (log_type in ('photo','harvest_actual','anomaly_note')),
  log_date date not null,
  photo_path text,
  harvest_kg numeric,
  note text,
  source text not null default 'web' check (source in ('web','telegram')),
  telegram_message_id text,
  created_by uuid references user_profiles(id),
  created_at timestamptz default now()
);


-- ============ 3. INDEXES ============
create index if not exists idx_plots_kawasan on plots(kawasan_id);
create index if not exists idx_satlogs_plot_date on satellite_logs(plot_id, scan_date desc);
create index if not exists idx_plots_geo on plots using gist(geo_data);
create index if not exists idx_kawasan_boundary on kawasan using gist(boundary);


-- ============ 4. RLS ENABLE ============
alter table kawasan enable row level security;
alter table plots enable row level security;
alter table satellite_logs enable row level security;
alter table mrv_carbon_records enable row level security;
alter table mrv_methodology_analysis enable row level security;
alter table field_logs enable row level security;


-- ============ 5. RLS POLICIES — Admin (full access) ============
drop policy if exists "admin_full_access_kawasan" on kawasan;
create policy "admin_full_access_kawasan" on kawasan for all
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "admin_full_access_plots" on plots;
create policy "admin_full_access_plots" on plots for all
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "admin_full_access_satlogs" on satellite_logs;
create policy "admin_full_access_satlogs" on satellite_logs for all
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "admin_full_access_carbon" on mrv_carbon_records;
create policy "admin_full_access_carbon" on mrv_carbon_records for all
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "admin_full_access_methodology" on mrv_methodology_analysis;
create policy "admin_full_access_methodology" on mrv_methodology_analysis for all
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "admin_full_access_fieldlogs" on field_logs;
create policy "admin_full_access_fieldlogs" on field_logs for all
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));


-- ============ 6. RLS POLICIES — Auditor (read-only + verify carbon) ============
drop policy if exists "auditor_read_kawasan" on kawasan;
create policy "auditor_read_kawasan" on kawasan for select
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'auditor'));

drop policy if exists "auditor_read_plots" on plots;
create policy "auditor_read_plots" on plots for select
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'auditor'));

drop policy if exists "auditor_read_satlogs" on satellite_logs;
create policy "auditor_read_satlogs" on satellite_logs for select
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'auditor'));

drop policy if exists "auditor_read_carbon" on mrv_carbon_records;
create policy "auditor_read_carbon" on mrv_carbon_records for select
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'auditor'));

drop policy if exists "auditor_verify_carbon" on mrv_carbon_records;
create policy "auditor_verify_carbon" on mrv_carbon_records for update
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'auditor'));


-- ============ 7. RLS POLICIES — Pekaseh ============
drop policy if exists "pekaseh_insert_fieldlog" on field_logs;
create policy "pekaseh_insert_fieldlog" on field_logs for insert
  with check (exists (select 1 from user_profiles where id = auth.uid() and role = 'pekaseh'));

drop policy if exists "pekaseh_read_own_fieldlog" on field_logs;
create policy "pekaseh_read_own_fieldlog" on field_logs for select
  using (created_by = auth.uid());


-- ============ VERIFIKASI (jalankan setelah selesai) ============
-- Harusnya muncul 7 tabel: user_profiles, kawasan, plots, satellite_logs,
-- mrv_carbon_records, mrv_methodology_analysis, field_logs
select tablename from pg_tables where schemaname = 'public' order by tablename;
