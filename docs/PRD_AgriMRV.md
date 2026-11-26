# PRD — AgriMRV
### Digital MRV & Monitoring Lahan Padi berbasis Satelit

**Versi: v1.2** (sebelumnya v1.1, v1.0)
**Terakhir diupdate:** 03 Juli 2026
**Founder/Developer:** Solusi (solo developer)
**Status keseluruhan project:** 🟡 Tahap 1 (PRD) — mendekati selesai, masuk Tahap 2 (Desain/Prototype)

---

## CARA PAKAI DOKUMEN INI

Ini dokumen hidup (living document), bukan sekali tulis lalu ditinggal. Setiap kali sebuah Tahap selesai:
1. Update kolom **Status** jadi ✅ Selesai
2. Isi **Tanggal Selesai**
3. Isi **Keputusan yang Diambil** — apa saja hal spesifik yang disepakati/diputuskan selama tahap itu (biar Claude di chat baru langsung paham konteks tanpa perlu baca ulang seluruh history chat)

Kalau kamu buka **chat Claude baru** dan mau lanjut kerja dari titik ini: cukup upload/paste dokumen ini di awal chat, lalu bilang "lanjut dari Tahap X". Claude akan langsung paham histori keputusan tanpa perlu kamu jelaskan ulang dari nol.

---

## RINGKASAN PRODUK

**Masalah yang diselesaikan:** Save Subak (dan mitra petani sejenis) butuh cara memantau jadwal tanam/panen padi secara presisi menggunakan data satelit, sebagai fondasi menuju sertifikasi karbon (carbon trading) di kemudian hari — tanpa harus kunjungan manual ke lapangan tiap saat.

**Siapa penggunanya:**
- **Internal (Admin/Manajemen)** — kebutuhan utama: jadwal panen untuk operasional, traceability data petani
- **Auditor eksternal** (fase lanjut) — verifikasi klaim karbon
- **Pekaseh/Petani** — sumber data lapangan (foto, konfirmasi panen aktual)

**Yang BUKAN tujuan produk ini:** dashboard klien hotel (itu produk terpisah, Save Subak Client Dashboard, sudah ada & sudah jalan — tidak digabung ke sini).

**Prinsip desain kunci:**
- Istilah "Subak" TIDAK di-hardcode — sistem pakai istilah generik **"Kawasan"**, dengan kolom `local_term` per record (isinya "Subak" di Bali, "Kelompok Tani" atau "Desa" di Jawa, dll) — supaya sistem siap dipakai di luar Bali sejak awal.
- Carbon engine (MRV) dibangun **setelah** modul monitoring tanam/panen matang — bukan prioritas fase 1.
- Semua angka karbon di versi awal berlabel jelas sebagai **formula ilustratif**, bukan angka bersertifikasi resmi.

---

## 7 TAHAPAN PRODUK

### TAHAP 1 — PRD & Brief
**Tujuan:** Menentukan apa yang dibangun, kenapa, siapa penggunanya, dan batasan scope-nya sebelum masuk desain/coding.

**Isi/Deliverable:**
- [x] Konsep produk & positioning (AgriMRV sebagai "Digital Carbon Vault" + "Supply Chain Radar")
- [x] Tech stack ditetapkan: Next.js + Supabase (PostGIS) + Vercel Cron (tanpa n8n)
- [x] Skema database awal (macro_polygons → kawasan generik, micro_polygons, satellite_logs, mrv_carbon_records)
- [x] Riset kelayakan Sentinel Hub API (via Copernicus Data Space Ecosystem — EO Browser lama sudah deprecated Feb 2025)
- [x] Riset auditor karbon Indonesia (SRN PPI, biaya, waktu proses)
- [x] Keputusan prioritas: modul jadwal tanam/panen dulu, carbon trading fase lanjut
- [x] Penamaan generik: "Kawasan" + `local_term`, bukan hardcode "Subak"

**Status:** ✅ Selesai
**Tanggal Selesai:** 02 Juli 2026

**Keputusan yang diambil di Tahap ini:**
- Sistem dipisah total dari Save Subak Client Dashboard (beda tujuan, beda database, jangan digabung)
- Interval scan satelit dibuat konfigurasi per-polygon (`scan_interval_days`), default disarankan 10-15 hari (bukan 5 hari) untuk hemat kuota Processing Unit Sentinel Hub
- Vercel Cron dipakai untuk otomasi tarik data, n8n tidak dipakai (skip infra tambahan)
- Auditor tetap wajib melakukan verifikasi manual — sistem hanya mempercepat proses, bukan menggantikan keputusan auditor
- Biaya cash operasional MVP diperkirakan Rp0 – Rp1 juta/bulan (didominasi free tier Supabase/Vercel/Sentinel Hub untuk skala puluhan lahan)

---

### TAHAP 2 — Desain / Prototype
**Tujuan:** Menentukan bentuk & alur interaksi produk secara visual sebelum masuk coding produksi — supaya revisi masih murah dilakukan.

**Isi/Deliverable:**
- [x] Prototype HTML interaktif — dashboard makro (peta kawasan + list petak + KPI + carbon summary)
- [x] Prototype HTML interaktif — dashboard mikro (detail 1 petak: peta, filter True Color/NDVI/NDWI, time-slider 2021–2026, chart NDVI)
- [x] Tab tambahan: Foto Lapangan, Log Panen, Estimasi Karbon (formula ilustratif + status draft/verified), Catatan Anomali
- [x] Panel "Insight Otomatis" (rule-based, bukan AI) yang bereaksi terhadap posisi slider/data
- [x] Visual style mengikuti brand Khiri Reach (hijau, Fraunces/Inter, minimalis)
- [ ] Revisi prototype berdasarkan feedback pemakaian langsung
- [ ] Validasi alur macro→micro drill-down dengan data 2 skenario (Bali & Jawa) — apakah sudah cukup jelas?
- [ ] Keputusan final: apakah AI Q&A masuk di fase produksi nanti atau tetap di-skip?

**Status:** 🟡 Sedang berjalan
**Tanggal Selesai:** _(belum)_

**Keputusan yang diambil sejauh ini di Tahap ini:**
- 1 file HTML dipilih (bukan 2 file terpisah makro/mikro) — alasan: alur klik lebih mulus, 1 sumber data, lebih mudah dibagikan
- AI Q&A **di-skip untuk versi downloadable** (karena butuh koneksi API yang cuma jalan di dalam platform Claude, tidak jalan di file yang didownload) — diganti Insight Otomatis rule-based
- Peta pakai basemap asli (OpenStreetMap via Leaflet), tapi data NDVI/NDWI/karbon tetap simulasi berlabel jelas
- Formula karbon: baseline 260 kg CH4/ha/musim (ilustratif) × rasio hari kering (dari NDWI) × GWP CH4 27x (IPCC AR6) = estimasi CO2e

---

### TAHAP 3 — Technical Design / Arsitektur Final
**Tujuan:** Mengunci detail teknis sebelum mulai coding produksi — supaya tidak bongkar-pasang arsitektur di tengah jalan.

**Isi/Deliverable:**
- [ ] Finalisasi skema Supabase (kolom, tipe data PostGIS, relasi antar tabel)
- [ ] Finalisasi RLS policy per role (admin/auditor/pekaseh)
- [ ] Desain struktur folder Next.js final (App Router)
- [ ] Kontrak API: format request/response ke Sentinel Hub (evalscript NDVI/NDWI, OAuth flow)
- [ ] Desain Vercel Cron: logika "polygon mana yang due di-scan hari ini", anti-duplikat request
- [ ] Rencana Storage Supabase (struktur path citra satelit, signed URL, masa berlaku)
- [ ] Keputusan: kolom `scan_interval_days` per polygon — default value & siapa yang bisa ubah

**Status:** ✅ Selesai
**Tanggal Selesai:** 03 Juli 2026

**Keputusan yang diambil di Tahap ini:**
- Skema SQL final: 6 tabel (user_profiles, kawasan, plots, satellite_logs, mrv_carbon_records, field_logs) + tabel analisis mrv_methodology_analysis
- PostGIS wajib di-enable sebelum jalankan DDL
- Formula karbon v1.1 NET CH4-N2O (bukan hanya hitung CH4 — N2O kenaikan ikut diperhitungkan)
- Sentinel-1 (radar SAR) ditambahkan sebagai sumber data kedua untuk deteksi genangan air
- Token Sentinel Hub di-cache di memory (refresh 60 detik sebelum expired), bukan request baru tiap panggilan
- Cron endpoint diproteksi dengan CRON_SECRET header
- Storage Supabase: 2 bucket private (satellite-imagery, field-photos), akses via signed URL 1 jam
- scan_interval_days per-plot (default 10), bisa diubah admin via /settings

---

### TAHAP 4 — Build MVP
**Tujuan:** Coding fitur inti sesuai prioritas yang sudah disepakati — bukan build semua fitur brief sekaligus.

**Isi/Deliverable (urutan prioritas berdasarkan tingkat kesulitan, dari yang paling berisiko duluan):**
- [x] Setup Supabase project + enable PostGIS + DDL + RLS (🟢 rendah)
- [x] Setup Next.js App Router + TypeScript + Tailwind — scaffold selesai (🟢 rendah-sedang)
- [x] Integrasi Sentinel Hub API — OAuth + Statistical API NDVI tervalidasi (🟠 sedang-tinggi)
- [x] Peta interaktif + input polygon manual (🟡 sedang)
- [x] Vercel Cron otomasi tarik data berkala (🟡 sedang)
- [x] Dashboard multi-layer + time-slider sinkron (🔴 tinggi — paling kompleks, dikerjakan setelah fondasi di atas solid)
- [x] Hover tooltip per polygon peta kawasan (NDVI, fase, varietas, luas)
- [x] Edit batas lahan via drag-and-drop vertex (Geoman imperatif + PATCH API)
- [x] Soft delete petak (is_deleted, view filter, portal dialog konfirmasi)
- [x] Manajemen musim tanam (tabel planting_seasons, CRUD, catat panen)
- [x] Field metadata status lahan self-declared (Organik/Konversi/Regenerative/Konvensional) + data sertifikasi LSO
- [x] Pemisahan pemilik/penggarap + riwayat kepemilikan lahan (tabel plot_ownership_history)
- [ ] Role & akses admin/pekaseh/auditor — autentikasi Supabase (🟢 rendah)
- [ ] Notifikasi Telegram dasar (🟢 rendah)
- [ ] *(Fase lanjut, opsional di MVP)* Modul carbon engine produksi

**Status:** 🟡 Sedang berjalan
**Tanggal Selesai:** _(belum)_

**Keputusan yang diambil sejauh ini di Tahap ini:**
- Next.js 16 App Router + TypeScript + Tailwind CSS dipilih (sesuai Technical Design)
- @supabase/ssr dipakai untuk Supabase client (bukan legacy @supabase/auth-helpers)
- Polygon input via Leaflet + Geoman (bukan form koordinat manual)
- area_ha dihitung Turf.js client-side (lihat catatan validasi di Tahap 5)
- Cron endpoint pakai adaptive interval: mode intensif 6 hari otomatis via planting_seasons (bukan planting_date di plots lagi); fixed bug WKB vs GeoJSON pada geo_data
- Dashboard mikro per plot: peta layer NDVI/NDWI, trend chart Recharts, insight rule-based, trigger scan manual
- Tab Karbon: tooltip edukasi CO₂e inline (IPCC Tier 1, rumus GWP, disclaimer LVV)
- Tab Musim Tanam: tabel `planting_seasons` terpisah dari `plots` — crop_variety dan planting_date per musim, bukan permanen di plot
- **Placeholder eksplisit di Tab Karbon**: dua syarat ("Log manajemen air AWD" dan "Baseline emisi CH₄ terverifikasi") ditampilkan di UI sebagai "⏳ belum tersedia (Fase 2)" — bukan tersembunyi atau diam-diam false. Tabel `water_management_logs` dan `emission_baselines` belum dibuat, dikerjakan di Fase 2.
- **Status lahan self-declared** (06 Juli 2026): field `status_lahan` (Organik/Konversi/Regenerative/Konvensional) di plots adalah metadata yang diisi manual admin/petani — BUKAN hasil deteksi satelit. Disclaimer amber selalu muncul di form dan UI: "Status ini berdasarkan pengakuan/dokumen petani, belum tervalidasi sistem." Tidak mempengaruhi kalkulasi NDVI/NDWI/CO2e — murni untuk filter dan laporan.
- **Pemisahan pemilik/penggarap** (06 Juli 2026): `nama_pemilik` dan `nama_penggarap` ditambah sebagai kolom terpisah di plots. `farmer_name` tetap ada untuk backward compat (sinkron dengan `nama_penggarap`). Tabel baru `plot_ownership_history` merekam riwayat perubahan — auto-close entri sebelumnya saat ada perubahan baru. Default: jika tidak diisi terpisah, pemilik = penggarap.
- **Pola migration PostgreSQL** (06 Juli 2026): Untuk fungsi RPC — selalu DROP dengan full arglist sebelum CREATE (CREATE OR REPLACE dengan signature beda membuat overload). Untuk view — selalu DROP VIEW + CREATE VIEW baru (CREATE OR REPLACE VIEW tidak bisa mengubah urutan kolom). Pola ini wajib diikuti untuk semua migration berikutnya yang menyentuh `insert_plot` atau `v_plots`.

---

### TAHAP 5 — Testing / QA
**Tujuan:** Memastikan alur benar-benar berjalan sesuai rencana sebelum dipakai orang lain, dan tidak ada bug kritis di alur utama.

**Isi/Deliverable:**
- [ ] Test alur end-to-end: input lahan → data satelit masuk → dashboard update → carbon terhitung
- [ ] Test kondisi gagal: citra tertutup awan, API Sentinel Hub timeout, polygon invalid
- [ ] Test role-based access (auditor tidak bisa edit, hanya baca)
- [ ] Test di perangkat berbeda (HP, desktop, browser berbeda)
- [ ] **Validasi ulang `area_ha`:** saat ini dihitung Turf.js di browser saat polygon digambar — perlu divalidasi bahwa nilainya konsisten dengan `ST_Area(geo_data::geography) / 10000` dari PostGIS. Jika ada selisih signifikan, migrasikan kalkulasi ke trigger PostgreSQL atau computed column agar `geo_data` menjadi sumber kebenaran tunggal untuk luas.

**Status:** ⚪ Belum dimulai
**Tanggal Selesai:** _(belum)_

**Keputusan yang diambil di Tahap ini:**
_(diisi setelah tahap ini berjalan)_

---

### TAHAP 6 — Deploy / Launch Terbatas
**Tujuan:** Merilis ke pengguna nyata dalam skala kecil dulu (bukan langsung semua kawasan), untuk validasi sebelum scale up.

**Isi/Deliverable:**
- [ ] Pilih 1-2 kawasan percobaan (real, bukan dummy)
- [ ] Onboarding admin/pekaseh yang akan input data pertama kali
- [ ] Monitoring pemakaian kuota Sentinel Hub di kondisi nyata
- [ ] Kumpulkan feedback pemakaian awal

**Status:** ⚪ Belum dimulai
**Tanggal Selesai:** _(belum)_

**Keputusan yang diambil di Tahap ini:**
_(diisi setelah tahap ini berjalan)_

---

### TAHAP 7 — Iterasi & Scale Up
**Tujuan:** Perbaikan berdasarkan feedback launch terbatas, baru diperluas ke lebih banyak kawasan dan fitur lanjutan (carbon trading resmi, integrasi auditor SRN PPI, dll).

**Isi/Deliverable:**
- [ ] Perbaikan berdasarkan feedback Tahap 6
- [ ] Perluasan ke kawasan tambahan
- [ ] Aktivasi modul carbon engine produksi (bukan ilustratif lagi)
- [ ] **Fase 2 — Modul Manajemen Air AWD**: bangun tabel `water_management_logs`, form input harian kondisi air, integrasi ke syarat karbon di Tab Karbon
- [ ] **Fase 2 — Baseline Emisi CH₄**: bangun tabel `emission_baselines`, alur verifikasi baseline per plot, integrasi ke syarat karbon
- [ ] Kontak & onboarding auditor/LVV resmi untuk proses SRN PPI
- [ ] Evaluasi apakah butuh scale Sentinel Hub ke tier berbayar

**Status:** ⚪ Belum dimulai
**Tanggal Selesai:** _(belum)_

**Keputusan yang diambil di Tahap ini:**
_(diisi setelah tahap ini berjalan)_

**Checklist Sentinel Hub tervalidasi (03 Juli 2026):**
- ✅ OAuth Client ID/Secret berhasil diverifikasi, dapat access_token (Bearer, expires_in 1800 detik)
- ✅ Request NDVI nyata via Statistical API berhasil — test di koordinat Subak Sangeh (-8.487345, 115.211131), NDVI mean 0.503 untuk periode 3 Juni–3 Juli 2026
- Catatan: test pertama pakai bounding box kecil (~190m², 1 pixel) — representasi 1 titik, bukan luasan petak asli. Test dengan polygon sungguhan perlu dilakukan saat sudah ada data petak nyata di Tahap 4
- Item paling berisiko di seluruh roadmap (integrasi Sentinel Hub pertama kali) sudah tervalidasi — aman lanjut ke scaffold Next.js

**Keputusan riset carbon trading lanjutan (03 Juli 2026, v1.2):**
- Ditegaskan jadi fitur konkret: sistem BOLEH hitung & bandingkan beberapa metodologi sekaligus (tabel baru `mrv_methodology_analysis`), tapi HANYA 1 yang boleh ditandai resmi untuk didaftarkan ke registry (`is_registered_for_trading = true` di `mrv_carbon_records`) — mencegah double-counting di level aplikasi, bukan cuma prinsip di atas kertas

**Keputusan riset carbon trading lanjutan (03 Juli 2026, v1.1):**
- Formula karbon direvisi jadi NET CH4-N2O: AWD menekan CH4 tapi menaikkan N2O (trade-off yang sebelumnya tidak dihitung) — CO2e = (CH4 tercegah × 27) − (N2O tambahan × 273), GWP100 IPCC AR6
- Dikonfirmasi: bisa pakai 2+ metodologi untuk kumpulkan data monitoring, TAPI tidak boleh klaim ton CO2e yang sama lewat 2 metodologi/registri berbeda sekaligus (anti-double counting) — 1 proyek pilih 1 metodologi per batch klaim sertifikat


- Sentinel-1 (radar/SAR) ditambahkan sebagai sumber data kedua untuk deteksi genangan air/AWD — lebih andal dibanding NDWI optik (Sentinel-2) karena bisa menembus awan
- Bot Telegram diperluas jadi kanal input data dua arah (logbook petani), bukan cuma notifikasi — berkontribusi ke kelengkapan bukti MRV sesuai metodologi Verra VM0051 yang menerima farmer logbook sebagai bukti pendukung
- Verra VM0051 dikonfirmasi relevan sebagai rujukan metodologi jika target ke pasar internasional — tapi mewajibkan monitoring N2O selain CH4, yang berarti formula karbon perlu diperluas di fase produksi nanti
- Pemerintah Indonesia punya bursa karbon sendiri (IDXCarbon, BEI) selain jalur Verra/Gold Standard — SPE-GRK adalah target unit karbon utama untuk jalur domestik
- Ditemukan 2 lembaga pendamping pemerintah (ICCTF di bawah Bappenas, RKKIK di bawah KLHK — layanan gratis) sebagai kontak awal yang lebih rendah risiko dibanding konsultan swasta



---

## WORKFLOW KERJA: Claude Chat → Claude Code

Karena kamu kerja solo dan pakai kombinasi Claude Chat (untuk mikir/diskusi/nulis prompt) + Claude Code (untuk eksekusi coding beneran), ini pembagian perannya:

**Di Claude Chat (di sini):**
- Diskusi keputusan produk, alur, dan desain (kayak yang kita lakukan sepanjang PRD ini)
- Bikin/revisi prototype visual (HTML dummy) untuk validasi ide sebelum coding produksi
- Susun instruksi/prompt yang jelas dan spesifik untuk dieksekusi di Claude Code

**Di Claude Code:**
- Eksekusi instruksi jadi kode beneran (Next.js, Supabase schema, API routes)
- Tempelkan (paste) instruksi yang sudah difinalisasi dari Claude Chat, bukan menulis ulang dari nol
- Cara paling efektif: dari Claude Chat, minta saya susunkan instruksi teknis yang siap tempel — bukan cuma "bikinkan fitur X", tapi lengkap dengan konteks skema data, penamaan, dan batasan yang relevan (biar Claude Code tidak menebak-nebak)

**Soal kebutuhan "plugin" untuk kerja di web Sentinel Hub:**

Ini bukan soal plugin tambahan yang wajib dipasang, tapi ada 2 opsi tergantung kebutuhanmu:
1. **Kalau cuma butuh referensi/baca dokumentasi Sentinel Hub sambil ngobrol di sini** — saya bisa langsung `web_search`/buka halaman dokumentasi resminya kapan saja tanpa setup tambahan.
2. **Kalau butuh saya benar-benar berinteraksi dengan halaman web Sentinel Hub** (misal isi form registrasi, klik-klik dashboard mereka, generate API key lewat UI) — itu butuh fitur **Claude in Chrome** (browsing agent, masih beta), yang beda dari chat biasa ini. Itu perlu diaktifkan terpisah di pengaturan, bukan sesuatu yang otomatis tersedia di sini.

Untuk sebagian besar kerjaan Tahap 3-4 (baca dokumentasi API, susun kode integrasi), kamu tidak perlu plugin tambahan — cukup Claude Chat (riset & prompt) + Claude Code (eksekusi). Plugin browsing baru relevan kalau ada langkah manual di UI Sentinel Hub yang berulang dan mau diotomasi/dibantu langsung.

---

## LAMPIRAN — Referensi Cepat

- Struktur folder & skema database detail: lihat `BRIEF.md` (dokumen sumber asli, masih valid untuk referensi teknis, PRD ini adalah lapisan ringkasan + tracking di atasnya)
- Prototype terakhir: `agrimrv_full.html` (dashboard makro+mikro+carbon+insight, per 02 Juli 2026)
