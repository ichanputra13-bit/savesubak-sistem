# TECHNICAL DESIGN — AgriMRV
### Tahap 3: Arsitektur Final (siap dieksekusi Claude Code)

**Versi: v1.2** (sebelumnya v1.1, v1.0)
**Tanggal disusun:** 02 Juli 2026 — **Update terakhir:** 03 Juli 2026
**Perubahan di v1.2:** tabel baru `mrv_methodology_analysis` untuk analisis multi-metodologi (bagian 3.8B) — sistem bisa hitung & bandingkan beberapa metodologi sekaligus, tapi cuma 1 yang ditandai `is_registered_for_trading` untuk didaftarkan resmi
**Perubahan di v1.1:** formula karbon direvisi jadi NET CH4-N2O (bagian 3.8), tambahan Telegram logbook (3.7), tambahan Sentinel-1/radar (3.9)
**Status:** Draft final — siap dipakai sebagai instruksi ke Claude Code
**Rujukan:** PRD_AgriMRV.md (Tahap 1-2), BRIEF.md (dokumen sumber awal)

---

## CATATAN PENTING UNTUK CLAUDE CODE

Dokumen ini adalah kontrak teknis. Ikuti keputusan di sini secara ketat — jangan improvisasi penamaan tabel/kolom/route di luar yang tertulis, karena ini akan dipakai lintas beberapa sesi coding. Kalau ada ambiguitas yang tidak tercakup di sini, tanyakan ke user sebelum melanjutkan, jangan menebak.

**Istilah wajib dipakai konsisten:**
- "Kawasan" = level makro (menggantikan istilah lama "Subak" yang terlalu spesifik Bali)
- "Plot" atau "Petak" = level mikro (1 petak lahan milik 1 petani)
- Jangan hardcode kata "Subak" di manapun di kode/skema — itu cuma salah satu nilai `local_term`, bukan konsep sistem

---

## 3.1 — SKEMA SUPABASE (PostGIS enabled)

```sql
-- Enable extension dulu
create extension if not exists postgis;

-- ============ USER PROFILES ============
create table user_profiles (
  id uuid primary key references auth.users(id),
  full_name text not null,
  role text not null check (role in ('admin','auditor','pekaseh')),
  phone text,
  telegram_id text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============ KAWASAN (level makro, generik) ============
create table kawasan (
  id uuid primary key default gen_random_uuid(),
  name text not null,                    -- contoh: "Subak Sangeh", "Kelompok Tani Sumber Makmur"
  local_term text not null default 'Kawasan',  -- contoh: "Subak", "Kelompok Tani", "Desa"
  region text,                           -- contoh: "Badung, Bali" / "Sragen, Jawa Tengah"
  boundary geometry(Polygon, 4326),      -- batas kawasan, dipakai untuk render outline di peta makro
  total_area_ha numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============ PLOTS (level mikro, per petani) ============
create table plots (
  id uuid primary key default gen_random_uuid(),
  kawasan_id uuid not null references kawasan(id) on delete cascade,
  farmer_name text not null,
  crop_variety text,                     -- contoh: "Mentik Susu", "IR64"
  area_ha numeric not null,
  geo_data geometry(Polygon, 4326) not null,
  is_organic_certified boolean default false,
  scan_interval_days integer not null default 10,  -- konfigurasi per-plot, bukan hardcode 5 hari
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============ SATELLITE LOGS (historis scan) ============
create table satellite_logs (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references plots(id) on delete cascade,
  scan_date date not null,
  cloud_cover_percent numeric,
  ndvi_score numeric,
  ndwi_score numeric,
  estimated_phase text check (estimated_phase in ('semai','vegetatif','generatif','pematangan','kosong')),
  true_color_path text,      -- path di Supabase Storage, bukan URL publik
  ndvi_heatmap_path text,
  ndwi_heatmap_path text,
  created_at timestamptz default now(),
  unique(plot_id, scan_date)   -- cegah duplikat scan di tanggal yang sama
);

-- ============ MRV CARBON RECORDS (buku besar karbon) ============
create table mrv_carbon_records (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references plots(id) on delete cascade,
  season_start_date date not null,
  season_end_date date,
  baseline_ch4_kg numeric,
  dry_ratio numeric,
  prevented_ch4_kg numeric,
  baseline_n2o_kg numeric,
  additional_n2o_kg numeric,
  co2e_kg numeric,               -- NET hasil dari methodology_registered (angka yang akan didaftarkan)
  methodology_ref text default 'internal-illustrative',
  status text not null default 'draft' check (status in ('draft','verified','retired')),
  verified_by uuid references user_profiles(id),
  verified_at timestamptz,
  is_registered_for_trading boolean default false, -- BARU v1.2: TRUE = ini metodologi yang didaftarkan resmi ke registry
  methodology_note text default 'Formula ilustratif — belum bersertifikasi resmi. CO2e dihitung NET setelah memperhitungkan kenaikan N2O akibat AWD.',
  created_at timestamptz default now()
);

-- ============ CARBON ANALYSIS COMPARISON (BARU v1.2) ============
-- Menyimpan hasil hitung dari BEBERAPA metodologi sekaligus untuk 1 musim/plot,
-- sebagai bahan analisis/perbandingan -- BUKAN untuk didaftarkan ke registry manapun.
-- Hanya SATU baris di mrv_carbon_records (di atas) yang boleh ditandai is_registered_for_trading = true,
-- diambil dari salah satu baris di tabel ini setelah dipilih.
create table mrv_methodology_analysis (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references plots(id) on delete cascade,
  season_start_date date not null,
  season_end_date date,
  methodology_name text not null,   -- 'internal-illustrative' / 'VM0051' / 'SRN-PPI-KMSAH' / 'Gold-Standard-Rice'
  co2e_kg numeric not null,
  calculation_detail jsonb,          -- simpan breakdown angka per metodologi (baseline, factor, dll) sebagai referensi
  notes text,
  created_at timestamptz default now(),
  unique(plot_id, season_start_date, methodology_name)  -- 1 metodologi cuma dihitung 1x per musim per plot
);

-- ============ MANUAL FIELD LOGS (foto, panen aktual) ============
create table field_logs (
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

-- Index penting untuk performa query peta & timeline
create index idx_plots_kawasan on plots(kawasan_id);
create index idx_satlogs_plot_date on satellite_logs(plot_id, scan_date desc);
create index idx_plots_geo on plots using gist(geo_data);
create index idx_kawasan_boundary on kawasan using gist(boundary);
```

---

## 3.2 — RLS POLICY PER ROLE

**Prinsip:** admin penuh akses, auditor read-only pada plot yang di-assign, pekaseh cuma bisa insert field_logs untuk plot miliknya sendiri.

```sql
alter table kawasan enable row level security;
alter table plots enable row level security;
alter table satellite_logs enable row level security;
alter table mrv_carbon_records enable row level security;
alter table field_logs enable row level security;

-- Admin: full access semua tabel
create policy "admin_full_access_kawasan" on kawasan for all
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));
create policy "admin_full_access_plots" on plots for all
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));
create policy "admin_full_access_satlogs" on satellite_logs for all
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));
create policy "admin_full_access_carbon" on mrv_carbon_records for all
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

-- Auditor: read-only semua (nanti bisa dipersempit ke plot ter-assign kalau sudah ada tabel assignment)
create policy "auditor_read_kawasan" on kawasan for select
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'auditor'));
create policy "auditor_read_plots" on plots for select
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'auditor'));
create policy "auditor_read_satlogs" on satellite_logs for select
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'auditor'));
create policy "auditor_read_carbon" on mrv_carbon_records for select
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'auditor'));

-- Auditor: HANYA bisa update kolom status/verified_by/verified_at di carbon records
create policy "auditor_verify_carbon" on mrv_carbon_records for update
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'auditor'));

-- Pekaseh: insert field_logs untuk plot sendiri saja (butuh kolom owner_id di plots jika ingin dibatasi per-petani)
create policy "pekaseh_insert_fieldlog" on field_logs for insert
  with check (exists (select 1 from user_profiles where id = auth.uid() and role = 'pekaseh'));
create policy "pekaseh_read_own_fieldlog" on field_logs for select
  using (created_by = auth.uid());
```

**Catatan untuk Claude Code:** kolom `owner_id` di tabel `plots` belum ada di skema 3.1 — kalau nanti pekaseh perlu dibatasi hanya lihat/isi plot miliknya sendiri (bukan semua plot di kawasan), tambahkan kolom itu dulu sebelum policy pekaseh diperketat. Untuk MVP awal, pekaseh boleh diasumsikan bisa insert ke plot manapun (longgar dulu, diperketat belakangan).

---

## 3.3 — STRUKTUR FOLDER NEXT.JS (App Router)

```
agrimrv/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── kawasan/
│   │   ├── page.tsx                    → dashboard makro, list semua kawasan
│   │   └── [kawasanId]/
│   │       ├── page.tsx                → peta kawasan + list plot di dalamnya
│   │       └── plot/
│   │           └── [plotId]/
│   │               └── page.tsx        → dashboard mikro (detail 1 plot)
│   ├── mrv-reports/
│   │   └── page.tsx                    → rekap semua carbon records, export PDF
│   ├── farmers/
│   │   └── page.tsx                    → database pekaseh/petani
│   ├── settings/
│   │   └── page.tsx                    → config scan_interval_days, API keys
│   └── api/
│       └── cron/
│           └── satellite-scan/
│               └── route.ts            → endpoint dipanggil Vercel Cron
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   → browser client
│   │   └── server.ts                   → server-side client
│   ├── sentinel-hub/
│   │   ├── auth.ts                     → OAuth token handling
│   │   ├── ndvi.ts                     → request NDVI via Statistical API
│   │   └── ndwi.ts                     → request NDWI via Statistical API
│   ├── mrv-engine.ts                   → kalkulasi CH4/CO2e (formula dari 3.4 PRD)
│   └── telegram.ts                     → notifikasi bot
├── components/
│   ├── maps/
│   │   ├── KawasanMap.tsx              → peta makro dengan drill-down klik plot
│   │   └── PlotMap.tsx                 → peta mikro dengan toggle True Color/NDVI/NDWI
│   ├── charts/
│   │   └── NdviTrendChart.tsx
│   └── ui/                             → komponen reusable (badge, tabs, dll)
└── vercel.json                         → konfigurasi cron schedule
```

**Route yang WAJIB diikuti persis (jangan pakai `/lands` dari brief lama):**
- `/kawasan` — bukan `/dashboard`
- `/kawasan/[kawasanId]` — bukan `/lands`
- `/kawasan/[kawasanId]/plot/[plotId]` — bukan `/lands/[id]`

---

## 3.4 — KONTRAK API SENTINEL HUB

**Autentikasi:** OAuth2 client credentials flow via Copernicus Data Space Ecosystem (CDSE), bukan EO Browser (sudah deprecated).

```
POST https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token
Body (x-www-form-urlencoded):
  grant_type=client_credentials
  client_id={CLIENT_ID}
  client_secret={CLIENT_SECRET}
→ Response: { access_token, expires_in }
```

Token perlu di-refresh sebelum expired (`expires_in` biasanya dalam detik) — implementasikan caching token di `lib/sentinel-hub/auth.ts`, jangan request token baru di setiap panggilan.

**Request NDVI (Statistical API — lebih efisien daripada Processing API untuk sekadar butuh angka, bukan gambar):**
```
POST https://sh.dataspace.copernicus.eu/api/v1/statistics
Headers: Authorization: Bearer {access_token}
Body: {
  "input": {
    "bounds": { "geometry": <GeoJSON polygon dari plots.geo_data> },
    "data": [{ "type": "sentinel-2-l2a" }]
  },
  "aggregation": {
    "timeRange": { "from": "<scan_date>T00:00:00Z", "to": "<scan_date>T23:59:59Z" },
    "aggregationInterval": { "of": "P1D" },
    "evalscript": "<evalscript NDVI, lihat di bawah>"
  }
}
```

**Evalscript NDVI dasar (disederhanakan):**
```js
//VERSION=3
function setup() {
  return { input: ["B04","B08","dataMask"], output: { bands: 1 } };
}
function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  return [ndvi];
}
```

**Evalscript NDWI:** sama strukturnya, ganti formula jadi `(B03 - B08) / (B03 + B08)` (band hijau vs NIR).

**Error handling wajib:**
- Timeout → retry maksimal 2x dengan delay, lalu skip ke plot berikutnya (jangan sampai 1 plot gagal menghentikan seluruh proses cron)
- Cloud cover > 15% di hasil → simpan tetap ke `satellite_logs` tapi beri flag/catatan, jangan dianggap data valid untuk kalkulasi NDVI trend
- Rate limit terkena → beri delay antar request (jangan tembak semua plot secara paralel dalam 1 waktu)

---

## 3.5 — LOGIKA VERCEL CRON

```json
// vercel.json
{
  "crons": [{ "path": "/api/cron/satellite-scan", "schedule": "0 1 * * *" }]
}
```
Jalan 1x sehari jam 01:00 UTC. Cek per-plot mana yang "due" — bukan scan semua plot tiap hari.

**Pseudocode endpoint `/api/cron/satellite-scan`:**
```
1. Ambil semua plots dari Supabase
2. Untuk setiap plot:
   a. Ambil scan_date terakhir dari satellite_logs untuk plot ini
   b. Hitung selisih hari dari scan terakhir ke hari ini
   c. JIKA selisih >= plot.scan_interval_days:
      - Request NDVI + NDWI ke Sentinel Hub (lib/sentinel-hub/)
      - JIKA cloud_cover < 15%: simpan hasil ke satellite_logs
      - JIKA cloud_cover >= 15%: simpan dengan flag, jangan hitung sebagai scan valid
      - Tunggu delay singkat (misal 500ms) sebelum lanjut ke plot berikutnya (hindari rate limit)
   d. JIKA selisih < scan_interval_days: skip, lanjut ke plot berikutnya
3. Log ringkasan: berapa plot berhasil di-scan, berapa gagal, berapa di-skip
```

**Anti-duplikat:** kolom `unique(plot_id, scan_date)` di tabel `satellite_logs` (sudah ada di skema 3.1) mencegah insert dobel kalau cron kebetulan jalan 2x di hari yang sama.

---

## 3.6 — STORAGE SUPABASE

```
Bucket: satellite-imagery (PRIVATE, bukan public)
Path pattern: {plot_id}/{year}/{scan_date}_{type}.jpg
  Contoh: a04-uuid/2026/2026-06-14_truecolor.jpg
          a04-uuid/2026/2026-06-14_ndvi.jpg
          a04-uuid/2026/2026-06-14_ndwi.jpg

Bucket: field-photos (PRIVATE)
Path pattern: {plot_id}/{log_date}_{log_id}.jpg
```

**Akses:** selalu lewat signed URL, masa berlaku 1 jam (`expires_in: 3600`), di-generate on-demand saat halaman dibuka — jangan simpan signed URL langsung di database (karena akan expired dan jadi broken link).

---

## CARA PAKAI DOKUMEN INI DI CLAUDE CODE

**Cara "upload"-nya — sebenarnya bukan upload, tapi salah satu dari 2 cara ini:**

1. **Cara paling gampang:** Download file `.md` ini ke komputer kamu (sudah ada tombol download di chat ini). Pas buka Claude Code, taruh file itu di folder project kamu (misal `agrimrv/docs/TECHNICAL_DESIGN_Tahap3.md`). Lalu di terminal Claude Code, tinggal ketik:
   ```
   Baca file docs/TECHNICAL_DESIGN_Tahap3.md, lalu scaffold project Next.js
   sesuai struktur folder di bagian 3.3 dan jalankan skema SQL di 3.1
   ke Supabase project saya.
   ```
   Claude Code akan otomatis baca file itu sendiri dari disk — nggak perlu copy-paste isi seluruh dokumen ke chat.

2. **Cara alternatif (kalau belum ada folder project sama sekali):** Buka Claude Code di folder kosong/baru, lalu copy-paste isi dokumen ini langsung ke chat Claude Code sebagai instruksi awal. Ini oke buat sesi pertama, tapi begitu ada file fisik ke-generate, lebih baik lanjut pakai cara 1 (rujuk ke file, bukan paste ulang tiap kali).

**Kamu nggak perlu install/aktifkan apapun tambahan untuk ini** — ini murni soal menaruh file di folder yang tepat, bukan fitur khusus yang perlu di-enable.

---

## OUTPUT YANG DIHARAPKAN SETELAH DOKUMEN INI DIEKSEKUSI

Supaya kamu tahu "berhasil" itu bentuknya seperti apa, dan bisa cek sendiri tanpa harus paham semua kodenya:

**Setelah Claude Code selesai proses skema (3.1 + 3.2):**
- Di Supabase dashboard (tab **Table Editor**), harus muncul 6 tabel baru: `user_profiles`, `kawasan`, `plots`, `satellite_logs`, `mrv_carbon_records`, `field_logs`
- Di tab **Database → Extensions**, PostGIS harus berstatus "Enabled" (centang hijau)
- Di tab **Authentication → Policies**, tiap tabel harus punya minimal 1 policy terdaftar (bukan kosong) — kalau kosong berarti RLS ke-enable tapi policy belum jalan, artinya semua akses akan tertolak
- **Cara tes cepat:** coba insert 1 baris dummy manual lewat Table Editor ke tabel `kawasan` — kalau berhasil tersimpan tanpa error izin, skema dasarnya sudah benar

**Setelah Claude Code selesai scaffold folder (3.3):**
- Struktur folder di komputer kamu harus persis seperti pohon folder di bagian 3.3 — cek dengan buka folder project di file explorer/VS Code, bandingkan manual
- Jalankan `npm run dev` (atau `pnpm dev` tergantung yang dipakai) — harus muncul server lokal di `http://localhost:3000` tanpa error merah di terminal
- Buka `http://localhost:3000/kawasan` di browser — halaman harus muncul (boleh masih kosong/belum ada data, yang penting route-nya jalan tanpa error 404)

**Setelah Claude Code selesai bagian Sentinel Hub (3.4) — INI YANG PALING PENTING DICEK MANUAL:**
- Sebelum masuk ke kode Next.js sama sekali, **tes dulu pakai curl/Postman** (sesuai saran di checklist paling bawah dokumen) — kalau request OAuth token berhasil dan dapat `access_token` balik, baru lanjut. Kalau di titik ini gagal, jangan lanjut ke integrasi kode — benerin dulu kredensial Copernicus-nya.
- Setelah itu jalan di kode: coba trigger 1x manual (bukan nunggu cron jalan otomatis) untuk 1 plot dummy — outputnya harus ada 1 baris baru muncul di tabel `satellite_logs` dengan angka `ndvi_score` yang masuk akal (antara -1 sampai 1, biasanya di rentang 0.1–0.9 untuk lahan sawah)

**Setelah Vercel Cron (3.5) aktif:**
- Di Vercel dashboard, tab **Cron Jobs**, harus muncul 1 job terdaftar dengan schedule `0 1 * * *`
- Setelah jam 01:00 UTC pertama kali jalan, cek tab **Logs** di Vercel — harus ada log yang nunjukkan berapa plot di-scan/skip/gagal (sesuai pseudocode ringkasan di bagian 3.5)

**Tanda kalau ada yang salah arah (harus stop dan tanya lagi, jangan lanjut):**
- Kalau Claude Code bikin nama tabel/folder/route yang beda dari yang tertulis di dokumen ini (misal balik pakai `/lands` atau `subak_id`) — itu tanda instruksinya nggak diikuti persis, minta perbaiki dulu sebelum lanjut
- Kalau RLS policy kosong tapi Claude Code bilang "sudah aman" — itu kontradiksi, harus dicek ulang

---

## 3.7 — TELEGRAM BOT SEBAGAI LOGBOOK PETANI (BARU)

Bot Telegram tidak hanya kirim notifikasi (satu arah), tapi juga terima input data dari petani/pekaseh langsung ke `field_logs` (dua arah).

**Command yang perlu diimplementasikan:**
```
/lapor          → bot tanya jenis log (tanam/panen/masalah) via inline keyboard,
                  lalu minta kirim foto + catatan teks
/panen [jumlah] → langsung insert ke field_logs dengan log_type='harvest_actual',
                  harvest_kg=[jumlah]
```

**Alur teknis:**
```
1. Petani kirim /lapor ke bot
2. Bot balas dengan inline keyboard: [Tanam] [Panen] [Masalah]
3. Petani pilih salah satu, bot minta kirim foto (opsional) + catatan teks
4. Bot terima foto → upload ke Supabase Storage bucket field-photos
5. Bot insert row ke field_logs dengan source='telegram', telegram_message_id=<id pesan asal>
6. Bot balas konfirmasi ke petani: "Laporan tersimpan ✓"
```

**Kolom tambahan di `field_logs` (revisi dari skema 3.1):**
```sql
alter table field_logs add column source text not null default 'web' check (source in ('web','telegram'));
alter table field_logs add column telegram_message_id text;
```

**Kenapa ini penting secara MRV, bukan cuma kemudahan UX:** metodologi Verra VM0051 secara eksplisit menerima farmer logbook sebagai bukti pendukung saat data satelit tidak tersedia (misal tertutup awan). Kolom `source` dan `telegram_message_id` memberi audit trail — auditor bisa menelusuri balik mana data yang berasal dari input lapangan manual vs otomatis dari satelit.

---

## 3.8 — FORMULA KARBON v1.1: NET CH4-N2O (BARU, MENGGANTIKAN FORMULA v1.0)

**Masalah di formula v1.0 (lama):** hanya menghitung penurunan CH4 dari AWD, tanpa memperhitungkan bahwa AWD juga MENAIKKAN emisi N2O (riset menunjukkan CH4 turun 32-43% tapi N2O naik 7,4-23,4%). Karena GWP N2O (273x CO2) jauh lebih besar dari CH4 (27x CO2), formula lama berisiko overstate klaim CO2e.

**Formula v1.1 (baru, NET):**
```
1. CH4 tercegah (kg) = baseline_ch4_per_ha × luas_ha × dry_ratio
2. N2O tambahan (kg) = baseline_n2o_per_ha × luas_ha × dry_ratio × faktor_kenaikan_n2o
   (faktor_kenaikan_n2o: gunakan rentang 0.074–0.234 sesuai literatur, default konservatif 0.15)
3. CO2e dari CH4 tercegah = CH4 tercegah × 27  (GWP100 IPCC AR6)
4. CO2e dari N2O tambahan = N2O tambahan × 273 (GWP100 IPCC AR6)
5. CO2e NET = (CO2e dari CH4 tercegah) − (CO2e dari N2O tambahan)
```

**Kolom SQL baru di `mrv_carbon_records`** (lihat revisi skema 3.1 di atas): `baseline_n2o_kg`, `additional_n2o_kg`, `methodology_ref`.

**Kenapa ini penting:** kalau formula v1.0 lama dipakai untuk pengajuan sertifikat resmi, klaim CO2e-nya bisa dianggap tidak akurat/overstated oleh LVV saat audit — berisiko proyek ditolak atau harus direvisi ulang. Formula v1.1 ini masih tetap ilustratif (belum bersertifikasi), tapi metodologi perhitungannya sudah selaras dengan yang disyaratkan VM0051.

---

## 3.8B — ANALISIS MULTI-METODOLOGI, TAPI PENDAFTARAN CUMA 1 (BARU v1.2)

**Prinsip:** sistem BOLEH menghitung & membandingkan hasil dari beberapa metodologi sekaligus (internal-illustrative, VM0051, SRN-PPI-KMSAH, dll) untuk keperluan analisis — ini membantu Save Subak membandingkan mana yang paling menguntungkan/realistis sebelum memutuskan jalur pendaftaran. TAPI hanya SATU metodologi yang boleh ditandai sebagai "resmi didaftarkan" ke registry (SRN PPI atau Verra) untuk 1 batch klaim — sesuai prinsip anti-double-counting yang sudah dibahas di BRIEF.

**Alur teknis:**
```
1. Sistem hitung CO2e dari tiap metodologi yang tersedia untuk 1 plot + 1 musim
   → insert 1 baris per metodologi ke tabel mrv_methodology_analysis
2. Admin/auditor bandingkan hasil semua metodologi di UI (tab baru "Perbandingan Metodologi")
3. Setelah dipilih 1 metodologi yang mau didaftarkan resmi:
   → insert/update 1 baris di mrv_carbon_records dengan methodology_ref = metodologi terpilih,
     is_registered_for_trading = true
4. SEMUA proses pendaftaran ke SRN PPI/Verra selanjutnya HANYA merujuk ke
   baris mrv_carbon_records yang is_registered_for_trading = true — 
   baris di mrv_methodology_analysis tidak pernah didaftarkan langsung ke registry manapun
```

**Constraint penting untuk dijaga di level aplikasi (bukan cuma database):** UI harus mencegah admin menandai lebih dari 1 baris `is_registered_for_trading = true` untuk kombinasi plot+musim yang sama. Ini validasi bisnis, bukan constraint SQL — perlu dicek eksplisit di kode sebelum insert/update.

---

## 3.9 — SENTINEL-1 (RADAR) SEBAGAI SUMBER DATA KEDUA

Selain Sentinel-2 (optik, untuk NDVI/True Color), tambahkan Sentinel-1 (radar/SAR) khusus untuk deteksi genangan air — lebih andal dibanding NDWI optik karena menembus awan (relevan untuk Indonesia yang sering berawan).

**Perbedaan permintaan API:** Sentinel-1 memakai koleksi data berbeda di Sentinel Hub (`sentinel-1-grd` alih-alih `sentinel-2-l2a`), dan evalscript-nya mengolah band radar (VV/VH polarization), bukan band optik biasa. Detail evalscript spesifik perlu dirujuk ke dokumentasi resmi Sentinel Hub saat implementasi — jangan menebak formatnya.

**Kolom tambahan di `satellite_logs` (revisi dari skema 3.1):**
```sql
alter table satellite_logs add column sar_flood_index numeric;
alter table satellite_logs add column sar_source text default 'sentinel-1';
```

---




- [ ] Skema SQL di atas sudah dijalankan di Supabase project (bukan cuma didiskusikan)
- [ ] Sudah punya akun Copernicus Data Space Ecosystem + client_id/client_secret aktif (bukan simulasi)
- [ ] Sudah tes 1x manual request Statistical API berhasil dapat angka NDVI untuk 1 polygon nyata (di luar Next.js dulu, bisa pakai Postman/curl untuk validasi sebelum diintegrasikan ke kode)
- [ ] Struktur folder Next.js sudah di-scaffold sesuai 3.3

**Urutan pengerjaan disarankan:** validasi item Sentinel Hub API dulu secara manual (di luar aplikasi) sebelum masuk coding Next.js — supaya kalau ada masalah kredensial/format request, ketahuan lebih awal tanpa nyampur dengan bug kode aplikasi.
