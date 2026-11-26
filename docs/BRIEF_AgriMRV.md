# AgriMRV — BRIEF.md
### Versi: v1.2 (sebelumnya v1.1, v1.0)
### Update 03 Juli 2026 — analisis multi-metodologi (boleh hitung banyak, daftar cuma 1), formula karbon NET CH4-N2O, terminologi generik

## Tentang Project
Aplikasi WebGIS dan Digital MRV (Measurement, Reporting, and Verification) untuk melacak jadwal tanam/panen padi via citra satelit, sebagai fondasi menuju sertifikasi karbon (carbon trading) di kemudian hari.
Admin memasukkan koordinat lahan → Sistem menarik data satelit Sentinel-2 otomatis → Algoritma menganalisis fase tanam dan tata air → Tampilkan metrik kesehatan lahan, dan (fase lanjut) estimasi karbon.

**PENTING:** Sistem ini dirancang generik sejak awal — TIDAK hardcode istilah "Subak" atau lokasi Bali. Siap dipakai di kawasan pertanian manapun (Kelompok Tani di Jawa, Desa, dll).

Target: Manajemen internal Save Subak, calon Auditor Karbon (SRN PPI), klien B2B (fase lanjut).
Model bisnis: Internal Use (jadwal tanam/panen) → fondasi B2B Carbon Insetting/Trading (fase lanjut).

## Prioritas Fase (KRITIS — jangan dilanggar urutannya)
1. **Fase 1 (prioritas sekarang):** Modul monitoring tanam/panen — peta, NDVI/NDWI, time-slider, dashboard makro-mikro
2. **Fase 2 (setelah Fase 1 matang):** Carbon engine — MRV records, formula CH4/CO2e, alur verifikasi auditor
3. **Fase 3 (jangka panjang):** Integrasi resmi ke SRN PPI, onboarding auditor/LVV sungguhan

Jangan mulai kerjakan Fase 2/3 sebelum Fase 1 stabil dan sudah dipakai nyata di minimal 1 kawasan.

## Tech Stack
- Frontend  : Next.js 14 (App Router) + Tailwind CSS (TypeScript strict)
- Database  : Supabase (PostgreSQL + PostGIS + Auth + Storage + RLS)
- Engine    : Sentinel Hub API via **Copernicus Data Space Ecosystem** (bukan EO Browser — sudah deprecated Feb 2025). Sentinel-2 (optik) untuk NDVI/True Color; **Sentinel-1 (radar/SAR) ditambahkan sebagai sumber data kedua untuk deteksi genangan air (AWD)** — lebih andal dibanding NDWI optik karena bisa menembus awan, penting untuk Indonesia yang sering berawan. **Bukti empiris (08 Juli 2026, dari data 2 tahun project sendiri, bukan cuma teori):** lihat tabel statistik tutupan awan per musim tanam di bagian RIWAYAT KEPUTUSAN — Musim 2/2025 Wayan Suparta cuma 1 dari 9 scan optik yang valid (88,9% gagal awan), sementara SAR merekam 41 titik lengkap di periode sama.
- Otomasi   : **Vercel Cron** (bukan n8n — diputuskan untuk skip infra tambahan, lihat alasan di bagian Keputusan)
- Telegram  : Telegram Bot API (notifikasi fase & anomali)
- Deploy    : GitHub + Vercel

## Struktur Folder (route generik, bukan "/lands" atau "/subak")
```
agrimrv/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── kawasan/page.tsx                        → dashboard makro, list semua kawasan
│   ├── kawasan/[kawasanId]/page.tsx             → peta kawasan + list plot di dalamnya
│   ├── kawasan/[kawasanId]/plot/[plotId]/page.tsx → dashboard mikro (1 petak)
│   ├── mrv-reports/page.tsx                     → rekap carbon records (Fase 2)
│   ├── farmers/page.tsx                         → database pekaseh/petani
│   ├── settings/page.tsx                        → config API & scan_interval_days
│   └── api/cron/satellite-scan/route.ts         → endpoint Vercel Cron
├── lib/
│   ├── supabase/client.ts & server.ts
│   ├── sentinel-hub/auth.ts, ndvi.ts, ndwi.ts
│   ├── mrv-engine.ts                            → kalkulasi CH4/CO2e (Fase 2)
│   └── telegram.ts
└── components/
    ├── maps/KawasanMap.tsx, PlotMap.tsx
    ├── charts/NdviTrendChart.tsx
    └── ui/
```

## Database Schema (PostGIS Enabled) — versi generik

### kawasan (dulu "macro_polygons", generik — bukan hardcode Subak)
```
id uuid PK
name text                    -- "Subak Sangeh" ATAU "Kelompok Tani Sumber Makmur" dll
local_term text default 'Kawasan'  -- "Subak" / "Kelompok Tani" / "Desa" — istilah lokal per daerah
region text                  -- "Badung, Bali" / "Sragen, Jawa Tengah"
boundary geometry(Polygon, 4326)
total_area_ha numeric
created_at, updated_at
```

### plots (dulu "micro_polygons")
```
id uuid PK
kawasan_id → kawasan.id
farmer_name, crop_variety, area_ha
geo_data geometry(Polygon, 4326)
is_organic_certified bool
scan_interval_days int default 10   -- konfigurasi per-plot, BUKAN hardcode 5 hari
created_at, updated_at
```

### satellite_logs
```
id uuid PK
plot_id → plots.id
scan_date, cloud_cover_percent
ndvi_score, ndwi_score
estimated_phase (semai/vegetatif/generatif/pematangan/kosong)
true_color_path, ndvi_heatmap_path, ndwi_heatmap_path  -- path Storage, bukan URL publik
unique(plot_id, scan_date)  -- anti-duplikat
```

### mrv_carbon_records (Fase 2 — jangan dibangun dulu di Fase 1)
```
id uuid PK
plot_id → plots.id
season_start_date, season_end_date
baseline_ch4_kg, dry_ratio, prevented_ch4_kg
baseline_n2o_kg, additional_n2o_kg    -- BARU v1.1: N2O naik saat AWD, trade-off dari CH4 turun
co2e_kg   -- NET v1.1: (prevented_ch4_kg × 27) − (additional_n2o_kg × 273), GWP100 IPCC AR6
status: draft / verified / retired
verified_by, verified_at
methodology_ref default 'internal-illustrative'  -- BARU v1.1: bisa diarahkan ke 'VM0051' dsb
methodology_note default 'Formula ilustratif NET CH4-N2O — belum bersertifikasi resmi'
```

### mrv_methodology_analysis (BARU v1.2 — analisis perbandingan, BUKAN untuk didaftarkan)
```
id uuid PK
plot_id → plots.id
season_start_date, season_end_date
methodology_name  -- 'internal-illustrative' / 'VM0051' / 'SRN-PPI-KMSAH' / dll
co2e_kg, calculation_detail (jsonb), notes
unique(plot_id, season_start_date, methodology_name)
```

**Kenapa formula direvisi jadi NET (v1.1):** riset menunjukkan AWD menurunkan CH4 32-43% TAPI menaikkan N2O 7,4-23,4%. Karena GWP N2O (273x CO2) jauh lebih besar dari CH4 (27x CO2), formula lama yang cuma hitung CH4 turun berisiko overstate klaim CO2e. Formula v1.1 menghitung NET setelah dikurangi kenaikan N2O — ini juga syarat eksplisit metodologi Verra VM0051.

**Prinsip inti (v1.2): analisis boleh pakai banyak metodologi, pendaftaran resmi cuma 1.**
Sistem menghitung & menyimpan hasil dari beberapa metodologi sekaligus (tabel di atas) untuk keperluan perbandingan internal — membantu Save Subak melihat mana yang paling menguntungkan/realistis. Tapi begitu ada keputusan mau daftar ke registry (SRN PPI atau Verra), HANYA SATU metodologi yang ditandai `is_registered_for_trading = true` di `mrv_carbon_records` (lihat di bawah) — sesuai prinsip anti-double-counting yang sudah dibahas sebelumnya. UI wajib mencegah lebih dari 1 baris ditandai resmi untuk kombinasi plot+musim yang sama.

### field_logs (foto lapangan, panen aktual, catatan anomali — gabungan 1 tabel)
```
id uuid PK
plot_id → plots.id
log_type (photo/harvest_actual/anomaly_note)
log_date, photo_path, harvest_kg, note
source (web/telegram) -- BARU: menandai asal input data
telegram_message_id text nullable -- BARU: referensi ke pesan asal jika dari bot
created_by → user_profiles.id
```

## Integrasi Telegram sebagai Logbook Petani (BARU)
Selain notifikasi satu arah (fase, panen, anomali), bot Telegram diperluas jadi kanal input data dua arah dari petani/pekaseh langsung ke `field_logs` — tanpa perlu buka aplikasi web.

**Command baru:**
```
/lapor          → pilih jenis log (tanam/panen/masalah), lalu kirim foto + catatan
/panen [jumlah] → langsung isi harvest_kg aktual ke field_logs
```

**Kenapa ini penting secara MRV, bukan cuma kemudahan UX:**
Metodologi karbon internasional (lihat Verra VM0051) secara eksplisit menerima farmer logbook sebagai bukti pendukung saat data satelit tidak tersedia (misal tertutup awan). Jadi logbook Telegram bukan sekadar convenience — ini berkontribusi langsung ke kelengkapan bukti MRV yang dibutuhkan saat audit LVV.

## RLS — Row Level Security
- Admin: full access semua tabel
- Auditor: read-only semua tabel + boleh update status di mrv_carbon_records saja (untuk verifikasi)
- Pekaseh: insert field_logs saja (dibatasi ke plot sendiri via kolom owner_id — TAMBAHKAN kolom ini kalau butuh pembatasan lebih ketat, untuk MVP awal boleh longgar dulu)
- Tidak ada URL satelit yang public — semua signed URL, masa berlaku 1 jam

## Storage Supabase
```
Bucket: satellite-imagery (PRIVATE)
Path: {plot_id}/{year}/{scan_date}_{type}.jpg

Bucket: field-photos (PRIVATE)
Path: {plot_id}/{log_date}_{log_id}.jpg
```

## Sistem Otomasi & Sentinel Hub API
Yang Sistem Lakukan:
- ✅ Tarik citra satelit otomatis via Vercel Cron (jalan harian, cek per-plot mana yang "due" berdasarkan `scan_interval_days`, bukan hardcode 5 hari)
- ✅ Hitung luas & posisi presisi pakai PostGIS
- ✅ Kenali fase tanam dari tren NDVI
- ✅ Hitung pola pengeringan (AWD) dari tren NDWI
- ✅ (Fase 2) Terjemahkan indeks satelit jadi estimasi CO2e — formula ilustratif dulu, bukan resmi
- ❌ TIDAK memberi sertifikat karbon resmi — tetap butuh klik verifikasi manual dari auditor

**Autentikasi Sentinel Hub:** OAuth2 client credentials via Copernicus Data Space Ecosystem (CDSE). EO Browser LAMA sudah deprecated Feb 2025 — jangan pakai referensi/dokumentasi yang menyebut EO Browser.

## Dashboard: Makro → Mikro (drill-down)

**Level Makro** (`/kawasan/[id]`):
- Peta dengan outline batas kawasan + semua plot di dalamnya berwarna sesuai fase/NDVI/NDWI
- KPI: total luas, fase terbanyak, estimasi CO2e kawasan (akumulasi), jumlah plot terverifikasi
- List plot — klik salah satu → masuk ke detail mikro

**Level Mikro** (`/kawasan/[id]/plot/[id]`):
- Peta 1 plot dengan toggle 3 mode: True Color / NDVI (Kesehatan) / NDWI (Genangan Air)
- Time-slider 2021–2026 + line chart NDVI yang sinkron
- Panel Insight Otomatis (rule-based, bukan AI) — bereaksi terhadap perubahan NDVI di titik slider aktif
- Tab: Foto Lapangan, Log Panen, Estimasi Karbon (Fase 2), Catatan Anomali

## Telegram Bot Flow
```
/start [kode] → link akun ke AgriMRV
/status       → cek fase kawasan hari ini
/panen        → estimasi tanggal panen terdekat
```
Notifikasi otomatis: alert anomali NDVI turun drastis, laporan ringkasan musim selesai.

## Model Bisnis & Akses (Role)
- **Internal (Free):** cek jadwal panen untuk operasional, traceability data petani
- **Auditor (Fase 2, Premium):** akses histori NDVI 5 tahun (syarat sertifikasi), ekspor laporan MRV format SRN PPI
- **B2B Klien (Fase lanjut, terpisah dari sistem ini):** QR landing page — INI BAGIAN DARI Save Subak Client Dashboard, BUKAN AgriMRV, jangan digabung

## Aturan Coding
- TypeScript strict mode wajib
- Pakai ekstensi PostGIS (`geometry` type) untuk kalkulasi luasan — jangan andalkan hitungan di frontend
- Error handling wajib untuk Sentinel Hub API (sering timeout, retry maks 2x lalu skip)
- Loading state pakai Skeleton Map — peta tidak boleh blank saat data dimuat
- Istilah "Kawasan" dan "Plot" dipakai konsisten di kode — JANGAN hardcode "Subak" di manapun

---

## RIWAYAT KEPUTUSAN (per tahap, ringkas)

**Keputusan formula karbon v1.1 (03 Juli 2026):**
- CH4 (metana): GWP100 ≈27x CO2 (IPCC AR6), dihasilkan bakteri anaerobik di tanah tergenang terus-menerus — inilah yang direduksi lewat AWD
- N2O (dinitrogen oksida): GWP100 ≈273x CO2 (IPCC AR6), justru muncul saat tanah kering/beroksigen — kebalikan dari CH4. AWD menekan CH4 32-43% tapi menaikkan N2O 7,4-23,4% (trade-off penting yang sebelumnya tidak dihitung)
- Formula direvisi jadi NET: CO2e = (CH4 tercegah × 27) − (N2O tambahan × 273) — bukan cuma hitung CH4 turun tanpa memperhitungkan kenaikan N2O
- **Bisa pakai 2+ metodologi untuk data monitoring**, tapi TIDAK BOLEH klaim ton CO2e yang sama lewat 2 metodologi/registri berbeda sekaligus (prinsip anti-double counting) — 1 proyek pilih 1 metodologi untuk 1 batch klaim penerbitan sertifikat



**Keputusan logic fase estimasi (05 Juli 2026):**
- Fungsi `estimatePhase(ndvi, ndwi)` menggantikan `phaseFromNdvi(ndvi)` yang hanya berbasis NDVI di semua 3 path: `scan/route.ts`, `cron/satellite-scan/route.ts`, `backfill-satellite.mjs`
- Threshold cross-check NDWI yang disepakati: NDVI 0.3–0.5 + NDWI < -0.35 → "pematangan"; NDVI 0.5–0.7 + NDWI < -0.3 → "pematangan"
- Contoh kasus yang memotivasi: NDVI=0.331 + NDWI=-0.402 sebelumnya dibaca "vegetatif", seharusnya "pematangan"
- **Catatan penting:** Threshold ini bersifat ILUSTRATIF berdasarkan pengamatan pola data — bukan standar agronomi tervalidasi secara ilmiah. Ditandai dengan catatan "* Ilustratif" di UI (detail plot + tooltip peta kawasan)
- Data historis di `satellite_logs` di-recalculate via `scripts/recalculate-phases.mjs` (one-time)
- `deriveInsights()` di UI juga harus mengikuti logic yang sama (bukan punya threshold sendiri) — pelajaran dari inkonsistensi insight vs kartu Data Scan yang ditemukan 06 Juli 2026

**Keputusan musim tanam (planting_seasons) vs plots (05 Juli 2026):**
- Tabel `planting_seasons` dipisah dari `plots` — crop_variety dan planting_date disimpan PER MUSIM, bukan sebagai kolom permanen di plot
- Kolom lama `plots.crop_variety` dan `plots.planting_date` sengaja TIDAK di-drop (backward compat — data lama Wayan Suparta tetap terbaca, removal setelah semua data dimigrasi)
- `estimated_harvest_date` adalah GENERATED ALWAYS AS (`planting_date + 110 days`) STORED — tidak diisi manual
- Adaptive scan interval: mode intensif 6 hari otomatis saat ada `planting_seasons` aktif dalam window 120 hari dari planting_date

**Keputusan status lahan self-declared (06 Juli 2026):**
- Field `status_lahan` (enum: organik/konversi/regenerative/konvensional) adalah metadata yang diisi manual admin/petani — BUKAN output kalkulasi satelit
- Ini adalah keputusan desain kritis: status tidak boleh pernah "dihitung otomatis" dari NDVI/NDWI karena sertifikasi organik membutuhkan proses formal dari LSO yang tidak bisa digantikan data satelit
- Disclaimer wajib muncul di semua titik input: "Status ini berdasarkan pengakuan/dokumen petani, belum tervalidasi sistem — untuk klaim resmi tetap perlu sertifikasi LSO."
- Field opsional terkait: `nama_lso` (badan sertifikasi), `nomor_sertifikat`, `tanggal_kadaluarsa`
- Tidak mempengaruhi kalkulasi NDVI/NDWI/CO2e sama sekali — murni metadata untuk filter, laporan, dan audit trail

**Keputusan pemisahan pemilik/penggarap + riwayat kepemilikan (06 Juli 2026):**
- `nama_pemilik` = pemilik legal lahan; `nama_penggarap` = yang menggarap secara aktif. Keduanya kolom terpisah di tabel `plots`.
- `farmer_name` tetap ada — TIDAK di-drop. Disinkronkan dengan `nama_penggarap` via RPC dan ownership API. Backward compat untuk cron scan dan kode lama yang masih baca `farmer_name`.
- Default saat insert: jika `nama_pemilik` tidak diisi, fallback ke `nama_penggarap` (pemilik = penggarap — kasus paling umum petani kecil).
- Tabel `plot_ownership_history`: riwayat kronologis siapa pemilik/penggarap per plot. `tanggal_selesai` nullable (null = masih aktif). Auto-close: POST ownership baru otomatis set `tanggal_selesai` entri sebelumnya ke `tanggal_mulai` entri baru.
- Seed saat migration v9: semua plot existing dapat 1 record awal bertanggal hari migration dijalankan.

**Keputusan pola migration PostgreSQL (06 Juli 2026 — dua error nyata):**
- **Fungsi RPC dengan signature berbeda:** `CREATE OR REPLACE FUNCTION` dengan jumlah/tipe param berbeda dari yang sudah ada TIDAK menggantikan — PostgreSQL membuat overload baru. Hasilnya: `GRANT EXECUTE ON FUNCTION insert_plot` (tanpa arglist) gagal dengan "function name is not unique". **Wajib**: `DROP FUNCTION IF EXISTS insert_plot(uuid, text, text, numeric, jsonb)` (dengan arglist lengkap) SEBELUM `CREATE FUNCTION`, dan GRANT dengan arglist eksplisit.
- **View dengan kolom diubah:** `CREATE OR REPLACE VIEW` mempertahankan posisi kolom dari view asli — kolom baru di tengah SELECT list dianggap "rename kolom di posisi itu", bukan tambah kolom. **Wajib**: `DROP VIEW IF EXISTS v_plots` → `CREATE VIEW v_plots` fresh. Selalu cek dependensi dulu (`SELECT ... FROM pg_depend`) sebelum DROP — untuk v_plots terbukti 0 dependensi (aman tanpa CASCADE).
- Pola ini berlaku untuk semua migration yang menyentuh `insert_plot` atau `v_plots`.

**Insiden keamanan — RLS tidak aktif di `user_profiles` (07 Juli 2026):**
- **Trigger:** Email peringatan otomatis Supabase "Table publicly accessible" untuk project ini.
- **Root cause:** Audit `migration_v1.sql` mengkonfirmasi tabel `user_profiles` dibuat bersamaan dengan 6 tabel lain, tapi TIDAK ikut masuk daftar `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (baris 127-132 migration v1 hanya mencakup kawasan/plots/satellite_logs/mrv_carbon_records/mrv_methodology_analysis/field_logs — user_profiles terlewat sejak migration pertama). Bukan regresi dari perubahan belakangan — bug ada sejak 03 Juli 2026 (migration v1 pertama kali dijalankan).
- **Dampak:** Sejak migration pertama dijalankan sampai diperbaiki 07 Juli 2026, tabel `user_profiles` (berisi `full_name`, `role`, `phone`, `telegram_id` semua user terdaftar) berpotensi diakses siapa pun yang tahu URL project via anon key (anon key bersifat publik, dipakai di browser) langsung lewat REST API tanpa autentikasi. Tidak ada indikasi/bukti data ini benar-benar diakses pihak luar — laporan ini murni dari Supabase Advisor, bukan dari log akses yang menunjukkan eksploitasi aktif.
- **Perbaikan (`migration_v11_enable_rls_user_profiles.sql`, nama SQL Editor: `11_enable_rls_user_profiles`):**
  - `ENABLE ROW LEVEL SECURITY` pada `user_profiles`
  - Policy `self_read_own_profile` (SELECT, `id = auth.uid()`) — wajib ada, karena semua policy admin di tabel lain memverifikasi role lewat subquery ke `user_profiles`; tanpa policy self-read ini subquery tersebut deadlock (tidak ada cara membuktikan "saya admin" lewat client key)
  - Policy `admin_full_access_user_profiles` (FOR ALL) — pola sama seperti tabel lain
- **Temuan tambahan yang ikut diperbaiki di migration yang sama:** `plot_ownership_history` (dibuat migration v9) sudah `ENABLE ROW LEVEL SECURITY` sejak awal, tapi TIDAK PERNAH punya policy sama sekali — bukan celah publik (default-deny), tapi berarti admin/auditor tidak bisa akses lewat client key, hanya lewat service_role di server. Ditambahkan `admin_full_access_ownership_history` (FOR ALL) dan `auditor_read_ownership_history` (FOR SELECT), pola sama seperti `plots`.
- **Verifikasi:** `SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND rowsecurity=false` — dikonfirmasi user hasilnya cuma 1 baris (`spatial_ref_sys`, tabel bawaan ekstensi PostGIS, false positive standar, sengaja tidak disentuh).
- **Pola yang ditetapkan ke depan:** Setiap `CREATE TABLE` baru WAJIB langsung diikuti `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + minimal 1 policy di migration yang sama — jangan pisah ke migration terpisah/kemudian, supaya tidak ada window waktu tabel baru "publicly accessible" secara default (perilaku default Postgres/Supabase kalau RLS belum diaktifkan).

**Keputusan redesign UI/UX — peta+tabel, hero petak, filter tanggal, tooltip (08 Juli 2026):**
- Halaman kawasan: daftar card besar per-petak diganti tabel ringkas (Petani/Varietas/Luas/Koordinat/Fase/Scan Terakhir/Aksi); peta tetap di atas, klik baris tabel men-`fitBounds` peta ke polygon petak + buka tooltip nama petani secara terprogram.
- Detail petak: hero jadi peta Leaflet penuh dengan badge fase mengambang (dark overlay + dot live) menggantikan card map biasa; card "Data Scan" dan "Data Radar" lama dihapus, dikonsolidasi jadi strip 4 statistik (NDVI/NDWI/VH-VV/Orbit) di bawah hero.
- **Pola baru — helper geometri harus di `lib/`, bukan di komponen map:** `lib/plot-geo.ts` dibuat sebagai modul geometri murni tanpa dependency Leaflet (`computePlotsCenter`, `plotCentroid`, `PHASE_LABEL`, `PHASE_BADGE_STYLE`). Pemicunya: import helper dari `KawasanMapInner.tsx` (browser-only, `import 'leaflet/dist/leaflet.css'` dkk) ke `KawasanPageClient.tsx` menarik seluruh modul Leaflet ke jalur SSR → `ReferenceError: window is not defined`, halaman 500 di production build sekalipun type-check bersih. **Aturan ke depan:** logic yang TIDAK butuh Leaflet secara langsung (kalkulasi centroid, label mapping, dsb) harus hidup di `lib/`, bukan di file `*MapInner.tsx` manapun, supaya aman diimpor dari server component atau client component non-map manapun.
- **Filter tanggal reusable:** `components/charts/DateRangeControl.tsx` — toggle cepat (1 Bulan/3 Bulan/1 Tahun/Semua) + slider draggable, dipakai independen di chart NDVI/NDWI dan chart SAR (rentang & titik pilih terpisah). Di-anchor ke tanggal data TERBARU (bukan `Date.now()`) supaya tetap masuk akal untuk dataset historis/backfill.
- **Pola baru — accessor function dari parent tidak boleh masuk dependency array:** Ditemukan infinite loop ("Maximum update depth exceeded") karena `useMemo` di `DateRangeControl` menyertakan `getDate`/`getId` (inline arrow function dari parent, reference baru tiap render) di dependency array → state parent ter-update tanpa henti. **Aturan ke depan:** komponen yang menerima accessor function sebagai prop harus mendasarkan `useMemo`/`useEffect` deps pada data primitif/stabil (`items`, key string, dst), bukan pada accessor function itu sendiri — asumsikan caller akan pass inline arrow function, jangan berharap caller selalu memoize dengan `useCallback`.
- **Pola baru — popover/tooltip mengambang wajib `createPortal`:** `InfoTooltip.tsx` di-redesign jadi panel dark (bg gelap, teks putih, panah penunjuk) yang di-render via `createPortal(..., document.body)`, bukan absolute-positioned inline. Alasan: salah satu titik pakai (tooltip CO₂e di tab Karbon) ada di dalam card `overflow-hidden` — persis kelas masalah yang sudah pernah ditemukan project ini untuk dialog konfirmasi (04 Juli 2026, lihat entri "pola migration" & keputusan portal di atas). **Aturan ini sekarang eksplisit berlaku untuk SEMUA elemen mengambang (dialog maupun tooltip), bukan cuma dialog konfirmasi** — kalau ada kemungkinan dipakai di dalam container `overflow-hidden`, wajib portal ke `document.body`.
- Verifikasi seluruh redesign pakai Playwright (diinstall lokal di scratchpad, tidak masuk `package.json` project — `chromium-cli` tidak tersedia di environment Windows ini) untuk drive klik/drag sungguhan dan screenshot, bukan cuma type-check.

**Keputusan fitur Analisis Pola Pengairan Otomatis + bug hysteresis (08 Juli 2026):**
- Fitur baru: `season_water_pattern_analysis` — deteksi rule-based (IF-ELSE murni, eksplisit BUKAN AI/LLM) pola pengairan 1 musim tanam dari NDWI+SAR, hasil `oscillating_awd_like` / `continuous_flooding` / `insufficient_data`. Dihitung otomatis (trigger saat `actual_harvest_date` diisi) maupun manual (tombol "Analisis Ulang Pola", bisa dipanggil kapan saja termasuk musim belum panen, pakai data sampai hari ini).
- **Bug ditemukan uji pertama:** versi awal (migration v12) memakai 1 garis batas tegas tanpa zona penyangga (SAR ≥0.25 basah, NDWI <-0.1 kering) → hasil pertama 14 "transisi" dalam 1 musim ~3 bulan, jelas tidak masuk akal untuk pola AWD asli.
- **Root cause (dibuktikan dari audit data mentah, bukan asumsi — sesuai CLAUDE.md §6):** dua mekanisme overcounting sekaligus:
  1. Threshold tanpa hysteresis — nilai SAR yang goyang tipis ±0.01-0.04 di sekitar garis batas dihitung sebagai transisi berulang, padahal itu speckle noise SAR harian.
  2. **Percampuran sumber data tanpa rekonsiliasi** (temuan tidak terduga) — menyambung urutan NDWI dan SAR (dua sensor beda skala/threshold) jadi satu deret tunggal menghasilkan "transisi" palsu tepat di titik sambungan antar-sumber, terlepas dari isu threshold.
- **Fix (migration v13):** hysteresis PADA SAR SAJA (≥0.28 basah, ≤0.22 kering, 0.22-0.28 zona mati/tidak mengubah status — NDWI sengaja tidak diberi dead-band) **+** syarat minimum persistensi (transisi baru valid kalau status baru bertahan ≥2 titik keputusan berturut-turut). Opsi ketiga yang diajukan (hitung NDWI & SAR sepenuhnya independen) **ditunda**, dievaluasi lagi kalau kombinasi ini belum cukup menekan angka transisi palsu.
- **Pola baru ditetapkan:** fitur klasifikasi rule-based apa pun ke depan yang memproses time-series dari data satelit (noisy secara inheren) WAJIB pakai hysteresis/dead-band + syarat durasi minimum di sekitar nilai ambang — threshold tunggal tanpa penyangga terbukti rawan "chattering". Kalau menggabung >1 sumber data dengan skala berbeda jadi satu urutan kronologis, titik sambungan antar-sumber juga harus diwaspadai sebagai sumber sinyal palsu, bukan cuma noise dalam 1 sumber.
- Root cause murni desain algoritma, BUKAN bug kode — v12 berjalan tepat sesuai spesifikasi awalnya, spesifikasinya saja yang kurang mempertimbangkan karakteristik noise data remote sensing.
- **Verifikasi hasil aktual (setelah fix v13):** oscillation_count Musim 1/2026 Wayan Suparta turun dari 14 → **4** (dipanggil ulang sungguhan via RPC, bukan simulasi), klasifikasi akhir tidak berubah (`oscillating_awd_like`, karena 4 masih ≥ ambang 2).

**Temuan lanjutan — status additionality Wayan Suparta MASIH BELUM PASTI (08 Juli 2026):**
- Fungsi otomatis dijalankan untuk SEMUA `planting_seasons` yang tercatat (4 musim, 3 plot). Hasil: Wayan Suparta Musim 2/2025 (3 transisi) dan Musim 1/2026 (4 transisi) sama-sama `oscillating_awd_like`; Budidaya BSO dan Men Lembug `insufficient_data` (histori satelit cuma pernah di-backfill untuk plot Wayan Suparta, bukan masalah algoritma).
- **Dua metode analisis NDWI/SAR yang pernah dilakukan di project ini TIDAK apple-to-apple** — penting diingat ke depan: analisis manual "eyeball grafik" (07 Juli 2026, periode Agu-Nov 2025) dilakukan SEBELUM konsep `planting_seasons` ada dan sebelum periode itu bahkan masuk musim tanam resmi manapun; analisis otomatis resmi berbasis rentang `planting_date`..`actual_harvest_date` eksplisit. Hasil "continuous_flooding" (manual) vs "oscillating_awd_like" (otomatis) BUKAN kontradiksi — dua pertanyaan berbeda ke periode yang berbeda pula.
- **Kedua musim resmi yang sudah tercatat sama-sama borderline** (3 dan 4 transisi, tipis di atas ambang minimal 2) — jauh dari angka yang diharapkan untuk AWD yang dijalankan ketat/rutin (~9-13 alternasi untuk siklus 5-10 harian sepanjang musim 90-130 hari). **Kesimpulan additionality (apakah plot ini benar-benar praktik AWD yang disengaja, relevan untuk klaim karbon) MASIH BELUM PASTI dari data satelit saja** — sinyal campuran/borderline, bukan jelas ke arah AWD maupun konvensional.
- Data historis 2024–Oktober 2025 tidak punya `planting_seasons` resmi tercatat (tabel baru ada sejak 04 Juli 2026) — tidak bisa dianalisis ulang otomatis untuk perbandingan lintas-musim yang lebih panjang; satu-satunya cara membandingkan periode itu tetap analisis manual.
- **Rekomendasi:** konfirmasi lapangan via wawancara pekaseh sebagai penentu akhir — resolusi temporal data satelit (6-15 hari) secara inheren tidak bisa membedakan "AWD terjadwal ketat" dari "pengeringan situasional beberapa kali". User merujuk dokumen `SOP_Tanam_Subak_Sangeh_Konfirmasi.pdf` sebagai referensi proses konfirmasi ini — **dicatat: file ini belum ditemukan di repository project**, perlu klarifikasi/diunggah kalau memang jadi bagian dari alur kerja resmi.
- Diskusi terbuka (belum diputuskan): apakah perlu kategori ketiga `borderline_ambiguous` (misal 2-4 transisi) supaya beda dari kasus yang jelas tegas (≥5, ambang usulan berbasis penalaran domain — BUKAN hasil kalkulasi statistik karena sampel valid baru n=2 musim). Backfill satelit untuk plot lain (Budidaya BSO, Men Lembug) ditahan dulu sampai ini diputuskan.

**Keputusan: kategori ketiga `borderline_ambiguous` diimplementasikan (migration v14, 08 Juli 2026):**
- Skema klasifikasi jadi 3 kategori: **0-1 transisi → `continuous_flooding`**, **2-4 transisi → `borderline_ambiguous`** (baru), **≥5 transisi → `oscillating_awd_like`** (ambang naik dari 2 ke 5).
- **Ambang "5" adalah keputusan penalaran domain, BUKAN hasil kalkulasi statistik** — ditegaskan ulang karena penting: sampel valid baru n=2 musim (Musim 2/2025 dan Musim 1/2026, keduanya milik plot yang sama, Wayan Suparta). Penalarannya: AWD yang dijalankan ketat/rutin (siklus ~5-10 hari) sepanjang musim 90-130 hari idealnya menghasilkan ~9-13 alternasi kalau sampling cukup rapat; angka 5 dipilih sebagai titik tengah yang jelas lebih tinggi dari "1 siklus penuh terbukti" (ambang lama, 2) tapi masih realistis mengingat interval sampling SAR/NDWI 6-15 harian. **WAJIB dikalibrasi ulang begitu sampel bertambah** (misalnya setelah backfill plot Budidaya BSO/Men Lembug menghasilkan data yang cukup untuk dianalisis) — jangan anggap ambang ini final.
- UI: badge `borderline_ambiguous` dapat warna netral abu-kuning (`bg #eae6d9`, `text #6b6047`) — sengaja dibedakan dari hijau (`oscillating_awd_like`) dan amber (`continuous_flooding`) supaya tidak salah dibaca sebagai salah satu ekstrem. Teks tetap: "Pola campuran — tidak cukup tegas untuk disimpulkan, perlu konfirmasi lapangan."
- **Hasil verifikasi aktual (RPC dipanggil ulang sungguhan):** kedua musim Wayan Suparta yang sebelumnya `oscillating_awd_like` (skema 2-kategori) sekarang **`borderline_ambiguous`** — Musim 2/2025 tetap 3 transisi, Musim 1/2026 tetap 4 transisi (angka penghitungan transisi tidak berubah, cuma ambang kategorinya yang bergeser). Ini konsisten dengan penilaian awal user bahwa kedua musim ini belum cukup tegas untuk diklaim sebagai AWD.

**Observasi tambahan — sampel bertambah jadi n=3 (08 Juli 2026, setelah backfill Budidaya BSO):**
- Musim 1/2026 Budidaya BSO (satu-satunya musim tercatat untuk plot ini, sudah panen, 12 Mar–01 Jul 2026): 6 NDWI + 33 SAR (39 titik) → **5 transisi** → `oscillating_awd_like`. **Angka ini PAS DI AMBANG MINIMUM (5), bukan jauh melewatinya** — sama seperti 2 sampel Wayan Suparta, hasil ini bukan sinyal AWD yang kuat/meyakinkan, cuma baru cukup lolos dari zona borderline.
- Total sampel valid sekarang **n=3**: 3, 4, dan 5 transisi — ketiganya berkerumun sempit di sekitar batas `borderline_ambiguous`/`oscillating_awd_like`, belum ada satu pun yang jelas tegas ke salah satu ekstrem. **n=3 masih terlalu kecil untuk mengkalibrasi ulang ambang "5" secara statistik** — dicatat sebagai observasi yang menarik untuk dipantau, BUKAN dasar untuk mengubah ambang sekarang.
- **PENTING — batasan yang harus selalu disertakan kalau hasil Budidaya BSO ini dirujuk ke depan:** plot ini dibina program Save Subak sejak awal 2024, tapi arsip backfill satelit cuma mulai Juli 2024 (jauh dari awal 2024) DAN cuma ada 1 musim tanam tercatat di sistem (Mar-Jul 2026, jauh setelah pembinaan dimulai). **Data ini TIDAK BISA dipakai untuk menyimpulkan "pembinaan berhasil mengubah pola pengairan ke arah AWD"** — itu perlu perbandingan before-after (data pra-pembinaan vs pasca-pembinaan) yang sama sekali tidak tersedia dari sistem ini untuk plot ini. Yang ada cuma 1 titik data pasca-pembinaan tanpa pembanding.

**⚠️ BUG BESAR — cloud_cover_percent salah dihitung sejak migration v1, ditemukan & diperbaiki (08 Juli 2026):**
- **Pemicu:** User konfirmasi lapangan langsung — padi masih ada di lahan Budidaya BSO 26 Mei 2026, tapi sistem melaporkan NDVI≈0 ("kosong/bera").
- **Root cause:** `cloud_cover_percent` di SELURUH pipeline (`lib/sentinel-hub/ndvi.ts`, `scan/route.ts`, `backfill-satellite.mjs` — 3 lokasi identik sejak scaffold pertama) dihitung dari band **`dataMask`**, yang cuma menandai "piksel punya data sensor" — **BUKAN detektor awan**. Awan tebal tetap `dataMask=1`. Diverifikasi silang ke Catalog API resmi: cloud cover asli 26 Mei 2026 = 42%, bukan 0% yang dilaporkan sistem.
- **Fix:** evalscript diganti pakai band **SCL (Scene Classification Layer)** — deteksi cloud/shadow/cirrus SUNGGUHAN per-piksel, dihitung spesifik di area polygon petak (lebih presisi dari cloud cover level-tile Catalog API yang 110×110km).
- **Skala dampak — audit histori lengkap kedua plot:** dari 98 baris ber-NDVI (2 tahun, 2 plot), **67 baris (68%) direklasifikasi** — sebelumnya salah dipercaya "valid" (cloud rendah) padahal cloud asli tinggi, `estimated_phase` di-null-kan (nilai NDVI/NDWI mentah TIDAK dihapus). Tingkat reklasifikasi hampir identik di kedua plot (69% vs 68%) — mengindikasikan ini benar-benar sistemik, bukan kebetulan 1 plot.
- **Pola biner 0%/100% (tidak pernah nilai tengah):** dicatat sebagai kemungkinan karakteristik wajar, bukan bug baru — kedua plot sangat kecil (0.174 ha, 0.404 ha) relatif terhadap resolusi native SCL (20m), jadi polygon-nya cuma tercakup 1-beberapa piksel SCL saja.
- **Fitur Analisis Pola Pengairan Otomatis TIDAK terdampak** — `fn_analyze_season_water_pattern` membaca `ndwi_score`/`sar_flood_index` langsung, bukan `estimated_phase` yang jadi korban bug ini. Hasil `borderline_ambiguous` yang sudah diverifikasi (migration v14) tetap valid.
- **Pola baru ditetapkan — WAJIB diikuti fitur satelit apa pun ke depan:** JANGAN PERNAH pakai `dataMask` sebagai proxy deteksi awan (cuma penanda "ada data", bukan cuaca). Deteksi awan Sentinel-2 yang benar: band **SCL** (per-polygon, presisi tinggi) atau `eo:cloud_cover` dari Catalog API (level-tile, lebih kasar tapi tanpa perlu ubah evalscript).
- 1 dari 5 titik silang-cek independen (31 Mei 2025, Budidaya BSO) menunjukkan hasil tidak konsisten dengan cloud cover resmi tile-level (0% vs 43%/26% resmi) — belum dikonfirmasi visual, kemungkinan wajar (awan tidak merata), tapi dicatat sebagai area yang perlu spot-check manual, bukan diasumsikan benar.

**Bukti empiris pendukung keputusan integrasi SAR — statistik tutupan awan per musim tanam (08 Juli 2026):**

| Musim | Rentang | Total Scan Optik | Cloud >15% (tidak reliable) | Valid | NDWI Valid : SAR |
|---|---|---|---|---|---|
| Wayan Suparta — Musim 2/2025 | 05 Nov 2025 – 11 Mar 2026 | 9 | **8 (88,9%)** | 1 (11,1%) | **1 : 41** |
| Wayan Suparta — Musim 1/2026 | 07 Apr 2026 – 08 Jul 2026 | 8 | 4 (50%) | 4 (50%) | 4 : 25 |
| Budidaya BSO — Musim 1/2026 | 12 Mar 2026 – 01 Jul 2026 | 9 | 4 (44,4%) | 5 (55,6%) | 5 : 33 |

- **Musim 2/2025 Wayan Suparta adalah bukti paling tegas:** dari 9 percobaan scan optik Sentinel-2 sepanjang musim hujan (Nov 2025–Mar 2026), **cuma 1 (11,1%) yang bisa dipercaya** — 8 lainnya gagal karena awan. Di periode yang SAMA PERSIS, **SAR merekam 41 titik data lengkap**, sama sekali tidak terganggu awan. **Kesimpulan: tanpa SAR, analisis pola pengairan untuk musim ini praktis tidak mungkin dilakukan dari citra optik saja** — bukan cuma "SAR lebih andal", tapi "SAR satu-satunya sumber yang benar-benar tersedia" untuk musim itu.
- Ketiga musim tanpa kecuali menunjukkan rasio NDWI-valid:SAR yang timpang jauh (1:6 sampai 1:8) — SAR konsisten memberi kepadatan data 6-8x lebih banyak daripada NDWI yang benar-benar bisa dipercaya.
- Ini mengubah status justifikasi arsitektur SAR (baris "Tech Stack" di atas) dari klaim teoritis/riset literatur (03 Juli 2026) menjadi **bukti empiris terukur dari data 2 tahun project sendiri**.
- Transparansi ditambahkan ke UI: titik cloud-invalid (>15%) ditandai merah di grafik Tren NDVI & NDWI (garis tetap tersambung, cuma warna dot beda), dan tiap card musim tanam menampilkan persentase scan optik yang gagal awan + rekomendasi pakai SAR sebagai cadangan.

**Riset kelayakan teknis:**
- EO Browser resmi deprecated Februari 2025 — pengganti untuk UI manual adalah Copernicus Browser, untuk akses programatik pakai Sentinel Hub API (Statistical/Processing API) di bawah Copernicus Data Space Ecosystem
- Skala lahan puluhan hektar kemungkinan besar masih masuk free tier Sentinel Hub (dibandingkan referensi: monitoring 1 kota 413 km² setahun penuh hanya ~886 Processing Unit)
- Biaya verifikasi karbon (LVV/auditor) tidak dipublikasi terbuka per-project; biaya pungutan resmi SRN PPI kecil (~Rp3.000/dokumen SPE-GRK), tapi jasa auditor komersial jauh lebih besar dan perlu ditanya langsung ke lembaga terkait
- Proses validasi-verifikasi SRN PPI bisa makan waktu 6-7 bulan; ada preseden project lain (Bujang Raba, Jambi — REDD+ hutan) yang sempat macet di tahap verifikasi

**Keputusan arsitektur:**
- Vercel Cron dipilih dibanding n8n — kebutuhan otomasi ini linear (tarik data → simpan), tidak perlu workflow bercabang yang jadi kekuatan utama n8n; n8n juga butuh hosting terpisah yang menambah beban maintenance solo developer
- Interval scan default diubah dari 5 hari (rencana awal) menjadi konfigurasi per-plot (`scan_interval_days`, default 10 hari) — untuk hemat kuota API dan karena kebutuhan jadwal tanam/panen tidak butuh sampling seketat deteksi anomali harian
- Nama level makro diubah dari "Subak" (istilah spesifik budaya Bali) menjadi generik "Kawasan" dengan kolom `local_term` — supaya siap dipakai di luar Bali tanpa refactor besar
- Carbon engine (mrv_carbon_records + formula CH4/CO2e) sengaja ditunda ke Fase 2 — prioritas awal adalah modul monitoring tanam/panen yang jadi tujuan awal founder

**Keputusan desain/prototype:**
- 1 file HTML dipilih untuk prototype (bukan 2 file terpisah makro/mikro) — alur drill-down lebih mulus, 1 sumber data
- Fitur AI Q&A di-skip untuk versi downloadable (butuh koneksi API yang cuma jalan di dalam platform Claude) — diganti panel Insight Otomatis berbasis rule sederhana yang tetap jalan offline
- Formula karbon prototype: baseline 260 kg CH4/ha/musim (ilustratif, sawah tergenang terus-menerus) × rasio hari kering terdeteksi dari NDWI × GWP CH4 ≈27x (IPCC AR6) = estimasi CO2e — SEMUA angka ini berlabel "ilustratif", bukan bersertifikasi

**Keputusan arsitektur multi-user/multi-organisasi (19 Juli 2026 — desain saja, BELUM diimplementasi):**
- **3 role dipertahankan** dari skema `user_profiles` yang sudah ada sejak migration v1 (`role` check `'admin'/'auditor'/'pekaseh'`) — tidak perlu skema baru, tinggal disambungkan ke Supabase Auth (lihat temuan audit auth API, entri PROJECT_LOG 19 Juli): `admin` = Save Subak internal, akses semua kawasan; `pekaseh` = perwakilan tiap kelompok Subak, akses hanya kawasan miliknya, bisa edit/tambah data (foto, musim tanam) tapi tidak bisa bikin kawasan baru; `auditor` = LSO (Lembaga Sertifikasi Organik, contoh: Kertha Bali Sejahtera).
- **Role `auditor` (LSO) BEDA MODEL dari `admin`/`pekaseh`:** LSO punya "dunia data terpisah" (tenant sendiri) — input polygon/petak SENDIRI meski lokasinya kebetulan sama dengan petak yang sudah terdaftar Save Subak/pekaseh. Admin Save Subak SENGAJA TIDAK otomatis bisa lihat data LSO — dipisah karena pertimbangan privasi antar-organisasi (LSO adalah entitas terpisah, bukan bagian internal Save Subak).
- **2 pola data berjalan bersamaan dalam sistem yang sama:** (a) "1 peta bersama" untuk admin+pekaseh — kawasan dibuat & dimiliki Save Subak, pekaseh diberi akses kolaborator ke kawasan miliknya (bukan bikin kawasan terpisah), semua input pekaseh otomatis terlihat admin karena memang data yang sama; (b) "tenant terpisah" untuk LSO dan kemungkinan besar partner masa depan (hotel untuk traceability, investor untuk monitoring dampak regeneratif) — masing-masing organisasi punya dunia data independen, tidak otomatis terlihat Save Subak.
- **Mekanisme akses:** perlu 1 tabel penghubung many-to-many (nama kerja sementara `user_kawasan_access`, skema final menyusul saat implementasi) supaya 1 user bisa di-assign ke 1 atau lebih kawasan/wilayah data — sengaja TIDAK menaruh `kawasan_id` langsung di tabel user, supaya fleksibel kalau nanti 1 kawasan butuh >1 user atau 1 user butuh akses >1 kawasan/tenant.
- **Role tambahan diputuskan perlu ada NANTI** (prioritas rendah, belum diimplementasi): `viewer` — untuk pihak riset/universitas, read-only + bisa download data milik Save Subak saja (bukan data LSO/organisasi lain), tidak bisa edit/bikin data.
- **DITUNDA SADAR (dicatat supaya tidak lupa kenapa):** konsep "organisasi generik" (tabel `organizations` + `organization_members`, role generik owner/member/viewer) sempat didiskusikan untuk mengantisipasi banyak jenis partner masa depan tanpa perlu tambah nilai role baru di kode tiap kali ada partner baru. **Keputusan: ditunda, dianggap over-engineering untuk kebutuhan yang belum konkret.** 3 role tetap (admin/pekaseh/auditor) cukup untuk sekarang karena kebutuhannya sudah jelas. Direkomendasikan didiskusikan ulang begitu ada partner konkret pertama (hotel/investor) yang benar-benar mau onboarding — bukan diprediksi sekarang.
- Implementasi menyusul setelah persiapan meeting Rikolto selesai — lihat PROJECT_LOG.md 19 Juli 2026 untuk konteks diskusi lengkap.

**Keputusan redesign UI besar bergaya QGIS (21 Juli 2026 — rencana/mockup saja, BELUM diimplementasi):**
- **Arah gaya visual:** terinspirasi software GIS (QGIS) — sidebar navigasi kiri yang bisa di-collapse jadi rail ikon, peta jadi elemen dominan layar (bukan dikelilingi banyak kartu terpisah seperti sekarang), tipografi lebih rapat/padat dan sans-serif (kesan software data-teknis, bukan dekoratif).
- **Halaman Kawasan:** peta mengisi sebagian besar layar; strip statistik (Total Petak/Luas/NDVI Rata-rata/Mode Intensif) jadi bar tipis mengambang di atas peta (bukan kartu besar terpisah); daftar petak jadi drawer collapsible di bawah peta — search/filter/sortir yang SUDAH diimplementasi (19-20 Juli) dipertahankan apa adanya, bukan dirombak ulang.
- **Interaksi klik petak — 3 tingkat baru:** (1) kartu kecil menempel dekat titik klik di peta (bukan modal tengah layar) berisi ringkasan cepat (Jenis Lahan, Luas, Tanggal Tanam, Estimasi Panen, Kesehatan, 1 insight singkat); (2) tombol "Lihat Detail" dari situ buka modal preview lebih lengkap; (3) tombol "Lihat Analisa Lengkap" dari modal baru pindah ke HALAMAN TERPISAH detail petak. Keputusan sadar: pola navigasi halaman biasa (bukan overlay/drawer di halaman yang sama) dipilih supaya dapat keuntungan gratis Next.js — tombol back browser otomatis benar, URL per-petak bisa di-share/bookmark, tidak perlu state management manual untuk overlay.
- **Halaman Detail Petak dipecah 2 tingkat:** **Mode Ringkas** (default, semua role) — panel kiri collapsible accordion (Info Dasar, Analisis Otomatis, Kesehatan Lahan dengan chart default rentang 3 Bulan, Jenis Lahan, Musim Tanam & Estimasi Karbon, Foto Lapangan), peta besar di kanan dengan kontrol layer mengambang. **Mode Audit** (halaman terpisah lebih lebar, dipicu tombol dari Mode Ringkas) — layout mirip tampilan lengkap yang sudah ada sekarang, panel Sumber Data & Verifikasi 2 kolom lengkap ID produk satelit, chart dengan toggle rentang PENUH (1 Bulan–3 Tahun). **Keputusan akses:** tombol ke Mode Audit DISEMBUNYIKAN TOTAL (bukan cuma disabled) untuk role `pekaseh` — cuma `admin`/`auditor` yang melihatnya. Baru bisa diimplementasi setelah sistem auth multi-role (didesain 19 Juli 2026) benar-benar dibangun, bukan sebelumnya.
- **Halaman baru "Laporan Kawasan"** menggantikan rencana lama "Jenis Lahan" di sidebar — menghitung otomatis total hektare per kategori Jenis Lahan untuk kawasan yang sedang dibuka (kartu ringkasan + bar chart), mengikuti kawasan & filter aktif, BUKAN agregasi lintas-kawasan.
- **Tombol "Picu Scan Semua Petak" (baru, mengubah rekomendasi lama):** sebelumnya direkomendasikan HANYA scan per-petak tanpa tombol borongan sama sekali (lihat diskusi kuota 19 Juli). Sekarang keputusan sadar: boleh ada tombol borongan ASALKAN wajib ada dialog konfirmasi (jumlah petak yang akan di-scan, estimasi pemakaian kuota Copernicus, tanggal terakhir dipakai borongan) sebelum eksekusi — supaya tidak sengaja menghabiskan kuota bulanan.
- **Sidebar navigasi final:** Kawasan, Semua Petak (khusus role admin — tidak relevan untuk pekaseh yang cuma punya 1 kawasan; **spesifikasi lengkap fitur ini ditentukan 23 Juli 2026, lihat entri di bawah**), Laporan Musim (ikut kawasan & filter aktif, bukan lintas-kawasan), Laporan Kawasan, Foto Lapangan, Pengaturan, Bantuan. Item "Estimasi Karbon" yang sempat diusulkan terpisah **diputuskan tidak perlu**, dihapus dari rencana (sudah tercakup di accordion Musim Tanam & Estimasi Karbon pada Mode Ringkas).
- **Status:** murni tahap desain/mockup HTML statis terpisah (sudah diuji-coba interaktif, TIDAK terhubung data/API asli), belum menyentuh kode aplikasi sama sekali. Implementasi ditunda sampai setelah persiapan Rikolto selesai, kemungkinan berbarengan dengan refactor `PlotDashboard.tsx` (~2000 baris) yang sudah direncanakan sebelumnya — momentum yang pas untuk sekalian merapikan struktur kode itu.

**Spesifikasi fitur "Semua Petak" + temuan duplikasi lahan lintas-kawasan (23 Juli 2026 — rencana & temuan investigasi, BELUM diimplementasi):**
- **"Semua Petak" (item sidebar dari rencana redesign 21 Juli di atas) sekarang punya spesifikasi jelas** — bukan sekadar tabel/daftar lintas-kawasan seperti dugaan awal, tapi **PETA BESAR SE-BALI** yang menampilkan SEMUA petak dari SEMUA kawasan sekaligus (tidak dibatasi per-kawasan), dengan **filter Jenis Lahan** (Organik/Regenerative/Konversi/Konvensional/Belum Ditentukan) — pilih 1 kategori, peta cuma tampilkan petak yang sesuai. Reuse langsung logika warna-per-kategori yang sudah ada (`LAND_CATEGORY_COLORS` di `lib/plot-geo.ts`) — tidak perlu skema warna baru. Khusus role admin/Save Subak (konsisten dengan keputusan role 19 Juli). Dikerjakan BARENGAN eksekusi redesign UI besar (bukan fitur terpisah sendiri), sama-sama menunggu pasca-Rikolto.
- **Temuan investigasi (23 Juli 2026, PostGIS via turf.js) — bukti NYATA duplikasi lahan lintas-kawasan:** dibandingkan geometri seluruh petak Subak Sangeh (11 petak) vs Kelompok tani Sri Galih (23 petak) — **6 dari 11 petak Sangeh (54%) punya overlap >30% dengan petak Sri Galih**, termasuk 1 overlap 100% dan 4 lainnya di atas 90%. Nama petani di pasangan-pasangan itu SALING COCOK secara tekstual (mis. "I Nyoman Sujana" identik di kedua kawasan, "Men Lembug" vs "Ni Made Glembug", "Made sengger" vs "I Made Sengger") — bukti kuat ini benar-benar LAHAN FISIK YANG SAMA dicatat 2x lewat 2 alur pendataan berbeda, bukan kebetulan geometris. Detail lengkap ada di laporan investigasi read-only (PROJECT_LOG.md, sesi sebelumnya).
- **Implikasi langsung:** rencana dashboard rangkuman "Total per Jenis Lahan" lintas-kawasan (agregasi hektare gabungan semua kawasan) **TIDAK BOLEH dibangun sebelum masalah duplikasi ini ditangani** — berpotensi salah hitung signifikan (diperkirakan 25-30% dari total gabungan adalah duplikasi, dari kasus Sangeh+Sri Galih saja).
- **Keputusan fitur — "Opsi D" (rencana kerja, BELUM dieksekusi, ditunda pasca-Rikolto):** deteksi duplikasi lintas-kawasan dengan pendekatan RINGAN, bukan otomatis hitung ulang total secara matematis presisi:
  1. **Deteksi geometris** — `ST_Intersects` + `ST_Area(ST_Intersection(...))` PostGIS antar-polygon lintas-kawasan. Ambang awal >30% (terbukti di investigasi cukup menangkap kandidat nyata tanpa banyak positif-palsu dari petak bertetangga) — ambang final produksi mungkin dinaikkan ke 50-70%, didiskusikan lagi saat eksekusi.
  2. **Hasil masuk "kotak tinjauan"** (bukan otomatis diputuskan) — admin (Save Subak) melihat daftar pasangan terdeteksi, MEMILIH MANUAL mana yang dihitung untuk total. **Kalau kategori Jenis Lahan berbeda antara pasangan yang overlap, TIDAK ADA aturan otomatis "yang menang" — selalu ditandai "Perlu Ditinjau" untuk diputuskan manual, TIDAK PERNAH otomatis pilih salah satu.**
  3. **Keputusan admin tersimpan permanen** — perhitungan total berikutnya otomatis konsisten tanpa perlu tinjau ulang pasangan yang sama.
  Perlu tabel/kolom baru untuk menyimpan hasil deteksi + keputusan tinjauan — skema detail menyusul saat eksekusi, belum didesain sekarang.
- **Status:** murni keputusan rencana + hasil investigasi read-only. **TIDAK ADA kode aplikasi (app/, components/, lib/) yang disentuh** untuk kedua hal ini.

**🔴 Keputusan fix bug KRITIS `resx`/`resy` Sentinel Hub Statistical API (25 Juli 2026):** lihat entri detail di PROJECT_LOG.md 25 Juli 2026 untuk investigasi/bukti lengkap. Ringkasan keputusan teknis:
- **Root cause:** `resx`/`resy` di object `aggregation` Sentinel Hub Statistical API diinterpretasikan dalam SATUAN CRS yang dipakai (`bounds.properties.crs`). Semua request project ini pakai `EPSG:4326` (derajat lon/lat) — nilai `10` yang dimaksudkan "10 meter" terbaca API sebagai "10 derajat" (~1.100 km), membuat polygon petak kecil (rata-rata <1 ha) cuma dapat 1 sample pixel per scan, bukan rata-rata seluruh area.
- **Pendekatan fix yang dipilih (BUKAN reprojeksi ke UTM):** tetap pakai geometry & CRS `EPSG:4326` apa adanya (tidak perlu reproyeksi koordinat polygon, yang berisiko menambah bug baru lewat library transformasi tambahan), tapi ganti `resx`/`resy` jadi nilai DERAJAT yang dihitung presisi dari formula panjang derajat lintang/bujur WGS84 pada lintang representatif Bali (~8.5°S): `resx=0.00009083`, `resy=0.00009042` (≈10m x 10m di lintang itu). Konstanta disatukan di `lib/sentinel-hub/resolution.ts` (sebelumnya nilai `10` di-copy-paste ke 4 file berbeda — salah satu penyebab bug ini luput lama, karena tidak ada 1 sumber kebenaran).
- **Kalau project ini suatu saat menjangkau lintang jauh dari Bali**, konstanta ini WAJIB dihitung ulang untuk lintang baru itu (dicatat sebagai komentar di `resolution.ts`) — TIDAK valid dipakai sembarang lintang tanpa recalculate.
- **4 lokasi diperbaiki** (bukan 3 yang awalnya diketahui — `lib/sentinel-hub/ndwi.ts` ditemukan juga kena bug yang sama, dipakai cron harian `app/api/cron/satellite-scan/route.ts`): `lib/sentinel-hub/ndvi.ts`, `lib/sentinel-hub/ndwi.ts`, `app/api/plots/[plotId]/baseline/route.ts`, `app/api/plots/[plotId]/scan/route.ts`.
- **Reprocess data historis DITUNDA SADAR** — hanya 1 plot ("Budidaya BSO") yang direprocess untuk validasi fix. Reprocess massal ke SEMUA plot BELUM dieksekusi, menunggu keputusan user (lihat rekomendasi di PROJECT_LOG.md).

**Rencana fitur "Import dari KML" bulk-tambah petak + deteksi collision 2 lapis (25 Juli 2026 — rencana/spesifikasi saja, BELUM diimplementasi):**
- **Lokasi &amp; alur:** tombol "Import dari KML" di halaman kawasan (sejajar tombol "+ Gambar Polygon Baru" yang sudah ada, BUKAN bikin kawasan baru otomatis — user harus sudah di 1 kawasan tujuan). Upload `.kml` → parse ke GeoJSON (`togeojson`) → halaman PREVIEW di peta (nama dari tag `<name>` KML jadi usulan nama petani) → user review &amp; konfirmasi → baru tersimpan (panggil `insert_plot` per polygon).
- **Deteksi collision 2 lapis di tahap PREVIEW (sebelum simpan):** Lapis 1 (internal, antar-polygon DALAM 1 file) &amp; Lapis 2 (eksternal, vs SEMUA petak database lintas-kawasan) — keduanya pakai metode overlap &gt;30% yang sama dengan investigasi duplikasi lahan 23 Juli 2026 (`@turf/boolean-intersects` + `@turf/intersect`).
- **Hubungan dengan Opsi D (rencana 23 Juli 2026):** fitur ini "cicilan pertama" dari Opsi D — scope lebih kecil, HANYA mencegah duplikat BARU lewat jalur import KML, TIDAK menyelesaikan duplikat yang SUDAH ada di database (kasus Sangeh vs Sri Galih tetap PR Opsi D penuh, terpisah).
- **Prioritas timing (beda dari fitur besar lain):** urutan (a) selesaikan reprocess resx/resy ke semua kawasan dulu, (b) baru bangun fitur ini — **keduanya SEBELUM Rikolto**, tidak ditunda pasca-Rikolto seperti redesign UI besar/Opsi D penuh.
- **Status:** murni spesifikasi tertulis. TIDAK ADA kode aplikasi disentuh untuk keputusan ini.

**Rencana PWA Mobile Petugas Lapangan + Checklist Validasi 5 Kategori (27 Juli 2026 — mockup saja, BELUM diimplementasi):**
- **Konsep:** aplikasi mobile TERPISAH (kandidat PWA) khusus petugas lapangan, alur native mobile (bukan versi diciutkan dari desktop) — 3 menu: (1) Update Lahan (pilih petani dari daftar, form ringkas foto/tanggal tanam-panen/hasil/catatan; edit detail lengkap tetap di web), (2) Polygon Baru (gambar di lapangan, edit ulang bentuk tetap di web), (3) **Analisa Satelit** — badge status + 3 chart mobile-native (NDVI/NBR/SAR) + **Checklist Validasi 5 Kategori** (Indikasi Pembakaran, Pola Air/AWD, Fase Tanaman, Jenis Lahan, Catatan Umum bebas teks) dengan konfirmasi Sesuai/Tidak Sesuai/Tidak Yakin per kategori + foto opsional terpisah per kategori.
- **Tujuan strategis:** membangun database ground-truth dari konfirmasi lapangan — persyaratan teknis krusial: WAJIB simpan snapshot nilai sistem saat konfirmasi (bukan link ke data live, supaya validitas historis tidak rusak kalau data live direproses ulang) — untuk kalkulasi akurasi nyata per kategori, kalibrasi ulang ambang batas berbasis bukti statistik, dan fondasi migrasi ke pendekatan ML di masa depan kalau diperlukan.
- **Prasyarat WAJIB sebelum implementasi:** (a) refactor kode (checkpoint sudah dibuat, `docs/CHECKPOINTS.md`), (b) sistem auth multi-role (rencana 19 Juli 2026) — supaya identitas pengisi validasi lapangan jelas &amp; data ground-truth bisa dipercaya.
- **Status:** murni mockup HTML (`Sinagri_UI_Mockup.html`, `Sinagri_Mobile_Lapangan.html`), dibuat di luar Claude Code. TIDAK ADA kode aplikasi disentuh untuk keputusan ini.

**Keputusan: TIDAK memakai `FeatureCollection` Sentinel Hub Statistical API untuk hemat kuota skala besar (27 Juli 2026 — investigasi murni, TIDAK ADA kode aplikasi disentuh):**
- **Temuan:** Statistical API (sinkron) TIDAK mendukung multi-polygon `FeatureCollection`/`GeometryCollection` dalam 1 request — dikonfirmasi 3 lapis: dokumentasi resmi (tidak ada contoh format ini), forum resmi (staf Sentinel Hub: "not possible for the moment, so you have to make a loop"), dan uji langsung ke endpoint produksi (8 petak asli Sri Galih, evalscript NDVI produksi persis sama) → HTTP 400 `COMMON_BAD_PAYLOAD` untuk kedua varian yang dicoba. Multi-polygon batch HANYA tersedia lewat **Batch Statistical API** terpisah (async, GeoPackage + S3-compatible storage, sampai 700.000 fitur) — perubahan arsitektur jauh lebih besar daripada sekadar ganti format request.
- **Koreksi info awal:** klaim "100 PU minimum/request" yang sempat beredar TIDAK terbukti — dicek ulang, halaman resmi Quotas tidak menyebutkannya; uji nyata 4x ke endpoint produksi menunjukkan **0.01 PU/request** konsisten. Kuota free tier CDSE yang benar: **10.000 request/bulan DAN 10.000 PU/bulan** (bukan 30.000 request/bulan seperti asumsi awal).
- **Keputusan:** tidak ada implementasi dari premis ini (tidak tersedia). Kalau skala "seluruh Bali" (~160.000 petak) benar-benar direalisasikan di masa depan, jalur yang relevan adalah investigasi TERPISAH soal Batch Statistical API dan/atau upgrade paket berbayar — bukan lanjutan dari investigasi ini. Detail lengkap (angka estimasi 3 skala, metodologi uji): `docs/PROJECT_LOG.md` entri 27 Juli 2026.

**Rencana "Skala Seluruh Bali" — 7 spesifikasi pendukung (27 Juli 2026 — murni dokumentasi, BELUM diimplementasi):**
- **(1) Saklar "Perlu Pemantauan Satelit" per petak:** toggle Ya/Tidak, default "Tidak" untuk pemetaan massal — petak tersimpan untuk peta "Semua Petak" tapi TIDAK dipanggil cron harian, TIDAK makan kuota. Jawaban langsung atas temuan kuota di investigasi FeatureCollection (poin di atas).
- **(2) Toggle Pembibitan/Budidaya:** per-polygon (bukan per-akun), reuse pola dropdown `status_lahan` yang sudah ada. Field tambahan (Nomor Sertifikat Benih dkk) muncul kalau dipilih "Pembibitan".
- **(3) Tema white-label** (Sinagri Organik/Regeneratif/Konversi dll): CUMA beda warna/logo/nama, BUKAN beda fitur (dikonfirmasi eksplisit user). **Prasyarat keras: auth multi-role selesai dulu.**
- **(4) Mode Presentasi:** toggle sembunyikan tombol edit, murni UI state client-side (BUKAN pembatasan server). Beda dari (5) — tidak butuh auth, bisa dikerjakan kapan saja.
- **(5) Role "Viewer" eksternal** (Rikolto/Dinas/mahasiswa audit formula): read-only + download, pembatasan DITEGAKKAN DI SERVER. Sama dengan role viewer di rencana auth 23 Juli. **Prasyarat keras: auth multi-role selesai dulu.** Beda dari (4).
- **(6) Kurasi manual sumber data per kategori** untuk agregasi "Semua Petak": admin pilih manual organisasi mana jadi "kebenaran resmi" per kategori Jenis Lahan. **Klarifikasi: BUKAN pengganti Opsi D (23 Juli)** — solusi tambahan yang lebih murah khusus untuk kasus agregasi Semua Petak Bali; Opsi D penuh (review pasangan overlap individual) tetap kebutuhan terpisah yang belum selesai.
- **(7) Deteksi tumpang tindih real-time saat gambar polygon manual:** reuse `lib/collision-detection.ts` (sudah terbukti bekerja di fitur Import KML 25 Juli) — dipasang juga di tombol "+ Gambar Polygon Baru" manual, bukan cuma Import KML. Alur 2 tahap: (a) real-time, tanya konfirmasi ringan "petak sama atau bukan" ke petugas lapangan, data tetap tersimpan apapun jawabannya; (b) review admin terpisah (bagian Opsi D) untuk memutuskan acuan resmi.
- **Prioritas:** (4) bisa kapan saja; (2)+(7a) setelah refactor, tanpa perlu auth; (1)(6)(7b) bagian fitur "Semua Petak", tunggu refactor; (3)(5) wajib tunggu auth multi-role. Detail teknis lengkap: `docs/PROJECT_LOG.md` entri 27 Juli 2026 (07:10).

**Keputusan RLS & batas waktu Sentinel & koneksi DB (23 Oktober 2026):**
- **Cek role di policy RLS WAJIB lewat fungsi `public.is_admin()` / `public.get_my_role()`** (SECURITY DEFINER, STABLE, `search_path=public`, migration v24) — BUKAN `exists (select 1 from user_profiles ...)`. Subquery langsung ke `user_profiles` dari policy di tabel `user_profiles` sendiri menyebabkan error 42P17 "infinite recursion" yang merambat ke semua tabel. Tulis di policy sebagai `USING ((SELECT public.is_admin()))` atau `USING ((SELECT public.get_my_role()) = 'auditor')` — dibungkus `SELECT` supaya dievaluasi sekali per query. Berlaku juga untuk migration baru dan `migration_v2_saas` kalau kelak dijalankan.
- **Batas akhir `timeRange` Statistical API Sentinel Hub = tengah malam hari BERIKUTNYA (eksklusif)**, lewat helper `statsTimeRange()` di `lib/sentinel-hub/formulas.ts` — BUKAN `T23:59:59Z`. Dengan `aggregationInterval P1D`, interval terakhir yang tidak penuh dibuang API, jadi `T23:59:59Z` selalu menghilangkan hari terakhir (window 1 hari = kosong total). Process API/Catalog (`truecolor.ts`, `nbr.ts`, `catalog.ts`) tidak terkena karena tidak pakai interval agregasi.
- **`SUPABASE_DB_URL` harus memakai host pooler `aws-1-ap-southeast-1.pooler.supabase.com`**, bukan `aws-0-...` — project ini terdaftar di cluster pooler `aws-1`; `aws-0` menolak dengan "tenant/user not found" sebelum password diperiksa. Password di `.env.local` sudah benar (terbukti konek dengan host `aws-1`).

---

## STATUS PROJECT (ringkas — detail lengkap ada di PRD_AgriMRV.md)

- Tahap 1 (PRD & Brief): ✅ Selesai — 02 Juli 2026
- Tahap 2 (Desain/Prototype): 🟡 Sedang berjalan — prototype HTML makro+mikro+carbon+insight sudah ada
- Tahap 3 (Technical Design): dokumen terpisah `TECHNICAL_DESIGN_Tahap3.md` sudah dibuat, siap dieksekusi Claude Code
- Tahap 4-7: belum dimulai

**Untuk detail tracking status/tanggal/keputusan per tahap secara lengkap, rujuk `PRD_AgriMRV.md` — dokumen ini (BRIEF.md) fokus ke referensi teknis & keputusan produk, PRD fokus ke tracking progress.**
