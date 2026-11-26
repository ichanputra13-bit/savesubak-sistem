# Status Sinagri Saat Ini — 23 Oktober 2026

Dokumen ini adalah **sumber kebenaran tunggal** soal kondisi sistem Sinagri sekarang. Beda dari `PRD_AgriMRV.md` (roadmap awal, sudah basi — jangan dipakai untuk cek status, dibiarkan jadi arsip sejarah) dan `PROJECT_LOG.md` (log kronologis mentah, detail lengkap tiap sesi kerja).

**Cara pakai dokumen ini:** kalau kamu (Ichan) mau minta Claude Chat menyusun prompt teknis untuk Claude Code, tempelkan file ini dulu supaya Claude Chat tahu persis apa yang sudah ada, apa yang belum, dan aturan main project — sebelum menyusun instruksi apapun.

---

## 1. Apa itu Sinagri (ringkas)

Sinagri adalah sistem Digital MRV (Measurement, Reporting, Verification) berbasis citra satelit untuk memvalidasi klaim kredit karbon dari praktik AWD (Alternate Wetting and Drying / pengeringan berkala) di sawah padi. Dibangun untuk organisasi **Save Subak** di Bali, skala per-Subak/kelompok tani (bukan enterprise nasional).

Sistem menarik data dari Sentinel Hub (Copernicus) — NDVI, NDWI, NBR (optik) dan VV/VH (radar/SAR) — plus data cuaca (Open-Meteo), lalu menghitung otomatis (rule-based, **bukan AI/LLM**): fase tanam, pola air musim tanam, indikasi kesengajaan praktik AWD (intentionality), dan estimasi CO2e yang dicegah.

## 2. Status deployment

- **Belum live di production.** Jalan di localhost saja (`npm run dev`), belum di-deploy ke Vercel.
- Semua kerja sudah di-commit ke git lokal (branch `master`, belum pernah di-push — 0 remote). Checkpoint terakhir sebelum perubahan: tag `backup-before-bugfix-rls-cron-2026-10-23`.
- **Migration database:** v23 (`app_settings`) dan v2_saas (`organizations`) tercatat BELUM dijalankan (cek 31 Juli). **v24 (fix rekursi RLS) SUDAH DITULIS, BELUM DIJALANKAN** — menunggu user di SQL Editor.
- Traksi nyata: **1 kawasan (Subak Sangeh), 7 petak, 6 musim tanam** dengan data riil (bukan dummy) sejak backfill 3 tahun cuaca + histori satelit.

## 3. Stack teknis

Next.js 16 (App Router) + TypeScript strict + Tailwind CSS + Supabase (PostgreSQL/PostGIS/RLS) + Sentinel Hub API (Copernicus Data Space Ecosystem) + Open-Meteo (cuaca, gratis, tanpa API key) + Leaflet/Geoman (peta) + Recharts (grafik). Rencana hosting: Vercel (belum dipakai).

## 4. Fitur yang SUDAH ada & jalan (terverifikasi, bukan rencana)

| Fitur | Ringkas |
|---|---|
| Peta kawasan & petak | Input polygon manual via Leaflet/Geoman, PostGIS |
| Scan satelit otomatis | Cron harian + trigger manual per-petak, ambil NDVI/NDWI/NBR (Sentinel-2) + VV/VH SAR (Sentinel-1) + True Color RGB. **Catatan:** sampai 23 Okt 2026 cron harian TIDAK PERNAH dapat NDVI/NDWI (bug batas waktu `T23:59:59Z`), dan scan/baseline/SAR/backfill kehilangan hari terakhir tiap window — sudah diperbaiki (commit `d54017e`), cron belum dibuktikan jalan di produksi karena belum deploy |
| Estimasi fase tanam | Rule-based dari NDVI (`estimatePhase()`) |
| Pola air musim & AWD intentionality | Fungsi database `fn_analyze_season_water_pattern` (PL/pgSQL) — klasifikasi hysteresis dari SAR, plus cross-check dengan curah hujan 5 hari sebelumnya untuk membuktikan pengeringan itu **disengaja** (praktik AWD), bukan kekeringan alami. 100% rule-based, hasil sudah dihitung utk 6 musim (42%–100% intentionality, bervariasi per musim) |
| Estimasi CO2e | Formula NET CH4-N2O, IPCC 2019 Refinement + GWP AR6 (27), sudah diperbaiki dari bug regresi (migration v19) |
| Layer cuaca | Open-Meteo, otomatis semua petak, backfill 3 tahun historis, chart rentang 1bln/3bln/1thn/3thn |
| NBR (deteksi bakar jerami) | Selalu tampil (bukan cuma kalau ada indikasi) — penting untuk validitas data karbon |
| Panel "Analisis Otomatis" | Konsolidasi 1 lokasi: insight NDVI/NDWI + status NBR + ringkasan pola air musim + CO2e — sebelumnya tersebar |
| Foto Lapangan | Upload (auto-kompresi client-side), edit catatan, hapus (dgn konfirmasi), klik untuk perbesar (lightbox) |
| Citra True Color | Overlay RGB asli di peta per tanggal scan |
| Rebrand logo & UI | Logo Sinagri resmi + "Powered by Save Subak" di semua dokumen HTML |
| `update_owner.html` | Dashboard interaktif bilingual (ID/EN) untuk pemilik non-teknis — overview, rumus+sumber sitasi, changelog, log error, roadmap, catatan UX |

## 5. Sudah didiskusikan MATANG tapi BELUM dibangun

- **Autentikasi API** — semua endpoint API saat ini **tanpa auth sama sekali**. Ini prioritas keamanan #1 sebelum deploy production manapun.
- **Pupuk via Telegram bot** — petani lapor pemakaian pupuk lewat Telegram, masuk ke `field_logs` (skema belum final)
- **Foto via Telegram bot** — sama, alternatif channel selain upload manual di web
- **Upload dokumen MOU/perjanjian petani** — perlu tabel dokumen baru + file upload, belum didesain skemanya
- **Laporan PDF per musim tanam** — sudah ada **mockup visual disetujui** (foto+NDVI/NDWI/NBR/SAR+pemupukan+panen+curah hujan dalam 1 laporan cetak), tapi belum jadi fitur beneran di app. Catatan revisi dari user: ganti logo placeholder jadi logo asli, field "varietas" masih perlu diperjelas.
- **Ground-truthing piezometer** — foto pipa PVC ber-geotagging untuk validasi independen dari satelit (belum ada 1-2 tanggal basah/kering terkonfirmasi petani, dibutuhkan buat validasi arah formula SAR flood_index)
- **"Scan Semua Petak" tombol massal per kawasan** — direkomendasikan tetap dipicu per-petak dulu; kalau kawasan makin besar (>~30 petak), perlu keputusan batching

## 6. Keterbatasan/risiko yang diketahui (jujur, bukan buat funder)

- **Tanpa autentikasi** di 14 API routes — siapapun yang tahu URL bisa akses (blocker keras sebelum production)
- Kredensial DB sempat tertulis plaintext di `run-migration.js` (sudah dipindah ke `.env.local`), **belum dikonfirmasi apakah perlu rotasi** (tergantung apakah repo pernah di-push ke tempat publik — belum dijawab user)
- Formula arah SAR `flood_index` (VH/VV) belum divalidasi silang dengan tanggal basah/kering yang dikonfirmasi petani langsung
- File besar/monolitik belum di-refactor: `components/plots/PlotDashboard.tsx` (~2000+ baris), `components/maps/KawasanMapInner.tsx` (~880 baris) — technical debt, bukan bug aktif
- **RLS rekursif (error 42P17) di 10 dari 11 tabel** untuk akses anon/login — perbaikan siap di `docs/migration_v24_fix_rls_recursion.sql`, **belum dijalankan**. Belum terasa user karena seluruh app memakai `service_role` (bypass RLS) dan `auth.users` masih kosong (0 akun) — tapi WAJIB dijalankan sebelum fitur login/multi-role dibangun.
- **`SUPABASE_DB_URL` gagal sejak 18 Juli** — akar masalah terbukti 23 Okt: host pooler salah (`aws-0-…` → harus `aws-1-ap-southeast-1.pooler.supabase.com`), password sudah benar. Perlu user ganti host di `.env.local` (1 kata, tanpa ganti password).
- Interval scan satelit 6 hari adalah **batas fisik** siklus ulang Sentinel-1 (radar), bukan pilihan sembarangan — didokumentasikan dengan sitasi ESA di `update_owner.html`

## 7. Kuota & skala (kalkulasi sudah dibahas)

- Sentinel Hub (Copernicus) dibatasi kuota per bulan — desain sistem **per-petak/trigger individual**, bukan tarik semua sekaligus, supaya irit
- 100 petak dalam 1 kawasan **tidak masalah** selama triggernya tetap per-petak (bukan 1 request borongan)
- Open-Meteo (cuaca): tanpa rate-limit ketat seperti Copernicus, aman dipakai untuk semua petak otomatis

## 8. Aturan kerja project (ringkas dari CLAUDE.md — WAJIB diikuti Claude Code)

- Backup (git tag) sebelum perubahan besar
- Setelah tiap perubahan: laporkan file yang berubah + delta jumlah baris + apa yang perlu ditest + konfirmasi `update_owner.html` sudah disinkronkan
- Setiap tabel baru WAJIB RLS aktif + minimal 1 policy dalam migration yang sama
- Tidak boleh klaim "root cause ditemukan" tanpa bukti log konkret dari kejadian yang didiagnosis
- Kredensial (`.env.local`, API key) tidak pernah ditampilkan di chat/output

## 9. File penting kalau Claude Chat/programmer perlu baca kode langsung

- `docs/BRIEF_AgriMRV.md` — skema database & keputusan produk detail (masih valid)
- `docs/PROJECT_LOG.md` — log kronologis lengkap tiap sesi kerja (paling bawah = terbaru)
- `CLAUDE.md` — aturan main wajib project
- `update_owner.html` — dashboard status untuk pemilik non-teknis, termasuk semua rumus + sumber sitasi ilmiah
- ~~`docs/PRD_AgriMRV.md`~~ — **JANGAN dipakai untuk cek status**, sudah basi (masih tertulis "Tahap 1/2"), dibiarkan sebagai arsip sejarah awal saja
