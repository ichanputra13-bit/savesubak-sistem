# PROJECT LOG — AgriMRV

Log kronologis semua sesi kerja. Entri baru selalu ditambahkan di PALING BAWAH.
Baca instruksi lengkap protokol update di `CLAUDE.md`.

---

## [2026-07-03 00:00] — Baseline: PRD, Brief, Technical Design selesai disusun (v1.2)

**Dikerjakan:**
- PRD 7 tahapan disusun, Tahap 1 (PRD) ditandai selesai
- Brief teknis lengkap: skema database, struktur folder, RLS, terminologi generik ("Kawasan" bukan "Subak")
- Technical Design Tahap 3: skema SQL lengkap, kontrak API Sentinel Hub, logika Vercel Cron
- Riset carbon trading: SRN PPI, IDXCarbon, LVV (Sucofindo dkk), konsultan pendamping (Fairatmos, Jejakin), pendamping pemerintah (ICCTF, RKKIK)
- Formula karbon direvisi jadi NET CH4-N2O (bukan cuma hitung CH4 turun)
- Tabel `mrv_methodology_analysis` ditambahkan — analisis boleh multi-metodologi, pendaftaran resmi cuma 1 (anti-double-counting)
- Prototype HTML interaktif (dashboard makro-mikro, filter matrix, time-slider, tab carbon) sudah dibuat dan diuji

**Keputusan/catatan penting:**
- Fase 1 fokus modul monitoring tanam/panen dulu, carbon engine (Fase 2) ditunda sampai Fase 1 matang
- Sentinel-1 (radar) ditambahkan sebagai sumber data kedua untuk deteksi genangan air, lebih andal dari NDWI optik saat berawan

**Status berikutnya:** Validasi teknis Sentinel Hub API (OAuth + request NDVI nyata) sebelum mulai scaffold Next.js

---

## [2026-07-03 06:30] — Validasi Sentinel Hub API berhasil

**Dikerjakan:**
- OAuth Client ID/Secret Copernicus Data Space Ecosystem terdaftar, disimpan di `.env.local`
- Tes request token OAuth: BERHASIL (access_token diterima, expires_in 1800 detik)
- Tes request NDVI nyata via Statistical API: BERHASIL — koordinat Subak Sangeh (-8.487345, 115.211131), NDVI mean 0.503, periode 3 Juni–3 Juli 2026

**Keputusan/catatan penting:**
- Tes pertama pakai bounding box kecil (~190m², 1 pixel) — representasi 1 titik, bukan luasan petak asli
- Test dengan polygon sungguhan perlu dilakukan saat sudah ada data petak nyata

**Status berikutnya:** Item paling berisiko di roadmap (integrasi Sentinel Hub) sudah tervalidasi. Lanjut scaffold project Next.js (App Router, TypeScript) sesuai struktur folder di Technical Design bagian 3.3. Setup Supabase project belum dilakukan — perlu dibahas dulu sebelum skema SQL dijalankan.

---

## [2026-07-03 08:00] — Scaffold Next.js selesai, semua struktur folder §3.3 terbuat

**Dikerjakan:**
- `create-next-app` dijalankan: Next.js 16, App Router, TypeScript, Tailwind CSS, import alias `@/*`
- Semua route sesuai §3.3 dibuat: `/kawasan`, `/kawasan/[kawasanId]`, `/kawasan/[kawasanId]/plot/[plotId]`, `/mrv-reports`, `/farmers`, `/settings`, `/(auth)/login`
- Cron endpoint `/api/cron/satellite-scan/route.ts` diimplementasikan sesuai pseudocode §3.5 (loop plots, cek interval, request NDVI+NDWI, delay 500ms antar plot, dilindungi CRON_SECRET)
- `lib/supabase/client.ts` dan `server.ts` menggunakan `@supabase/ssr`
- `lib/sentinel-hub/auth.ts` — token caching (refresh 60 detik sebelum expired)
- `lib/sentinel-hub/ndvi.ts` dan `ndwi.ts` — Statistical API dengan evalscript yang sudah tervalidasi di sesi sebelumnya
- `lib/mrv-engine.ts` — formula NET CH4-N2O v1.1 sesuai §3.8
- `lib/telegram.ts` — stub, tunggu bot token
- `components/maps/KawasanMap.tsx`, `PlotMap.tsx`, `components/charts/NdviTrendChart.tsx` — stub placeholder
- `vercel.json` — cron schedule `0 1 * * *`
- `app/page.tsx` — redirect ke `/kawasan`
- Env vars placeholder ditambahkan ke `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CRON_SECRET`
- `npm run build` bersih — 0 TypeScript error

**Keputusan/catatan penting:**
- `@supabase/ssr` (bukan `@supabase/auth-helpers` yang sudah deprecated) dipakai dari awal
- Evalscript NDVI/NDWI di lib menggunakan format yang sudah tervalidasi (dengan `dataMask` sebagai output terpisah) — bukan format di §3.4 yang belum teruji

**Status berikutnya:** Setup Supabase project (buat project, enable PostGIS, jalankan DDL §3.1 + RLS §3.2, isi env vars). Setelah itu baru bisa tes cron endpoint secara end-to-end.

---

## [2026-07-03 09:00] — Skema Supabase (DDL + RLS) selesai dijalankan

**Dikerjakan:**
- `docs/migration_v1.sql` dibuat: DDL 7 tabel + 4 index + enable RLS + semua policy (admin/auditor/pekaseh) dalam 1 file
- SAR columns (`sar_flood_index`, `sar_source`) sudah dimasukkan langsung ke DDL `satellite_logs` (bukan ALTER TABLE terpisah) karena tabel dibuat fresh
- NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY sudah diisi di `.env.local`
- Migration dijalankan via Supabase SQL Editor (koneksi langsung PostgreSQL tidak bisa dari mesin lokal — DNS tidak resolve)
- Query disimpan di Supabase SQL Editor dengan nama `01_initial_schema_and_rls` sesuai aturan CLAUDE.md §7

**Keputusan/catatan penting:**
- Koneksi direct PostgreSQL (`db.{ref}.supabase.co:5432`) tidak bisa dari mesin lokal — untuk migration berikutnya tetap pakai Supabase SQL Editor
- Aturan baru CLAUDE.md §7: semua query SQL Editor diberi nama deskriptif format `<nomor_urut>_<deskripsi>`, bukan default "dummy_query"

**Status berikutnya:** Setup 2 Storage bucket di Supabase (`satellite-imagery` dan `field-photos`, keduanya private). Lalu tes `npm run dev` dan verifikasi routing berjalan di browser.

---

## [2026-07-03 09:30] — Storage buckets SQL siap + npm run dev semua route OK

**Dikerjakan:**
- `docs/migration_v2_storage_buckets.sql` dibuat: insert 2 bucket private (`satellite-imagery` 50MB/JPEG+PNG+TIFF, `field-photos` 10MB/JPEG+PNG+HEIC) + RLS policy storage (admin full, pekaseh upload field-photos, auditor read kedua bucket)
- Query harus dijalankan di SQL Editor Supabase dengan nama `02_storage_buckets_and_policies`
- `npm run dev` berhasil: server ready di `localhost:3000` dalam 552ms
- Semua route diverifikasi HTTP 200: `/`, `/kawasan`, `/mrv-reports`, `/farmers`, `/settings`, `/login`

**Keputusan/catatan penting:**
- Signed URL (1 jam) dipakai untuk akses file storage — tidak simpan URL langsung di database (sesuai §3.6)
- `allowed_mime_types` ditambahkan ke bucket config sebagai validasi awal di storage layer

**Status berikutnya:** User perlu jalankan `migration_v2_storage_buckets.sql` di Supabase SQL Editor (nama query: `02_storage_buckets_and_policies`). Setelah itu, milestone Tahap 4 fondasi sudah solid — lanjut ke implementasi UI: peta interaktif `/kawasan` + input polygon.

---

## [2026-07-03 10:30] — Peta interaktif + polygon drawing selesai diimplementasikan

**Dikerjakan:**
- `docs/migration_v3_rpc_functions.sql` — view `v_plots` (ST_AsGeoJSON, security_invoker=true) + fungsi RPC `insert_plot` yang menerima GeoJSON dan menyimpan sebagai PostGIS geometry (nama query SQL Editor: `03_rpc_insert_plot_and_view`)
- `lib/supabase/admin.ts` — `createAdminClient()` dengan service_role key untuk bypass RLS di server
- `app/api/plots/route.ts` — GET (refresh plots per kawasan) + POST (simpan plot baru via `insert_plot` RPC)
- `components/maps/KawasanMapInner.tsx` — implementasi penuh: Leaflet + react-leaflet + @geoman-io/leaflet-geoman-free untuk polygon drawing, @turf/area untuk hitung luas otomatis, form inline setelah drawing selesai
- `components/maps/KawasanMap.tsx` — dynamic import wrapper (ssr: false) supaya Leaflet tidak crash di SSR
- `app/kawasan/[kawasanId]/page.tsx` — server component: fetch kawasan + plots via admin client, render peta + daftar plot
- `SUPABASE_SERVICE_ROLE_KEY` placeholder ditambahkan ke `.env.local`
- `npm run build` bersih — 0 TypeScript error

**Keputusan/catatan penting:**
- Browser client (anon key) tidak dipakai untuk write plots — semua lewat `/api/plots` yang menggunakan service_role. Ini karena auth belum diimplementasikan dan RLS akan memblokir anon writes.
- Polygon drawing menggunakan Geoman (bukan leaflet-draw yang sudah tidak aktif dipelihara)
- Setelah save berhasil: fetch ulang list plots dari `/api/plots?kawasan_id=...` untuk sinkronisasi peta; kalau fetch gagal, pakai optimistic update lokal

**Status berikutnya:** 
1. User jalankan `migration_v3_rpc_functions.sql` di SQL Editor (nama: `03_rpc_insert_plot_and_view`)
2. User isi `SUPABASE_SERVICE_ROLE_KEY` di `.env.local` (dari Supabase dashboard > Settings > API)
3. Tes end-to-end: gambar polygon di browser, verifikasi row muncul di tabel `plots` Supabase
4. Setelah terbukti jalan: lanjut ke halaman `/kawasan/[kawasanId]/plot/[plotId]` (dashboard mikro per petak)

---

## [2026-07-04 08:00] — ✅ MILESTONE: alur gambar polygon → luas otomatis → simpan DB berfungsi end-to-end

**Dikerjakan:**
- Tes end-to-end berhasil: polygon digambar di peta `/kawasan/[kawasanId]`, data tersimpan ke tabel `plots` — `farmer_name: "wayan suparta"`, `crop_variety: "mentik susu"`, `area_ha: 0.174`
- Toggle basemap ditambahkan: "Satelit" (Esri World Imagery, default) ↔ "Peta" (OpenStreetMap)
- Overlay hybrid label ditambahkan: Esri World_Boundaries_and_Places ditumpuk di atas citra satelit (nama tempat, jalan, batas wilayah) — otomatis tampil/hilang saat toggle basemap
- Search box + pin lokasi ditambahkan di pojok kiri atas peta: menerima nama tempat (via Nominatim API) atau koordinat langsung format `lat, lng` — flyTo animasi + pin merah merah di peta

**Keputusan/catatan penting:**
- `area_ha` dihitung oleh `@turf/area` di client (browser), bukan PostGIS `ST_Area` di server — akurasi setara untuk lahan skala petak sawah (geodesic formula), tidak ada recalculation di server
- `insert_plot` RPC menyimpan nilai `area_ha` yang dikirim dari client; PostGIS hanya menyimpan geometry-nya
- Search menggunakan Nominatim (OpenStreetMap geocoder, gratis, tanpa API key) — tidak disimpan ke database, hanya navigasi visual di peta

**Status berikutnya:** Lanjut ke halaman `/kawasan/[kawasanId]/plot/[plotId]` — dashboard mikro per petak: peta detail plot, timeline NDVI, tab foto lapangan.

---

## [2026-07-04] — Dashboard mikro /kawasan/[kawasanId]/plot/[plotId] selesai

**Dikerjakan:**
- `lib/types/plot.ts` — shared types: `PlotDetail`, `SatelliteLog`, `FieldLog`, `LayerType`
- `components/maps/PlotMapInner.tsx` — Leaflet peta detail 1 petak: polygon fill color berdasarkan NDVI/NDWI/truecolor, auto-fit bounds, satellite + label overlay
- `components/charts/NdviTrendChart.tsx` — Recharts LineChart NDVI + NDWI, custom dot highlight untuk scan aktif, reference lines di y=0.3/0.6
- `components/plots/PlotDashboard.tsx` — client orchestrator: layout 2 kolom, scan date selector, insight engine rule-based, tabs Foto/Panen/Karbon
- `app/kawasan/[kawasanId]/plot/[plotId]/page.tsx` — server component: fetch parallel satellite_logs + field_logs via admin client
- `recharts` v2 diinstall
- PRD Tahap 5: catatan validasi `area_ha` vs PostGIS `ST_Area` ditambahkan

**Keputusan/catatan penting:**
- Imagery heatmap (true_color_path, ndvi_heatmap_path) belum tersedia — polygon diwarnai berdasarkan score, bukan gambar satelit asli. Toggle "True Color" menampilkan notifikasi "Citra RGB belum tersedia"
- Insight engine 100% client-side rule-based (threshold NDVI/NDWI), bukan ML
- Tab Karbon placeholder — butuh minimal 1 siklus tanam selesai

**Status berikutnya:** Tes halaman di browser. Lanjut: implementasi trigger scan manual dari UI, atau halaman daftar kawasan `/kawasan` dan homepage `/`.

---

## [2026-07-04] — Tooltip CO2e + Adaptive Scan Interval

**Dikerjakan:**

*Bagian 1 — Tooltip Edukasi CO₂e:*
- `components/plots/InfoTooltip.tsx` — komponen reusable: icon (i) kecil, klik untuk expand/collapse panel inline (menghindari masalah CSS overflow dari parent), tampil di tab Karbon
- Tab Karbon di `PlotDashboard.tsx` di-redesign: NET CO₂e display + icon (i) dengan penjelasan lengkap (apa itu CO₂e, IPCC Tier 1, rumus CH₄×GWP27 − N₂O×GWP273, disclaimer LVV), checklist input yang sudah/belum tersedia (luas lahan ✓, AWD log, baseline CH₄, log panen)

*Bagian 2 — Mode Interval Scan Adaptif:*
- `docs/migration_v4_planting_date.sql` — ALTER TABLE plots ADD COLUMN planting_date DATE (nullable); simpan ke SQL Editor Supabase dengan nama `04_add_planting_date_plots`
- `lib/adaptive-scan.ts` — fungsi `getEffectiveScanInterval()`: priority (1) planting_date eksplisit dalam window 120 hari → 6 hari intensif, (2) tren NDVI naik <0.2→>0.3 dalam 2 scan berturut → 6 hari intensif, (3) fallback: scan_interval_days normal
- `app/api/cron/satellite-scan/route.ts` — diperbaiki dua bug: (a) ganti `createClient()` → `createAdminClient()`, (b) ganti `plots.geo_data` (WKB) → `v_plots.geo_data` (GeoJSON); sekarang juga fetch `planting_date` dari `plots` dan pakai `getEffectiveScanInterval()` untuk menentukan perlu scan atau skip
- `lib/types/plot.ts` — tambah `planting_date: string | null` ke `PlotDetail`
- `app/kawasan/[kawasanId]/plot/[plotId]/page.tsx` — fetch `planting_date` dari tabel `plots` langsung (bukan v_plots), tampilkan sebagai chip amber di header jika tersedia

**Keputusan/catatan penting:**
- `planting_date` diambil dari tabel `plots` (bukan v_plots) karena v_plots view belum diupdate — pendekatan dual-query (v_plots untuk geo_data GeoJSON, plots untuk planting_date) lebih aman tanpa perlu ubah view yang sudah production
- `InfoTooltip` menggunakan inline expand (bukan floating popup) untuk menghindari masalah CSS overflow dari `overflow-hidden` pada parent container tab
- Migration v4 perlu dijalankan di Supabase sebelum planting_date bisa diisi

**Status berikutnya:** Jalankan `migration_v4_planting_date.sql` di Supabase SQL Editor (nama: `04_add_planting_date_plots`). Lanjut: halaman `/kawasan` (daftar kawasan), homepage `/`, atau auth flow.

---

## [2026-07-04] — Tombol Lihat Lokasi + Dashboard + Layer Batas Desa OSM

**Dikerjakan:**
- Verifikasi mode intensif: trigger scan manual untuk plot Wayan Suparta → `adaptive.mode: intensive_planting`, `effective_interval: 6 hari`, `reason: Hari ke-50 dari tanggal tanam`. Bug fix: scan endpoint sebelumnya error duplicate key → ganti insert ke upsert dengan `onConflict: plot_id,scan_date`
- `components/kawasan/KawasanPageClient.tsx` — client orchestrator baru untuk halaman kawasan: tombol "Lihat Lokasi" (pan/zoom ke centroid semua plot via `flyToggle` state prop), tombol "Dashboard" (scroll ke KPI section via `#kpi-section`), KPI cards (total petak, luas, rata-rata NDVI, mode intensif aktif)
- `components/maps/KawasanMapInner.tsx`:
  - `FlyToCenter` sub-component: watch `flyToggle` prop, hitung centroid dari semua polygon plot, `map.flyTo(center, 16)`
  - `DesaBoundaryLayer` sub-component: fetch Nominatim API dengan `polygon_geojson=1` pada mount, prioritas `class: boundary` → render sebagai `<GeoJSON>` layer oranye putus-putus + label DivIcon nama desa
- `components/maps/KawasanMap.tsx` — thread `flyToggle` + `region` props baru
- `app/kawasan/[kawasanId]/page.tsx` — refactor: fetch KPI data (satellite_logs + planting_date), hitung avgNdvi + intensivePlots + lastScanDate, pass ke KawasanPageClient

**Keputusan/catatan penting:**
- OSM (Nominatim) **punya data polygon batas Desa Sangeh** (relation `class: boundary`). Tampil sebagai outline oranye putus-putus terpisah dari batas kawasan/subak yang sudah ada. Alternatif data tidak diperlukan.
- Layer batas desa fetch on-mount, silent fail jika OSM tidak tersedia (tidak error ke user)
- `DesaBoundaryLayer` menggunakan `region` field dari tabel kawasan; format parsing: segmen pertama sebelum koma, strip prefix "Desa/Kelurahan/Banjar"
- `flyToggle` adalah integer yang increment setiap klik "Lihat Lokasi" — lebih reliable daripada boolean karena tetap trigger effect meski diklik dua kali berturut-turut

**Status berikutnya:** Refresh browser di `/kawasan/[id]`, verifikasi: (1) tombol "Lihat Lokasi" pan/zoom ke polygon, (2) tombol "Dashboard" scroll ke KPI, (3) outline oranye putus-putus batas Desa Sangeh muncul di peta. Lanjut: halaman daftar kawasan `/kawasan`, homepage `/`, atau auth flow.

---

## [2026-07-04] — Bug fix layer batas desa + tombol Lihat Lokasi/Dashboard per petak

**Dikerjakan:**
- **Bug fix DesaBoundaryLayer**: Layer sebelumnya menampilkan area yang jauh lebih besar dari Desa Sangeh. Root cause: react-leaflet `<GeoJSON>` component tidak menerapkan `style` object dengan benar → Leaflet fallback ke fill default. Solusi: ganti ke pendekatan imperatif `L.geoJSON()` + `L.marker()` langsung ke instance map (cleanup via effect return). 
- Tambah validasi bbox: jika `latSpan * lonSpan > 0.008` (>≈100 km²), polygon ditolak dan tidak ditampilkan sama sekali. Konfirmasi via curl: Sangeh relation `admin_level=7`, bbox ~7.8 km² → lolos validasi.
- Tambah filter `extratags.admin_level` 6-9 agar tidak mengambil boundary level provinsi/kabupaten secara tidak sengaja.
- **Tombol per petak**: Redesign card petak di `KawasanPageClient.tsx` — card bukan lagi `<Link>` wrapper seluruhnya, melainkan `<div>` dengan dua tombol:
  - "Lihat Lokasi" → `setFlyToPlot({ plotId, counter: Date.now() })` + scroll ke `#kawasan-map`
  - "Dashboard →" → `<Link>` ke `/kawasan/[id]/plot/[plotId]`
- Tambah `FlyToPlot` sub-component di `KawasanMapInner.tsx`: watch `target?.counter`, hitung centroid polygon petak spesifik, `map.flyTo(center, 18)`. Trigger via `counter` bukan `plotId` supaya klik dua kali pada petak sama pun tetap jalan.
- Thread prop `flyToPlot: { plotId: string; counter: number } | null` dari `KawasanPageClient` → `KawasanMap` → `KawasanMapInner`.

**Keputusan/catatan penting:**
- `L.geoJSON()` imperatif lebih reliable untuk kasus ini daripada `<GeoJSON>` react-leaflet component, terutama untuk kontrol style (`fillOpacity: 0`) yang kritis.
- Validasi ukuran bbox (max 0.008 deg²) sebagai safety net: lebih baik tidak tampilkan daripada tampilkan batas yang salah/menyesatkan.
- "Lihat Lokasi" level kawasan → zoom 16 (lihat semua plot), level petak → zoom 18 (detail satu polygon).

**Status berikutnya:** Refresh browser, verifikasi: (1) batas Desa Sangeh muncul sebagai outline oranye kecil di sekitar area Sangeh saja (bukan seluruh Bali), (2) klik "Lihat Lokasi" di card Wayan Suparta → peta zoom ke polygon petak itu, (3) klik "Dashboard →" di card → navigasi ke halaman detail petak.

---

## [2026-07-04] — Fix layer batas desa: hilang saat zoom out + warna salah

**Dikerjakan:**
- Root cause "hilang saat zoom out": `DesaBoundaryLayer` sebelumnya render ke `overlayPane` (z-index 400). TileLayer overlay (World_Boundaries_and_Places) juga di `overlayPane`, dan tile images-nya di-append setelah SVG element → menutupi layer SVG saat tile reload (zoom out/in).
- Fix: buat custom pane `desaBoundaryPane` dengan z-index 450 (di antara `overlayPane` 400 dan `shadowPane` 500). Render polygon via `L.polygon(..., { pane: 'desaBoundaryPane' })` agar selalu muncul di atas tile overlay di semua zoom level.
- Ganti dari `L.geoJSON()` ke `L.polygon()` langsung: lebih reliable untuk opsi `pane`, handles Polygon + MultiPolygon geometry, dan koordinat GeoJSON [lng,lat] di-convert manual ke Leaflet [lat,lng].
- Warna garis diubah ke `#C98A2E` (amber tua), weight 1.5, dashArray '8 5', fillOpacity 0. Label chip juga diupdate ke warna amber yang sama.

**Keputusan/catatan penting:**
- Custom pane `desaBoundaryPane` dibuat dengan `pointerEvents: 'none'` agar tidak mengganggu klik user ke polygon plot.
- Pane hanya dibuat jika belum ada (`!map.getPane(paneName)`) — idempotent, aman untuk React Strict Mode double-effect.
- Label marker tetap di `markerPane` default (z-index 600) yang sudah di atas semua overlay.

**Status berikutnya:** Refresh browser, verifikasi: (1) outline batas Desa Sangeh warna amber `#C98A2E` muncul di semua zoom level, (2) tidak hilang saat zoom out ke view Bali, (3) polygon petak hijau masih jelas terlihat di atas boundary desa.

---

## [2026-07-04] — Root cause batas desa hilang saat zoom: fetch Nominatim dipanggil ulang

**Dikerjakan:**
- Debug via console.log mengkonfirmasi: `DesaBoundaryLayer` (yang sebelumnya di dalam MapContainer children) unmount/remount setiap kali zoom berubah karena react-leaflet behavior. Setiap unmount/remount = cleanup + fetch ulang = Nominatim kadang return admin_level=7 (desa, valid) kadang admin_level=5 (kecamatan, terlalu besar → ditolak validasi) → layer hilang/muncul tidak konsisten.
- Fix: **angkat Nominatim fetch ke level `KawasanMapInner`** (di luar MapContainer children). `useEffect([region])` di sini stabil — hanya re-run kalau `region` prop berubah, tidak terpengaruh zoom/pan sama sekali.
- Pisah komponen menjadi dua: `DesaBoundaryRenderer` (pure renderer, terima data jadi, tidak fetch) + fetch logic di `KawasanMapInner` level.
- Hapus semua console.log debug.
- Tambah type `DesaBoundaryData` untuk data polygon yang sudah diproses ke format Leaflet.

**Keputusan/catatan penting:**
- Pola "lift fetch ke atas, renderer hanya terima data" adalah pattern yang benar untuk semua komponen yang butuh fetch data tapi ada di dalam react-leaflet MapContainer.
- Rekomendasi jangka panjang (belum diimplementasi): simpan polygon batas desa yang sudah divalidasi ke kolom baru di tabel `kawasan` (misal `boundary_geojson JSONB`) — sehingga Nominatim hanya perlu di-query sekali seumur hidup per kawasan, bukan tiap halaman dibuka.

**Status berikutnya:** Refresh browser, verifikasi batas Desa Sangeh tetap muncul di semua zoom level.

---

## [2026-07-04] — Cache boundary_geojson di DB kawasan (skip Nominatim setelah pertama kali)

**Dikerjakan:**
- Migration SQL: `docs/migration_v5_boundary_geojson.sql` — `ALTER TABLE kawasan ADD COLUMN IF NOT EXISTS boundary_geojson JSONB`. Nama query Supabase: `05_add_boundary_geojson_kawasan`.
- API endpoint baru: `PATCH /api/kawasan/[kawasanId]/boundary` — terima `{ boundary_geojson: {...} }`, simpan ke DB via admin client.
- Server component `app/kawasan/[kawasanId]/page.tsx` — tambah `boundary_geojson` ke kolom select kawasan, pass sebagai prop ke `KawasanPageClient`.
- Prop chain: `KawasanPageClient` → `KawasanMap` → `KawasanMapInner` — prop `boundaryGeojson: Record<string,unknown>|null`.
- `KawasanMapInner` logika cache-first:
  1. Kalau `boundaryGeojson` (dari DB) sudah ada → parse via `parseStoredBoundary()` → set state langsung, skip Nominatim
  2. Kalau null → fetch Nominatim + validasi seperti sebelumnya → set state → PATCH ke DB (fire and forget)
- Helper `parseStoredBoundary()`: konversi format DB (`{ geom, bbox, name }`) ke `DesaBoundaryData` (format Leaflet `[lat,lng]`). Try/catch agar graceful jika format berubah.
- Format JSON yang disimpan: `{ geom: GeoJSONGeometry, bbox: string[4], name: string, admin_level: string }`.

**Keputusan/catatan penting:**
- Nominatim hanya di-query pada kunjungan PERTAMA per kawasan (saat `boundary_geojson` masih null di DB). Setelah itu semua request langsung pakai cache DB — tidak ada dependency ke Nominatim di runtime normal.
- "Fire and forget" PATCH: UI tidak menunggu save selesai, tidak ada loading state tambahan.
- Kolom `boundary_geojson JSONB` memungkinkan admin mengedit/override data batas desa langsung via Supabase dashboard jika data OSM salah.
- Migration perlu dijalankan manual di SQL Editor sebelum fitur ini aktif.

**Status berikutnya:** Jalankan migration `05_add_boundary_geojson_kawasan` di Supabase SQL Editor. Lalu refresh halaman kawasan — batas desa Sangeh akan muncul dari Nominatim (pertama kali), dan PATCH tersimpan ke DB. Kunjungan kedua langsung ambil dari DB.

---

## [2026-07-04] — Bug fix: halaman kawasan 404 karena kolom boundary_geojson belum ada

**Dikerjakan:**
- Root cause 404: query `select('...boundary_geojson')` di server component gagal karena kolom belum ada di DB (migration 05 belum dijalankan). Supabase return error → `kawasan` data null → `notFound()` terpanggil → halaman 404.
- Fix: pisah query `boundary_geojson` ke query terpisah SETELAH `if (!kawasan) notFound()`. Kalau kolom belum ada (query error), `boundaryGeojson` fallback ke null — halaman tetap load, Nominatim jadi fallback untuk batas desa.
- Query utama kawasan kembali ke `select('id, name, local_term, region, total_area_ha')` tanpa `boundary_geojson` — tidak akan 404 meski migration belum dijalankan.

**Status berikutnya:** Halaman kawasan sekarang bisa diakses lagi. Jalankan migration `05_add_boundary_geojson_kawasan` di Supabase SQL Editor untuk mengaktifkan fitur cache batas desa.

---

## [2026-07-04] — Script backfill 2 tahun data NDVI/NDWI satelit

**Dikerjakan:**
- Buat `scripts/backfill-satellite.mjs` — script Node.js ESM standalone untuk backfill historical NDVI+NDWI ke tabel `satellite_logs`.
- Cara kerja: generate ~48 interval 15-hari dari 2 tahun lalu sampai hari ini. Untuk tiap interval, query Sentinel Hub Statistical API (NDVI + NDWI paralel), pilih tanggal terbaik dalam window tersebut, upsert ke DB (skip/overwrite kalau tanggal sudah ada). Delay 1.5 detik antar interval.
- Menangani token OAuth Sentinel Hub dengan cache (auto-refresh sebelum expired).
- Progress ditampilkan line-by-line di terminal dengan emoji status: ✓ (clear), ☁ (cloudy), ⬜ (no data), ✗ (error).
- Ringkasan final: jumlah berhasil, cloudy tersimpan, tidak ada data, error.
- Script dijalankan: `node scripts/backfill-satellite.mjs` dari root project.

**Status berikutnya:** Jalankan script backfill di terminal. Setelah selesai (~1-2 menit), grafik tren NDVI/NDWI di dashboard plot akan menampilkan data historis 2 tahun.

---

## [2026-07-04] — Revisi script backfill: resume + retry backoff + early stop

**Dikerjakan:**
- Rework `scripts/backfill-satellite.mjs` setelah run pertama: 15/49 berhasil, 34 gagal 429.
- **Resume**: fetch semua scan_date yang sudah ada di DB sebelum mulai. Tiap interval dicek: kalau ada scan_date dalam rentang [from,to] di DB → skip. 15 titik pertama otomatis di-skip saat re-run.
- **Retry backoff 429**: wrap `Promise.all([fetchStats NDVI, fetchStats NDWI])` di retry loop. Delay: 30s → 60s → 120s (max 3 retry per interval). Setelah 3 retry tetap 429 → interval di-skip, counter berturut naik.
- **Early stop**: kalau 3 interval berturut-turut gagal 429 (setelah semua retry habis) → berhenti, tampilkan pesan "coba lagi nanti", dan interval mana yang bisa dilanjutkan.
- **Delay antar interval**: naik dari 1.5s ke 6s.
- Estimasi waktu run (34 interval sisa, tanpa 429): ~3-4 menit.

**Status berikutnya:** Jalankan `node scripts/backfill-satellite.mjs` — akan skip 15 yang sudah ada dan lanjutkan dari interval ~2025-02-13.

---

## [2026-07-04] — Restrukturisasi musim tanam + tooltip NDVI/NDWI

**Dikerjakan:**
- **Tooltip NDVI/NDWI**: Tambahkan `title` prop ke `InfoTooltip.tsx` (tidak lagi hardcoded "Tentang CO₂e"). Refactor `scoreChip()` di `PlotDashboard.tsx` — parameter opsional 4: `{ title, body }`. Icon (i) kini tampil di chip NDVI dan NDWI dengan teks penjelasan masing-masing.
- **Migration SQL** `docs/migration_v6_planting_seasons.sql`: Tabel `planting_seasons` baru (id, plot_id FK, season_year, season_number, crop_variety, planting_date, estimated_harvest_date GENERATED, actual_harvest_date, actual_harvest_kg, status, notes). Constraint unik per `(plot_id, season_year, season_number)`. Kolom lama `plots.crop_variety` dan `plots.planting_date` di-COMMENT DEPRECATED tapi tidak di-DROP.
- **Types**: `PlantingSeason` interface ditambah ke `lib/types/plot.ts`.
- **API endpoints baru**:
  - `POST /api/plots/[plotId]/seasons` — buat musim tanam baru
  - `GET /api/plots/[plotId]/seasons` — list semua musim tanam satu plot
  - `PATCH /api/plots/[plotId]/seasons/[seasonId]` — catat panen / update status
- **Plot detail page** (`app/kawasan/[kawasanId]/plot/[plotId]/page.tsx`): query `planting_seasons` ditambahkan, dioper ke `PlotDashboard` sebagai prop `plantingSeasons`.
- **Kawasan page** (`app/kawasan/[kawasanId]/page.tsx`): `intensivePlots` KPI sekarang query `planting_seasons WHERE status='aktif'` (bukan `plots.planting_date` lagi).
- **PlotDashboard** — perubahan besar:
  - Tab "Log Panen" diganti menjadi "Musim Tanam" (tab id `'musim'`).
  - Header badge varietas dan tanggal tanam: prioritaskan `activeSeason` (musim dengan status 'aktif'), fallback ke `plot.crop_variety`/`plot.planting_date` untuk data lama.
  - Tab Musim Tanam: form "Tambah Musim Tanam Baru" (inline, auto-suggest nomor musim), list semua musim, form "Catat Panen" per musim aktif yang belum panen.
  - Tab Karbon: syarat "Minimal 1 log panen" sekarang cek `planting_seasons.some(s => s.actual_harvest_date !== null)`.
- **KawasanMapInner** form polygon: hapus field "Varietas Padi" dan semua state `cropVariety`. Diganti pesan info "Varietas diisi setelah petak tersimpan via Musim Tanam".

**Keputusan/catatan penting:**
- `estimated_harvest_date` adalah GENERATED ALWAYS AS (`planting_date + 110`) STORED — tidak perlu diisi manual, otomatis dari DB.
- Kolom lama `plots.crop_variety` dan `plots.planting_date` sengaja TIDAK di-drop — untuk backward compat display data yang sudah ada (Wayan Suparta). Removal bisa dilakukan setelah semua data lama dimigrasi ke `planting_seasons`.
- Migration belum dijalankan — user perlu jalankan manual di Supabase SQL Editor: `06_create_planting_seasons`.

**Status berikutnya:** Jalankan migration `06_create_planting_seasons` di Supabase SQL Editor. Setelah itu test tab "Musim Tanam" di dashboard plot — tambah musim tanam baru dan catat panen.

---

## [2026-07-04] — Transparansi placeholder karbon + konfirmasi data migration

**Dikerjakan:**
- **Tab Karbon UI**: Dua item checklist yang belum diimplementasi ("Log manajemen air AWD" dan "Baseline emisi CH₄ terverifikasi") kini tampil eksplisit sebagai `⏳ — belum tersedia (Fase 2)` — warna amber, bukan sekadar `○` abu-abu seperti item yang sedang kosong. Ini memastikan saat presentasi, keterbatasan sistem terlihat jelas, tidak tersembunyi.
- **PRD_AgriMRV.md**: Ditambahkan catatan di Tahap 4 (keputusan diambil) dan Tahap 7 (checklist deliverable) bahwa AWD water logging dan CH₄ baseline adalah scope Fase 2, belum dikerjakan. Tabel `water_management_logs` dan `emission_baselines` belum ada di schema.
- **Konfirmasi ke user**: Data `planting_date = 2026-05-15` yang ada di tabel `plots` TIDAK otomatis ter-migrate ke `planting_seasons` — migration hanya membuat tabel baru kosong. User perlu input ulang manual di tab Musim Tanam.

**Status berikutnya:** User input musim tanam pertama di tab Musim Tanam (tanggal tanam 2026-05-15, varietas yang sesuai). Verifikasi: (1) KPI "Mode Intensif Aktif" di halaman kawasan berubah dari 0 ke 1 setelah musim tanam diisi, (2) badge varietas + tanggal tanam muncul di header dashboard plot, (3) syarat "Minimal 1 log panen" di Tab Karbon bisa dipenuhi setelah catat panen.

---

## [2026-07-04 (sesi lanjutan)] — Tooltip NDVI Rata-rata KPI + soft delete Hapus Petak

**Dikerjakan:**
- **Tooltip NDVI Rata-rata** (KPI halaman kawasan): Tambahkan `<InfoTooltip>` di sebelah label "NDVI Rata-rata" di `KawasanPageClient.tsx`. Isi: "Rata-rata NDVI dari scan terakhir semua petak di kawasan ini. Skala -1 sampai 1, makin tinggi makin sehat/hijau. Catatan: rata-rata gabungan — kondisi tiap petak individual bisa berbeda-beda."
- **Migration SQL** (`docs/migration_v7_soft_delete_plots.sql`): Tambah kolom `is_deleted boolean NOT NULL DEFAULT false` ke tabel `plots` + index parsial + recreate view `v_plots` dengan filter `WHERE p.is_deleted = false`. Setelah migration, semua query yang pakai `v_plots` otomatis tidak melihat plot yang dihapus.
- **API PATCH** (`app/api/plots/[plotId]/route.ts`): Endpoint PATCH baru untuk soft delete — menerima `{ is_deleted: boolean }`, update kolom di tabel `plots` via admin client.
- **UI Hapus Petak di halaman kawasan** (`KawasanPageClient.tsx`): Tombol "⋯" di setiap card petak → dropdown → "Hapus Petak" → dialog overlay konfirmasi dengan nama petak + keterangan "data disembunyikan, bukan dihapus permanen". State: `menuOpenId`, `deleteConfirmId`, `isDeleting`, `deleteError`. Overlay transparan di belakang menu untuk tutup otomatis saat klik di luar.
- **UI Hapus Petak di halaman detail plot** (`PlotDashboard.tsx`): Tombol teks merah "Hapus Petak" di bawah area scan button. Dialog konfirmasi identik. Setelah konfirmasi dan delete berhasil, redirect ke halaman kawasan (`router.push`).

**Keputusan/catatan penting:**
- Soft delete — TIDAK hard delete dari DB. Ini sesuai keputusan sebelumnya: histori satelit dan log panen tetap ada di DB, hanya disembunyikan dari UI.
- `v_plots` view di-recreate dengan tambahan `WHERE p.is_deleted = false` — ini berarti SEMUA consumer `v_plots` (termasuk GET `/api/plots`, kawasan page, cron scan) otomatis tidak akan melihat plot yang dihapus, tanpa perlu ubah kode di masing-masing tempat.
- **Wajib jalankan migration** `07_soft_delete_plots` di Supabase SQL Editor sebelum fitur ini bisa dipakai — kalau migration belum jalan, PATCH endpoint akan error karena kolom `is_deleted` belum ada.

**Status berikutnya:** Jalankan migration `07_soft_delete_plots` di Supabase SQL Editor (beri nama: `07_soft_delete_plots`). Setelah itu test di browser: (1) buka halaman kawasan → card petak → klik "⋯" → "Hapus Petak" → konfirmasi → petak hilang dari list dan peta, (2) buka halaman detail plot → klik "Hapus Petak" → konfirmasi → redirect ke kawasan.

---

## [2026-07-04 (sesi lanjutan 2)] — Fix z-index dialog + edit/hapus musim tanam

**Dikerjakan:**
- **Bug z-index dialog hapus petak**: Dialog muncul di belakang peta Leaflet (z-index Leaflet bisa 400-800+, dialog pakai `z-50`=50 — kalah). Fix: pakai `ReactDOM.createPortal(dialog, document.body)` di kedua file (`KawasanPageClient.tsx` dan `PlotDashboard.tsx`). Portal me-render langsung ke `document.body`, keluar dari semua stacking context. Z-index dinaikan ke `z-[9999]` sebagai lapisan tambahan.
- **API DELETE musim tanam** (`app/api/plots/[plotId]/seasons/[seasonId]/route.ts`): Tambah handler DELETE — hard delete baris dari `planting_seasons`, sesuai permintaan (musim tanam salah input wajar dihapus permanen, beda dari data satelit).
- **UI edit musim tanam** (`PlotDashboard.tsx`): Tombol "Edit" di header setiap card musim tanam. Membuka dialog portal dengan form (varietas, tanggal tanam, status select, tgl panen aktual, hasil panen kg, catatan). Submit → PATCH ke API → `router.refresh()`. Z-index aman via portal.
- **UI hapus musim tanam** (`PlotDashboard.tsx`): Tombol "Hapus" di header card → dialog konfirmasi portal "dihapus permanen, tidak bisa dibatalkan" → DELETE ke API → `router.refresh()`. Z-index aman via portal.

**Keputusan/catatan penting:**
- Semua dialog konfirmasi di project ini harus pakai `createPortal(..., document.body)` bukan rendering inline — ini pelajaran dari bug z-index dengan Leaflet. `createPortal` tetap bekerja di mana pun dalam JSX tree; yang berubah hanya di mana DOM-nya di-render.
- Guard `typeof document !== 'undefined'` diperlukan karena Next.js App Router SSR — `document` tidak ada di server.

**Status berikutnya:** Test di browser: (1) buka halaman kawasan → klik "⋯" card → "Hapus Petak" → dialog harus muncul DI ATAS peta, (2) buka detail plot → tab Musim Tanam → klik "Edit" dan "Hapus" di musim tanam yang ada → verify dialog muncul di atas semua elemen.

---

## [2026-07-05] — Hover tooltip polygon petak di peta kawasan

**Dikerjakan:**
- **Extend `PlotData` interface** (`KawasanMapInner.tsx`): Tambah field opsional `active_variety`, `latest_ndvi`, `latest_phase`, `latest_scan_date` — data ini diisi server-side, backward compat (semua `?`).
- **Enrich plot data server-side** (`app/kawasan/[kawasanId]/page.tsx`): Query satellite_logs diperluas dengan `estimated_phase`; query planting_seasons ditambah `crop_variety`. Dibangun dua Map (per plot_id): `latestScanPerPlot` dan `activeVarietyPerPlot`. Plot dienrich sebelum dikirim ke client.
- **Hover tooltip polygon** (`KawasanMapInner.tsx`):
  - State `hoveredPlot` + `tooltipPos {x, y}` di komponen utama
  - `eventHandlers` (mouseover / mousemove / mouseout) di setiap `<Polygon>`
  - Polygon berubah: `fillOpacity: 0.5`, `weight: 3` saat di-hover
  - Komponen `PlotTooltip`: card putih rounded dengan shadow, konten (nama petani, varietas aktif atau "Belum ada musim tanam aktif", luas ha, fase estimasi, NDVI + tanggal scan). Flip otomatis ke kiri kursor kalau posisi terlalu dekat tepi kanan.
  - Komponen `Row`: helper untuk baris label + value di tooltip
  - Fase diterjemahkan ke bahasa Indonesia via `PHASE_LABEL` map

**Keputusan:**
- Tooltip adalah pure CSS `position: absolute` di dalam wrapper div peta (`relative`), bukan Leaflet Tooltip/Popup bawaan — supaya bisa pakai Tailwind dan style custom.
- `window.innerWidth` dipakai untuk deteksi flip (bukan `containerWidth`) — cukup akurat untuk use case ini; peta biasanya full-width.

**Status berikutnya:** Test di browser: hover ke polygon petak → tooltip muncul dekat kursor dengan info nama, varietas, NDVI, fase. Tidak perlu klik.

---

## [2026-07-05 (sesi lanjutan)] — Fitur Edit Batas Lahan (polygon drag & drop)

**Dikerjakan:**
- **API PATCH generalized** (`app/api/plots/[plotId]/route.ts`): Diperluas dari hanya menerima `is_deleted` menjadi menerima field mana pun dari `['is_deleted', 'geo_data', 'area_ha']`. Validasi tetap ada untuk is_deleted (harus boolean).
- **PlotMapInner edit mode** (`components/maps/PlotMapInner.tsx`): Tambah import Geoman CSS + JS + `@turf/area`. Export `PlotGeoJSON` interface. Tambah props `editMode` dan `onEditChange`. Sub-komponen `GeomanEditor`: buat L.polygon imperatively (warna oranye), enable `layer.pm.enable()`, listen `pm:edit / pm:vertexadded / pm:vertexremoved`, emit GeoJSON + area_ha ke parent via callback. Cleanup di useEffect return (pm.disable, removeLayer).
- **PlotMap.tsx** (`components/maps/PlotMap.tsx`): Teruskan `editMode` + `onEditChange` props + import `PlotGeoJSON` type.
- **PlotDashboard edit UI** (`components/plots/PlotDashboard.tsx`):
  - State baru: `isEditingBoundary`, `pendingGeoData`, `pendingAreaHa`, `isSavingBoundary`, `boundaryError`
  - Handler `handleSaveBoundary()`: PATCH `geo_data` + `area_ha` → `router.refresh()`
  - Tombol "Edit Batas" (text kecil di ujung kanan bar layer toggle) — hanya muncul saat tidak edit
  - Header bar saat edit mode: label oranye "Mode Edit Batas Aktif" (gantikan layer toggle)
  - Footer saat edit mode (gantikan legend): luas baru real-time + "Simpan Perubahan" + "Batal"
  - Batal → reset semua state edit, GeomanEditor unmount, polygon normal kembali

**Keputusan:**
- Geoman diaktifkan secara imperatif (bukan via react-leaflet component) supaya bisa memanipulasi layer lifecycle secara eksplisit — konsisten dengan pola yang sudah ada di KawasanMapInner.
- `GeomanEditor` meng-emit state awal ke parent saat mount, sehingga `pendingGeoData` langsung terisi — "Simpan" bisa diklik bahkan sebelum user drag apa pun (menyimpan polygon yang belum diubah).
- Tidak ada dialog konfirmasi di fitur ini (hanya Save/Cancel inline) — sesuai permintaan user.

**Status berikutnya:** Test di browser: buka detail plot → klik "Edit Batas" → peta polygon berubah oranye dengan titik-titik vertex → drag vertex → luas di footer update otomatis → klik "Simpan Perubahan" → halaman refresh, geo_data dan area_ha baru tersimpan.

---

## [2026-07-05 (sesi lanjutan 2)] — Fix logic fase estimasi NDVI+NDWI cross-check

**Dikerjakan:**
- **Investigasi root cause**: Dikonfirmasi bahwa "perbaikan cross-check NDWI" yang diasumsikan sudah ada TIDAK pernah diimplementasikan. Semua 3 path (scan route, cron route, backfill) masih pure NDVI-only sejak awal. Untuk NDVI=0.331 → kode lama selalu mengembalikan 'vegetatif' tanpa cek NDWI apapun.
- **Fix di 3 tempat** — konsisten, tidak ada yang tertinggal:
  - `app/api/plots/[plotId]/scan/route.ts`: rename `phaseFromNdvi(v)` → `estimatePhase(v, ndwi)`, panggil dengan `(ndviMean, ndwiMean)`
  - `app/api/cron/satellite-scan/route.ts`: update inline logic, tambah `w = ndwiScore` sebagai variable cross-check
  - `scripts/backfill-satellite.mjs`: rename + tambah ndwi param
- **Logic baru (threshold disepakati user):**
  - NDVI < 0.1 → kosong
  - NDVI < 0.3 → semai
  - NDVI 0.3–0.5 + NDWI < -0.35 → pematangan, else vegetatif
  - NDVI 0.5–0.7 + NDWI < -0.3 → pematangan, else generatif
  - NDVI ≥ 0.7 → pematangan
- **Script recalculate** (`scripts/recalculate-phases.mjs`): One-time script, baca semua baris `satellite_logs`, hitung ulang `estimated_phase` dari `ndvi_score` + `ndwi_score` yang sudah tersimpan (tidak fetch ulang ke Sentinel Hub). Print diff per baris: old → new. 
- **Disclaimer di UI**: Label "* Ilustratif — bukan standar agronomi resmi" di bawah nilai fase di detail plot (`PlotDashboard.tsx`). Label "Fase *" + keterangan di tooltip peta kawasan (`KawasanMapInner.tsx`).
- **Dokumentasi**: `BRIEF_AgriMRV.md` → bagian RIWAYAT KEPUTUSAN ditambah entri lengkap keputusan threshold + catatan ilustratif.

**Keputusan/catatan penting:**
- Debugging ini mengikuti prosedur CLAUDE.md §6: tidak ada klaim "sudah ada perbaikan" tanpa bukti kode konkret. Terbukti perbaikan belum pernah ada.
- Data lama TIDAK otomatis recalculate — perlu jalankan `node scripts/recalculate-phases.mjs` secara manual satu kali.
- Threshold NDWI bersifat ilustratif — ini perlu dicatat jelas di dokumentasi karena validasi agronomi formal butuh data lapangan yang belum ada.

**Status berikutnya:**
1. Jalankan `node scripts/recalculate-phases.mjs` di terminal untuk recalculate 48 baris historical
2. Cek output script — lihat berapa baris yang berubah dari 'vegetatif'/'generatif' ke 'pematangan'
3. Verifikasi di UI: plot Budidaya BSO, data 30 Jun 2026 (NDVI=0.331, NDWI=-0.402) seharusnya sekarang tampil "pematangan"

---

## [2026-07-05] — Tambah field status_lahan + data sertifikasi ke plots

**Dikerjakan:**
- **Migration v8** (`docs/migration_v8_status_lahan.sql`, nama SQL Editor: `08_status_lahan_plots`):
  - `ALTER TABLE plots ADD COLUMN status_lahan text CHECK (IN 'organik','konversi','regenerative','konvensional')`
  - `ALTER TABLE plots ADD COLUMN nama_lso text, nomor_sertifikat text, tanggal_kadaluarsa date`
  - `CREATE OR REPLACE FUNCTION insert_plot(...)` — tambah 4 param opsional dengan DEFAULT NULL (backward-compatible)
  - `CREATE OR REPLACE VIEW v_plots` — recreate untuk expose kolom baru, pertahankan `WHERE is_deleted = false`
- **API** `app/api/plots/route.ts` — POST sekarang terima dan validasi `status_lahan`, kirim 4 field baru ke RPC
- **Type** `lib/types/plot.ts` — `PlotDetail` ditambah `status_lahan`, `nama_lso`, `nomor_sertifikat`, `tanggal_kadaluarsa`
- **Form polygon baru** `KawasanMapInner.tsx`:
  - Select dropdown 4 pilihan status lahan
  - Disclaimer amber: "Status ini berdasarkan pengakuan/dokumen petani, belum tervalidasi sistem — untuk klaim resmi tetap perlu sertifikasi LSO."
  - 3 field cert (nama_lso, nomor_sertifikat, tanggal_kadaluarsa) muncul conditional — hanya kalau status bukan 'konvensional'
  - Form container sekarang scrollable (`max-h-[82%] overflow-y-auto`) untuk accommodate field tambahan
- **Tooltip peta kawasan** `KawasanMapInner.tsx` — Row "Status" muncul di tooltip hover polygon kalau status_lahan terisi
- **Header detail plot** `PlotDashboard.tsx` — badge status dengan warna: organik=emerald, konversi=amber, regenerative=teal, konvensional=gray; plus baris LSO info kalau ada
- **Data flow**: `kawasan/[id]/page.tsx` select + propagate `status_lahan`; `plot/[id]/page.tsx` select + map ke `PlotDetail` via direct `plots` table query

**Keputusan/catatan penting:**
- Field ini TIDAK mempengaruhi kalkulasi NDVI/NDWI/CO2e — murni metadata self-declared
- Disclaimer muncul di form (warna amber, bukan error) — supaya admin/petani sadar ini bukan validasi resmi
- Cert fields (LSO, nomor, tanggal kadaluarsa) conditional — muncul hanya untuk status organik/konversi/regenerative
- Migration harus dijalankan SEBELUM deploy — kalau belum dijalankan, query ke v_plots yang menyertakan status_lahan akan error

**Status berikutnya:** Jalankan `08_status_lahan_plots` di Supabase SQL Editor sebelum test di browser

---

## [2026-07-06] — Pemilik/Penggarap + Riwayat Kepemilikan Lahan

**Dikerjakan:**
- **Migration v9** (`docs/migration_v9_ownership.sql`, nama SQL Editor: `09_ownership_history`):
  - `ALTER TABLE plots ADD COLUMN nama_pemilik text, ADD COLUMN nama_penggarap text`
  - Backfill: `UPDATE plots SET nama_penggarap = farmer_name, nama_pemilik = farmer_name` untuk data lama
  - Tabel baru `plot_ownership_history` (id, plot_id FK, nama_pemilik, nama_penggarap, tanggal_mulai, tanggal_selesai nullable, notes, created_at)
  - Constraint: `tanggal_selesai IS NULL OR tanggal_selesai >= tanggal_mulai`
  - Seed initial history dari semua plot existing (satu record per plot, tanggal_mulai = hari migration dijalankan)
  - DROP insert_plot (9 param dari v8) → CREATE insert_plot (11 param, tambah p_nama_pemilik + p_nama_penggarap); RPC kini juga INSERT initial ownership record secara atomik
  - Recreate v_plots dengan kolom baru
- **API** `app/api/plots/[plotId]/ownership/route.ts` — **BARU**: GET (list riwayat DESC), POST (auto-close record aktif, insert baru, sync ke plots.nama_pemilik/penggarap)
- **API** `app/api/plots/route.ts` — POST terima `nama_penggarap` (required, dengan fallback ke `farmer_name` untuk backward compat) + `nama_pemilik` opsional
- **Type** `lib/types/plot.ts` — `PlotDetail` + `nama_pemilik`/`nama_penggarap`; tambah `OwnershipRecord` interface
- **Form polygon baru** `KawasanMapInner.tsx` — label "Nama Petani" → "Nama Penggarap *"; tambah field opsional "Nama Pemilik Lahan"
- **Tooltip peta** `KawasanMapInner.tsx` — header tooltip pakai `nama_penggarap ?? farmer_name`
- **Header PlotDashboard** — h1 = nama_penggarap; baris tambahan di bawah h1 menampilkan "Pemilik & Penggarap" (jika sama) atau "Pemilik lahan: X" (jika berbeda)
- **Tab baru "Kepemilikan"** di PlotDashboard — list riwayat (urut terbaru ke terlama, badge "Aktif" untuk record tanpa tanggal_selesai) + form tambah perubahan baru (dengan catatan alasan)

**Keputusan/catatan penting:**
- `farmer_name` di tabel plots TIDAK dihapus — tetap sinkron dengan `nama_penggarap` (diisi via RPC dan ownership API) untuk backward compat dengan cron scan yang masih baca `v_plots.farmer_name`
- Auto-close: POST ownership otomatis set `tanggal_selesai` entri sebelumnya ke `tanggal_mulai` entri baru
- Ownership history seed saat migration: semua plot lama dapat 1 record awal bertanggal hari migration dijalankan + notes "backfill dari data sebelum migrasi v9"
- RPC `insert_plot` v9: jika `nama_pemilik` tidak diisi, default ke `nama_penggarap` (owner = operator, kasus paling umum untuk petani kecil)

**Status berikutnya:** Jalankan `09_ownership_history` di Supabase SQL Editor sebelum test di browser

---

## [2026-07-06 10:30] — Edit Status Lahan + fix Insight Otomatis NDWI threshold

**Dikerjakan:**
- **Edit Status Lahan** — tombol "Edit" kecil ditambahkan di sebelah badge status lahan di header PlotDashboard. Buka dialog (portal) dengan form prefilled (status_lahan, nama_lso, nomor_sertifikat, tanggal_kadaluarsa). PATCH ke `/api/plots/[plotId]` (field status ditambahkan ke ALLOW list endpoint tersebut).
- **Fix Insight Otomatis** — `deriveInsights()` sebelumnya punya logic threshold NDVI tersendiri yang tidak sinkron dengan `estimatePhase()`. Diperbaiki: NDVI 0.3–0.5 dengan NDWI < -0.35 → "pematangan" (bukan "vegetatif"); NDVI 0.5–0.7 dengan NDWI < -0.3 → "pematangan" (bukan "generatif"). Sekarang konsisten dengan kartu Data Scan.
- **Suppress warning "lahan kering"** — peringatan NDWI "Lahan terdeteksi kering — pertimbangkan pengairan" kini dilewati kalau phase sudah teridentifikasi sebagai pematangan (NDWI rendah saat pematangan adalah hal yang diharapkan, bukan anomali).

**Keputusan/catatan penting:**
- Tombol "Edit" ditampilkan selalu (tidak hanya kalau status sudah terisi) — memudahkan admin mengisi status dari kosong sekalipun.
- Field "Tidak diset" tersedia di dropdown edit, sehingga admin bisa clear status lahan kalau perlu.
- Threshold pematangan disamakan persis dengan `estimatePhase()`: NDWI < -0.35 (NDVI 0.3–0.5), NDWI < -0.3 (NDVI 0.5–0.7).

**Status berikutnya:** Siap test di browser — cek: (1) klik tombol Edit → dialog prefilled dengan data lama, (2) simpan → badge terupdate, (3) Insight Otomatis plot Budidaya BSO (NDVI 0.476, NDWI -0.490) sekarang harus bilang "pematangan"

---

## [2026-07-06] — RINGKASAN SESI PENUH (05–06 Juli 2026)

Entri ini merangkum keseluruhan sesi dalam 2 hari, melengkapi detail yang tidak tercakup di entri per-fitur sebelumnya — khususnya debug dan error migration v8.

---

### Fix threshold fase estimasi NDVI+NDWI

**Masalah awal:** Fungsi `phaseFromNdvi()` di 3 path (scan route, cron route, backfill script) hanya memakai NDVI tanpa cek NDWI sama sekali. Plot Budidaya BSO dengan NDVI=0.331, NDWI=-0.402 terus dibaca "vegetatif" padahal NDWI sangat negatif (lahan kering, padi mendekati panen).

**Yang dikerjakan:**
- Investigasi kode di 3 file — dikonfirmasi cross-check NDWI memang belum pernah diimplementasikan (bukan "bug regresi", melainkan fitur yang diasumsikan sudah ada ternyata belum)
- `phaseFromNdvi(v)` → `estimatePhase(v, ndwi)` di 3 path secara bersamaan
- Threshold NDWI yang disepakati: NDVI 0.3–0.5 + NDWI < -0.35 → pematangan; NDVI 0.5–0.7 + NDWI < -0.3 → pematangan; NDVI ≥ 0.7 → pematangan
- Script one-time `scripts/recalculate-phases.mjs` untuk recalculate 48 baris historis tanpa fetch ulang ke Sentinel Hub
- Disclaimer `"* Ilustratif — bukan standar agronomi resmi"` ditambahkan di UI
- Hasil run script: 19 baris diupdate, termasuk plot BSO yang benar berubah ke "pematangan"

### Backfill data historis (konteks sesi sebelumnya, dicatat ulang untuk kelengkapan)

- `scripts/backfill-satellite.mjs` membangun ~48 titik data per plot dari 2 tahun lalu
- Run pertama: 15/49 berhasil, 34 gagal 429 rate limit
- Rework: tambah resume (skip scan_date yang sudah ada di DB), retry 3x dengan backoff 30s/60s/120s, early stop setelah 3 consecutive failures
- Delay antar interval dinaikkan dari 1.5s ke 6s

### Migration v8 — status_lahan (termasuk 2 error PostgreSQL)

**Yang ditambahkan:** kolom `status_lahan` (Organik/Konversi/Regenerative/Konvensional), `nama_lso`, `nomor_sertifikat`, `tanggal_kadaluarsa` ke tabel plots.

**Error 1: `ERROR 42725: function name "insert_plot" is not unique`**
- Root cause: `CREATE OR REPLACE FUNCTION` dengan signature 9 param (tambah 4 kolom baru) TIDAK menggantikan fungsi lama signature 5 param — PostgreSQL membuat overload baru. Hasilnya sementara ada 2 fungsi `insert_plot`. Saat `GRANT EXECUTE ON FUNCTION insert_plot` (tanpa arglist) dijalankan, PostgreSQL menolak karena ambiguous.
- Fix: `DROP FUNCTION IF EXISTS insert_plot(uuid, text, text, numeric, jsonb)` sebelum `CREATE FUNCTION`, dan `GRANT` dengan full arglist eksplisit.
- **Pola yang ditetapkan:** Setiap migration yang mengubah signature fungsi PostgreSQL harus DROP dengan arglist lengkap terlebih dulu.

**Error 2: `ERROR 42P16: cannot change name of view column "created_at" to "status_lahan"`**
- Root cause: `CREATE OR REPLACE VIEW` di PostgreSQL mempertahankan posisi kolom dari view asli. Ketika kolom baru (status_lahan, dll) diinsert di tengah-tengah SELECT list, PostgreSQL menginterpretasikan ini sebagai usaha mengubah nama kolom di posisi tertentu — bukan menambah kolom.
- Dicek dahwa tidak ada DB object yang bergantung pada v_plots (query dependensi → 0 baris).
- Fix: `DROP VIEW IF EXISTS v_plots` → `CREATE VIEW v_plots ...` dari awal.
- **Pola yang ditetapkan:** `CREATE OR REPLACE VIEW` tidak bisa dipakai jika urutan/daftar kolom berubah — selalu `DROP VIEW` + `CREATE VIEW` fresh untuk v_plots.

### Migration v9 — kepemilikan lahan (pemilik/penggarap)

- `ALTER TABLE plots ADD COLUMN nama_pemilik text, nama_penggarap text`
- Backfill: set `nama_penggarap = farmer_name`, `nama_pemilik = farmer_name` untuk data lama
- Tabel baru `plot_ownership_history`: riwayat siapa pemilik dan penggarap per plot, dengan `tanggal_mulai` / `tanggal_selesai nullable` (null = masih aktif)
- `insert_plot` RPC diupdate ke 11 param (DROP v9-param lama dari v8 sebelum CREATE)
- `v_plots` di-recreate dengan kolom baru
- API ownership: GET list riwayat, POST dengan auto-close entri sebelumnya + sync ke `plots.nama_pemilik`/`nama_penggarap`
- UI: form polygon diupdate ("Nama Penggarap" + opsional "Nama Pemilik"), header PlotDashboard menampilkan pemilik/penggarap, tab "Kepemilikan" baru dengan list riwayat + form tambah perubahan

### Fitur Edit Status Lahan

- Sebelumnya badge status lahan tampil di header tapi tidak ada tombol edit (fitur kelewat di tengah pekerjaan ownership)
- Ditambahkan: tombol "Edit" kecil permanen di sebelah badge
- Klik → portal dialog dengan semua field prefilled
- PATCH endpoint diperluas: tambah `status_lahan`, `nama_lso`, `nomor_sertifikat`, `tanggal_kadaluarsa` ke ALLOWED list + validasi enum
- Dropdown "Tidak diset" tersedia untuk clear status kalau perlu

### Fix Insight Otomatis (konsistensi threshold)

- `deriveInsights()` di PlotDashboard punya logic NDVI tersendiri yang tidak pakai NDWI cross-check
- Plot BSO (NDVI 0.476, NDWI -0.490): kartu "Data Scan" bilang "pematangan" (setelah fix estimatePhase), tapi Insight Otomatis masih bilang "vegetatif" — inkonsisten
- Fix: samakan logic dengan estimatePhase() persis
- Bonus: suppress peringatan "lahan kering — pertimbangkan pengairan" saat fase sudah pematangan (NDWI rendah saat pematangan adalah kondisi yang diharapkan, bukan anomali)

---

**Jumlah migration selesai sesi ini:** v8 (status_lahan) + v9 (ownership history) = 2 migration baru, total project sekarang 9 migration

**TypeScript check akhir sesi:** 0 error

**Status selanjutnya:** Tahap 4 masih berlanjut — sisa: role & akses admin/pekaseh/auditor (belum diimplementasi), notifikasi Telegram

---

## [2026-07-06 ~11:00] — Integrasi penuh Sentinel-1 SAR: lib, cron, backfill, dashboard card

**Dikerjakan:**

### Arsitektur SAR (reusable lib)
- Buat `lib/sentinel-hub/sar.ts` — fungsi `fetchSar(geometry, fromDate, toDate)` reusable
  - Query ASCENDING + DESCENDING secara paralel (`Promise.all`)
  - Merge per tanggal: jika kedua orbit hit hari yang sama → rata-rata VV/VH, orbit='BOTH'
  - Return array `SarDayResult[]` dengan date, vv, vh, flood_index, orbit_direction
  - Error propagation dengan `.status` property (untuk retry 429 detection)
  - Koleksi: `sentinel-1-grd`, mode IW, polarisasi DV, resolusi HIGH, LINEAR_POWER

### Cron update (`app/api/cron/satellite-scan/route.ts`)
- Tambah import `fetchSar` dari lib SAR
- Restruktur loop: hapus `continue` pada skip NDVI → SAR dicek independen dari NDVI
- NDVI tetap pakai adaptive interval per plot; SAR pakai interval tetap 6 hari
- SAR check: query `sar_vv IS NOT NULL` terbaru → jika >= 6 hari: fetch SAR window 8 hari ke belakang
- Setiap SAR pass di-upsert ke actual acquisition date (bisa beda dari today) dengan `onConflict: 'plot_id,scan_date'` → update kolom SAR saja, kolom NDVI/NDWI tidak disentuh
- Summary tambah field `sarScanned`

### Backfill SAR (`scripts/backfill-sar.mjs`) — script baru terpisah dari backfill-satellite.mjs
- 2 tahun histori, interval 6 hari (bukan 15 hari seperti NDVI backfill)
- Resume: skip interval yang sudah ada >= 1 row dengan sar_vv IS NOT NULL di window itu
- Fetch dua orbit per interval, merge ke dates unik → upsert ke satellite_logs
- Retry backoff 429: 30s → 60s → 120s, early stop setelah 3x berturut-turut
- Delay 8 detik antar interval (vs 6 detik NDVI backfill — karena 2 API calls per interval)

### Types update (`lib/types/plot.ts`)
- Tambah ke SatelliteLog: `sar_vv`, `sar_vh`, `sar_flood_index`, `sar_orbit_direction`, `sar_source`

### SELECT update (`app/kawasan/[kawasanId]/plot/[plotId]/page.tsx`)
- satellite_logs SELECT diperluas: tambah semua 5 kolom SAR baru

### Dashboard card (`components/plots/PlotDashboard.tsx`)
- `latestSarLog`: computed via useMemo — cari log terbaru dengan sar_vv IS NOT NULL (mungkin beda tanggal dari activeScan/NDVI)
- Card baru "Data Radar (Sentinel-1)" ditempatkan antara "Data Scan" (NDVI/NDWI) dan "Insight Otomatis"
- Grid 2x2: VV (σ°), VH (σ°), Rasio VH/VV (color-coded: biru=tinggi, sky=sedang, amber=kering), Orbit direction
- Tooltip (InfoTooltip) komprehensif: penjelasan SAR vs optical, VV/VH/rasio/orbit, interval akuisisi, satuan linear power
- Interpretasi singkat di bawah rasio: "indikasi genangan tinggi" / "genangan sedang" / "lahan relatif kering"
- Threshold: VH/VV > 0.4 → genangan tinggi; 0.25-0.4 → sedang; < 0.25 → relatif kering
- Fallback state: "Belum ada data radar" saat belum ada SAR di DB

**Keputusan/catatan penting:**
- SAR dan NDVI disimpan ke tanggal akuisisi masing-masing (bukan selalu today) — bisa beda row, bisa row yang sama tergantung timing
- Upsert SAR tidak mengubah kolom NDVI/NDWI karena hanya set kolom sar_* (Supabase merge-duplicates)
- Dashboard SAR card tidak terhubung ke timeline scrubber NDVI — selalu tampil data SAR terbaru yang ada

**TypeScript check:** 0 error (`npx tsc --noEmit` clean)

**Status selanjutnya:**
- User perlu jalankan `node scripts/backfill-sar.mjs` untuk isi histori SAR Wayan Suparta
- Bandingkan pola SAR (genangan) dengan pola NDWI (Agu-Nov 2025 yang ambigu sebelumnya)
- Sisa Tahap 4: role & akses (admin/pekaseh/auditor), notifikasi Telegram

---

## [2026-07-06 ~11:30] — Tambah SarTrendChart dan siapkan query Agu-Nov 2025

**Dikerjakan:**
- Buat `components/charts/SarTrendChart.tsx` — chart tren SAR (VV, VH, flood_index per tanggal)
  - Recharts LineChart, filter hanya log yang punya sar_flood_index IS NOT NULL
  - Tiga garis: VV (slate), VH (indigo), flood_index/VH/VV (biru tebal — garis utama)
  - Reference lines di 0.25 (genangan sedang) dan 0.40 (genangan tinggi) — warna biru
  - Tooltip kustom: tampilkan VV, VH, flood_index + interpretasi teks + orbit direction
  - Fallback "Belum ada data radar" kalau belum ada SAR
- Integrasikan di PlotDashboard: section baru "Tren Radar SAR (Sentinel-1)" di bawah NDVI chart
  - Counter pass SAR aktif (bukan total log)
  - Label threshold dijelaskan di bawah judul
- TypeScript: 0 error

**Status selanjutnya:**
- Jalankan `node scripts/backfill-sar.mjs` dari root project untuk isi 2 tahun histori SAR
- Setelah selesai, query Agu-Nov 2025 di SQL Editor dengan nama `11_query_sar_aug_nov_2025`
- Dashboard langsung tampil SAR tren setelah backfill

---

## [2026-07-07] — npm run dev diverifikasi + backfill SAR 2 tahun selesai dijalankan

**Dikerjakan:**
- `npm run dev` dijalankan: Next.js 16.2.10 (Turbopack) ready di `localhost:3000` dalam 440ms, `.env.local` termuat — dikonfirmasi server aktif.
- `node scripts/backfill-sar.mjs` dijalankan penuh sampai selesai (plot Wayan Suparta, 2024-07-06 s/d 2026-07-06, interval 6 hari):
  - 120/120 interval diproses (2 interval sudah ada di DB, di-skip)
  - 205 SAR pass tersimpan ke `satellite_logs` (VV/VH per tanggal akuisisi ASCENDING/DESCENDING)
  - 1 interval tanpa pass SAR (window terakhir 2026-07-02→2026-07-06, belum ada citra baru)
  - 0 gagal/retry 429 — proses berjalan bersih tanpa rate-limit sepanjang ~120 interval

**Keputusan/catatan penting:**
- Tidak ada error selama backfill — script resume + delay 8 detik dari sesi sebelumnya terbukti cukup untuk menghindari rate limit Sentinel Hub untuk volume 120 interval x 2 orbit.

**Status berikutnya:**
1. Jalankan query SQL Editor Agu-Nov 2025 (nama: `11_query_sar_aug_nov_2025`) untuk cross-check pola genangan SAR vs NDWI yang sebelumnya ambigu di periode itu
2. Verifikasi di browser: buka detail plot Wayan Suparta → card "Data Radar (Sentinel-1)" dan chart "Tren Radar SAR" sekarang harus tampil histori penuh 2 tahun
3. Sisa Tahap 4: role & akses (admin/pekaseh/auditor), notifikasi Telegram

---

## [2026-07-07] — ⚠️ INSIDEN KEAMANAN: RLS tidak aktif di user_profiles, diperbaiki (migration v11)

**Dikerjakan:**
- **Trigger:** User menerima email peringatan otomatis Supabase "Table publicly accessible" untuk project agrimrv.
- **Investigasi:** Tidak bisa cek langsung ke DB (koneksi Postgres langsung dari mesin lokal tetap tidak resolve DNS, konsisten dengan kendala sesi-sesi sebelumnya). Dilakukan audit kode: baca ulang semua file `docs/migration_v*.sql`, grep `CREATE TABLE` + `ENABLE ROW LEVEL SECURITY` di semua migration.
- **Root cause ditemukan (dari audit kode, bukan asumsi):** `migration_v1.sql` baris 17-25 membuat tabel `user_profiles`, tapi blok "RLS ENABLE" di baris 127-132 hanya mencakup 6 dari 7 tabel yang dibuat — `user_profiles` terlewat sejak migration pertama (03 Juli 2026).
- **Konfirmasi via user:** User menjalankan query verifikasi (`SELECT ... FROM pg_tables WHERE schemaname='public' AND rowsecurity=false`) di SQL Editor — hasil 2 baris: `spatial_ref_sys` (bawaan PostGIS, false positive standar, dikonfirmasi aman diabaikan) dan `user_profiles` (sesuai dugaan dari audit kode).
- **Migration fix dibuat:** `docs/migration_v11_enable_rls_user_profiles.sql` (nama SQL Editor: `11_enable_rls_user_profiles`):
  - `ENABLE ROW LEVEL SECURITY` di `user_profiles`
  - Policy `self_read_own_profile` (SELECT, `id = auth.uid()`) — wajib, mencegah deadlock pada subquery admin-check yang dipakai tabel-tabel lain
  - Policy `admin_full_access_user_profiles` (FOR ALL), pola sama seperti tabel lain
  - **Ditambahkan sekalian** (temuan tambahan saat audit): `plot_ownership_history` (migration v9) sudah RLS aktif tapi belum pernah punya policy — ditambahkan `admin_full_access_ownership_history` (FOR ALL) + `auditor_read_ownership_history` (FOR SELECT), pola sama seperti `plots`
- **User menjalankan migration** di SQL Editor, verifikasi ulang: hasil query cek RLS sekarang cuma 1 baris (`spatial_ref_sys`) — `user_profiles` sudah tidak muncul lagi di daftar tabel tanpa RLS. **Dikonfirmasi fixed.**
- Dokumentasi: entri lengkap ditambahkan ke `BRIEF_AgriMRV.md` bagian RIWAYAT KEPUTUSAN (root cause, dampak, perbaikan, pola pencegahan ke depan).

**Keputusan/catatan penting:**
- Root cause dari audit kode langsung (bukan teori), dikonfirmasi dengan query nyata dari user sebelum fix dijalankan — sesuai disiplin debugging CLAUDE.md §6.
- Dampak: sejak migration v1 pertama dijalankan (03 Juli 2026) sampai fix ini (07 Juli 2026), tabel `user_profiles` (full_name, role, phone, telegram_id semua user) berpotensi diakses lewat anon key tanpa autentikasi. Tidak ada bukti/indikasi eksploitasi aktif — laporan murni dari Supabase Advisor otomatis.
- `spatial_ref_sys` SENGAJA tidak disentuh — tabel bawaan ekstensi PostGIS, false positive standar untuk warning ini.
- **Pola baru ditetapkan:** setiap `CREATE TABLE` baru ke depan WAJIB langsung disertai `ENABLE ROW LEVEL SECURITY` + minimal 1 policy di migration yang SAMA, tidak boleh dipisah/ditunda ke migration berikutnya.

**Status berikutnya:** Insiden ditutup — RLS `user_profiles` dan `plot_ownership_history` sudah aktif dengan policy lengkap. Lanjut ke agenda sebelumnya: query SAR Agu-Nov 2025 (`11_query_sar_aug_nov_2025` — catatan: nomor urut SQL Editor lanjut ke `12` karena `11` sudah dipakai migration keamanan ini), verifikasi dashboard SAR di browser, dan sisa Tahap 4 (role & akses, notifikasi Telegram).

---

## [2026-07-08] — Redesign UI/UX sesuai prototype: peta+tabel kawasan, hero petak, filter tanggal, tooltip konsisten, branding Save Subak

Sesi restyle besar mengikuti prototype HTML yang sudah dikonfirmasi user, dikerjakan bertahap 5 bagian (masing-masing diverifikasi via browser sungguhan sebelum lanjut ke bagian berikutnya, bukan cuma type-check).

### Bagian 1 — Halaman Kawasan: peta + tabel (ganti card besar)

- `components/kawasan/KawasanPageClient.tsx`: daftar card besar per-petak diganti tabel ringkas — kolom Petani | Varietas | Luas | Koordinat | Fase Terkini | Scan Terakhir | Aksi.
- Kolom Koordinat: link `https://maps.google.com/?q={lat},{lng}` buka tab baru.
- Klik baris tabel (atau ikon 📍) → peta di atas **fitBounds** ke polygon petak (upgrade dari sekadar `flyTo` titik tetap zoom 18) + tooltip nama petani otomatis muncul di posisi polygon setelah animasi selesai.
- Tombol baru "📍 Lokasi Gmaps Kawasan" di header, link ke titik pusat kawasan (rata-rata centroid semua petak).
- `components/maps/KawasanMapInner.tsx`: `FlyToPlot` diupgrade pakai `L.latLngBounds` + `flyToBounds`, dan menerima callback `onArrive` yang menghitung container point dari centroid lalu men-trigger tooltip hover secara terprogram (bukan cuma dari event mouse).

**Bug ditemukan+diperbaiki saat verifikasi (bukan asumsi dari type-check):** import helper baru (`computePlotsCenter`, `plotCentroid`, `PHASE_LABEL`) dari `KawasanMapInner.tsx` ke `KawasanPageClient.tsx` menarik seluruh modul Leaflet (browser-only) ke jalur SSR → `ReferenceError: window is not defined`, halaman 500. **Fix:** helper geometri dipindah ke modul baru `lib/plot-geo.ts` yang tidak bergantung Leaflet sama sekali — dipakai bersama oleh komponen manapun (server atau client) tanpa risiko menarik dependency browser-only ke SSR.

### 3 fix visual (sebelum Bagian 2)

- **Background `--paper` (#fbfaf7):** ditambahkan sebagai CSS variable + Tailwind token di `app/globals.css` (`--color-paper`), dipakai di kedua wrapper halaman utama (`bg-paper` menggantikan `bg-gray-50`) — card tetap putih murni untuk kontras lembut.
- **Badge fase berwarna:** komponen baru `components/plots/PhaseBadge.tsx` + `PHASE_BADGE_STYLE`/`PHASE_BADGE_EMPTY` di `lib/plot-geo.ts` — 4 kombinasi warna per fase (pematangan/semai/vegetatif/generatif) + fallback abu netral, dipakai di kolom Fase Terkini tabel kawasan.
- **Logo Save Subak:** ditemukan `public/logo-save-subak.png` sebenarnya adalah **folder** (bukan file), berisi file asli `save_subak_logo.png` di dalamnya — kemungkinan kesalahan saat menaruh file (drag folder, bukan filenya). Diperbaiki strukturnya. Dibuat topbar aplikasi global baru `components/layout/AppTopbar.tsx` (dipasang di `app/layout.tsx`, membungkus semua halaman) — sebelumnya tidak ada elemen header bersama sama sekali di app. Kiri: wordmark teks "AgriMRV" (belum ada aset logo terpisah). Kanan: logo 22px + teks 11px "Powered by Save Subak" → link `www.savesubak.org` tab baru.

### Bagian 2 — Detail Petak: hero peta asli + strip statistik

- `components/plots/PlotDashboard.tsx`: peta Leaflet dijadikan hero penuh (h-420px) di posisi paling atas konten, menggantikan card map yang sebelumnya nested di kolom kiri grid.
- Badge fase mengambang pojok kiri atas peta: dark overlay (`bg-black/70`) + dot hijau live-pulse (`animate-ping`), mengikuti `activeScan` yang sedang dipilih.
- Kontrol layer (NDVI/NDWI/True Color) + tombol "Edit Batas" dipindah jadi mengambang di pojok kanan atas peta (sebelumnya bar terpisah di atas peta).
- Strip 4 statistik baru di bawah hero: NDVI | NDWI | VH/VV | Orbit, masing-masing dengan tooltip (i) sendiri — **mengonsolidasikan** card "Data Scan" dan "Data Radar" lama yang dihapus (datanya sudah tercakup di strip; tutupan awan jadi footnote kecil, bukan tile ke-5, sesuai spesifikasi "4 statistik").
- Card "Tren Radar Sentinel-1 (SAR)" (sudah ada dari sesi sebelumnya) tetap terpisah dari card NDVI/NDWI.

### Bagian 3 — Filter tanggal: toggle cepat + slider (ganti grid ratusan tombol)

- Komponen reusable baru `components/charts/DateRangeControl.tsx`: toggle cepat (1 Bulan/3 Bulan/1 Tahun/Semua) + slider horizontal draggable dengan label tanggal di kedua ujung. Rentang di-**anchor ke tanggal data terbaru** (bukan tanggal sistem `Date.now()`) — supaya "1 Bulan" tetap berarti "1 bulan terakhir dari data yang ada" walau jam sistem sudah lewat dari tanggal data terakhir.
- Diterapkan independen ke 2 chart: NDVI/NDWI (aksen hijau) dan SAR (aksen biru). `components/charts/SarTrendChart.tsx` ditambah prop `activeScanId`/`onSelect` + custom dot highlight (pola sama persis dengan `NdviTrendChart.tsx`) supaya SAR chart juga punya titik-terpilih yang bisa di-scrub via slider.
- State di `PlotDashboard.tsx`: `ndviRangeFiltered`/`sarRangeFiltered` (data yang ditampilkan di chart, hasil filter rentang) dan `sarActiveId`/`sarSelectedLog` (titik SAR yang sedang dipilih, terpisah dari `activeScanId` milik NDVI) — strip statistik VH/VV & Orbit sekarang reaktif mengikuti slider SAR, bukan selalu data terbaru seperti sebelumnya.

**Bug kritis ditemukan+diperbaiki saat verifikasi dengan Playwright:** klik toggle "1 Bulan" memicu crash React **"Maximum update depth exceeded"** (infinite loop) di `NdviTrendChart`. Root cause: `useMemo` untuk `filtered` di `DateRangeControl` menyertakan `getDate`/`getId` di dependency array — keduanya di-pass sebagai inline arrow function dari parent (`getDate={(l) => l.scan_date}`), reference baru tiap render → `filtered` selalu jadi array baru → `useEffect` yang memanggil `onRangeChange` (setState parent) retrigger tanpa henti → parent re-render → loop. **Fix:** mempersempit dependency array `useMemo` ke `[items, rangeKey]` saja (item accessor function TIDAK dimasukkan ke deps — pola defensif supaya komponen tetap aman dipakai dengan inline prop function dari caller manapun).

### Bagian 4 — Konsistensi tooltip (i)

- `components/plots/InfoTooltip.tsx` di-redesign total: ikon bulat kecil abu-abu "i" tetap, tapi panel keterangan sekarang **dark (bg-gray-900, teks putih) + panah kecil penunjuk ke ikon**, trigger hover ATAU klik, muncul di bawah ikon, dengan clamp horizontal supaya tidak keluar viewport.
- **Di-render via `createPortal` ke `document.body`** (bukan absolute inline seperti sebelumnya) — krusial karena salah satu titik pakai (tooltip CO₂e di tab Karbon) berada di dalam card `overflow-hidden`; ini persis masalah yang sudah pernah ditemukan & didokumentasikan di project ini sebelumnya (04 Juli 2026: "InfoTooltip pakai inline expand untuk hindari overflow-hidden"). Portal menghindari masalah itu sepenuhnya, konsisten dengan pola `createPortal` yang sudah dipakai untuk dialog konfirmasi di project ini.
- Karena hanya ada 1 komponen `InfoTooltip` dipakai di seluruh app (NDVI, NDWI, VH/VV, Orbit, NDVI Rata-rata kawasan, CO₂e) — redesign 1 komponen ini otomatis menyeragamkan semua titik tanpa perlu ubah lokasi pakainya satu-satu. Konten tooltip CO₂e disesuaikan warna internal (kotak formula & disclaimer sebelumnya didesain untuk panel terang) supaya kontras di panel gelap.

### Verifikasi (semua bagian, browser sungguhan)

`chromium-cli` tidak tersedia di environment Windows ini — Playwright (`playwright@1.61.1` + Chromium) diinstall **lokal di direktori scratchpad session**, bukan sebagai dependency project (`package.json` tidak disentuh). Dipakai untuk:
- Drive klik toggle + drag slider sungguhan, baca nilai tampilan sebelum/sesudah (bukan cuma cek elemen ada).
- Screenshot visual tiap bagian untuk verifikasi layout.
- Hover ke 6 titik tooltip di 2 halaman (termasuk kasus `overflow-hidden` yang paling rawan) — semua ✓ visible, teks sesuai, tidak terpotong, 0 console error.

**Keputusan/catatan penting:**
- Pola baru: helper geometri/logic murni (tanpa dependency Leaflet) harus hidup di `lib/`, bukan di komponen `*MapInner.tsx` — supaya bisa diimpor server component maupun client component manapun tanpa risiko menarik modul browser-only ke SSR. Berlaku untuk `lib/plot-geo.ts` ke depannya.
- Pola baru: komponen popover/dialog mengambang yang mungkin dipakai di dalam card `overflow-hidden` mana pun **wajib** pakai `createPortal(..., document.body)`, tidak boleh absolute-positioned inline — pelajaran ini sekarang berlaku untuk tooltip juga, bukan cuma dialog konfirmasi.
- Pola baru: komponen custom hook/effect yang menerima accessor function (`getDate`, `getId`, dst) dari parent sebagai prop TIDAK BOLEH memasukkan accessor itu ke dependency array `useMemo`/`useEffect` kalau parent kemungkinan pass inline arrow function — gunakan primitive/reference stabil (`items`, `rangeKey`) sebagai dependency, bukan si accessor.
- `DateRangeControl` di-anchor ke tanggal data terbaru (bukan `Date.now()`) — keputusan disengaja supaya filter tetap masuk akal untuk dataset historis/backfill yang tanggal terakhirnya bisa saja beberapa hari di belakang tanggal sistem saat ini.

**TypeScript check di setiap bagian:** 0 error.

**Status berikutnya:** Redesign UI selesai penuh (Bagian 1-5, branding sudah kelar di sesi fix-3-hal). Sisa Tahap 4: role & akses admin/pekaseh/auditor (belum diimplementasi), notifikasi Telegram. Query SAR Agu-Nov 2025 (`12_query_sar_aug_nov_2025`) masih tertunda dari sesi sebelumnya.

---

## [2026-07-08 (lanjutan)] — Query SAR Agu-Nov 2025 + fitur baru: Analisis Pola Pengairan Otomatis (rule-based)

**Query SAR Agu-Nov 2025 (dijanjikan sesi sebelumnya):**
- Dijalankan langsung via Supabase REST API pakai service_role (read-only, tidak perlu user paste manual ke SQL Editor).
- Dibandingkan 8 titik NDWI vs SAR flood_index terdekat di rentang Agu-Nov 2025, plot Wayan Suparta. Hasil: mayoritas konsisten; 2 titik NDWI≈0 (ambigu) diperjelas SAR; 1 titik (22 Nov) SAR mengungkap indikasi genangan sedang yang NDWI lewatkan sama sekali; 1 titik divergen (08 Okt, NDWI sangat kering vs SAR moderat — dicatat sebagai butuh investigasi lanjut, kemungkinan efek kanopi padat fase pematangan terhadap backscatter).

**Fitur baru: Analisis Pola Pengairan Otomatis** (`docs/migration_v12_season_water_pattern.sql`, nama SQL Editor: `12_season_water_pattern_analysis` atau `13_...` kalau 12 sudah kepakai query di atas):
- Tabel baru `season_water_pattern_analysis` (RLS aktif + policy admin/auditor sejak awal, sesuai checklist wajib CLAUDE.md §7).
- Fungsi `fn_analyze_season_water_pattern(p_season_id)`: rule-based (IF-ELSE murni, BUKAN AI/LLM) — gabung NDWI+SAR kronologis dalam rentang planting_date..actual_harvest_date (atau CURRENT_DATE kalau belum panen), hitung transisi basah/kering, klasifikasi `oscillating_awd_like` (≥2 transisi) / `continuous_flooding` (0-1 transisi) / `insufficient_data` (<5 titik).
- Trigger otomatis saat `actual_harvest_date` diisi + RPC manual (tombol "Analisis Ulang Pola" di tab Musim Tanam, bisa dipanggil kapan saja termasuk musim belum panen).
- API `POST /api/plots/[plotId]/seasons/[seasonId]/water-pattern`, UI di tab Musim Tanam dengan disclaimer wajib.
- Query `season_water_pattern_analysis` di server component pakai fallback graceful (tabel baru, migration belum tentu sudah jalan saat kode deploy) — dikonfirmasi via testing: halaman tetap 200 sebelum migration dijalankan, tombol "Analisis Ulang Pola" menampilkan error rapi ("function not found"), bukan crash.

**⚠️ Bug ditemukan langsung setelah user coba fitur pertama kali:** Hasil pertama untuk Musim 1/2026 (Wayan Suparta, tanam 07 Apr 2026, belum panen) menunjukkan **14 transisi** dalam ~3 bulan (`oscillating_awd_like`) — user curiga ini noise, bukan pola AWD asli, dan awalnya dikira bertentangan dengan analisis manual Agu-Nov 2025 (`continuous_flooding`).

**Investigasi (mengikuti CLAUDE.md §6 — bukti dulu, jangan asumsi):**
1. **Diklarifikasi dulu periode yang dibandingkan salah** — Musim 1/2026 (tanam Apr 2026) dan analisis manual Agu-Nov 2025 adalah dua rentang waktu yang SAMA SEKALI TIDAK TUMPANG TINDIH (Agu-Nov 2025 terjadi sebelum musim ini bahkan mulai tanam). Bukan kontradiksi literal — belum pernah dibandingkan apple-to-apple.
2. **Audit data mentah** (31 titik: 6 NDWI + 25 SAR) menemukan 2 mekanisme nyata penyebab over-counting:
   - **(a) Threshold tanpa hysteresis:** 4 dari 14 transisi terjadi pada nilai SAR cuma 0.004–0.04 dari garis batas 0.25 — dalam rentang speckle noise SAR harian, bukan perubahan lahan nyata.
   - **(b) Percampuran sumber data tanpa rekonsiliasi (temuan baru, tidak terduga sebelumnya):** 6 dari 14 transisi terjadi TEPAT saat urutan data berpindah dari titik SAR ke NDWI atau sebaliknya — dua sensor beda skala/threshold disambung jadi satu urutan tunggal rawan menghasilkan transisi palsu murni akibat gonta-ganti jenis sensor.
3. Kesimpulan: dari 14 transisi, hanya ~6-7 yang punya sinyal cukup kuat untuk dipercaya sebagai perubahan kondisi lahan nyata.

**Fix diputuskan user** (`docs/migration_v13_water_pattern_hysteresis.sql`, nama SQL Editor: `13_water_pattern_hysteresis_fix`) — kombinasi 2 dari 3 opsi yang diajukan:
1. **Hysteresis/dead-band PADA SAR SAJA** (NDWI sengaja TIDAK diubah): SAR ≥0.28 = basah, ≤0.22 = kering, 0.22–0.28 = zona mati (tidak mengubah status, titik dilewati).
2. **Minimum persistensi:** transisi baru dihitung valid kalau status baru bertahan ≥2 titik keputusan berturut-turut (menyaring lonjakan 1 titik).
3. Opsi ketiga (hitung NDWI & SAR sepenuhnya terpisah) **DITUNDA** — dievaluasi lagi kalau kombinasi 1+2 ternyata belum cukup.
- Signature fungsi tidak berubah → `CREATE OR REPLACE FUNCTION` aman, tidak perlu `DROP FUNCTION` (beda kasus dari migration v8).

**Keputusan/catatan penting:**
- **Root cause BUKAN bug logika** — kode v12 berjalan persis sesuai desainnya. Masalahnya desain algoritma yang terlalu naif untuk data time-series remote sensing yang secara inheren noisy di sekitar nilai ambang. Pelajaran ini penting: threshold tunggal tanpa hysteresis/dead-band ATAU syarat durasi minimum akan selalu rawan "chattering" pada sinyal noisy — berlaku untuk fitur rule-based lain di masa depan yang mengklasifikasi time-series dari data satelit.
- Pola baru: kalau menggabung dua sumber data dengan skala/threshold berbeda (NDWI optik vs SAR radar) jadi satu urutan kronologis tunggal, WASPADAI titik-titik sambungan antar-sumber sebagai sumber transisi palsu — bukan cuma noise dalam satu sumber saja.
- Disiplin CLAUDE.md §6 terbukti berguna di sini: user tidak menerima angka 14 begitu saja, minta bukti konkret sebelum percaya "root cause"-nya, dan investigasi berbasis data mentah (bukan teori) berhasil mengidentifikasi 2 mekanisme spesifik, bukan cuma "kemungkinan noise" generik.

**Status berikutnya:** User perlu jalankan `docs/migration_v13_water_pattern_hysteresis.sql` di SQL Editor. Setelah dikonfirmasi jalan, hitung ulang `fn_analyze_season_water_pattern` untuk Musim 1/2026 Wayan Suparta dan verifikasi angka oscillation_count baru + apakah klasifikasi berubah — hasil akan ditambahkan sebagai entri log lanjutan.

---

## [2026-07-08 (lanjutan 2)] — ✅ Verifikasi fix hysteresis: oscillation_count 14 → 4, klasifikasi tidak berubah

**Dikerjakan:**
- User konfirmasi migration `13_water_pattern_hysteresis_fix` sudah dijalankan di SQL Editor.
- `fn_analyze_season_water_pattern` dipanggil ULANG secara aktual untuk Musim 1/2026 Wayan Suparta (`planting_season_id: 515ca4d7-696e-4bd3-856c-3115051e48d0`) via REST API service_role (bukan simulasi/prediksi) — response HTTP 200 langsung dari database.

**Hasil aktual (sebelum → sesudah fix):**
| Field | v12 (lama) | v13 (baru, aktual) |
|---|---|---|
| `oscillation_count` | 14 | **4** |
| `pattern_detected` | oscillating_awd_like | oscillating_awd_like (**tidak berubah**) |
| `ndwi_points_used` | 6 | 6 |
| `sar_points_used` | 25 | 25 |

**Keputusan/catatan penting:**
- Fix berhasil menekan angka transisi 71% (14→4) — persis di kisaran ~6-7 "sinyal kuat" yang diperkirakan manual sebelumnya (4 tervalidasi ketat dengan syarat persistensi ≥2 titik, sedikit lebih konservatif dari estimasi awal karena beberapa "sinyal kuat" yang berdekatan waktu digabung jadi 1 transisi oleh state machine, bukan dihitung terpisah).
- Klasifikasi akhir **tidak berubah** (`oscillating_awd_like`, karena 4 masih ≥ ambang 2) — tapi sekarang didukung angka yang defensible, bukan angka yang tercampur noise. `ndwi_points_used`/`sar_points_used` tetap 6/25 seperti semula karena keduanya menghitung "titik yang diperiksa", bukan "titik yang lolos jadi sinyal" (8 dari 25 titik SAR jatuh di zona mati 0.22–0.28 dan tetap terhitung "digunakan" meski tidak ikut menentukan status).
- Kasus ini kebetulan tidak mengubah kesimpulan akhir, tapi fix tetap krusial: pada plot/musim lain dengan sinyal lebih lemah/lebih sedikit data, angka yang tercampur noise (seperti 14 sebelumnya) berpotensi mengubah klasifikasi secara keliru dari `continuous_flooding` jadi `oscillating_awd_like` — bukan cuma soal kosmetik angka.

**Status berikutnya:** Fitur Analisis Pola Pengairan Otomatis dianggap selesai & terverifikasi untuk kasus ini. Opsi 3 (pisah hitung NDWI/SAR independen) tetap ditunda sesuai keputusan — evaluasi ulang kalau ke depan ditemukan kasus lain yang masih menunjukkan overcounting meski sudah pakai hysteresis+persistensi. Sisa Tahap 4: role & akses admin/pekaseh/auditor, notifikasi Telegram.

---

## [2026-07-08 (lanjutan 3)] — Analisis lintas-musim + kesimpulan additionality Wayan Suparta MASIH BELUM PASTI

**Dikerjakan:**
- `fn_analyze_season_water_pattern` dijalankan untuk SEMUA `planting_seasons` yang tercatat di DB (4 musim, 3 plot berbeda), bukan cuma Musim 1/2026 Wayan Suparta:
  - **Wayan Suparta, Musim 2/2025** (05 Nov 2025 → 11 Mar 2026, sudah panen): 8 NDWI + 41 SAR (49 titik) → **3 oscillation** → `oscillating_awd_like`
  - **Wayan Suparta, Musim 1/2026** (07 Apr 2026 → berjalan): 6 NDWI + 25 SAR (31 titik) → **4 oscillation** → `oscillating_awd_like`
  - **Budidaya BSO, Musim 1/2026** (sudah panen): cuma 1 titik NDWI, 0 SAR → `insufficient_data`
  - **Men Lembug, Musim 2/2026** (berjalan): cuma 2 titik NDWI, 0 SAR → `insufficient_data`
- Root cause 2 plot lain `insufficient_data`: script backfill (`backfill-satellite.mjs`, `backfill-sar.mjs`) sesi-sesi sebelumnya cuma pernah dijalankan untuk plot Wayan Suparta — bukan masalah algoritma.
- User diminta klarifikasi apakah perlu kategori ketiga `borderline_ambiguous` (2-4 transisi) supaya beda dari kasus yang jelas tegas (≥5) — **BELUM diimplementasikan**, masih menunggu keputusan user (ambang "5" adalah usulan berbasis penalaran domain, BUKAN hasil kalkulasi statistik karena sampel cuma n=2 musim valid).
- User eksplisit minta: **JANGAN backfill plot lain dulu** sampai temuan berikut dicatat resmi ke dokumentasi.

**Temuan resmi yang dicatat (permintaan user):**
1. **Dua metode analisis NDWI/SAR yang pernah dilakukan di project ini TIDAK apple-to-apple:**
   - Analisis manual awal (07 Juli 2026, perbandingan NDWI vs SAR Agu-Nov 2025) — dilakukan dengan cara "eyeball" grafik atas seluruh histori satelit plot, SEBELUM `planting_seasons` ada sebagai konsep resmi (tabel itu baru dibuat 04 Juli 2026, dan periode Agu-Nov 2025 yang dianalisis manual itu bahkan sebelum musim tanam resmi manapun yang tercatat di `planting_seasons`).
   - Analisis otomatis resmi (fitur `fn_analyze_season_water_pattern`) — berbasis rentang tanggal `planting_date`..`actual_harvest_date` yang eksplisit tercatat per musim.
   - Kedua metode ini tidak pernah membandingkan periode yang sama, sehingga hasil "continuous_flooding" (manual, Agu-Nov 2025) dan "oscillating_awd_like" (otomatis, musim 2025/2026) **bukan kontradiksi** — cuma dua pertanyaan berbeda yang kebetulan pernah ditanyakan ke data yang sama.
2. **Kedua musim resmi yang sudah tercatat SAMA-SAMA borderline:** Musim 2/2025 (3 transisi) dan Musim 1/2026 (4 transisi) — keduanya tipis di atas ambang minimal 2, jauh dari angka yang diharapkan untuk AWD yang dijalankan ketat/rutin (~9-13 alternasi kalau siklus tiap 5-10 hari sepanjang musim 90-130 hari).
3. **Kesimpulan additionality plot Wayan Suparta MASIH BELUM PASTI.** Data satelit (NDWI+SAR, sudah lolos fix hysteresis+persistensi) menunjukkan sinyal campuran/borderline — TIDAK cukup tegas untuk menyimpulkan praktik AWD disengaja-berulang, TAPI juga tidak cukup tegas untuk menyimpulkan pengelolaan konvensional/tergenang-terus. Ini punya konsekuensi langsung ke klaim additionality karbon (lihat BRIEF_AgriMRV.md — additionality belum bisa dikonfirmasi dari data jarak jauh saja).
4. **Data historis 2024–Oktober 2025 tidak punya `planting_seasons` resmi tercatat** — tidak bisa dianalisis ulang dengan fungsi otomatis untuk perbandingan lintas-musim yang lebih panjang. Satu-satunya cara membandingkan periode itu tetap analisis manual (seperti yang sudah dilakukan 07 Juli 2026), bukan lewat fitur otomatis ini.
5. **Rekomendasi langkah berikutnya: konfirmasi lapangan via wawancara pekaseh**, disebut user merujuk ke dokumen `SOP_Tanam_Subak_Sangeh_Konfirmasi.pdf` — **dicatat: file ini TIDAK ditemukan di repository project saat pengecekan** (`find` di seluruh folder project, tidak ada hasil). Kemungkinan dokumen eksternal/fisik yang belum diunggah ke project, atau rencana dokumen yang belum dibuat — perlu klarifikasi user kalau mau direferensikan sebagai artefak project. Data satelit sendiri, seberapa pun bagus algoritmanya, punya keterbatasan resolusi temporal (6-15 hari) yang tidak bisa membedakan "AWD terjadwal ketat" dari "pengeringan situasional beberapa kali" — konfirmasi lapangan langsung ke pekaseh/petani adalah penentu akhir yang tidak tergantikan data jarak jauh.

**Status berikutnya:** Menunggu keputusan user soal kategori `borderline_ambiguous` (poin 1 di respons chat). Backfill satelit untuk plot Budidaya BSO dan Men Lembug **ditahan dulu** sesuai instruksi eksplisit user, sampai poin-poin di atas selesai dicatat (sudah selesai lewat entri ini).

---

## [2026-07-08 (lanjutan 4)] — Kategori borderline_ambiguous diimplementasikan + backfill Budidaya BSO + bug fix grafik NDVI

**Kategori ketiga `borderline_ambiguous` (migration v14, `docs/migration_v14_water_pattern_borderline.sql`, nama SQL Editor: `14_water_pattern_borderline_category`):**
- User setuju skema 3 kategori: 0-1 transisi → `continuous_flooding`, 2-4 → `borderline_ambiguous` (baru), ≥5 → `oscillating_awd_like`.
- CHECK constraint `pattern_detected` diupdate — dicari nama constraint-nya via `pg_constraint` (bukan asumsi nama otomatis Postgres) sebelum DROP+ADD, supaya migration tetap aman kalau nama auto-generated ternyata beda dari dugaan.
- `lib/types/plot.ts` — `WaterPatternType` tambah `'borderline_ambiguous'`. `components/plots/PlotDashboard.tsx` — `WATER_PATTERN_LABEL` tambah badge warna netral abu-kuning (`bg #eae6d9`, `text #6b6047`, ikon ⚠️), teks persis: "Pola campuran — tidak cukup tegas untuk disimpulkan, perlu konfirmasi lapangan."
- **Verifikasi aktual** (RPC dipanggil ulang sungguhan, bukan asumsi): kedua musim Wayan Suparta yang sebelumnya `oscillating_awd_like` sekarang **`borderline_ambiguous`** — Musim 2/2025 tetap 3 transisi, Musim 1/2026 tetap 4 transisi (cuma ambang kategori yang bergeser, bukan cara hitungnya). Dikonfirmasi juga di browser — kedua kartu musim di tab Musim Tanam tampil badge baru dengan benar.
- Dicatat ke `BRIEF_AgriMRV.md`: ambang "5" adalah penalaran domain, bukan statistik (n=2), wajib dikalibrasi ulang begitu sampel bertambah.

**Backfill NDVI/NDWI + SAR untuk Budidaya BSO** (konteks: petani ini dibina program Save Subak sejak awal 2024 — backfill 2 tahun ini berpotensi jadi baseline pra/pasca-pembinaan):
- Kedua script backfill (`scripts/backfill-satellite.mjs`, `scripts/backfill-sar.mjs`) di-generalisasi: `PLOT_ID` sekarang bisa dioverride via argumen CLI pertama (`process.argv[2]`), default tetap plot Wayan Suparta untuk backward-compat — tidak perlu edit source code tiap ganti plot.
- NDVI/NDWI: **46/48 berhasil**, 2 gagal (Sentinel Hub Stats API 500 transient, bisa di-retry dengan resume). **Tanggal data paling awal yang berhasil ditarik: 20 Juli 2024.**
- SAR: sedang berjalan (122 interval, ~17 menit) saat entri ini ditulis — dilanjutkan di entri berikutnya.
- **PENTING — dicatat sesuai permintaan user, jangan diasumsikan:** backfill "2 tahun" di kedua script dihitung `hari ini − 730 hari`, BUKAN mundur ke tanggal kalender tertentu. Untuk hari ini (08 Juli 2026), itu berarti mundur ke **~07-08 Juli 2024** — **TIDAK mencapai Januari 2024 atau awal 2024**. Artinya **backfill ini KEMUNGKINAN BESAR TIDAK memberikan baseline data pra-pembinaan** (pembinaan disebut mulai "awal 2024") — window datanya sudah confirmed mulai pertengahan 2024, beberapa bulan setelah pembinaan kemungkinan sudah berjalan. Ini perlu diketahui eksplisit sebelum data ini dipakai untuk klaim "before/after pembinaan" — kalau baseline pra-pembinaan penting, perlu sumber data lain di luar 2-tahun-terakhir dari sistem ini.

**Bug fix: grafik Tren NDVI & NDWI tampil sebagai titik-titik lepas tanpa garis (plot Wayan Suparta)**
- **Investigasi sesuai CLAUDE.md §6 — bukti dari data mentah dulu:**
  - Duplikat `scan_date`: 0 — bukan penyebab.
  - Urutan data tidak berurutan: 0 baris — bukan penyebab.
  - `ndvi_score IS NULL`: **201 dari 251 baris (80%)** — dari 250 pasangan baris berdekatan (by scan_date), **cuma 1 pasang yang keduanya punya `ndvi_score` terisi**.
- **Root cause terkonfirmasi:** `satellite_logs` adalah tabel gabungan NDVI (interval ~10-15 hari) dan SAR (interval ~6 hari) — baris SAR-only ikut masuk daftar dengan `ndvi_score: null`. `NdviTrendChart.tsx` pakai `connectNulls={false}` di Recharts; karena baris SAR-only jauh lebih banyak dan bersilangan hampir di tiap titik dengan baris NDVI, garis nyaris tidak pernah punya 2 titik berdekatan yang sama-sama terisi → patah jadi puluhan segmen 1-titik yang terlihat seperti titik lepas.
- **Bukan spesifik ke Wayan Suparta** — Budidaya BSO kelihatan normal SAAT ITU cuma karena backfill SAR-nya belum jalan (baru mulai di entri ini). Begitu SAR Budidaya BSO selesai di-backfill, bug yang sama akan muncul di sana juga kalau tidak diperbaiki di kode — dikonfirmasi lewat data: 24/72 baris BSO sudah null saat backfill SAR baru separuh jalan.
- **Fix** (`components/plots/PlotDashboard.tsx`): tambah `ndviLogsOnly = useMemo(() => satelliteLogs.filter(l => l.ndvi_score !== null || l.ndwi_score !== null), [satelliteLogs])` — saring baris SAR-only keluar SEBELUM masuk ke `NdviTrendChart`, `DateRangeControl` NDVI, dan inisialisasi `latestScan`/`activeScanId` (yang sebelumnya rawan kebetulan memilih baris SAR-only sebagai "scan terakhir" kalau baris terakhir secara tanggal ternyata baris SAR, bukan NDVI). Label "X dari Y scan" juga diperbaiki, sebelumnya `Y` memakai `satelliteLogs.length` (termasuk baris SAR, menyesatkan — sempat tertulis "251 dari 251 scan" padahal cuma 50 yang benar-benar scan NDVI).
- **Fix di level data, bukan `connectNulls={true}`** — sengaja: mengubah `connectNulls` akan menyambungkan garis melintasi baris yang secara fisik bukan representasi NDVI (baris SAR), bukan solusi yang benar. Filter di level data adalah root-cause fix, bukan menutupi gejala.
- **Verifikasi di browser:** label berubah dari "251 dari 251 scan" jadi "50 dari 50 scan" (akurat). Toggle "3 Bulan" dikonfirmasi garis tersambung sempurna di semua 8 titik. Toggle "Semua (2 Tahun)" sempat terlihat ada beberapa titik "lepas" di ujung kanan — dicek lebih lanjut lewat query data terpisah, dikonfirmasi BUKAN bug (semua 10 baris terbaru punya ndvi_score+ndwi_score terisi, tidak ada null) — itu cuma efek visual kepadatan titik di skala 2 tahun, bukan garis yang benar-benar patah.

**Keputusan/catatan penting:**
- Pola baru: tabel `satellite_logs` yang menggabungkan >1 sumber data (NDVI, NDWI, SAR) di baris yang sama TAPI kolom berbeda — komponen chart/UI yang spesifik ke 1 sumber data WAJIB filter baris yang relevan ke sumber itu saja SEBELUM diproses, jangan asumsikan seluruh isi tabel relevan. Pola ini sudah diterapkan untuk `sarLogsOnly` sejak Bagian 3 redesign UI, sekarang diterapkan juga untuk `ndviLogsOnly` — harus jadi pola standar untuk fitur serupa ke depan.
- Backfill "2 tahun" berbasis `hari ini − N hari`, bukan tanggal kalender tetap — perlu diingat setiap kali backfill dipakai untuk keperluan baseline historis dengan tanggal cutoff spesifik (seperti kasus pembinaan Budidaya BSO awal 2024 ini).

**Status berikutnya:** Tunggu backfill SAR Budidaya BSO selesai, lalu jalankan `fn_analyze_season_water_pattern` untuk musim tanam yang tercatat di plot itu. Ingatkan user eksplisit soal keterbatasan baseline pra-2024 sebelum menyimpulkan apa pun dari perbandingan pembinaan.

---

## [2026-07-08 (lanjutan 5)] — Backfill SAR Budidaya BSO selesai + hasil analisis pola pengairan

**Dikerjakan:**
- Backfill SAR Budidaya BSO selesai: 122/122 interval diproses, **209 SAR pass tersimpan**, 0 gagal.
- `fn_analyze_season_water_pattern` dijalankan untuk satu-satunya `planting_seasons` yang tercatat di plot ini: **Musim 1/2026** (tanam 12 Mar 2026 → panen 01 Jul 2026, sudah panen). Hasil: 6 titik NDWI + 33 titik SAR (39 total) → **5 transisi tervalidasi** → **`oscillating_awd_like`**.

**Penegasan penting (diminta eksplisit oleh user, dicatat apa adanya — jangan disederhanakan di baca ulang nanti):**
1. **Angka 5 itu PAS DI AMBANG MINIMUM kategori `oscillating_awd_like` (≥5), bukan jauh melewatinya.** Beda karakter dari kasus yang jelas tegas (semisal 8-10+) — hasil ini baru cukup untuk lolos dari zona `borderline_ambiguous`, bukan sinyal AWD yang kuat/meyakinkan.
2. **Ini SATU-SATUNYA musim yang bisa dianalisis untuk plot Budidaya BSO** — tidak ada `planting_seasons` lain tercatat untuk plot ini. Tidak ada data pra-pembinaan (awal 2024) yang bisa dibandingkan, karena arsip backfill satelit untuk plot ini cuma mulai **20 Juli 2024 (NDVI)** / **07 Juli 2024 (SAR)** — jauh dari awal 2024, saat pembinaan Save Subak disebut sudah mulai berjalan.
3. **TIDAK BISA disimpulkan "pembinaan berhasil mengubah pola pengairan ke arah AWD" dari data ini.** Kesimpulan semacam itu butuh perbandingan before-after (data pra-pembinaan vs pasca-pembinaan) yang TIDAK TERSEDIA dari sistem ini untuk plot ini — yang ada cuma 1 titik data pasca-pembinaan (Musim 1/2026), tanpa titik pembanding pra-pembinaan sama sekali.
4. Hasil ini murni deskriptif satu musim tunggal, bukan bukti tren atau perubahan dari waktu ke waktu.

**Keputusan/catatan penting:**
- Total sampel valid untuk fitur Analisis Pola Pengairan Otomatis sekarang **n=3** (Musim 2/2025 Wayan Suparta: 3 transisi, Musim 1/2026 Wayan Suparta: 4 transisi, Musim 1/2026 Budidaya BSO: 5 transisi) — dicatat sebagai observasi tambahan di `BRIEF_AgriMRV.md`, TAPI masih terlalu kecil untuk mengkalibrasi ulang ambang "5" secara statistik. Ambang itu tetap berstatus penalaran domain, bukan hasil kalkulasi data.
- Ketiga sampel yang ada sejauh ini semuanya jatuh di rentang sempit 3-5 (semua di sekitar batas `borderline_ambiguous`/`oscillating_awd_like`) — belum ada satu pun sampel yang jelas tegas ke salah satu ekstrem (`continuous_flooding` rendah atau `oscillating_awd_like` tinggi/≥8). Ini pola yang menarik untuk terus dipantau begitu sampel bertambah, tapi belum bisa ditarik kesimpulan apa pun darinya sekarang.

**Status berikutnya:** Fitur Analisis Pola Pengairan Otomatis dianggap selesai untuk kedua plot yang sudah di-backfill (Wayan Suparta, Budidaya BSO). Backfill Men Lembug (plot ketiga) belum dikerjakan — belum ada instruksi eksplisit dari user untuk itu. Sisa Tahap 4: role & akses admin/pekaseh/auditor, notifikasi Telegram.

---

## [2026-07-08 (lanjutan 6)] — Panel "Sumber Data & Verifikasi" (kredibilitas) + ⚠️ BUG BESAR: cloud_cover_percent salah sejak awal project

### Fitur baru: Panel Sumber Data & Verifikasi

**Tujuan:** membuktikan ke petani skeptis bahwa data ini benar-benar dari satelit resmi, bukan dikarang/AI — dengan ID produk resmi, timestamp presisi, dan tombol verifikasi independen.

- **Riset teknis dulu (sebelum coding):** Statistical API yang dipakai project ini untuk NDVI/NDWI/SAR cuma kasih angka agregat — TIDAK ada ID produk/tile resmi atau timestamp presisi. Dites Sentinel Hub **Catalog API** (STAC) secara langsung — terkonfirmasi memberi `id` produk resmi (mis. `S2C_MSIL2A_20260705T021531_..._T50LKR_....SAFE`), `datetime` presisi milidetik, `platform`. Dites juga untuk Sentinel-1 (SAR) — sama-sama tersedia.
- **Riset Copernicus Browser deep-link:** dikonfirmasi via WebSearch + dokumentasi resmi bahwa `browser.dataspace.copernicus.eu` mendukung parameter URL `zoom`, `lat`, `lng`, `fromTime`, `toTime` — dipakai untuk tombol "Verifikasi Independen".
- **Migration v15** (`docs/migration_v15_source_verification.sql`, nama SQL Editor: `15_satellite_source_verification`): 6 kolom baru di `satellite_logs` (`ndvi_product_id`, `ndvi_acquisition_datetime`, `ndvi_platform`, `sar_product_id`, `sar_acquisition_datetime`, `sar_platform`) — **BELUM DIJALANKAN user saat sesi ini berlanjut ke temuan bug di bawah**, jadi fitur ini masih berjalan graceful-degradation ("Metadata resmi belum tersedia").
- `lib/sentinel-hub/catalog.ts` — fungsi `fetchCatalogProduct()` baru.
- Diintegrasikan ke scan manual (`scan/route.ts`) dan cron (`cron/satellite-scan/route.ts`) — otomatis simpan metadata untuk scan BARU ke depan.
- `scripts/backfill-metadata.mjs` — untuk lengkapi metadata data historis (user sudah setuju scope ini, TAPI belum dijalankan — tertunda karena investigasi bug cloud cover di bawah lebih mendesak).
- Panel UI baru di `PlotDashboard.tsx`, 2 sub-kartu (Sentinel-2 optik, Sentinel-1 radar), masing-masing dengan tombol Copernicus Browser. Diverifikasi graceful degradation di browser sebelum migration dijalankan — 0 error.

### ⚠️ BUG BESAR ditemukan: cloud_cover_percent salah dihitung sejak migration v1

**Pemicu:** User melaporkan anomali scan 26 Mei 2026 Budidaya BSO — NDVI turun ke ~0 (kosong/bera) padahal padi dikonfirmasi masih ada di lahan secara langsung oleh user.

**Investigasi (CLAUDE.md §6 — bukti dulu, bukan asumsi):**
1. Data mentah 26 Mei 2026: `cloud_cover_percent=0`, `ndvi_score=-0.0114`, `ndwi_score=0.0501`. Bukan tertukar (nilai beda, bukan sama persis — cuma terlihat menempel di grafik karena skala Y-axis).
2. **Root cause ditemukan dari baca kode**, dikonfirmasi 3 lokasi identik (`lib/sentinel-hub/ndvi.ts`, `app/api/plots/[plotId]/scan/route.ts`, `scripts/backfill-satellite.mjs`): `cloud_cover_percent` dihitung dari band **`dataMask`** — band ini cuma menandai "piksel punya data sensor terekam" (di dalam jangkauan swath), **BUKAN detektor awan**. Piksel di bawah awan tebal tetap `dataMask=1` (sensor tetap merekam sesuatu, walau reflektansinya rusak oleh awan).
3. **Verifikasi silang dengan Catalog API resmi** (independen dari kode kita): cloud cover resmi Copernicus untuk 26 Mei 2026 di tile yang sama = **42.08%** (bukan 0% seperti dilaporkan app). Awan yang merusak NDVI/NDWI lolos validasi (ambang 15%) karena metrik yang dipakai untuk memvalidasi itu sendiri yang salah.

**Fix — evalscript diubah ke deteksi awan berbasis band SCL (Scene Classification Layer)** di 3 lokasi yang sama:
- SCL value 3=cloud shadow, 8=cloud medium probability, 9=cloud high probability, 10=thin cirrus → dihitung sebagai `cloudMask`, `cloud_cover_percent = mean(cloudMask) * 100`, dihitung SPESIFIK di area polygon petak (bukan level-tile 110×110km seperti Catalog API).
- **Diverifikasi dengan API call sungguhan sebelum dipercaya**: evalscript baru dites ke tanggal 26 Mei 2026 — hasil cloud SCL-based = **100%** (vs 0% lama), tanggal tetangga (21 & 31 Mei, NDVI tinggi 0.85/0.82) tetap 0% — konsisten dan masuk akal.
- Catatan metodologi: request Statistical API dengan rentang 1-hari-persis (`from=to=tanggal sama`) kadang dikembalikan KOSONG oleh API — ditemukan saat debugging test manual, bukan bug di app (app selalu pakai window lebih lebar: 30 hari di scan route, 15 hari di backfill). Dicatat sebagai gotcha teknis untuk script/test manual ke depan.

**Audit histori** (`scripts/audit-cloud-cover.mjs <PLOT_ID>` — script baru, cek ulang SEMUA baris ber-NDVI di kedua plot dengan evalscript SCL, update `cloud_cover_percent`, null-kan `estimated_phase` kalau ternyata cloud asli >15% padahal dulu dianggap valid — **nilai `ndvi_score`/`ndwi_score` mentah TIDAK diubah/dihapus sama sekali**):

| Plot | Total baris ber-NDVI | 🔴 Direklasifikasi (fase lama salah → null) | ✓ Tidak berubah |
|---|---|---|---|
| Budidaya BSO | 48 | **33 (69%)** | 15 |
| Wayan Suparta | 50 | **34 (68%)** | 16 |
| **Total** | **98** | **67 (68%)** | **31** |

**Silang-cek independen** (5 tanggal BSO, dibandingkan ke cloud cover resmi tile-level Catalog API): 4/5 arahnya konsisten (cloud resmi tinggi → direklasifikasi; cloud resmi rendah → tetap). **1/5 (31 Mei 2025) tidak konsisten** — cloud resmi tile 43%/26%, tapi kalkulasi per-petak kita 0%. Kemungkinan wajar (awan tidak merata, petak kecil bisa kebetulan di area cerah — justru itu kelebihan deteksi per-petak dibanding rata-rata tile), TAPI belum dikonfirmasi visual — direkomendasikan spot-check manual via tombol "Verifikasi Independen di Copernicus Browser".

**Keputusan/catatan penting:**
- **Pola biner 0%/100%, tidak pernah nilai tengah** — dicatat sebagai karakteristik yang kemungkinan besar wajar (bukan bug baru): kedua plot sangat kecil (0.174 ha dan 0.404 ha), sementara band SCL native-nya 20m resolusi — polygon sekecil itu kemungkinan cuma tercakup 1-beberapa piksel SCL saja, sehingga hasilnya cenderung "seluruh petak kena" atau "seluruh petak tidak kena", bukan gradasi persentase halus. Perlu diingat sebagai keterbatasan inheren metode ini untuk lahan kecil, bukan indikasi kesalahan baru.
- **Yang TIDAK terdampak bug ini:** nilai `ndvi_score`/`ndwi_score` mentah dipertahankan apa adanya di semua baris (tidak ada yang dihapus). Fitur Analisis Pola Pengairan Otomatis (`fn_analyze_season_water_pattern`) **TIDAK terpengaruh** — fungsi itu membaca `ndwi_score`/`sar_flood_index` langsung, bukan `estimated_phase`, jadi hasil `borderline_ambiguous` yang sudah diverifikasi sebelumnya (migration v14) tetap valid, tidak perlu dihitung ulang.
- **Pola baru ditetapkan:** JANGAN PERNAH pakai `dataMask` sebagai proxy deteksi awan — itu cuma penanda "ada data sensor", bukan cuaca. Deteksi awan Sentinel-2 yang benar harus pakai band SCL (Scene Classification Layer) atau referensi silang ke `eo:cloud_cover` resmi dari Catalog API. Berlaku untuk evalscript apa pun ke depan yang butuh filter kualitas citra.
- Root cause murni bug logika (BUKAN keterbatasan desain seperti kasus water pattern hysteresis sebelumnya) — `dataMask` dipakai sejak scaffold pertama (03 Juli 2026, migration v1) tanpa pernah dipertanyakan sampai user melaporkan anomali lapangan yang bertentangan dengan data.

**Status berikutnya:**
1. Jalankan migration `15_satellite_source_verification` di SQL Editor untuk mengaktifkan penuh panel Sumber Data & Verifikasi.
2. Jalankan `scripts/backfill-metadata.mjs` untuk kedua plot (belum dijalankan, tertunda karena investigasi bug).
3. Direkomendasikan: spot-check manual 2025-05-31 (Budidaya BSO) via Copernicus Browser untuk konfirmasi visual kasus yang tidak konsisten di silang-cek.
4. UI dashboard plot untuk baris yang estimated_phase-nya sekarang null (bekas "kosong"/dll yang salah) — pastikan tampilan card "Data Scan"/tooltip peta menampilkan state "tidak bisa ditentukan (awan)" yang jelas, bukan kosong membingungkan — belum dicek/diverifikasi di sesi ini.

---

## [2026-07-08 (lanjutan 7)] — Migration v15 dikonfirmasi jalan + fix UI untuk baris cloud-invalidated

**Dikerjakan:**
- User konfirmasi migration `15_satellite_source_verification` sudah dijalankan (kolom `ndvi_product_id`/`sar_product_id` sudah ada).
- **User minta cek dulu tampilan dashboard untuk baris yang `estimated_phase`-nya baru di-null-kan dari audit cloud cover** (poin 4 status sebelumnya), sebelum lanjut ke `backfill-metadata.mjs`.
- **Verifikasi di browser sungguhan** (tanggal 2024-07-15 Wayan Suparta, salah satu baris yang direklasifikasi) — ditemukan 2 bug nyata:
  1. **Badge fase mengambang di hero map** menampilkan **"Belum ada scan"** untuk baris yang sebenarnya PUNYA scan (NDVI/NDWI ada), cuma fase-nya tidak bisa ditentukan karena awan — pesan ini menyesatkan (menyiratkan sistem tidak pernah scan tanggal itu, padahal scan terjadi tapi datanya tidak reliable).
  2. **`deriveInsights()` (Insight Otomatis) lebih parah** — menampilkan peringatan "Citra tertutup awan 100% — nilai NDVI/NDWI mungkin tidak akurat", TAPI langsung diikuti insight fase & kekeringan yang dihitung PERCAYA DIRI dari NDVI/NDWI yang sama persis yang baru saja diperingatkan. Root cause: `deriveInsights()` sejak awal punya logic estimasi fase sendiri yang independen dari `estimated_phase` di database, dan tidak pernah digating oleh cek `cloud > 15` yang sudah ada di fungsi yang sama (cek awan cuma menambahkan warning, tidak mencegah insight fase lain jalan terus).
- **Fix:**
  - `deriveInsights()`: tambah flag `dataUnreliable = cloud > 15 || scan.estimated_phase === null`, kalau true → cuma tampilkan 1 warning awan yang jelas, `return` lebih awal (tidak lanjut hitung insight fase/kekeringan sama sekali). Fallback filler "Kondisi lahan terlihat normal" disederhanakan (`out.length === 0`) karena logic filter lama yang cek string "awan" sudah tidak relevan.
  - Badge hero map: fungsi baru `phaseBadgeText(scan)` — 3 state eksplisit: tidak ada scan sama sekali → "Belum ada scan"; scan ada tapi `estimated_phase` null → "☁️ Tertutup awan — fase tidak dapat ditentukan"; scan ada dengan fase → label fase normal.
- **Verifikasi ulang di browser setelah fix:** tanggal 2024-07-15 sekarang benar menampilkan badge "☁️ Tertutup awan — fase tidak dapat ditentukan" dan Insight Otomatis cuma 1 warning awan (tidak ada lagi klaim fase/kekeringan kontradiktif).
- **Regression check**: tanggal yang TIDAK kena reklasifikasi (2024-08-29, cloud tetap 0%) dicek ulang — badge tetap "Pematangan", insight tetap normal (success-level) — tidak ada regresi.
- **Temuan tambahan penting**: scan TERBARU Wayan Suparta (05 Juli 2026 — tanggal yang jadi default landing state setiap halaman plot dibuka, termasuk di HAMPIR SEMUA screenshot verifikasi sepanjang sesi-sesi sebelumnya di percakapan ini) **ternyata juga kena reklasifikasi** oleh audit cloud cover (dulu salah label "Semai", sekarang benar "☁️ Tertutup awan"). Bug tampilan default ini baru sekarang diketahui — sepanjang sesi-sesi UI redesign sebelumnya, tampilan default yang dipakai untuk verifikasi visual kebetulan menunjukkan data yang salah tanpa disadari.

**Keputusan/catatan penting:**
- Pola baru: kalau ada 2 tempat kode yang MENGHITUNG hal yang sama dari data mentah yang sama (di sini: `estimated_phase` tersimpan di DB vs `deriveInsights()` yang recompute fase sendiri dari NDVI/NDWI client-side), keduanya WAJIB konsisten soal kapan hasilnya dianggap tidak reliable — bukan cuma soal threshold angkanya sama (sudah pernah diperbaiki 05 Juli 2026), tapi juga soal GATING/kapan insight ditampilkan sama sekali. Cek ulang tempat lain yang mungkin recompute NDVI/NDWI secara independen kalau ada, ke depan.
- Root cause bug ini murni UI logic (belum pernah menghubungkan cloud check ke phase insight), terpisah dari bug `dataMask` yang sudah diperbaiki sebelumnya — dua bug berbeda yang kebetulan sama-sama soal awan.

**Status berikutnya:** Lanjut jalankan `scripts/backfill-metadata.mjs` untuk kedua plot (Wayan Suparta, Budidaya BSO) sesuai urutan yang diminta user.

---

## [2026-07-08 (lanjutan 8)] — Backfill metadata selesai kedua plot + statistik tutupan awan per musim (bukti pendukung SAR) + transparansi visual awan di UI

**Backfill metadata (Catalog API) selesai kedua plot:**
- Wayan Suparta: 258/258 baris berhasil (50 NDVI + 208 SAR), 0 gagal.
- Budidaya BSO: 256/256 baris berhasil (47 NDVI + 209 SAR), 0 gagal.
- Panel "Sumber Data & Verifikasi" sekarang aktif penuh untuk seluruh histori 2 tahun kedua plot — ID produk resmi + timestamp presisi tersedia untuk hampir semua baris.

**Statistik tutupan awan PER MUSIM TANAM** (diminta user untuk jadi bukti pendukung keputusan integrasi SAR di BRIEF_AgriMRV.md):

| Musim | Rentang | Total Scan Optik | Cloud >15% (tidak reliable) | Valid (dipercaya) | NDWI Valid : SAR |
|---|---|---|---|---|---|
| Wayan Suparta — Musim 2/2025 | 05 Nov 2025 – 11 Mar 2026 | 9 | **8 (88.9%)** | 1 (11.1%) | **1 : 41** |
| Wayan Suparta — Musim 1/2026 | 07 Apr 2026 – 08 Jul 2026 | 8 | 4 (50%) | 4 (50%) | 4 : 25 |
| Budidaya BSO — Musim 1/2026 | 12 Mar 2026 – 01 Jul 2026 | 9 | 4 (44.4%) | 5 (55.6%) | 5 : 33 |

**Temuan paling signifikan — Musim 2/2025 Wayan Suparta (05 Nov 2025 – 11 Mar 2026, musim hujan Bali):** dari 9 percobaan scan optik Sentinel-2, **8 (88,9%) gagal karena awan** — cuma 1 yang bisa dipercaya. Kalau sistem ini HANYA mengandalkan citra optik, praktis TIDAK ADA data NDWI reliable sepanjang musim itu. Di periode yang sama persis, **SAR berhasil merekam 41 titik data lengkap**, sama sekali tidak terganggu awan. **Ini bukti konkret: tanpa SAR, analisis pola pengairan untuk Musim 2/2025 praktis tidak mungkin dilakukan dari citra optik saja.**

**Transparansi visual tutupan awan ditambahkan ke dashboard:**
1. **Titik merah di grafik Tren NDVI & NDWI** (`NdviTrendChart.tsx`) — titik dengan `cloud_cover_percent > 15%` diwarnai merah (beda dari hijau/biru normal), garis tetap tersambung (cuma warna dot yang beda, bukan connectNulls). Tooltip custom menampilkan "Tutupan awan X% — data tidak reliable" untuk titik merah.
2. **Keterangan persentase per musim di tab Musim Tanam** (`PlotDashboard.tsx`) — tiap card musim tanam sekarang menghitung cloud stats dari `satelliteLogs` dalam rentang `planting_date`..`actual_harvest_date`/hari ini secara client-side, menampilkan baris kecil: "X dari Y scan optik ketutup awan (Z%) — gunakan data SAR sebagai cadangan".

**Keputusan/catatan penting:**
- Statistik ini jadi bukti empiris kuat untuk keputusan arsitektur SAR yang diambil jauh sebelumnya (03 Juli 2026: "Sentinel-1 ditambahkan ... lebih andal dari NDWI optik saat berawan") — sebelumnya cuma justifikasi teoritis/riset, sekarang ada angka nyata dari data 2 tahun project sendiri.
- Perhitungan cloud stats per-musim di UI dilakukan client-side dari data yang sudah di-fetch (tidak perlu API call tambahan) — konsisten dengan pola `fn_analyze_season_water_pattern` yang juga scoped ke rentang `planting_date`..`actual_harvest_date`.

**Verifikasi visual di browser (Playwright, plot Wayan Suparta, toggle "Semua 2 Tahun"):** 68 titik merah terkonfirmasi tampil di grafik (34 titik cloud-invalid × 2 garis NDVI+NDWI), garis tetap tersambung tidak putus, tooltip hover menampilkan "⚠ Tutupan awan 100% — data tidak reliable" persis sesuai spek. Tab Musim Tanam menampilkan "4 dari 8 scan optik ketutup awan (50%)" untuk Musim 1/2026 dan "8 dari 9 scan optik ketutup awan (88.9%)" untuk Musim 2/2025 — angka konsisten dengan tabel statistik di atas. 0 error console.

**Status berikutnya:** Fitur Sumber Data & Verifikasi + transparansi cloud cover dianggap selesai. Sisa item lama yang belum dikerjakan: spot-check manual 31 Mei 2025 Budidaya BSO via Copernicus Browser (1 dari 5 titik silang-cek sebelumnya tidak konsisten), sisa Tahap 4 (role & akses, notifikasi Telegram).

---

## [2026-07-09] — Fitur bikin Kawasan baru via UI + Cek kuota Supabase + Fitur True Color (tes manual → integrasi penuh)

### 1. Halaman "Tambah Kawasan" (sebelumnya tidak ada sama sekali)

User minta tes bikin kawasan baru dari awal via UI — ternyata `/kawasan` (halaman utama/home) masih placeholder "coming soon" sejak awal project, tidak ada form/tombol untuk bikin kawasan di mana pun (semua kawasan yang ada sejauh ini dibuat langsung lewat SQL migration).

**Dibangun:**
- `app/kawasan/page.tsx` — diubah dari stub jadi Server Component yang fetch daftar kawasan asli + jumlah petak per kawasan (join manual ke `v_plots`).
- `components/kawasan/KawasanListClient.tsx` — grid card kawasan (nama, badge local_term, region, jumlah petak, total luas) + tombol "+ Tambah Kawasan" yang buka modal form (pola `createPortal` konsisten dengan modal lain di project).
- `app/api/kawasan/route.ts` — POST, insert via `createAdminClient()` (service role, bypass RLS — pola sama dengan `POST /api/plots`), validasi 3 field wajib: `name`, `local_term`, `region`.
- Form: Nama Kawasan (teks bebas), Jenis/Local Term (dropdown Subak/Kelompok Tani/Desa/Lainnya + input custom), Region/Lokasi (teks bebas) — 3-3-nya wajib sesuai permintaan user, walau skema DB sebenarnya cuma mewajibkan `name`.

**Bug ditemukan saat verifikasi (bukan dari kode baru — dikonfirmasi dengan bukti):** setelah submit form, halaman detail kawasan baru 500 error dengan pesan "Jest worker encountered 2 child process exceptions, exceeding retry limit". Dicek ulang: halaman kawasan LAMA (Wayan Suparta, sudah berfungsi baik sepanjang project) JUGA ikut 500 di server yang sama — membuktikan ini crash worker Turbopack tingkat infra (proses dev server jadi tidak stabil setelah berjalan lama), bukan bug di kode kawasan baru. Fix: kill proses dev server lama, restart bersih → semua halaman (lama & baru) kembali 200. Isu ini terulang lagi nanti di sesi True Color di bawah dengan gejala lebih parah (Turbopack panic native, exit code Windows `0xc0000142` saat compile `globals.css`) — kali ini fix butuh `taskkill node.exe` menyeluruh (ditemukan 3 proses node nyangkut) + hapus cache `.next` sebelum restart bersih berhasil. **Dicatat sebagai pola berulang**: sesi coding panjang dengan banyak file berubah di Windows + Turbopack rentan bikin worker proses corrupt — kalau 500 error muncul di halaman yang SEBELUMNYA sudah terbukti jalan, curigai dulu infra/dev-server sebelum menuduh kode baru.

**Verifikasi end-to-end (Playwright):** bikin 2 kawasan test ("Subak Test Otomatis", "Subak Uji Coba") — form terisi benar, redirect ke halaman detail baru berhasil (0 plot, empty state graceful, tombol "+ Gambar Polygon Baru" siap pakai), kawasan baru muncul di list. Kedua data test dihapus lagi via script admin-client setelah dikonfirmasi 0 petak (aman, tidak ada cascade) — user eksplisit minta dihapus karena cuma testing.

### 2. Cek kuota Supabase Free Tier (sebelum lanjut ke True Color)

- **Storage: 0 MB / 1 GB (0%)** — dicek langsung via Storage HTTP API (list objects di 2 bucket `satellite-imagery` dan `field-photos`), keduanya kosong total.
- **Database**: TIDAK bisa dapat angka resmi (byte) — kredensial project cuma `SUPABASE_SERVICE_ROLE_KEY` (akses PostgREST), tidak ada Personal Access Token Management API atau `DATABASE_URL` langsung untuk query `pg_database_size()`. Dikasih estimasi kasar dari row count (~530 baris total, didominasi `satellite_logs`=510) — jelas jauh dari limit 500MB tapi bukan angka resmi.
- **Bandwidth**: TIDAK bisa dicek sama sekali dari sisi kode — egress cuma dilacak di level platform Supabase, cuma bisa dilihat lewat Dashboard atau Management API. User memutuskan: tidak perlu setup token sekarang, cukup cek manual sesekali via Dashboard.

### 3. Fitur True Color — tes manual 1 titik dulu, baru integrasi penuh (sesuai permintaan eksplisit user)

**Riset dulu:** cari spesifikasi yang sudah ada di `TECHNICAL_DESIGN_Tahap3.md` §3.6 — bucket `satellite-imagery` (private), path pattern `{plot_id}/{year}/{scan_date}_{type}.jpg`, akses selalu via signed URL 1 jam (generate on-demand, TIDAK disimpan di DB). Kolom `true_color_path`/`ndvi_heatmap_path`/`ndwi_heatmap_path` di `satellite_logs` ternyata SUDAH ADA sejak migration v1 — tidak perlu migration baru.

**Tes manual 1 titik (Sentinel Hub Process API, beda dari Statistical API yang dipakai NDVI/NDWI angka):**
- Evalscript true color standar (B04/B03/B02, gain 2.5x), dites pakai geometri ASLI plot Wayan Suparta (bukan bbox sintetis), tanggal 08 April 2026 (cerah, terkonfirmasi cloud 0% dari audit sebelumnya).
- Hasil: JPEG 10.9 KB, **diverifikasi VISUAL** (bukan cuma percaya status 200) — bentuk gambar mengikuti persis kontur polygon plot (bukan kotak), warna hijau tua konsisten dengan NDVI 0.68 tercatat untuk tanggal itu.
- **Temuan jujur**: gambar blocky di 512×512 karena petak kecil (0.174 ha) cuma beberapa piksel asli di resolusi native 10m Sentinel-2 — bukan bug, keterbatasan inheren.

**Keputusan user sebelum integrasi penuh** (ditanya eksplisit via pertanyaan pilihan):
1. Ukuran output: **256×256** (bukan 512×512) — blocky-nya sama saja, cuma bikin file lebih besar tanpa nambah detail nyata.
2. Scope: **cuma scan baru ke depan dulu** (bukan backfill 510 baris histori sekaligus) — validasi dulu di beberapa scan baru sebelum commit ke backfill besar.

**Integrasi penuh yang dibangun:**
- `lib/sentinel-hub/truecolor.ts` — `fetchTrueColorImage()` (Process API call) + `uploadTrueColorImage()` (upload ke Storage, path sesuai spec).
- Diintegrasikan ke `app/api/plots/[plotId]/scan/route.ts` (scan manual) dan `app/api/cron/satellite-scan/route.ts` (cron harian) — dipanggil setiap kali scan NDVI baru terjadi, TIDAK digating oleh validitas cloud (gambar tetap berguna dilihat meski berawan, sama seperti `cloud_cover_percent` selalu disimpan apa adanya). Kegagalan fetch/upload di-catch, tidak menggagalkan scan NDVI/NDWI utama (pola sama dengan `fetchCatalogProduct`).
- `app/api/plots/[plotId]/truecolor-url/route.ts` — GET, generate signed URL on-demand (1 jam), validasi path harus diawali `{plotId}/` (cegah akses ke path plot lain).
- UI: `PlotMapInner.tsx` dapat prop `trueColorUrl`, render `ImageOverlay` react-leaflet dibatasi bounding box polygon saat `activeLayer==='truecolor'`. `PlotDashboard.tsx` — `useEffect` fetch signed URL saat layer True Color aktif & scan terpilih punya `true_color_path`; badge "Citra RGB belum tersedia" cuma tampil kalau memang belum ada path (bukan selalu tampil seperti sebelumnya).

**Tes end-to-end sungguhan** (bukan cuma type-check): trigger scan manual API plot Wayan Suparta → `true_color_path` tersimpan benar di DB → dicek visual di browser via Playwright → gambar tampil TEPAT di lokasi & bentuk polygon yang benar, warna PUTIH konsisten dengan `cloud_cover_percent=100%` tanggal itu (26 Mei 2026-style validation: citra dan metadata cloud saling menguatkan, bukan kontradiksi).

**Bug ditemukan & diperbaiki dari verifikasi visual sendiri**: kotak HITAM pekat mengelilingi bentuk polygon di peta (area dalam bounding box tapi di luar polygon asli) — root cause: format JPEG tidak dukung alpha channel, area "transparan" dari Process API jadi hitam solid saat di-render JPEG. **Fix** (dikonfirmasi user, opsi PNG dipilih): evalscript diubah ke 4 band (RGB + `dataMask` sebagai alpha), format request diubah ke `image/png`, ekstensi path jadi `.png` (deviasi dari `TECHNICAL_DESIGN_Tahap3.md` yang nulis `.jpg` — dicatat sebagai keputusan teknis baru). **Diverifikasi 2 cara**: (1) inspeksi byte PNG langsung — color type byte = 6 (RGBA, alpha ada); (2) screenshot browser ulang — kotak hitam hilang total, gambar True Color menyatu mulus dengan tile peta dasar di sekitarnya.

**Keputusan/catatan penting:**
- Storage per gambar ~2.6 KB (PNG, plot kecil) — proyeksi kalau nanti backfill histori penuh (510 baris × 3 tipe citra kalau ditambah NDVI/NDWI heatmap juga) masih jauh dari kuota 1GB.
- Pola established baru: SETIAP kali menambah integrasi Sentinel Hub baru (Statistical API utk angka vs Process API utk gambar), WAJIB tes manual 1 titik dengan verifikasi visual dulu sebelum wiring ke pipeline otomatis — bukan cuma percaya HTTP 200.
- `ndvi_heatmap_path`/`ndwi_heatmap_path` (kolom sudah ada di skema) BELUM dikerjakan — scope sesi ini cuma True Color sesuai permintaan eksplisit user.

**Status berikutnya:** Fitur True Color aktif untuk scan BARU (manual + cron). Backfill True Color untuk 510 baris histori BELUM dikerjakan — menunggu keputusan lanjutan user setelah lihat hasil beberapa scan baru dulu. `ndvi_heatmap_path`/`ndwi_heatmap_path` (citra heatmap NDVI/NDWI, beda dari True Color RGB) belum dikerjakan sama sekali.

---

### [Audit Arsitektur] 16 Juli 2026: Evaluasi Kode & SOP Refactor

**Konteks:** 
Melakukan pemindaian (audit) jumlah baris dan kompleksitas file .tsx dan .ts pada folder pp, components, lib, dan scripts untuk mencegah penumpukan *spaghetti code* serta mendokumentasikan SOP backup/revert.

**Temuan Utama (Kategori Merah - Perlu Segera Direfactor):**
1. components/plots/PlotDashboard.tsx (2.000 baris) - Sangat monolitik. Menangani semua UI tab (NDVI, SAR, Laporan), state, dan kalkulasi sekaligus. **Rencana:** Harus dipecah per-tab menjadi komponen kecil dan menggunakan *custom hooks*.
2. components/maps/KawasanMapInner.tsx (881 baris) - Rawan bug memori. **Rencana:** Harus diekstrak menjadi komponen independen untuk *MapPopup*, *MapControls*, dan *PolygonLayer*.
3. components/kawasan/KawasanPageClient.tsx (396 baris) - Logika agregasi terlalu menumpuk.
4. pp/api/plots/[plotId]/scan/route.ts (225 baris) - Logika bisnis terlalu tebal untuk sebuah *route handler*. **Rencana:** Pindah ke modul service (misal lib/services/scanner.ts).

**Kategori Aman (Hijau):**
- Modul integrasi Sentinel Hub (lib/sentinel-hub/) berkisar 30-100 baris. Sangat rapi dan terbagi berdasarkan tanggung jawab spesifik.
- Routing utilitas dan file konfigurasi Supabase (di bawah 50 baris).

**Kebijakan (SOP Baru) Pengembangan & Backup:**
1. **Audit Rutin Pasca-Iterasi:** Setiap selesai pengerjaan fitur baru, wajib menjalankan evaluasi file. Target ukuran file maksimal 200-300 baris. Memastikan *Business Logic* tidak bercampur dengan UI.
2. **Sistem Backup untuk Revert:** Dilarang melakukan refactor masif pada file raksasa tanpa melakukan backup / *commit* solid sebelumnya (opsional membuat *branch* baru). Ini untuk memastikan jika terjadi error pasca-refactor, kode bisa di-*revert* dengan cepat dan aman tanpa merusak UI yang sudah stabil.

---
- **Backup: beta.v.1.0** telah dibuat via Git (*tag: beta.v.1.0*). Ini adalah *checkpoint* stabil sebelum dimulainya proses bedah/refactor masif pada komponen-komponen UI (seperti PlotDashboard.tsx). Jika terjadi error kritis pasca-refactor, kode bisa dikembalikan dengan mudah ke versi ini.
- Menjawab Audit Verra (Fase 3): Pembuatan skrip migrasi v18 untuk memperbaiki kalkulator CO2e (Standar IPCC Tier 2 dengan hitungan luas hektar), mengubah tarikan baseline historis dari 6 bulan menjadi 3 tahun (1095 Hari), dan menambahkan poin Ground Truthing (Pizometer) di Whitepaper.
- Akun Kredensial: Email login untuk Copernicus Data Space dan Supabase didaftarkan dengan akun oorganiksolutions.bali@gmail.com

## [2026-07-16] � Diskusi Strategi Audit-Proofing (Fase 2)

**Dikerjakan/Disepakati:**
- Diskusi mendalam mengenai validasi nilai 2.19 Ton CO2e di lahan Budidaya BSO 1. Formula IPCC Tier 2 terbukti akurat dan dapat dipertanggungjawabkan ((87 * 1.2 * 0.749 * 28) / 1000).
- Menyepakati 4 fitur utama untuk **Fase 2 (Verra-Ready & Audit-Proofing)**:
  1. **Integrasi Data Curah Hujan (CHIRPS/BMKG)**: Untuk membuktikan *Intentionality* bahwa hari aerasi terjadi karena praktik AWD, bukan kekeringan alami.
  2. **Ground-Truthing Piezometer**: Validasi data lapangan via unggahan foto Pipa PVC ber-geotagging.
  3. **Visualisasi Additionality (Baseline vs Proyek)**: Menampilkan grafik perbandingan hari aerasi 3 tahun ke belakang (BAU) dengan proyek saat ini untuk membuktikan perubahan perilaku.
  4. **Export Verification Dossier per Petak**: Pembuatan laporan siap audit per lahan yang mencakup data radar time-series, bukti NBR, dan kalkulasi IPCC.

**Status berikutnya:** Besok akan dimulai dengan **Eksekusi Refactor Kode** berdasarkan implementation_plan.md untuk merapikan backend sebelum masuk ke pengerjaan fitur Fase 2.


## [2026-07-18] - SINAGRI v2.0 Enterprise Architecture Planning (ASDI)

**Dikerjakan/Disepakati:**
- Melakukan review arsitektur SINAGRI v1.x secara komprehensif. Ditemukan bottleneck kritis: arsitektur saat ini menggunakan *per-polygon request* ke Copernicus yang tidak akan scale melampaui 500 polygon (sangat mahal dan lambat).
- Menyusun **SINAGRI v2.0 Implementation Plan** (sebagai *Agricultural Spatial Data Infrastructure / ASDI*).
- Menetapkan 7 prinsip utama rekayasa perangkat lunak:
  1. Performance First
  2. Low Cloud Cost
  3. Clean Code (Modular, SOLID)
  4. Bug Prevention (Validation, Retry, Graceful Failure)
  5. Scalability (Siap 1.000.000 polygon)
  6. Security (Auth, Rate Limit, Audit)
  7. Future Ready (Open-Closed Principle)

**Rencana 5 Fase Transformasi (Strangler Fig Pattern):**
- **Phase 0 (Clean Architecture):** Setup folder core/, infra/, workers/ tanpa mengubah UI. Centralisasi config, error handling, dan logger.
- **Phase 1 (Tile-Based Ingestion):** Perubahan paling kritis. Meringkas N request polygon menjadi 1 request per Tile Sentinel (MGRS). Menghemat 99% cost API Sentinel Hub.
- **Phase 2 (Weather Layer):** Membuat abstraksi WeatherProvider (NASA POWER, BMKG, ERA5) agar cuaca menjadi *first-class citizen* dalam analisis agrikultur, bukan sekadar data tambahan.
- **Phase 3 (Agricultural Analytics):** Extract logika kalkulasi ke Engine spesifik (VegetationIndexEngine, CarbonEngine, CropHealthEngine, ClimateEngine).
- **Phase 4 (AI & Hardening):** Penambahan queue system (BullMQ), caching (Redis), deteksi anomali, peringatan dini, dan security hardening.

**Status berikutnya:** Menunggu keputusan terkait platform deployment (Vercel vs VPS/Cloud Run), queue system, dan provider cuaca sebelum memulai eksekusi Phase 0.

---

## [2026-07-19 pagi] — Koreksi scope ASDI + insiden 637 proses + kredensial plaintext

**Konteks:** rencana "SINAGRI v2.0 Enterprise (ASDI)" di entri sebelumnya (18 Juli) dikoreksi user — kebesaran untuk kebutuhan riil (skala per-Subak/kelompok tani, bukan 1 juta polygon). Scope ditarik turun: pakai NDVI/NDWI yang sudah ada, jangan boros kuota Copernicus, tambah layer cuaca + data gratis lain.

**Dikerjakan:**
- **Insiden 637 proses node.exe** yang bikin laptop hang — root-caused via `Get-CimInstance Win32_Process` (semua 637 proses punya command-line identik, dari 1 dev server Turbopack yang lupa dimatikan di folder backup lama) → dikonfirmasi aman → `taskkill //F //IM node.exe`. Aturan baru: hanya 1 dev server jalan (`Desktop\agrimrv`), selalu `preview_stop` sebelum pindah folder.
- **Kredensial plaintext** ditemukan di `run-migration.js` (connection string Postgres hardcoded) — dipindah ke `.env.local` (`SUPABASE_DB_URL`), script ditulis ulang baca dari `process.env`. **Belum diputuskan** apakah perlu rotasi password (tergantung riwayat push repo, user belum jawab).
- Folder `Documents\Backup agrimv\agrimrv` (lama, sudah tidak dipakai) gagal di-rename karena directory-level lock yang tidak jelas sumbernya (bukan file lock — masing-masing file di dalamnya bisa diedit/dihapus bebas). Ditunda sampai restart laptop, tidak blocking karena risiko utama (server nyala tanpa sengaja) sudah dimitigasi dengan menghapus `.claude/launch.json` folder itu.

---

## [2026-07-19] — Weather layer (Open-Meteo), AWD Intentionality, konsolidasi UI Analisis Otomatis, CRUD Foto Lapangan, rebrand logo

**Dikerjakan:**

1. **Layer cuaca (Open-Meteo)** — `lib/weather/openmeteo.ts` (`fetchWeatherRange`), tabel baru `weather_logs` (migration v20, RLS aktif: admin full-access + auditor read-only). Otomatis narik data curah hujan/suhu/kelembapan untuk SEMUA petak (bukan cuma yang ditrigger manual) via centroid+tanggal, terintegrasi ke cron scan harian. Backfill 3 tahun historis untuk 7 petak (`scripts/backfill-weather.mjs`). Chart baru `components/charts/WeatherTrendChart.tsx` dengan rentang 1bln/3bln/1thn/3thn (menyamakan pola `DateRangeControl` yang sudah ada di chart NDVI/NDWI/SAR).
2. **AWD Intentionality (bukti kesengajaan praktik AWD)** — migration v21: kolom baru `dry_points_total`, `dry_points_with_rain`, `awd_intentionality_pct` di `season_water_pattern_analysis`; fungsi `fn_analyze_season_water_pattern` diperluas — tiap titik "kering" dicek apakah curah hujan ≥5mm turun dalam 5 hari sebelumnya (kalau kering TAPI baru saja hujan → itu bukti pengeringan disengaja, bukan kekeringan alami). 100% rule-based (IF-ELSE), tanpa AI/LLM, konsisten dengan pendekatan seluruh fitur klasifikasi lain di project. Dihitung ulang untuk 6 musim: 100%, 77.8%, 87.9%, 68.2%, 52.6%, 42.1%.
3. **Bug PostgREST 1000-row limit** ditemukan & diperbaiki — chart cuaca awalnya nampilin rentang tanggal SALAH (potong ~1000 baris) karena limit default PostgREST tidak bisa dilewati via `.limit()` client-side; fix pakai pagination `.range()` di `fetchAllWeatherLogs()`.
4. **Konsolidasi "Analisis Otomatis"** (rename dari "Insight Otomatis", bahasa Inggris → Indonesia proper atas permintaan user) — semua analisis otomatis (insight NDVI/NDWI, status NBR, ringkasan pola air musim + intentionality + CO2e) digabung jadi 1 panel, di lokasi yang sama seperti sebelumnya (tidak membongkar tab detail Musim Tanam/Karbon lain).
5. **NBR (deteksi bakar jerami) dibuat SELALU tampil** — sebelumnya cuma muncul kalau ada indikasi, diubah karena "penting untuk data karbon" (validitas klaim karbon perlu bukti tidak ada pembakaran, positif maupun negatif).
6. **CRUD Foto Lapangan penuh**: upload dengan auto-kompresi client-side (Canvas API, `toBlob` JPEG quality 0.75, tanpa dependency baru), auto-tanggal, catatan aktivitas; edit catatan; hapus dengan konfirmasi; klik foto untuk perbesar (lightbox, `createPortal` ke `document.body` — pola sama dengan dialog delete musim yang sudah ada). Endpoint baru: `app/api/plots/[plotId]/field-logs/route.ts` (POST upload), `.../field-logs/[logId]/route.ts` (PATCH catatan, DELETE — urutan hapus DB dulu baru storage, supaya tidak orphan-delete kalau DB gagal), `.../field-photo-url/route.ts` (GET signed URL 1 jam, pola sama `truecolor-url`).
7. **Rebrand logo Sinagri** — logo lama diganti logo resmi baru (2000×2000 RGBA, transparent) di `public/images/sinagri_logo.png` + `_white.png`, `AppTopbar.tsx`, `app/page.tsx` (header+footer). Ditemukan & diperbaiki bug: Next.js Image Optimizer (`sharp`) korup logo baru (200 OK tapi browser gagal decode) — fix pakai prop `unoptimized`.
8. **Fix UX layout**: kolom kanan halaman detail petak (panel Analisis Otomatis + Tabs) dibuat `lg:sticky lg:top-4 lg:self-start` — sebelumnya ada area kosong besar saat scroll karena kolom kiri (4 chart bertumpuk) lebih tinggi dari kolom kanan.
9. **Mockup laporan PDF per musim tanam** — dibuat sebagai Artifact terpisah (bukan fitur production), pakai data riil plot Budidaya BSO Musim 1/2026 (foto, NDVI/NDWI/NBR/SAR-VV/SAR-VH trend, curah hujan, pemupukan, panen, produktivitas). User setuju layout, 2 catatan revisi: logo placeholder perlu diganti logo asli, field "varietas" masih perlu diperjelas (belum ada jawaban detail dari user).
10. **Diskusi (belum dibangun)**: evidence tambahan untuk memperkuat klaim karbon Sinagri — pupuk & foto via Telegram bot (masuk `field_logs`), MOU/perjanjian petani via upload dokumen (skema belum final), ground-truthing piezometer.
11. **`update_owner.html`** ditambah section baru "Kenapa Interval Scan 6 Hari?" — penjelasan bilingual bahwa 6 hari adalah siklus ulang fisik satelit Sentinel-1 (radar), bukan angka sembarangan, dengan sitasi ESA. Disinkron ke `public/update_owner.html`.

**Keputusan/catatan penting:**
- Skala kawasan: 100 petak dalam 1 kawasan tidak masalah selama trigger scan tetap per-petak (bukan borongan) — desain existing sudah benar untuk ini, tidak perlu dipecah jadi banyak kawasan kecil.
- Backfill cuaca 3 tahun dipilih (bukan cuma ke depan) karena AWD intentionality butuh histori untuk baseline yang kuat.
- Semua perubahan sesi ini **masih uncommitted di git** (belum di-commit).
- **Kesenjangan proses ditemukan**: `PROJECT_LOG.md` dan `PRD_AgriMRV.md` sempat tidak diupdate selama beberapa sesi kerja padahal CLAUDE.md mewajibkan update tiap akhir sesi — entri ini adalah catch-up. `PRD_AgriMRV.md` diputuskan TIDAK di-rewrite (terlalu basi, formatnya per-Tahap linear sudah tidak representatif) — dibiarkan jadi arsip sejarah, diganti dengan `docs/STATUS_SAAT_INI.md` sebagai sumber kebenaran status terkini.

**Status berikutnya:** Auth API (prioritas keamanan #1, masih 0 endpoint yang terproteksi) belum dikerjakan. Fitur PDF laporan musim tanam belum jadi fitur production (baru mockup). Telegram bot (pupuk+foto) dan upload dokumen MOU belum didesain skemanya. Rotasi password DB masih menunggu jawaban user soal riwayat push repo. Commit git untuk seluruh kerja sesi ini belum dilakukan — menunggu keputusan user.

---

## [2026-07-19] — Audit & perbaikan konsistensi formula CO2e — persiapan meeting Rikolto

**Konteks:** user meminta audit lengkap semua formula (NDVI/NDWI/NBR/SAR/CO2e) dengan sumber ilmiah dan level kepercayaan, untuk persiapan meeting dengan Rikolto (NGO partner) minggu depan. Alur kerja mulai berubah: user berencana diskusi strategi lewat Claude Chat (claude.ai), lalu Claude Chat menyusun prompt teknis terstruktur untuk dieksekusi di sini — beberapa entri sesi ini datang dari prompt semacam itu, bukan permintaan langsung di chat ini.

**Dikerjakan:**

1. **Dokumen konteks baru dibuat untuk workflow Claude Chat → Claude Code**: `docs/STATUS_SAAT_INI.md` (status sistem terkini, sumber kebenaran tunggal — `PRD_AgriMRV.md` resmi dijadikan arsip, tidak dipakai lagi untuk cek status). `CLAUDE.md` ditambah section wajib soal update_owner.html + laporan terstruktur (sebelumnya cuma ada di memori sesi Claude, tidak tertulis di project — jadi Claude Chat tidak akan tahu aturan ini kalau tidak dituliskan).

2. **Audit auth API** (murni investigasi, tidak ada perubahan): dikonfirmasi 16 dari 17 API route TANPA autentikasi sama sekali (cuma cron yang aman, pakai `CRON_SECRET`). Skema `user_profiles`+role sudah ada dari migration v1 tapi tidak pernah disambungkan (Supabase Auth 0% fungsional — halaman login masih placeholder, `lib/supabase/server.ts` dead code). `/api/debug/route.ts` ditemukan sebagai endpoint sisa development yang dump seluruh tabel tanpa filter — direkomendasikan dihapus. Rencana implementasi (middleware.ts terpusat) ditulis tapi BELUM dieksekusi, menunggu approval user.

3. **Audit formula lengkap** (murni investigasi): NDVI/NDWI dikonfirmasi konsisten di 3 lokasi kode (termasuk cloud-filtering SCL, bug lama 08 Juli sudah benar-benar konsisten diperbaiki). **Temuan baru kritis**: cron harian TIDAK PERNAH menghitung NBR (angka maupun citra) — cuma trigger manual/baseline yang menghitungnya, jadi fitur "NBR selalu tampil" tidak benar-benar otomatis untuk scan harian ke depan. **Temuan baru paling kritis**: formula CO2e yang BENAR di database (migration v19/v21: GWP 27 × faktor netting N2O 0.653) TIDAK KONSISTEN dengan teks di `app/page.tsx` (homepage publik) dan tooltip `PlotDashboard.tsx` — keduanya masih menampilkan formula lama yang sudah terbukti salah (GWP 28, tanpa netting), kontradiksi langsung dengan angka asli yang tampil di sampingnya.

4. **Perbaikan formula CO2e di seluruh tampilan**: `app/page.tsx` dan `components/plots/PlotDashboard.tsx` diperbaiki teksnya (bukan logika, logika di database sudah benar) supaya konsisten dengan formula asli.

5. **Ditemukan 3 dokumen eksternal lagi** dengan masalah sama (di luar scope audit awal, ketahuan dari validasi grep): `docs/Whitepaper_AgriMRV_SaveSubak.html`, `docs/AgriMRV_Technical_Verification_Report_EN.html`, `docs/Laporan_Verifikasi_Teknis_AgriMRV_ID.html` — file statis, tidak di-link dari app, kemungkinan besar untuk dikirim langsung ke partner seperti Rikolto. Formula diperbaiki di ketiganya, sitasi nomor tabel IPCC yang tidak terverifikasi (Table 5.11/8.7) DIHAPUS (bukan diganti asal), bagian "System Limitations" di kedua Verification Report diperkuat dengan 3 keterbatasan jujur baru (ambang klasifikasi sampel kecil, SAR belum ground-truth, faktor netting belum spesifik Bali), dan ditambahkan section baru yang mengundang review kolaboratif dari Rikolto.

6. **Screenshot Gambar 9** (Tab Karbon) di kedua Verification Report diganti dari versi lama (16 Juli, masih nunjukin 0.77 Ton & label "Insight Otomatis") ke versi baru user (19 Juli, nunjukin 0.49 Ton & label "Analisis Otomatis" yang benar). Nama file asli ternyata typo (`.png.png`, dobel ekstensi) — dipakai apa adanya, tidak di-rename (di luar scope task).

7. **`update_owner.html`** (root + public/, disinkron) ditambah 1 entri Changelog baru merangkum poin 4-6 di atas untuk pemilik non-teknis.

**Keputusan/catatan penting:**
- Setiap kali audit formula/dokumentasi menemukan sesuatu di luar scope yang diminta, langsung dilaporkan eksplisit ke user (bukan didiamkan) — pola ini berulang kali membuahkan temuan penting (3 dokumen tambahan, gap NBR di cron, Gambar 6 yang belum diperbaiki).
- Sitasi ilmiah yang tidak bisa diverifikasi dari sumber project sendiri (nomor tabel IPCC spesifik) DIHAPUS, bukan ditebak-tebak — prinsip: lebih baik sitasi umum yang benar daripada sitasi presisi yang mengarang.
- Git tag checkpoint di-skip untuk semua perubahan kecil sesi ini (working tree sudah tidak bersih dari sesi-sesi sebelumnya) — before→after lengkap di tiap laporan jadi pengganti pengaman.

**Status berikutnya:** 2 item terbuka dari temuan sesi ini belum diperbaiki: (1) screenshot Gambar 9 di Verification Report perlu di-crop ulang supaya gaya visualnya konsisten dengan gambar lain (saat ini tangkapan layar lebar dengan browser chrome, beda gaya dari 8 gambar lain yang crop rapat); (2) Gambar 6 di Verification Report ID masih pakai screenshot & label lama "Insight Otomatis", belum diperbarui. Audit auth API sudah lengkap tapi implementasinya (middleware.ts) belum dieksekusi — masih menunggu approval user. Gap NBR-tidak-terhitung-di-cron (temuan poin 3) juga belum diperbaiki, di luar scope task-task sesi ini yang fokus ke CO2e.

---

## [2026-07-19] — Desain arsitektur multi-user/multi-organisasi (keputusan saja, BELUM diimplementasi)

**Konteks:** diskusi arsitektur untuk menjawab kebutuhan multi-role yang muncul dari audit auth API sebelumnya (16/17 endpoint tanpa proteksi) — sekaligus mengantisipasi kebutuhan riil ke depan: LSO (Lembaga Sertifikasi Organik) butuh input data sendiri yang terpisah dari Save Subak, dan pekaseh (perwakilan Subak) butuh akses terbatas ke kawasannya sendiri. Murni keputusan desain, tidak ada kode yang disentuh — implementasi menyusul setelah persiapan meeting Rikolto selesai.

**Keputusan (5 poin):**

1. **3 role dipertahankan, skema sudah ada dari awal** — `user_profiles.role` (`'admin'/'auditor'/'pekaseh'`, migration v1) tidak perlu diubah, tinggal disambungkan ke Supabase Auth beneran (belum pernah dilakukan — lihat temuan audit auth API sebelumnya, `lib/supabase/server.ts` dead code, login page masih placeholder). Pembagian akses: `admin` (Save Subak internal) = akses semua kawasan; `pekaseh` (perwakilan tiap kelompok Subak) = akses hanya kawasan miliknya, bisa edit/tambah data (foto, musim tanam, dll) tapi TIDAK bisa bikin kawasan baru; `auditor` (LSO, contoh: Kertha Bali Sejahtera) = model berbeda, lihat poin 2.

2. **LSO (`auditor`) sengaja dipisah dari 2 role lain — bukan cuma soal permission, tapi soal privasi antar-organisasi.** LSO punya "dunia data terpisah" (tenant sendiri): input polygon/petak SENDIRI meski lokasinya kebetulan sama dengan petak yang sudah terdaftar Save Subak/pekaseh. Admin Save Subak SENGAJA TIDAK otomatis bisa lihat data LSO — LSO adalah entitas organisasi terpisah, bukan bagian internal Save Subak, jadi data mereka tidak boleh otomatis "bocor" ke admin biarpun admin adalah role dengan privilege tertinggi di sistem.

3. **2 pola data berjalan bersamaan dalam sistem yang sama** (bukan 1 model seragam untuk semua role):
   - **Pola "1 peta bersama"** (admin + pekaseh): kawasan dibuat & dimiliki Save Subak, pekaseh diberi akses sebagai kolaborator ke kawasan miliknya — BUKAN bikin kawasan terpisah. Semua yang diinput pekaseh otomatis terlihat admin, karena memang data yang sama, cuma beda hak akses siapa boleh apa.
   - **Pola "tenant terpisah"** (LSO, dan kemungkinan besar partner masa depan seperti hotel untuk traceability atau investor untuk monitoring dampak regeneratif): masing-masing organisasi punya "dunia data" sendiri yang independen, tidak otomatis terlihat Save Subak.

4. **Mekanisme akses: 1 tabel penghubung many-to-many** (nama kerja sementara `user_kawasan_access`, skema kolom final menyusul saat implementasi beneran) — supaya 1 user bisa di-assign ke 1 atau lebih kawasan/wilayah data. Sengaja TIDAK menaruh `kawasan_id` langsung sebagai kolom di tabel user — itu akan mengunci 1 user cuma bisa 1 kawasan, padahal ke depan mungkin butuh 1 kawasan dengan >1 user (misal 2 pekaseh gantian), atau 1 user (misal auditor eksternal) butuh akses ke beberapa kawasan/tenant sekaligus.

5. **Role `viewer` diputuskan perlu ada NANTI** (prioritas rendah, belum diimplementasi sekarang) — untuk pihak riset/universitas: read-only, bisa download data milik Save Subak saja (bukan data LSO/organisasi partner lain), tidak bisa edit atau bikin data apapun.

**Keputusan sadar untuk TIDAK dikerjakan sekarang (dicatat supaya tidak lupa alasannya kalau topik ini muncul lagi):** sempat didiskusikan konsep "organisasi generik" — tabel `organizations` + `organization_members` dengan role generik (owner/member/viewer) yang bisa dipakai untuk jenis partner apapun tanpa perlu nambah nilai enum role baru di kode tiap kali ada partner baru (misal hotel, investor, dst). **Keputusan: DITUNDA.** Dinilai over-engineering untuk kebutuhan yang belum konkret — desain generik seperti ini biasanya butuh 2-3 contoh kasus nyata dulu supaya bentuknya tepat, sementara sekarang baru ada 1 kandidat konkret (LSO) dan 2 spekulasi (hotel, investor) yang belum ada yang benar-benar mau onboarding. Rekomendasi: bahas ulang begitu ada partner konkret PERTAMA (bukan LSO, yang sudah tercakup role `auditor`) yang benar-benar serius mau onboarding — baru dari situ jelas pola generiknya harus seperti apa, bukan ditebak dari sekarang.

**Dicatat juga di `BRIEF_AgriMRV.md` bagian RIWAYAT KEPUTUSAN** (aturan CLAUDE.md §4 — keputusan arsitektur baru wajib tercatat di sana juga, bukan cuma di sini) — entri sama, ringkas.

**Status berikutnya:** BELUM ada kode yang berubah untuk keputusan ini. Implementasi (skema `user_kawasan_access`, RLS policy per-tenant, middleware auth yang sudah direncanakan dari audit auth API sebelumnya) menyusul SETELAH persiapan meeting Rikolto selesai — jangan mulai implementasi duluan tanpa instruksi eksplisit baru, ini murni catatan desain untuk direalisasikan nanti.

---

## [2026-07-20] — Fitur: toggle warna peta berdasarkan Jenis Lahan (pakai status_lahan yang sudah ada)

**Konteks:** diminta bikin kolom baru `land_category` + `land_category_source` untuk fitur toggle warna peta berdasarkan kategori lahan (organik/regeneratif/konversi/konvensional), sebagai alternatif dari mode warna NDVI yang sudah ada.

**Temuan sebelum eksekusi (mengubah pendekatan total):** kolom `status_lahan` SUDAH ADA sejak migration v8 (06 Juli 2026) dengan 4 kategori yang PERSIS SAMA (`organik`/`konversi`/`regenerative`/`konvensional`), lengkap dengan: UI badge + dropdown edit di `PlotDashboard.tsx`, tersimpan lewat `PATCH /api/plots/[plotId]` (sudah di `ALLOWED` list), tampil di tooltip `KawasanMapInner.tsx`, plus kolom pendamping `nama_lso`/`nomor_sertifikat`/`tanggal_kadaluarsa` yang sudah menutupi kebutuhan "persiapan integrasi LSO" (tujuan awal `land_category_source`). Dikonfirmasi ke user via pertanyaan eksplisit sebelum lanjut — user pilih pakai `status_lahan` yang sudah ada, BUKAN bikin kolom baru. **Tidak ada migration database baru yang dibuat sama sekali** di sesi ini.

**Dikerjakan:**
1. `lib/types/plot.ts` — `LayerType` ditambah 1 nilai baru: `'landcategory'`.
2. `lib/plot-geo.ts` — ditambah `LAND_CATEGORY_COLORS`, `LAND_CATEGORY_NULL_COLOR`, `LAND_CATEGORY_LABEL`, `statusLahanToColor()`. Sengaja ditaruh di `lib/` (bukan di `PlotMapInner.tsx`) mengikuti pola yang sudah ditetapkan 08 Juli 2026 ("helper geometri harus di lib/, bukan di komponen map") — supaya bisa diimpor `PlotDashboard.tsx` (untuk legenda) tanpa menyeret modul Leaflet/CSS yang browser-only ke kode yang berpotensi di-SSR.
3. `components/maps/PlotMapInner.tsx` — prop baru `statusLahan?: string | null`; logika `fillColor`/`fillOpacity` diperluas untuk `activeLayer === 'landcategory'`; `isOptical` sengaja MENGECUALIKAN `'landcategory'` dari logika "abu-abu kalau tertutup awan" — status lahan adalah metadata manual, tidak ada hubungannya dengan tutupan awan scan hari itu.
4. `components/maps/PlotMap.tsx` — prop `statusLahan` diteruskan ke `PlotMapInner`.
5. `components/plots/PlotDashboard.tsx` — `LAYERS` ditambah `{ id: 'landcategory', label: 'Jenis Lahan' }`; `plot.status_lahan` diteruskan ke `<PlotMap>`; legenda baru (swatch bulat + label per kategori, BEDA bentuk dari legenda gradien NDVI/NDWI/NBR yang sudah ada — kategorikal bukan kontinu) ditambahkan sebagai branch baru sebelum branch legenda lama, supaya tidak salah kena logika gradien.

**Verifikasi nyata (bukan cuma type-check):**
- `npx tsc --noEmit`: 0 error baru — 3 error yang muncul semuanya pre-existing (sudah tercatat sebelumnya: `PlotMapInner.tsx` perbandingan `'sar'`, `PlotDashboard.tsx` Props `text` mismatch, `test-nbr.ts` implicit any), tidak terkait perubahan sesi ini.
- Dicoba langsung di browser ke plot Made sengger: klik "Jenis Lahan" → warna `#9ca3af` (abu-abu, sesuai `status_lahan` yang memang masih null) → edit lewat form yang sudah ada, pilih "Organik" → simpan → warna polygon langsung berubah jadi `#90EE90` TANPA reload (state client update) → refresh halaman penuh → warna tetap `#90EE90` (konfirmasi tersimpan di database, bukan cuma state lokal) → klik NDVI → warna kembali `#86efac` sesuai gradien NDVI asli, legend NDVI juga normal (konfirmasi mode lama tidak terpengaruh) → data test dikembalikan ke "— Tidak diset —".
- Verifikasi RLS: TIDAK bisa dijalankan otomatis — kredensial `SUPABASE_DB_URL` di `run-migration.js` masih gagal ("tenant not found", masalah lama yang sama seperti sebelumnya, belum pernah berhasil terkoneksi sepanjang project ini). Karena tidak ada kolom baru (reuse `status_lahan` yang RLS-nya sudah tercakup kebijakan tabel `plots` yang ada — `admin_full_access_plots` FOR ALL, `auditor_read_plots` FOR SELECT, dikonfirmasi dari `migration_v1.sql`), risiko keamanannya rendah — TAPI belum diverifikasi ulang secara langsung ke database live, cuma disimpulkan dari kode migration yang sudah ada.

**Keputusan/catatan penting:**
- Pola "cek dulu apakah sudah ada sebelum bikin baru" kembali terbukti penting — permintaan awal (kolom `land_category` terpisah) kalau dieksekusi mentah-mentah akan menciptakan 2 sumber kebenaran untuk konsep yang sama persis.
- Warna kategori (`LAND_CATEGORY_COLORS`) sengaja 1 sumber tunggal di `lib/plot-geo.ts`, dipakai baik oleh peta maupun legenda — menghindari risiko warna peta dan warna legenda tidak sinkron di masa depan kalau ada yang lupa update salah satunya.

**Status berikutnya:** Fitur toggle warna sudah jalan dan terverifikasi untuk 1 plot (Made sengger). Belum dicoba untuk plot lain yang mungkin sudah punya `status_lahan` terisi dari sebelumnya (kemungkinan besar aman karena logic-nya generik, tapi belum dicek manual satu-satu). Verifikasi RLS ke database live masih tertunda karena kredensial `SUPABASE_DB_URL` belum pernah berhasil — masih item lama yang belum terselesaikan.

---

## [2026-07-20] — Warna Jenis Lahan diterapkan juga ke peta kawasan (KawasanMapInner.tsx)

**Konteks:** kelanjutan langsung dari fitur toggle warna Jenis Lahan di peta detail 1 petak (entri sebelumnya) — sekarang diterapkan ke peta kawasan (`components/maps/KawasanMapInner.tsx`, dikonfirmasi ini file yang benar sebelum edit, ada juga file `.backup` peninggalan lama yang tidak disentuh).

**Kondisi sebelum diubah:** warna polygon semua petak di peta kawasan FIXED/tunggal — `fillColor: '#22c55e'` (hijau) untuk semua petak tersimpan tanpa kecuali, border `#15803d`/`#166534` (hover). Tidak terkait NDVI maupun `status_lahan` sama sekali, murni dekorasi statis.

**Dikerjakan:**
1. Import `LAND_CATEGORY_COLORS`, `LAND_CATEGORY_NULL_COLOR`, `LAND_CATEGORY_LABEL`, `statusLahanToColor` dari `lib/plot-geo.ts` — REUSE total dari yang sudah dibuat sesi sebelumnya untuk peta detail petak, tidak ada warna baru didefinisikan (1 sumber kebenaran).
2. `fillColor: '#22c55e'` (fixed) diganti `fillColor: statusLahanToColor(plot.status_lahan)` — SATU baris saja yang diubah di dalam `pathOptions`, `eventHandlers` (hover/mouseover/mouseout) tidak disentuh sama sekali.
3. Legenda baru ditambahkan (pojok kiri-bawah peta) — 4 kategori + "Belum ditentukan", pola visual sama dengan legenda di peta detail petak.
4. Beda penting dari peta detail petak: TIDAK ada toggle di level kawasan — cuma 1 mode warna (Jenis Lahan selalu aktif), sesuai permintaan eksplisit (peta kawasan tidak perlu switch NDVI seperti peta 1 petak).

**Verifikasi nyata:**
- `npx tsc --noEmit`: 0 error baru (3 error tersisa semuanya pre-existing, sama seperti sebelumnya, tidak terkait perubahan ini).
- Dibuka ke kawasan Subak Sangeh (8 petak) di browser: warna BERVARIASI sesuai data asli tiap petak — 3 petak `#90EE90` (Organik), 1 petak `#ADD8E6` (Regenerative), 4 petak `#9ca3af` (Belum Ditentukan) — bukan 1 warna seragam seperti sebelumnya. Legenda dikonfirmasi tampil di halaman.
- Dicek langsung ke source: blok `eventHandlers` (mouseover/mousemove/mouseout untuk hover tooltip & klik) byte-identik dengan sebelum perubahan — cuma 1 baris `fillColor` yang berubah di dalam `pathOptions`.

**Keputusan/catatan penting:** pola "1 sumber warna dipakai bersama" dari sesi sebelumnya (`lib/plot-geo.ts`) langsung terbukti manfaatnya di sini — tidak perlu mendefinisikan ulang warna kategori, tinggal impor, otomatis sinkron dengan peta detail petak.

**Status berikutnya:** Peta kawasan Subak Sangeh sudah terverifikasi. Belum dicek untuk kawasan lain (kalau ada). `update_owner.html` (root+public) sudah diupdate dengan entri terpisah untuk perubahan ini.

---

## [2026-07-20] — Search, filter Jenis Lahan, sortir tabel kawasan (sinkron peta) + fix warna Regenerative

**Konteks:** kelanjutan fitur warna Jenis Lahan — sekarang ditambah toolbar interaktif (search+filter+sort) di tabel "Petak Lahan" halaman kawasan, client-side murni (data sudah dimuat, tidak ada query API baru), sinkron dengan peta di atasnya.

**Dikerjakan:**
1. `lib/plot-geo.ts` — warna `regenerative` di `LAND_CATEGORY_COLORS` diganti dari `#ADD8E6` (biru sangat muda, terlalu mirip abu-abu `#9ca3af`) jadi `#3b82f6` (biru medium) — 1 baris, 1 sumber, otomatis konsisten di peta petak DAN peta kawasan tanpa perlu sentuh file lain.
2. `components/maps/KawasanMapInner.tsx` — prop baru `matchedPlotIds?: Set<string> | null`; `pathOptions` Polygon diperluas: petak yang tidak ada di `matchedPlotIds` (saat filter aktif) mendapat `fillOpacity: 0.15` dan `opacity: 0.35` (border ikut pudar) — TETAP digambar, tidak disembunyikan. `matchedPlotIds=null` (default, tidak ada filter) = semua petak normal seperti biasa.
3. `components/maps/KawasanMap.tsx` — prop `matchedPlotIds` diteruskan ke `KawasanMapInner`.
4. `components/kawasan/KawasanPageClient.tsx` — state `searchQuery`, `filterCategory`, `sortColumn`, `sortDir` di level halaman (lift state up, sesuai arahan); fungsi `matchesFilter()` (AND antara search & kategori); `matchedIds` via `useMemo`; `displayedPlots` (hasil filter + sort) dipakai tabel; toolbar baru (search box + dropdown kategori + tombol reset) di atas tabel; header kolom Petani/Varietas/Luas/Scan Terakhir jadi `onClick` sortable dengan indikator ▲/▼; pesan "Tidak ada petak yang cocok" saat 0 hasil.

**Insiden debugging (dicatat sesuai CLAUDE.md §6 — root cause SALAH sempat diklaim sebelum ketemu yang benar):**
- Setelah edit, dev server (Turbopack) terus-menerus melempar error "Unterminated regexp literal" di `KawasanPageClient.tsx` baris 461, bertahan meski server di-restart penuh DAN cache `.next/` dihapus total.
- **Teori pertama (SALAH, sempat dikira benar):** dicurigai sintaks generic `Exclude<SortColumn, null>` membingungkan parser SWC — diperbaiki jadi `type SortColumnName` di level modul. Error TETAP muncul persis sama setelah fix ini — bukti langsung teori ini salah/tidak lengkap, dicatat eksplisit (bukan diam-diam pindah ke teori berikutnya).
- **Root cause sebenarnya (dibuktikan via `npx next build`):** build produksi (Turbopack juga) **compile bersih 100%**, cuma gagal di tahap type-check TERPISAH dengan error yang SAMA PERSIS seperti 3 error pre-existing yang sudah lama tercatat (tidak terkait file ini sama sekali). Ini membuktikan kode `KawasanPageClient.tsx` tidak pernah punya masalah sintaks — errornya murni state proses dev-server (Turbopack incremental compiler) yang korup, bukan masalah kode.
- **Fix sebenarnya:** stop total proses dev server + pastikan 0 sisa proses node.exe + start ulang bersih. Setelah itu, log server menunjukkan `200 OK` untuk semua request — dan yang penting, pesan error yang masih terlihat lewat `read_console_messages` browser ternyata JUGA menyesatkan: itu adalah log konsol LAMA yang menumpuk di tab, bukan error baru — dikonfirmasi dengan cross-check ke `preview_logs` (log sisi server, yang menunjukkan request sukses real-time) dan membaca konten halaman langsung via DOM, bukan cuma percaya riwayat console.
- **Pola baru dicatat:** kalau dev-server Turbopack melempar parse-error yang terasa tidak masuk akal dan bertahan meski sudah di-restart, coba `npx next build` sekali sebagai pembanding independen SEBELUM menyimpulkan ada bug di kode — itu memakai compiler yang sama tapi proses baru, jadi bisa membedakan "kode salah" vs "state dev-server korup". Juga: `read_console_messages` browser bisa menumpuk log LAMA lintas-navigasi — untuk error yang mencurigakan, verifikasi silang ke `preview_logs` (server) sebelum percaya penuh ke console browser.

**Verifikasi nyata (setelah root cause benar ditemukan dan diperbaiki):**
- `npx tsc --noEmit`: 0 error baru (3 error pre-existing yang sama seperti biasa).
- Test search "Made": tabel 8→1 baris, peta 7 petak opacity turun ke 0.15 bersamaan, 1 petak cocok tetap 0.4 — dibuktikan lewat `fill-opacity` tiap `<path>` SVG, bukan cuma dilihat sekilas.
- Test filter "Organik": 3 baris tabel, 3 polygon `fill="#90EE90"` opacity 0.4, sisanya 0.15 — sekaligus mengonfirmasi warna Regenerative baru (`#3b82f6`) muncul benar di data nyata.
- Test kombinasi search "wayan" + filter "organik": 1 hasil tepat (AND, bukan OR).
- Test sortir kolom Petani: klik 1x → urutan descending + arrow "▼"; klik lagi → ascending case-insensitive benar + arrow "▲".
- Test search tanpa hasil ("zzzznotexist"): 0 baris tabel, pesan "Tidak ada petak yang cocok" muncul, 8 polygon TETAP digambar (bukan hilang), semua opacity 0.15.
- Test hover ke petak yang sedang pudar (opacity 0.15): tooltip tetap muncul (innerText bertambah + ada teks NDVI/Fase) — fungsi hover lama dikonfirmasi tidak rusak oleh perubahan opacity.

**Status berikutnya:** Fitur terverifikasi lengkap di kawasan Subak Sangeh. `update_owner.html` (root+public) sudah diupdate dengan entri gabungan (toolbar + fix warna Regenerative jadi 1 entri, karena dikerjakan dalam 1 sesi yang sama).

---

## [2026-07-21] — Rencana redesign UI besar bergaya QGIS (mockup HTML statis, BELUM diimplementasi ke kode)

**Konteks:** rencana redesign UI besar sudah digodok lewat mockup HTML statis terpisah (diuji-coba interaktif, TIDAK terhubung ke data/API asli), sebagai catatan sebelum implementasi sesungguhnya dimulai. Sesi ini murni dokumentasi — TIDAK ADA kode aplikasi (app/, components/, lib/) yang disentuh sama sekali.

**7 poin rencana yang didokumentasikan:**

1. **Gaya keseluruhan terinspirasi QGIS** — sidebar navigasi kiri (bisa di-collapse jadi rail ikon saja), peta jadi elemen dominan layar (bukan dikelilingi banyak kartu terpisah seperti sekarang), tipografi lebih rapat/padat & sans-serif untuk kesan software data-teknis, bukan dekoratif.

2. **Halaman Kawasan:** peta jadi elemen utama mengisi sebagian besar layar; strip statistik (Total Petak/Total Luas/NDVI Rata-rata/Mode Intensif) jadi bar tipis mengambang di atas peta (bukan kartu besar terpisah seperti sekarang); daftar petak jadi drawer collapsible di bawah peta — search+filter+sortir yang SUDAH diimplementasi 19-20 Juli 2026 dipertahankan apa adanya.

3. **Interaksi klik petak di peta kawasan — pola 3 tingkat:** (a) kartu kecil menempel dekat lokasi klik (bukan modal tengah layar) — isi ringkas: Jenis Lahan, Luas, Tanggal Tanam, Estimasi Panen, Kesehatan, 1 insight singkat; (b) tombol "Lihat Detail" lanjut ke modal preview lebih lengkap; (c) tombol "Lihat Analisa Lengkap" dari modal itu PINDAH KE HALAMAN TERPISAH (bukan overlay/drawer di halaman yang sama) — keputusan sadar demi keuntungan gratis Next.js: tombol back browser otomatis jalan, URL per-petak bisa di-share/bookmark, tidak perlu state management manual untuk overlay.

4. **Halaman Detail Petak dipecah 2 tingkat:**
   - **Mode Ringkas** (default, semua role bisa akses): panel kiri collapsible berisi accordion (Info Dasar Petak, Analisis Otomatis, Kesehatan Lahan dengan chart NDVI/NDWI/NBR/SAR/Suhu & Curah Hujan default rentang 3 Bulan, Jenis Lahan, Musim Tanam & Estimasi Karbon, Foto Lapangan), peta besar di kanan dengan kontrol layer mengambang.
   - **Mode Audit** (halaman terpisah lebih lebar, dipicu tombol "Lihat Detail Verifikasi Lengkap" dari Mode Ringkas): layout mirip tampilan lengkap yang sudah ada sekarang — panel "Sumber Data & Verifikasi" 2 kolom (Citra Optik/Citra Radar dengan ID produk satelit lengkap), chart besar dengan toggle rentang PENUH (1 Bulan sampai 3 Tahun, bukan cuma default ringkas).
   - **Keputusan akses:** tombol ke Mode Audit DISEMBUNYIKAN TOTAL (bukan cuma disabled) untuk role `pekaseh` — cuma `admin` & `auditor` yang melihat tombolnya. Baru bisa diimplementasi setelah sistem auth multi-role (didesain 19 Juli 2026) benar-benar dibangun — bukan sebelum itu.

5. **Halaman baru "Laporan Kawasan"** (menggantikan rencana lama "Jenis Lahan" di sidebar) — otomatis menghitung & menampilkan total hektare per kategori Jenis Lahan (Organik/Regenerative/Konversi/Konvensional/Belum Ditentukan) untuk kawasan yang sedang dibuka, dengan kartu ringkasan + bar chart perbandingan. Mengikuti kawasan & filter yang sedang aktif — BUKAN agregasi lintas-kawasan.

6. **Tombol "Picu Scan Semua Petak" di halaman kawasan** — DENGAN dialog konfirmasi wajib sebelum eksekusi (jumlah petak yang akan di-scan, estimasi pemakaian kuota Copernicus, tanggal terakhir dipakai borongan). Ini keputusan sadar MENGUBAH rekomendasi lama (sebelumnya: scan per-petak saja, tanpa tombol borongan sama sekali sesuai diskusi kuota 19 Juli 2026) — sekarang boleh ada tombol borongan ASALKAN dengan pengaman konfirmasi ini, supaya tidak sengaja menghabiskan kuota bulanan.

7. **Sidebar navigasi direncanakan berisi:** Kawasan, Semua Petak (khusus role admin/Save Subak — tidak relevan untuk pekaseh yang cuma punya 1 kawasan; **spesifikasi lengkap fitur ini ditentukan 23 Juli 2026, lihat entri "lanjutan 3" di bawah**), Laporan Musim (mengikuti kawasan & filter aktif, BUKAN lintas-kawasan), Laporan Kawasan, Foto Lapangan, Pengaturan, Bantuan. Item "Estimasi Karbon" yang sempat diusulkan terpisah SUDAH DIPUTUSKAN TIDAK PERLU — dihapus dari rencana (sudah tercakup di accordion Musim Tanam & Estimasi Karbon, Mode Ringkas poin 4).

**Dicatat juga di `BRIEF_AgriMRV.md` bagian RIWAYAT KEPUTUSAN** (aturan CLAUDE.md §4 — keputusan arsitektur/desain UI besar wajib tercatat di sana juga, bukan cuma di sini) — entri sama, ringkas.

**Status:** murni tahap desain/mockup (file HTML statis terpisah, sudah diuji-coba interaktif tapi TIDAK terhubung ke data/API asli). Implementasi sesungguhnya sengaja DITUNDA sampai setelah persiapan Rikolto selesai, kemungkinan berbarengan dengan refactor `PlotDashboard.tsx` (~2000 baris, sudah direncanakan sebelumnya) — momentum yang pas untuk sekalian merapikan struktur kode itu.

**Status berikutnya:** BELUM ada kode aplikasi yang berubah untuk rencana ini — dikonfirmasi eksplisit di laporan sesi ini. Implementasi menunggu (a) persiapan Rikolto selesai, (b) kemungkinan bergabung dengan refactor PlotDashboard.tsx, dan (c) khusus untuk pembatasan akses Mode Audit di poin 4 — menunggu sistem auth multi-role (19 Juli 2026) benar-benar dibangun lebih dulu.

---

## [2026-07-22] — Fix bug tooltip petak "nyangkut" di peta kawasan (koreksi investigasi sebelumnya: trigger BUKAN hover, tapi klik)

**Konteks:** Laporan bug pertama kali datang dengan premis "tooltip nyangkut setelah HOVER dipindah ke area lain". Investigasi tahap 1 (sesi ini, sebelum entri log ini ditulis — tidak sempat dicatat di PROJECT_LOG karena belum ada fix): dicoba reproduksi hover-ke-area-kosong dan hover-ke-polygon-lain berkali-kali di `KawasanMapInner.tsx`, `mouseout` SELALU terbukti jalan benar di setiap percobaan nyata (bukan teori) — tidak berhasil direproduksi sama sekali. Sesuai CLAUDE.md §6, tidak dipaksakan menulis fix spekulatif waktu itu; user diminta bukti tambahan.

User lalu mengoreksi premis laporan setelah cek ulang ke pelapor asli: **trigger sebenarnya adalah KLIK polygon, bukan hover** — dan kartu tidak hilang meski diklik di tempat lain (area kosong maupun polygon lain). Investigasi tahap 1 di atas TETAP VALID (hover memang tidak pernah bermasalah), cuma premis awal laporannya yang salah — bukan kesimpulan tahap 1 yang salah.

**Root cause (dibuktikan lewat reproduksi nyata di browser, kawasan `de5b6d6a-bad0-4da7-8034-e7a6c6bd49da`, bukan teori):**
- Tooltip 100% dikendalikan oleh state `hoveredPlot`/`tooltipPos`, hanya di-set/reset lewat `eventHandlers` tiap `<Polygon>`: `mouseover`/`mousemove` (set) dan `mouseout` (reset). **Tidak ada `click` handler sama sekali** sebelum fix ini, dan tidak ada listener di level `<MapContainer>` yang mereset state saat klik di luar polygon.
- Reproduksi: dispatch `mouseover`+`click` di path polygon pertama → tooltip muncul (sesuai laporan: "muncul karena klik"). Lalu dispatch `mousedown`+`mouseup`+`click` di **elemen `.leaflet-container` kosong** (BUKAN di atas polygon manapun) → tooltip **tetap menempel**, tidak hilang. Terbukti karena: klik di area kosong tidak pernah melewati transisi `mouseout` pada polygon yang sebelumnya di-hover (tidak ada pergerakan mouse kontinu yang "keluar" dari polygon itu ke area kosong — cuma dispatch langsung di target baru), jadi `mouseout` polygon lama tidak pernah terpanggil, dan tidak ada mekanisme lain yang mereset state.
- Ini persis skenario yang terjadi di device dengan interaksi tap/klik diskrit (bukan gliding mouse kontinu) — cocok dengan laporan user bahwa masalah muncul lewat klik.
- Klik ke polygon LAIN saat tooltip sedang nyangkut ternyata **kebetulan tetap bekerja** sebelum fix (karena `mouseover` di polygon baru tetap men-set ulang `hoveredPlot` tanpa syarat) — tapi ini bukan mekanisme yang disengaja/robust, cuma efek samping. Untuk device yang cuma mengirim `click` tanpa `mouseover` (touch tap murni), ini akan tetap gagal tanpa fix.

**Fix (`components/maps/KawasanMapInner.tsx`):**
1. Tambah `click` ke `eventHandlers` tiap `<Polygon>` petak — set `hoveredPlot`/`tooltipPos` sama seperti `mouseover`, PLUS `L.DomEvent.stopPropagation(e)` supaya klik ini tidak diteruskan ke listener klik di level map.
2. Komponen baru `ClickOutsideResetter` (pakai `useMapEvents({ click: onReset })` dari react-leaflet) dipasang di dalam `<MapContainer>` — reset `hoveredPlot`/`tooltipPos` ke `null` setiap kali map-level `click` event ter-trigger. Karena klik pada polygon sudah `stopPropagation`, listener ini HANYA pernah jalan untuk klik di luar polygon (area kosong, garis batas desa, marker label) — tidak pernah menimpa tooltip yang baru saja dibuka oleh klik polygon itu sendiri.
3. `eventHandlers` mouseover/mousemove/mouseout SAMA SEKALI TIDAK diubah — hover desktop tetap jalan seperti semula.

**Verifikasi nyata (browser, kawasan `de5b6d6a-bad0-4da7-8034-e7a6c6bd49da`, 3 petak asli — MM 15/MM04/MM05, tanpa data uji baru dibuat):**
- Klik polygon MM15 (hover dulu lalu klik) → tooltip muncul. Klik area kosong peta → tooltip **hilang** (sebelum fix: tetap nyangkut — dikonfirmasi reproduksi identik sebelum fix diterapkan).
- Klik MURNI (tanpa mouseover sama sekali, simulasi touch tap) di MM15 → tooltip tetap muncul (menunjukkan fix `click` handler bekerja independen dari `mouseover`).
- Klik MM04 (petak lain) saat tooltip MM15 sedang tampil → tooltip berganti bersih ke MM04 (1 kartu, tidak menumpuk).
- Hover murni (mouseover+mousemove, tanpa klik) ke MM05 → tooltip muncul seperti biasa. `mouseout` dispatch ke MM05 → tooltip hilang seperti biasa — perilaku hover desktop dikonfirmasi TIDAK berubah sama sekali.
- `npx tsc --noEmit`: 0 error baru (3 error pre-existing yang sama seperti biasa — `PlotMapInner.tsx`, `PlotDashboard.tsx`, `test-nbr.ts`).
- Tidak ada petak/data uji baru dibuat selama investigasi kali ini (semua tes pakai 3 petak asli yang sudah ada) — tidak perlu cleanup soft-delete.

**Keputusan/catatan penting:** Pola baru untuk komponen peta manapun ke depan yang butuh "klik untuk buka, klik-di-luar untuk tutup" — pasang `click` handler di elemen yang mau dibuka DENGAN `L.DomEvent.stopPropagation(e)`, lalu pasang 1 listener `useMapEvents({click:...})` di level `<MapContainer>` untuk reset. Tidak cukup hanya mengandalkan `mouseout`, karena itu cuma jalan kalau ada pergerakan mouse kontinu keluar dari elemen — tidak jalan untuk klik/tap diskrit ke target yang berbeda.

**Status berikutnya:** Fitur terverifikasi di kawasan Subak Sangeh (`de5b6d6a-...`). Belum dicek eksplisit di device touch fisik (semua reproduksi di atas pakai simulasi `MouseEvent` lewat browser pane) — kalau nanti ada laporan serupa lagi dari device touch asli, itu sinyal untuk cek lebih lanjut apakah touch device tersebut benar-benar mengirim event `click` yang sama seperti simulasi ini. `update_owner.html` (root+public) sudah diupdate dengan entri "fixed" untuk perubahan ini.

---

## [2026-07-22] — REGRESI dari fix sebelumnya: klik ke petak solid tidak memunculkan kartu sama sekali — root cause SEBENARNYA berbeda dari dugaan awal

**Konteks:** Beberapa jam setelah entri di atas (fix "kartu nyangkut setelah klik"), muncul laporan regresi baru: klik ke petak berwarna solid (bukan garis batas desa) TIDAK memunculkan kartu SAMA SEKALI — kebalikan dari bug asli. Dugaan awal yang diberikan user (WAJIB dibuktikan dulu sebelum dipercaya, sesuai CLAUDE.md §6): `ClickOutsideResetter` (listener klik level `<MapContainer>`) mungkin menangkap ulang event klik yang SAMA setelah polygon membukanya, membatalkannya di render cycle yang sama, karena `L.DomEvent.stopPropagation(e)` di handler polygon mungkin tidak benar-benar mencegah event itu sampai ke map.

**Investigasi — dugaan awal TERBUKTI SALAH:** Ditambahkan `console.log` sementara di KEDUA handler (klik polygon dan `ClickOutsideResetter`), lalu direproduksi klik ke petak solid berkali-kali dengan berbagai metode (dispatch langsung ke elemen path, klik murni tanpa mouseover). Hasil: `ClickOutsideResetter` **TIDAK PERNAH** ter-log sama sekali ketika klik polygon berhasil — artinya `stopPropagation` bekerja BENAR, dugaan awal soal race-condition/re-catch di render cycle yang sama **terbukti salah**, bukan penyebabnya.

**Root cause SEBENARNYA (dibuktikan lewat `document.elementFromPoint(x, y)` — hit-testing asli browser, bukan dispatch langsung ke elemen yang bisa melewati proses hit-testing):**
- Di `DesaBoundaryRenderer` (baris ~130-144), garis batas desa dirender di pane custom `desaBoundaryPane` dengan `pane.style.pointerEvents = 'none'` DAN `pane.style.zIndex = '450'` (LEBIH TINGGI dari `overlayPane` bawaan Leaflet, tempat `<Polygon>` petak dirender, yang berzIndex 400).
- **Masalahnya:** `pathStyle` untuk polygon batas desa TIDAK PERNAH menyertakan `interactive: false`. Tanpa itu, Leaflet tetap menandai path tersebut dengan class `.leaflet-interactive`, yang di CSS bawaan Leaflet punya aturan `pointer-events: auto` — ini MENIMPA `pointer-events: none` yang di-set di level pane (CSS pointer-events pada elemen anak bisa override milik induk kalau di-set eksplisit). Akibatnya: garis batas desa (fill tak terlihat, `fillOpacity: 0`) tetap MENANGKAP klik/hover di SELURUH area interiornya, dan karena pane-nya z-index lebih tinggi, ia menang saat bertumpuk dengan polygon petak asli di bawahnya.
- **Bukti konkret:** `document.elementFromPoint(716, 391)` — koordinat yang terlihat berada di dalam bounding-box polygon petak — mengembalikan elemen `<path fill="#C98A2E">` (warna batas desa), BUKAN elemen petak (`#90EE90`) yang sebenarnya dimaksud user untuk diklik.
- **Kenapa ini baru "ketahuan" sekarang, bukan sejak fitur batas desa dibuat (~08 Juli 2026):** sebelum sesi sebelumnya, `<Polygon>` petak TIDAK PERNAH punya `click` handler sama sekali — jadi tidak ada cara untuk mengetahui bahwa klik di area tertentu ditelan oleh batas desa, karena tidak ada fungsi yang seharusnya terjadi saat diklik. Begitu `click` handler ditambahkan (entri sebelumnya), bug laten ini baru punya efek yang terlihat/dilaporkan.

**Catatan jujur — bukan 100% konsisten di SEMUA titik:** Sampling grid di dalam bounding-box beberapa polygon petak lain menunjukkan SEBAGIAN titik memang mengembalikan garis batas desa (tertutup), tapi SEBAGIAN LAIN (termasuk titik yang visually jelas di tengah area hijau solid) tetap benar mengembalikan polygon petak — artinya penutupan ini tidak selalu 100% menutupi SETIAP piksel tiap petak, tergantung bentuk polygon petak vs bentuk polygon batas desa yang bertumpuk. Ini tetap bug nyata yang harus diperbaiki (klik seharusnya TIDAK PERNAH bisa "ditelan" oleh elemen dekoratif yang sengaja dibuat tak terlihat), tapi dicatat di sini secara jujur bahwa tidak bisa dipastikan ini menjelaskan 100% laporan "kartu tidak pernah muncul sama sekali" — kalau user masih mengalami kegagalan setelah fix ini, perlu bukti tambahan (rekaman layar/device asli).

**Temuan sampingan (dicatat, TIDAK diperbaiki karena tidak menjelaskan gejala & kemungkinan besar cuma artefak dev-server):** `console.log` di handler klik polygon sempat konsisten ter-log DUA KALI dengan timestamp identik untuk 1 klik yang sama (walau cuma dispatch 1 event `click` tunggal, tanpa `mousedown`/`mouseup`). Diduga kuat ini artefak Fast Refresh Next.js dev-server dari beberapa kali edit berturut-turut di sesi ini (pola dev-server yang sudah pernah didokumentasikan sebelumnya di project ini, 20 Juli 2026), BUKAN duplikasi listener di kode produksi — karena kedua panggilan men-set state yang identik (idempotent), ini tidak menjelaskan gejala "kartu tidak muncul".

**Fix (`components/maps/KawasanMapInner.tsx`):**
- Tambah `interactive: false` ke `pathStyle` polygon batas desa di `DesaBoundaryRenderer` — SATU baris. Ini mencegah Leaflet menandai path dengan class `.leaflet-interactive` sama sekali, sehingga aturan CSS `pointer-events:auto` bawaan Leaflet tidak pernah berlaku untuknya, dan `pointer-events:none` di level pane benar-benar efektif untuk klik/hover tembus ke elemen di bawahnya.
- Semua `console.log` debug sementara (di handler klik polygon dan `ClickOutsideResetter`) DIHAPUS setelah investigasi. `window.__leafletMap` (hook sementara untuk mengakses instance peta dari console browser demi keperluan testing terkontrol zoom) juga sudah dihapus — sempat dipasang DUA KALI (sekali untuk investigasi awal, sekali lagi untuk validasi ulang pasca-fix), keduanya sudah dibersihkan.

**Verifikasi nyata (kawasan Subak Sangeh, zoom 18, 6 petak asli — MM15/MM04/MM05/MM09/MM13/+1, via `document.elementFromPoint` untuk memastikan titik klik benar-benar di dalam fill petak, bukan asumsi):**
1. Titik yang SEBELUM fix mengembalikan batas desa (716,391) — SETELAH fix mengembalikan `<div class="leaflet-container">` (tembus ke map, bukan tertelan batas desa lagi).
2. Klik petak solid (titik terverifikasi di dalam fill MM05) → kartu MUNCUL dan TETAP TERLIHAT (dicek di panggilan terpisah, bukan cuma sesaat) — "MM05...".
3. Klik area kosong (titik terverifikasi bukan di atas polygon manapun) → kartu HILANG.
4. Klik petak lain (petak berbeda, MM09) saat kartu MM05 masih ada → kartu MM05 hilang, kartu MM09 muncul — 1 kartu saja, tidak menumpuk.
5. Hover murni (`mouseover`/`mousemove`, tanpa klik sama sekali) ke petak lain (MM15) → kartu muncul normal. `mouseout` → kartu hilang normal — perilaku hover TIDAK berubah dari sebelumnya.
6. `npx tsc --noEmit`: 0 error baru (3 error pre-existing yang sama — `PlotMapInner.tsx`, `PlotDashboard.tsx`, `test-nbr.ts`).
7. `read_console_messages` (browser, 0 error) dan `preview_logs` (server, 0 error) setelah reload bersih tanpa kode debug apa pun.
8. Tidak ada data uji baru dibuat di kawasan manapun — semua tes memakai petak asli yang sudah ada.

**Keputusan/catatan penting:** Pola baru untuk elemen dekoratif/non-interaktif di peta manapun ke depan (garis batas, label, dll.) — `pane.style.pointerEvents = 'none'` di level pane SAJA TIDAK CUKUP untuk mencegah elemen itu menangkap klik/hover, KALAU elemen di dalamnya adalah shape Leaflet (`L.polygon`/`L.polyline`/dll.) yang tidak eksplisit di-set `interactive: false` — CSS bawaan Leaflet (`.leaflet-interactive { pointer-events: auto }`) akan tetap menimpa pengaturan pane. **Wajib set `interactive: false` langsung di `pathStyle`/opsi layer itu sendiri**, jangan andalkan pengaturan pane saja.

**Status berikutnya:** Perlu ditest lebih lanjut di kawasan lain yang juga punya batas desa untuk memastikan tidak ada kawasan dengan pola tumpang-tindih berbeda yang masih bermasalah. `update_owner.html` (root+public) sudah diupdate — entri sebelumnya (fix "kartu nyangkut") DIBERI CATATAN TAMBAHAN bahwa fix itu ternyata memicu regresi baru yang baru saja diperbaiki di entri ini, supaya tidak menyesatkan pembaca yang cuma baca entri lama.

---

## [2026-07-22] — Tombol "Tarik Data Baseline Cuaca" untuk petak baru (menutup gap dari investigasi sesi sebelumnya)

**Konteks:** Sesi investigasi sebelumnya (sama hari ini, sebelum entri regresi klik di atas — investigasi murni, tidak dicatat entri terpisah karena tidak ada kode yang diubah saat itu) menemukan gap desain nyata: chart Curah Hujan (Open-Meteo) tampil kosong total untuk petak baru. Ditemukan penyebabnya BUKAN bug rendering, tapi memang tidak ada mekanisme backfill cuaca per-petak — dibandingkan dengan data satelit yang punya tombol "Tarik Data Baseline Satelit" (histori 3 tahun on-demand, `/api/plots/[plotId]/baseline`, wajib diklik 1x di awal proyek sesuai Verra VM0051), cuaca cuma terisi bertahap 3 hari/hari lewat cron harian — bisa butuh ~90 hari kalender sebelum petak baru punya histori 3 bulan. Backfill 3 tahun yang ada (`scripts/backfill-weather.mjs`) cuma pernah dijalankan 1x manual (19 Juli 2026, untuk 7 petak yang ada saat itu) via CLI, tidak lewat UI, tidak otomatis untuk petak baru berikutnya.

**Fix — endpoint & tombol baru yang meniru pola baseline satelit sepersis mungkin:**
1. **`app/api/plots/[plotId]/weather-baseline/route.ts`** (baru, 71 baris) — struktur identik `.../baseline/route.ts` (ambil `geo_data` dari `v_plots`, hitung window 1095 hari/3 tahun ke belakang — SAMA dengan baseline satelit supaya histori 2 sumber data konsisten jangka waktunya). Bedanya: panggil `fetchWeatherRange` (fungsi yang sudah ada, sama persis dipakai cron harian) alih-alih Sentinel API, lalu upsert ke `weather_logs` dengan `onConflict: 'plot_id,date'` — pola upsert SAMA dengan cron, supaya aman dipanggil berkali-kali tanpa duplikat.
2. **`components/plots/PlotDashboard.tsx`** (+42 baris) — state `isPullingWeatherBaseline`/`weatherBaselineMsg` (identik pola `isPullingBaseline`/`baselineMsg`), fungsi `handlePullWeatherBaseline` (identik `handlePullBaseline`, cuma ganti endpoint), dan blok tombol baru "Tarik Data Baseline Cuaca" PERSIS DI BAWAH tombol satelit di tab Karbon — styling & pola loading/pesan hasil disamakan sepenuhnya (bukan didesain beda sendiri).
3. Endpoint & tombol satelit yang sudah ada **tidak disentuh sama sekali** — dikonfirmasi lewat `git diff --stat` terhadap `baseline/route.ts` (0 perubahan).

**Verifikasi nyata (petak "MJ31", kawasan Subak Sangeh — petak paling baru, cuaca & satelit sama-sama kosong sebelum tes):**
- Sebelum: chart Curah Hujan → "Belum ada data cuaca untuk petak ini" (dikonfirmasi lewat `get_page_text` di halaman detail petak).
- Klik "Tarik Data Baseline Cuaca" → pesan sukses "Berhasil menarik 1096 hari data cuaca (Open-Meteo) untuk 3 tahun terakhir (1095 hari)!" muncul di UI.
- Reload halaman penuh (bukan cuma percaya state React) → chart Curah Hujan terisi: rentang default 3 Bulan menunjukkan "91 hari · total 218 mm · 47 hari kering (<1mm)"; toggle ke "Semua (3 Tahun)" → "1096 hari · total 6910 mm · 268 hari kering" — data benar-benar tersimpan di `weather_logs`, bukan cuma tampilan sementara.
- Tombol "Tarik Data Baseline Satelit" (existing) dicoba lagi di petak yang sama → tetap berhasil normal ("Berhasil menarik 474 data satelit ASLI...") — fitur satelit tidak terpengaruh sama sekali oleh perubahan ini.
- Tes idempotensi: tombol cuaca diklik KEDUA KALINYA (simulasi kalau cron harian sudah sempat isi sebagian data sebelum admin sempat klik tombol ini) → total data setelah reload TETAP 1096 hari (bukan 2192/dobel) — `upsert onConflict:'plot_id,date'` terbukti bekerja benar, tidak ada duplikasi baris.
- `npx tsc --noEmit`: 0 error baru (3 error pre-existing yang sama, cuma nomor baris `PlotDashboard.tsx` bergeser karena baris baru ditambahkan sebelum lokasi errornya).

**Keputusan/catatan penting:** Open-Meteo (beda dari Copernicus) tidak punya kuota/rate-limit, jadi endpoint baru ini sengaja dibuat SESEDERHANA mungkin — 1 request per klik untuk seluruh rentang 3 tahun, tanpa loop per-interval atau delay seperti pola `fetchSar`/`fetchNdvi` di baseline satelit. Ini konsisten dengan temuan investigasi sesi sebelumnya bahwa tidak perlu mikirkan proteksi kuota untuk cuaca.

**Status berikutnya:** Gap yang ditemukan investigasi sebelumnya sekarang TERTUTUP — petak baru bisa langsung diisi histori cuaca 3 tahun via tombol, tidak perlu lagi menunggu cron harian atau minta admin jalankan script CLI manual. SOP baru yang disarankan (belum wajib): setiap kali admin bikin petak baru, klik JUGA "Tarik Data Baseline Cuaca" di tab Karbon, sama seperti sudah terbiasa klik "Tarik Data Baseline Satelit". `update_owner.html` (root+public) sudah diupdate dengan entri baru untuk fitur ini.

---

## [2026-07-23] — Disclaimer fase diperkuat di semua lokasi tampil (perbaikan logika DITUNDA pasca-Rikolto) + bersihkan console.log NBR

**Konteks:** Lanjutan dari 2 investigasi sesi sebelumnya (hari yang sama, tidak sempat dicatat entri terpisah karena murni investigasi tanpa kode diubah): (1) kasus petak MM04 (Kelompok tani Sri Galih) berlabel "Pematangan" padahal NDVI plateau datar 3 minggu (0.43-0.46, 25 Jun - 15 Jul) — pola yang jauh lebih konsisten dengan "sudah dipanen, lahan bera dengan vegetasi residual" dibanding "masih aktif menuju panen" (tanaman hidup seharusnya terus menurun, bukan mendatar). Dikonfirmasi: `estimatePhase()` murni snapshot 1 titik data, tidak ada cek tren/durasi/tanggal panen manual sama sekali. (2) Kasus terpisah: MM04/MM05 tetap "Belum ada scan" di tabel kawasan meski "Picu Scan Satelit" sukses — dugaan awal "butuh 2 scan" (mengacu ke hysteresis AWD) TERBUKTI SALAH (ketiga petak sama-sama punya 474 baris histori) — akar masalah sebenarnya: `latest_phase` di `app/kawasan/[kawasanId]/page.tsx` mengambil baris TERBARU tanpa skip null, dan pass Sentinel-2 terbaru (20 Juli) kebetulan 100% berawan khusus untuk polygon MM04/MM05 (tidak untuk MM15 yang bersebelahan) — fix untuk gap INI belum dikerjakan (di luar scope sesi ini, cuma dicatat).

**KEPUTUSAN EKSPLISIT:** perbaikan logika fase (deteksi plateau, override dari tanggal panen manual, atau perbaikan pemilihan `latest_phase` skip-null) DITUNDA sampai setelah persiapan Rikolto selesai — supaya tidak ada risiko regresi menjelang meeting. Untuk SEKARANG, cukup perkuat disclaimer supaya user tidak salah percaya label fase 100% akurat, TANPA mengubah `estimatePhase()` atau logika fase manapun sama sekali.

**Dikerjakan (TUGAS 1 — disclaimer, 4 lokasi, semua tempat fase ditampilkan dicek):**
1. `components/plots/PlotDashboard.tsx` — footer strip di bawah stat NDVI/NDWI/NBR/VH-VV/Orbit (dulu: "* Fase & indeks bersifat ilustratif — bukan standar agronomi resmi"): diperkuat jadi menyebut eksplisit "estimasi otomatis dari satu titik data satelit... lahan sudah dipanen bisa saja masih berlabel fase lama... Konfirmasi ke petani/pekaseh untuk kepastian."
2. `components/plots/PlotDashboard.tsx` — panel "Analisis Otomatis" (sebelumnya TIDAK ADA disclaimer sama sekali di panel ini, padahal isinya kalimat percaya-diri seperti "bulir sedang mengering menjelang panen"): ditambah 1 baris caption kecil di bawah header, sebelum daftar insight.
3. `components/maps/KawasanMapInner.tsx` — tooltip hover polygon peta kawasan (dulu: "* Fase: ilustratif, bukan standar agronomi resmi"): diperkuat dengan kalimat sependek mungkin (ruang tooltip cuma ~220px) tapi tetap menyebut inti "lahan sudah panen bisa saja masih berlabel fase lama".
4. `components/kawasan/KawasanPageClient.tsx` — kolom header "Fase Terkini" di tabel kawasan (sebelumnya TIDAK ADA disclaimer/tooltip sama sekali): ditambah ikon (i) `InfoTooltip` di sebelah judul kolom, isi tooltip penjelasan lengkap termasuk kalimat "sistem belum bisa membedakan 'menuju panen' dari 'sudah dipanen'".

**Dikerjakan (TUGAS 2 — bersihkan console.log):**
`app/api/plots/[plotId]/scan/route.ts` baris 166 & 168 — 2 baris `console.log("== NBR INTERVALS ==", ...)` dan `console.log("== MATCH NBR ==", ...)` (sisa debug, mencetak seluruh interval data ke log server tiap "Picu Scan Satelit" diklik) DIHAPUS. Logic NBR (`matchNbr`, `nbrMean`) di baris yang sama SAMA SEKALI tidak disentuh — dikonfirmasi lewat `git diff` file ini: cuma 2 baris `console.log` yang hilang, tidak ada perubahan lain.

**Dikerjakan (TUGAS 3 — tutup gap dokumentasi):**
`update_owner.html` (root+public) — Log Error ditambah entri baru (2026-07-19, warning): "NBR tidak dihitung otomatis tiap hari — masih terbuka". Menjelaskan dalam bahasa awam bahwa NBR cuma dihitung saat scan manual/baseline ditarik, bukan otomatis tiap hari — status diketahui, belum diperbaiki, sengaja ditunda pasca-Rikolto. Ini melengkapi entri 19 Juli yang sebelumnya cuma mencatat fix CO2e tapi TERLEWAT mencatat gap NBR yang ditemukan di sesi yang sama.

**Verifikasi nyata (browser, plot MM04 & kawasan Subak Sangeh):**
- Footer disclaimer plot detail: dikonfirmasi tampil via `get_page_text` — teks baru muncul persis seperti ditulis.
- Disclaimer panel Analisis Otomatis: dikonfirmasi tampil tepat di bawah header "rule-based", sebelum daftar insight.
- Tooltip (i) kolom "Fase Terkini" tabel kawasan: diklik via JS, teks tooltip lengkap dikonfirmasi muncul di `document.body.innerText`.
- Tooltip hover peta kawasan: `mouseover` di-dispatch ke polygon MM15, teks tooltip dikonfirmasi memuat kalimat disclaimer baru (bukan yang lama).
- `npx tsc --noEmit`: 0 error baru (3 error pre-existing yang sama seperti biasa, cuma nomor baris `PlotDashboard.tsx` bergeser).
- `grep estimatePhase` di `scan/route.ts` dan `baseline/route.ts`: teks fungsi byte-identik dengan yang dikutip di investigasi sesi sebelumnya — dikonfirmasi TIDAK berubah sama sekali. `grep "estimated_phase = "` di `cron/satellite-scan/route.ts`: 5 baris ambang yang sama, juga tidak berubah.
- `grep console.log` di `scan/route.ts`: 0 hasil — bersih.
- `read_console_messages` (browser): 0 error setelah semua interaksi di atas.
- root & public `update_owner.html`: dikonfirmasi byte-identical via `diff`.

**Status berikutnya:** Perbaikan logika sesungguhnya (deteksi plateau NDVI, override dari tanggal panen manual jika ada, fix pemilihan `latest_phase` supaya skip baris null-karena-awan) TETAP TERBUKA, sengaja ditunda sampai pasca-Rikolto sesuai keputusan eksplisit sesi ini. Gap "MM04/MM05 tetap Belum ada scan meski Picu Scan sukses" (ditemukan investigasi kedua hari ini) JUGA belum diperbaiki — di luar scope sesi ini yang fokus ke disclaimer saja.

---

## [2026-07-23 (lanjutan)] — Fix pemilihan `latest_phase` skip-null (gap yang tertunda di entri di atas) + PhaseBadge cloud-aware + penunjuk arah mata angin di semua peta

**Konteks:** Melanjutkan gap yang eksplisit ditunda di entri sebelumnya ("fix pemilihan `latest_phase` supaya skip baris null-karena-awan") — sekarang dikerjakan. Sekalian ada 1 permintaan terpisah (Tugas 3): penunjuk arah mata angin di semua peta.

**Dikerjakan (Tugas 1 — pemilihan data di server):**
`app/kawasan/[kawasanId]/page.tsx` — loop `latestScanPerPlot` sebelumnya cuma ambil baris PERTAMA (= paling baru) per plot_id dari hasil `order('scan_date', {ascending:false})`, TANPA cek `estimated_phase` null atau tidak. Sekarang ditambah Map KEDUA, `latestValidPhasePerPlot`, yang dicari MUNDUR lewat riwayat sampai ketemu baris pertama dengan `estimated_phase` TIDAK null (skip baris berawan). Kedua nilai diteruskan terpisah ke `enrichedPlots`: `latest_scan_date` TETAP baris paling baru apapun (jujur menunjukkan kapan terakhir dicoba), `latest_valid_phase` + `latest_valid_phase_date` BARU, berisi fase valid terakhir meski beda tanggal. `estimatePhase()` (di 3 lokasi: `scan/route.ts`, `baseline/route.ts`, `cron/satellite-scan/route.ts`) SAMA SEKALI tidak disentuh — dikonfirmasi lewat grep, byte-identik dengan sebelumnya.

Tipe `PlotData` di `components/maps/KawasanMapInner.tsx` (dipakai bersama oleh `KawasanPageClient.tsx`) ditambah 2 field opsional baru: `latest_valid_phase`, `latest_valid_phase_date`.

**Dikerjakan (Tugas 2 — PhaseBadge cloud-aware):**
`components/plots/PhaseBadge.tsx` — ditambah 3 prop opsional: `cloudCover`, `fallbackPhase`, `fallbackPhaseDate`. Kalau `phase` yang mau ditampilkan null TAPI `fallbackPhase`+`fallbackPhaseDate` ada isinya (artinya scan terbaru berawan tapi ada histori valid), badge menampilkan "☁️ Awan {cloudCover}% — data terakhir: {label fase} ({tanggal})" alih-alih "Belum ada scan" generik. Kalau `fallbackPhase` juga kosong (plot BENAR-BENAR belum pernah punya fase valid), tetap fallback ke `emptyLabel` lama ("Belum ada scan") — tidak berubah untuk kasus ini. `components/kawasan/KawasanPageClient.tsx` — pemanggilan `<PhaseBadge>` diperluas kirim `cloudCover`, `fallbackPhase`, `fallbackPhaseDate` dari data plot.

**Dikerjakan (Tugas 3 — penunjuk arah mata angin):**
Komponen baru `components/maps/CompassIndicator.tsx` — lingkaran kecil (36px) semi-transparan putih, border+shadow konsisten gaya legenda yang sudah ada, huruf "N" tebal abu-gelap + tick merah kecil di atasnya. Statis (peta pakai proyeksi Web Mercator standar Leaflet, utara selalu lurus ke atas — tidak perlu rotasi dinamis). Dipasang di 2 komponen peta yang ada di project ini (dicek dulu via `grep MapContainer` — cuma 2 file yang benar-benar merender peta, `KawasanMapInner.tsx` dan `PlotMapInner.tsx`, tidak ada peta lain yang terlewat):
- `KawasanMapInner.tsx`: ditaruh `bottom-24 left-4` — SENGAJA di ATAS legenda "Warna polygon = Jenis Lahan" yang sudah ada di `bottom-4 left-4` (bukan sejajar), supaya tidak tabrakan di pojok kiri-bawah yang sama.
- `PlotMapInner.tsx`: return statement dibungkus `<div className="relative h-full w-full">` (sebelumnya cuma return `<MapContainer>` langsung, tidak ada wrapper) supaya compass bisa di-overlay sebagai sibling — ditaruh `bottom-4 left-4` (dikonfirmasi tidak ada elemen lain di pojok itu untuk peta detail petak; legenda "Warna polygon = NDVI" untuk peta ini dirender TERPISAH di `PlotDashboard.tsx`, di BAWAH kartu peta, bukan mengambang di atasnya).

**Verifikasi nyata (kawasan Subak Sangeh, 21 petak):**
- Sebelum fix, tabel kawasan: MM04, MM05 tampil "Belum ada scan" meski 474 baris histori ada (kasus yang sama seperti investigasi sebelumnya).
- Sesudah fix, dicek lewat `get_page_text` halaman kawasan langsung:
  - MM04: "☁️ Awan 100% — data terakhir: Pematangan (15 Jul)"
  - MM05: "☁️ Awan 100% — data terakhir: Pematangan (15 Jul)"
  - MJ31 (bonus, plot lain dengan kondisi sama): "☁️ Awan 100% — data terakhir: Pematangan (5 Jul)"
  - MM15 (scan terbaru bersih, tidak berawan): tetap "Pematangan" — TIDAK berubah.
  - 17 petak lain: dicek satu (MM09) langsung ke database via REST API — 0 baris `satellite_logs` sama sekali (bukan cuma "selalu berawan") — tetap tampil "Belum ada scan", dikonfirmasi TIDAK berubah untuk kasus genuinely-never-scanned.
- Compass: dikonfirmasi tampil di kedua peta (kawasan & detail petak) lewat `getBoundingClientRect()` — dicek TIDAK tabrakan dengan legenda di desktop (celah 26px) MAUPUN mobile 375×812 (celah 7px).
- `npx tsc --noEmit`: 0 error baru (3 error pre-existing yang sama seperti biasa).
- `read_console_messages` (browser): 0 error setelah semua navigasi & interaksi di atas.
- `estimatePhase()` di 3 lokasi kode: byte-identik dengan sebelumnya (dikonfirmasi grep, bukan diff yang bisa "terselip" perubahan kecil).

**Status berikutnya:** Gap "latest_phase skip-null" yang ditunda di entri sebelumnya SEKARANG TERTUTUP. `update_owner.html` (root+public) diupdate dengan 1 entri gabungan (fix cloud-aware + fitur compass, keduanya dari sesi yang sama). Belum dicek: petak dengan histori scan TAPI 100% baris-nya berawan (tidak pernah sekalipun valid) — secara logika kode tetap akan fallback ke "Belum ada scan" (karena `fallbackPhase` juga akan null), tapi tidak ada data nyata di kawasan ini untuk membuktikan skenario itu secara langsung — kalau muncul kasus itu di masa depan, perlu dicek ulang.

---

## [2026-07-23 (lanjutan 2)] — Fix FINAL: maxNativeZoom={18} — tutup regresi "peta blank" dari kenaikan maxZoom sesi sebelumnya

**Konteks:** Rangkaian 3 sesi terkait `maxZoom` yang perlu disambungkan eksplisit:
1. Sesi A: ditemukan `maxZoom` peta (18) adalah default bawaan Leaflet, bukan sengaja di-set. Dites tile Esri z18 vs z19/z20 untuk 1 titik (Sri Galih) — **KESIMPULAN SAAT ITU (SALAH, lihat koreksi di bawah): "z19 tetap ada gambar, cuma tidak nambah detail dari z18/19/20 byte-identik, aman dinaikkan ke 19"** — kesalahan verifikasi: HANYA dicek HTTP status + ukuran gambar (`complete:true`, `naturalWidth:256`), TIDAK PERNAH benar-benar dibuka/dilihat ISI gambarnya.
2. Sesi B: `maxZoom={19}` diterapkan ke `<TileLayer>` di kedua komponen peta, dikonfirmasi `map.getMaxZoom()=19` di server yang di-restart bersih — waktu itu dianggap selesai.
3. Sesi C (baru saja): user laporkan DENGAN SCREENSHOT — kawasan "Subak Selan Bawak" (2 petak, 0.858 ha — dikonfirmasi cocok by database) tampil BLANK ABU-ABU bertuliskan "Map data not yet available" di zoom 19. Diinvestigasi ulang, dan **KALI INI gambar tile BENAR-BENAR DIBUKA SATU PER SATU (bukan cuma cek status)** — ditemukan: tile z19 yang di sesi A "dikonfirmasi berhasil" TERNYATA adalah gambar placeholder "Map data not yet available" itu sendiri (hash MD5 identik: `f27d9de7f80c13501f470595e327aa6d`)! Dicek ke SEMUA 4 kawasan yang ada di database (Subak Sangeh, Subak Selan Bawak, Kelompok tani Sri Galih, Subak Timbul) — **KEEMPATNYA punya hash z19 IDENTIK PERSIS** — bukan cuma 1 kawasan yang bernasib buruk, tapi masalah SISTEMIK: Esri tidak punya citra asli di zoom 19 untuk SELURUH area kerja Sinagri saat ini (rice paddy Bali bukan "metropolitan area terpilih" yang dapat resolusi Maxar tertinggi).

**Koreksi eksplisit (sesuai CLAUDE.md §6):** kesimpulan sesi A ("z19 aman, tetap ada gambar") SALAH — bukan cuma tidak lengkap, tapi benar-benar salah. Root cause SEBENARNYA baru ketemu setelah gambar dibuka visual, bukan cuma dicek metadata teknis (status/ukuran/dimensi).

**Fix final (disetujui user, BUKAN keputusan sepihak — 2 opsi diajukan, user pilih):** `maxNativeZoom={18}` ditambahkan ke `<TileLayer>` yang sama, DI SAMPING `maxZoom={19}` yang tetap dipertahankan (bukan diturunkan balik). Ini fitur bawaan Leaflet yang dirancang persis untuk kasus "peta boleh zoom lebih jauh dari resolusi asli tile source" — di atas `maxNativeZoom`, Leaflet otomatis minta tile dari level `maxNativeZoom` lalu upscale sendiri di browser, TIDAK PERNAH request tile di atas itu ke server.

**Perubahan kode:**
- `components/maps/KawasanMapInner.tsx` — `<TileLayer key={basemap} url={...} attribution={...} maxZoom={19} maxNativeZoom={18} />` (+1 baris). Catatan: TileLayer ini dipakai BERSAMA oleh basemap "Satelit" (Esri, butuh fallback ini) DAN "Peta" (OpenStreetMap, yang sebenarnya native mendukung z19 — jadi mode OSM akan sedikit "dikorbankan" ikut upscale juga meski sebenarnya tidak perlu; dampak minor, cuma sedikit lebih buram di mode OSM saat zoom 19, tidak fatal).
- `components/maps/PlotMapInner.tsx` — `<TileLayer url=".../World_Imagery/..." maxZoom={19} maxNativeZoom={18} />` (+1 baris). Selalu satelit, tidak ada isu OSM di sini.

**Verifikasi nyata (KEEMPAT kawasan, bukan cuma yang dilaporkan user):**
- Subak Selan Bawak: `map.getZoom()=19`, tile ter-request `/tile/18/137262/214941` (BUKAN z19), CSS size 512x512 (naturalWidth tetap 256 — dikonfirmasi upscale 2x, bukan placeholder).
- Subak Sangeh: sama, tile z18 di-request, upscale 512px.
- Kelompok tani Sri Galih: sama.
- Subak Timbul: sama — SEKALIAN dibuka visual tile z18-nya (foto rumah+pohon+jalan asli, BUKAN placeholder abu-abu).
- `npx tsc --noEmit`: 0 error baru (3 error pre-existing yang sama).

**Keputusan/catatan penting:** pelajaran untuk ke depan — **verifikasi "tile/gambar berhasil dimuat" TIDAK CUKUP cuma cek HTTP status + dimensi teknis** (keduanya bisa "sukses" untuk sebuah gambar placeholder/error yang valid secara format file). Untuk klaim "citra asli tersedia", WAJIB buka & lihat isi gambarnya langsung — ini pelajaran yang sama persis dengan disiplin CLAUDE.md §6 (jangan percaya "sudah dicek berhasil" tanpa bukti konkret yang benar-benar relevan dengan klaimnya).

**Status berikutnya:** Tidak ada lagi kawasan yang diketahui bermasalah. Kalau ke depan ada kawasan BARU di lokasi Bali lain yang KEBETULAN punya cakupan Esri z19 asli (mis. area lebih urban), `maxNativeZoom={18}` akan sedikit "menyia-nyiakan" potensi detail asli itu (selalu upscale dari 18) — trade-off yang disadari &amp; diterima demi kesederhanaan (1 setting global, tidak perlu cek per-kawasan). `update_owner.html` (root+public) diupdate dengan entri baru yang mengoreksi klaim "aman dinaikkan ke 19" dari changelog sebelumnya (catatan: perubahan maxZoom sesi A/B sendiri sebelumnya TIDAK dicatat di update_owner.html karena dianggap "perubahan teknis kecil" — keputusan itu sekarang terbukti kurang tepat, karena regresinya ternyata user-facing dan cukup besar; entri koreksi ini sekaligus jadi catatan pertama soal seluruh rangkaian perubahan maxZoom).

---

## [2026-07-23 (lanjutan 3)] — Investigasi overlap lahan lintas-kawasan (bukti nyata duplikasi) + spesifikasi "Semua Petak" + rencana Opsi D

**Konteks:** Sesi ini murni dokumentasi keputusan — TIDAK ADA kode aplikasi (app/, components/, lib/) yang disentuh sama sekali. Menyambungkan 2 hal: (1) investigasi read-only yang dijalankan sesi sebelumnya (sama hari ini, tidak sempat dicatat entri terpisah karena murni investigasi tanpa kode diubah — pola yang sama seperti investigasi cuaca/gap NBR sebelumnya), dan (2) 2 keputusan rencana kerja baru yang diambil setelah melihat hasil investigasi itu.

**Investigasi (dilakukan sesi sebelumnya, dicatat di sini untuk pertama kali):** Dugaan awal — kawasan "Subak Sangeh" dan "Kelompok tani Sri Galih" terlihat di area geografis yang sama persis dari peta, perlu dibuktikan apakah polygon individual di dalamnya benar-benar tumpang tindih. Metodologi: PostGIS dikonfirmasi aktif sejak awal (`migration_v1.sql` baris 12: `create extension if not exists postgis;`, kolom `geo_data geometry(Polygon, 4326)`). Karena akses langsung `SUPABASE_DB_URL` masih gagal (masalah lama, sudah tercatat), geometri diambil via REST (`v_plots`, sudah pakai `ST_AsGeoJSON`) lalu dihitung intersect/area-nya pakai turf.js (`@turf/boolean-intersects` + `@turf/intersect`, matematis setara `ST_Intersects`/`ST_Area(ST_Intersection(...))` untuk polygon planar sederhana) — library ini di-install SEMENTARA (`npm install --no-save`, 0 diff di `package.json`/`package-lock.json`, dikonfirmasi) dan di-uninstall lagi setelah selesai, script investigasi juga dihapus, tidak ada jejak permanen di repo.

**Hasil:** dari 11 petak Subak Sangeh × 23 petak Sri Galih (253 kombinasi dicek), 20 pasangan bersinggungan, **6 pasangan overlap >30%** — 1 di antaranya **100%** (petak "munduk jemeng" Sangeh vs "MJ37" Sri Galih), dan 4 lainnya di atas 90% ("Pan sinar"/"MM05" 97.1%, "I Nyoman sujana"/"MM09" 95.4%, "Men Lembug"/"MM 15" 93.7%, "I Nyoman Sujana"/"MM04" 93.6%), plus 1 di 75.7% ("Budidaya BSO 1"/"MM35"). **Bukti pendukung tambahan (tidak diminta, tapi memperkuat):** nama petani di pasangan-pasangan ini SALING COCOK secara tekstual — "I Nyoman Sujana"/"I Nyoman sujana" identik di kedua kawasan, "Men Lembug" vs "Ni Made Glembug", "Made sengger" vs "I Made Sengger" — pola nama berulang yang tidak mungkin kebetulan geometris murni.

**Kesimpulan investigasi:** overlap signifikan TERBUKTI ADA dan cukup dramatis (54% dari petak Sangeh punya pasangan overlap tinggi) — bukan kasus langka/batas. Sangat konsisten dengan dugaan: kedua kawasan mencakup sebagian besar lahan FISIK yang SAMA, dicatat dua kali lewat 2 alur pendataan berbeda (kemungkinan 2 pekaseh/pencatat berbeda yang tidak saling tahu).

**KEPUTUSAN 1 — Spesifikasi fitur "Semua Petak" (item sidebar dari rencana redesign 21 Juli, sebelumnya cuma disebut nama tanpa detail):** BUKAN tabel/daftar lintas-kawasan seperti dugaan awal — **PETA BESAR SE-BALI** menampilkan SEMUA petak dari SEMUA kawasan sekaligus (tidak dibatasi per-kawasan), dengan **filter Jenis Lahan** (Organik/Regenerative/Konversi/Konvensional/Belum Ditentukan) — reuse langsung `LAND_CATEGORY_COLORS` (`lib/plot-geo.ts`), tidak ada skema warna baru. Khusus role admin/Save Subak (konsisten keputusan role 19 Juli). Dikerjakan BARENGAN eksekusi redesign UI besar (bukan fitur terpisah), sama-sama menunggu pasca-Rikolto.

**KEPUTUSAN 2 — Implikasi &amp; rencana "Opsi D" (deteksi duplikasi lintas-kawasan):**
- **Implikasi langsung dari temuan investigasi:** rencana dashboard rangkuman "Total per Jenis Lahan" lintas-kawasan **TIDAK BOLEH dibangun** sebelum masalah duplikasi ditangani — perkiraan 25-30% dari total gabungan adalah duplikasi (dari kasus Sangeh+Sri Galih saja).
- **Rencana Opsi D (BELUM dieksekusi, ditunda pasca-Rikolto)** — pendekatan RINGAN, bukan otomatis hitung ulang total secara matematis presisi:
  1. Deteksi geometris: `ST_Intersects` + `ST_Area(ST_Intersection(...))` PostGIS, ambang awal >30% (terbukti bekerja di investigasi ini — menangkap 6 kandidat nyata tanpa banyak false-positive dari petak bertetangga; ambang final produksi mungkin dinaikkan ke 50-70%, didiskusikan lagi saat eksekusi).
  2. Hasil masuk "kotak tinjauan" — admin (Save Subak) MEMILIH MANUAL mana yang dihitung untuk total. **Kalau kategori Jenis Lahan berbeda antar-pasangan overlap, TIDAK ADA aturan otomatis "yang menang" — selalu "Perlu Ditinjau" untuk keputusan manual, TIDAK PERNAH otomatis pilih salah satu.**
  3. Keputusan admin tersimpan permanen — perhitungan total berikutnya otomatis konsisten.
  Perlu tabel/kolom baru (skema menyusul saat eksekusi, belum didesain).

**Dicatat juga di `docs/BRIEF_AgriMRV.md` bagian RIWAYAT KEPUTUSAN** (sesuai CLAUDE.md §4) — entri sama, ringkas, plus catatan silang ditambahkan ke entri redesign 21 Juli lama supaya tidak ada 2 sumber kebenaran beda soal "Semua Petak".

**Status:** murni keputusan rencana + hasil investigasi read-only. `update_owner.html` (root+public) diupdate dengan entri baru menjelaskan ketiga hal ini dalam bahasa awam, ditandai jelas BARU RENCANA/temuan, belum diimplementasi.

---

## [2026-07-24] — 🔴 BUG SERIUS: checklist Verra "Log AWD Tracker" hardcode `done: true` — lolos audit formula 19 Juli — FIXED + badge ketidakpastian ditambahkan

**Konteks:** Sesi sebelumnya (hari yang sama) menginvestigasi (read-only) laporan inkonsistensi: tab Musim Tanam menampilkan "Pola campuran — tidak cukup tegas, perlu konfirmasi lapangan" untuk sebuah musim tanam, TAPI tab Karbon di petak & musim yang SAMA menampilkan checklist Verra dengan ✓ hijau penuh percaya diri untuk "Log AWD Tracker" plus angka presisi (85 Hari Aerasi, 0.38 Ton CO2e) tanpa peringatan apapun. Investigasi itu mengonfirmasi kedua angka (Musim Tanam vs Karbon) berasal dari SATU fungsi/sumber yang sama (`fn_analyze_season_water_pattern`, di `docs/migration_v21_awd_intentionality.sql`) — bukan 2 sistem yang tidak sinkron — tapi menemukan 2 masalah berbeda:
1. **BUG NYATA (bukan cuma presentasi):** baris checklist "Log AWD Tracker (Satelit Radar VV)" di `components/plots/PlotDashboard.tsx` ternyata `done: true` — HARDCODE, tidak pernah mengecek data radar apapun. Ini SELALU tercentang hijau untuk SEMUA petak/musim, termasuk yang datanya kosong total.
2. **Masalah presentasi (bukan bug, tapi bisa menyesatkan):** kartu "Total Hari Aerasi"/"NET CO2e" menampilkan angka presisi tanpa indikasi visual bahwa angka itu ikut mewarisi ketidakpastian dari klasifikasi pola pengairan yang mendasarinya, kalau pola itu sendiri "borderline_ambiguous"/"insufficient_data".

**Kenapa bug #1 lolos dari audit formula 19 Juli 2026:** audit waktu itu memeriksa KEBENARAN MATEMATIS rumus (CO2e, NDVI, dst.) — tidak memeriksa apakah KONDISI TAMPILAN (checklist/badge) benar-benar terhubung ke data nyata. Sebuah kondisi `true` tetap tidak pernah "salah secara matematis" karena tidak menghitung apa-apa sama sekali — jenis bug ini secara struktural tidak akan pernah tertangkap oleh audit yang fokus ke rumus, hanya oleh audit yang secara eksplisit memeriksa setiap kondisi tampilan satu per satu.

**Fix diterapkan (TUGAS 1 &amp; 2, keduanya SUDAH tervalidasi):**
- `components/plots/PlotDashboard.tsx` ~baris 2098 — checklist "Log AWD Tracker" diubah dari `{ done: true, placeholder: false }` menjadi `{ done: (activeSeason?.water_pattern?.sar_points_used ?? 0) > 0, placeholder: (activeSeason?.water_pattern?.sar_points_used ?? 0) === 0 }` — sekarang genuinely mengecek apakah ada data radar SAR yang benar-benar dipakai untuk musim itu.
- `components/plots/PlotDashboard.tsx` — badge baru ditambahkan setelah grid kartu "Total Hari Aerasi"/"NET CO2e", tampil HANYA kalau `activeSeason?.water_pattern?.pattern_detected` adalah `'borderline_ambiguous'` atau `'insufficient_data'`, teks: "⚠️ Berdasarkan pola pengairan yang belum tegas — lihat tab Musim Tanam", reuse warna `WATER_PATTERN_LABEL.borderline_ambiguous` (bg `#eae6d9`, text `#6b6047`) supaya konsisten visual dengan badge yang sudah ada di tab Musim Tanam — TIDAK ada skema warna baru dibuat.
- **TIDAK DISENTUH sama sekali (dikonfirmasi):** `total_aeration_days`, `estimated_co2e_tonnes`, dan fungsi `fn_analyze_season_water_pattern` itu sendiri — `git status --short` mengonfirmasi `docs/migration_v21_awd_intentionality.sql` tetap `??` (untracked, tidak berubah), dan baris display angka (2065, 2086) dikonfirmasi byte-identik lewat grep.

**Verifikasi nyata (3 skenario, browser pane):**
1. Plot MM09 (kawasan `de5b6d6a-...`), musim dengan `pattern_detected: 'insufficient_data'`, `sar_points_used: 0` — badge peringatan MUNCUL, checklist "Log AWD Tracker" tampil ⏳ (bukan ✓ palsu lagi).
2. Plot "Regenerative/001" (kawasan `9af7dae3-72d4-4218-8b80-c7011b2722df`) — INI PERSIS plot/musim dari laporan bug awal (dikonfirmasi lewat teks halaman "85 Hari Kering"/"0.38 Ton CO2e" yang cocok persis), `pattern_detected: 'borderline_ambiguous'`, `sar_points_used: 28` — badge peringatan MUNCUL, checklist "Log AWD Tracker" tampil ✓ (kali ini GENUINE karena sar_points_used=28&gt;0, bukan hardcode).
3. Plot MM04 (kawasan `de5b6d6a-...`), `pattern_detected: 'oscillating_awd_like'`, `sar_points_used: 35` (menampilkan "69 Hari Kering", "0.21 Ton CO2e") — badge TIDAK muncul (benar, pola sudah jelas/yakin), checklist tetap ✓ genuine.
- `npx tsc --noEmit`: 3 error pre-existing yang sama, 0 error baru.
- `read_console_messages` (onlyErrors): 0 error setelah semua pengujian di atas.

**Keputusan/catatan penting:** ini ditandai severity TINGGI/KRITIS di `update_owner.html` (bukan entri bug biasa) karena checklist Verra VM0051 ini berpotensi ditunjukkan langsung ke auditor/partner (termasuk Rikolto) sebagai bukti kesiapan data — centang hijau yang ternyata tidak berarti apa-apa adalah risiko kredibilitas, bukan cuma bug kosmetik.

**REKOMENDASI EKSPLISIT UNTUK SESI BERIKUTNYA:** perlu audit MENYELURUH semua checklist/badge/indikator kondisi tampilan LAIN di seluruh aplikasi (bukan cuma yang di tab Karbon ini) untuk memastikan tidak ada `done`/kondisi lain yang ternyata hardcode serupa. Cara audit yang disarankan: grep untuk pola literal `done: true`, `: true,` yang tidak diikuti pemanggilan variabel/fungsi, di semua file yang merender checklist/badge/status (`components/plots/`, kemungkinan juga `components/kawasan/` kalau ada checklist serupa di level kawasan) — lalu untuk setiap yang ditemukan, verifikasi manual apakah nilainya benar-benar berasal dari pengecekan data nyata atau cuma nilai tetap yang "kebetulan selalu benar".

**Status berikutnya:** Fix TUGAS 1 &amp; 2 selesai &amp; tervalidasi. `update_owner.html` (root+public, byte-identik dikonfirmasi) diupdate dengan entri `severity: 'danger'` terpisah dari entri bug biasa. Audit menyeluruh checklist/badge lain (rekomendasi di atas) BELUM dikerjakan — ini kandidat kuat untuk sesi berikutnya.

---

## [2026-07-25 13:43] — 🔴 BUG KRITIS: `resx`/`resy=10` Sentinel Hub dibaca "10 derajat" bukan "10 meter" — SEMUA data historis sejak 2023 cuma 1 sample pixel per scan — FIXED (4 lokasi) + 1 plot direprocess & divalidasi

**Konteks:** User menemukan bug serius — evalscript Sentinel Hub Statistical API dipanggil dengan `resx: 10, resy: 10` sambil CRS request di-set `EPSG:4326` (derajat lon/lat, BUKAN meter). Karena Statistical API menginterpretasikan `resx`/`resy` dalam satuan CRS yang dipakai, angka `10` di sini terbaca sebagai **"10 derajat" (~1.100 km)**, bukan 10 meter. Untuk polygon petak sawah yang rata-rata jauh di bawah 1 ha, ini berarti SELURUH polygon jatuh di dalam 1 pixel raksasa — setiap scan NDVI/NDWI/NBR/cloud_cover selama ini cuma dapat **1 sample pixel**, bukan rata-rata puluhan pixel asli di seluruh area petak. Bug ini menyentuh SEMUA data historis sejak awal project (2023) karena ada di kode sejak awal, tidak pernah diketahui sampai sekarang.

**TUGAS 1 — Keamanan reprocess (investigasi SEBELUM menyentuh data apapun):**
- Dicek langsung logika INSERT/UPSERT di `app/api/plots/[plotId]/baseline/route.ts` — baris 191-193: `.from('satellite_logs').upsert(logsToInsert, { onConflict: 'plot_id,scan_date' })`.
- Dikonfirmasi lewat `docs/migration_v1.sql` baris 66: tabel `satellite_logs` punya `unique(plot_id, scan_date)` sejak skema AWAL project — dicek juga semua migration yang menyentuh `satellite_logs` setelahnya (v10 SAR columns, v16 NBR) HANYA `ALTER TABLE ADD COLUMN`, tidak ada yang men-drop constraint ini.
- **Kesimpulan: AMAN dijalankan berulang.** Upsert dengan `onConflict` yang match constraint unique yang benar-benar ada di database — menjalankan "Tarik Data Baseline Satelit" 2x untuk plot yang sama akan MENIMPA baris `scan_date` yang sama, BUKAN membuat duplikat.

**TUGAS 2 — Perbaikan `resx`/`resy` (untuk scan BARU ke depan):**
- **Pendekatan yang dipilih:** tetap pakai geometry & CRS `EPSG:4326` (TIDAK reproyeksi ke UTM — reproyeksi polygon butuh library tambahan seperti proj4 yang menambah risiko bug baru lebih besar daripada manfaatnya untuk area sekecil ini). Sebagai gantinya, `resx`/`resy` diganti jadi nilai DERAJAT presisi yang setara ~10 meter di lintang Bali, dihitung dari formula panjang derajat lintang/bujur WGS84 (Snyder) pada lintang representatif 8.5°S (Bali membentang -8.05° s/d -8.85°, variasi cos(lat) antar titik <0.15% — 1 konstanta cukup akurat untuk seluruh wilayah project):
  - panjang 1° lintang @ 8.5°S ≈ 110.598,5 m → `resy = 10 / 110598.5 = 0.00009042`
  - panjang 1° bujur @ 8.5°S ≈ 110.104,9 m → `resx = 10 / 110104.9 = 0.00009083`
- Konstanta disatukan di file baru `lib/sentinel-hub/resolution.ts` (`SENTINEL_RESX_DEG_10M_BALI`, `SENTINEL_RESY_DEG_10M_BALI`) — supaya tidak di-copy-paste manual ke tiap file (persis pola yang membuat bug ini luput lama: 4 salinan kode yang mestinya identik, tidak ada 1 sumber kebenaran).
- **4 lokasi diperbaiki** (BUKAN 3 yang awalnya diketahui user — ditemukan 1 lokasi tambahan lewat audit Tugas 4):
  1. `lib/sentinel-hub/ndvi.ts`
  2. `lib/sentinel-hub/ndwi.ts` — **TIDAK ADA di daftar awal user**, ditemukan saat audit karena dipanggil `app/api/cron/satellite-scan/route.ts` (cron harian jam 01:00 UTC via Vercel Cron) — artinya bug ini AKTIF BERJALAN OTOMATIS SETIAP HARI untuk NDWI sampai fix ini, terpisah dari 2 endpoint manual di bawah.
  3. `app/api/plots/[plotId]/baseline/route.ts`
  4. `app/api/plots/[plotId]/scan/route.ts`
- **Verifikasi nyata (bukan asumsi)** — request langsung ke Sentinel Hub Statistical API untuk polygon Budidaya BSO, tanggal 2023-12-23, evalscript NDVI:
  - `resx=10, resy=10` (bug lama): `sampleCount: 1`, `mean: 0.0844`
  - `resx=0.00009083, resy=0.00009042` (fix): `sampleCount: 45`, `mean: 0.4106`, `stDev: 0.127`
  - Sesuai perkiraan investigasi sebelumnya (bukti 40-pixel) — sekarang genuinely rata-rata puluhan pixel, bukan 1.

**TUGAS 3 — Uji reprocess 1 plot (Budidaya BSO, `0032c36a-4cea-4590-8802-52fbead2563c`):**
- Dev server dijalankan lokal, endpoint `POST /api/plots/0032c36a-4cea-4590-8802-52fbead2563c/baseline` dipanggil langsung (kode produksi asli, bukan simulasi) — respons: `"Berhasil menarik 473 data satelit ASLI... "`.
- **Perbandingan before/after nyata dari database** untuk tanggal 2023-12-23 (contoh kasus yang sama dari investigasi sebelumnya):

  | | NDVI | NDWI | NBR | cloud% | estimated_phase |
  |---|---|---|---|---|---|
  | SEBELUM | 0.0844 | -0.0832 | -0.0745 | 0% | **kosong** (lahan kosong) |
  | SESUDAH | 0.4106 | -0.4021 | 0.3334 | 0% | **pematangan** (siap panen) |

  Perbedaan klasifikasi fase EKSTREM — sistem sebelumnya melaporkan lahan kosong padahal padi sudah di fase pematangan/siap panen. Total baris tetap 473→473 (upsert bekerja seperti diharapkan, tidak ada duplikasi baris baru).

**TUGAS 4 — Audit lebih luas (SEMUA read-only, sesuai instruksi user — tidak ada kode diubah untuk bagian ini):**
1. **`lib/sentinel-hub/ndwi.ts`** — bug identik ditemukan &amp; DIPERBAIKI (masuk hitungan 4 lokasi Tugas 2 di atas, bukan cuma temuan pasif — karena aktif jalan tiap hari lewat cron, ditangani sekaligus).
2. **`test-nbr.ts`** (script dev/debug standalone, root project) — punya pola bug identik (`resx: 10, resy: 10` @ EPSG:4326), TAPI tidak pernah menulis ke database (murni buat cek manual via console.log) — **TIDAK diperbaiki** (di luar scope "tidak ubah apapun" Tugas 4, dan tidak ada dampak data), cukup dicatat di sini untuk kesadaran kalau dipakai lagi ke depan.
3. **`lib/sentinel-hub/sar.ts`** (fetch SAR Sentinel-1) — pola BEDA: TIDAK set `resx`/`resy` SAMA SEKALI (juga tidak set `bounds.properties.crs`). Diuji langsung ke API: tanpa resx/resy, Sentinel Hub default ke grid 256×256 pixel (`sampleCount: 65536`) terlepas dari ukuran fisik polygon — untuk plot 0.4ha ini jauh lebih halus dari resolusi asli Sentinel-1 (~10m, harusnya ±40 pixel). **Dites apakah ini mempengaruhi nilai mean secara signifikan:** dibandingkan mean VV/VH dengan vs tanpa `resx`/`resy` eksplisit ~10m — bedanya kecil (~1-3%, konsisten resampling/interpolasi, BUKAN kesalahan lokasi/skala seperti bug NDVI). **Kesimpulan: bukan bug separah resx/resy=10, tapi tetap inkonsistensi desain** (mengandalkan default API yang tidak terdokumentasi jelas, beda pola dari fetch NDVI/NDWI yang eksplisit) — **direkomendasikan** ditambah `resx`/`resy` eksplisit juga untuk konsistensi &amp; menghindari ketergantungan ke default API yang bisa berubah, TAPI ini bukan urgensi kritis seperti Tugas 2.
4. **`lib/sentinel-hub/nbr.ts`, `lib/sentinel-hub/truecolor.ts`** — pakai Process API (bukan Statistical API) dengan `width`/`height` piksel (256×256), bukan `resx`/`resy` — parameterisasi berbeda yang TIDAK rentan bug unit derajat/meter yang sama (cuma menentukan resolusi gambar output, sudah didokumentasikan trade-off-nya di komentar file masing-masing sejak sebelumnya).
5. **Area (`area_ha`) &amp; perhitungan geometri lain** — dicek SEMUA pemakaian PostGIS di seluruh migration SQL (`ST_SetSRID`, `ST_GeomFromGeoJSON`, `ST_AsGeoJSON`) — HANYA dipakai untuk simpan/konversi geometri (SRID 4326 benar), **TIDAK ADA** `ST_Area`/`ST_Distance`/`ST_Buffer`/`geography` dipakai di manapun (jadi tidak ada risiko "luas dalam derajat persegi" seperti dikhawatirkan). `area_ha` sendiri: (a) saat insert plot baru — nilai input manual/dari `@turf/area` di frontend (`components/maps/KawasanMapInner.tsx`, `PlotMapInner.tsx`, baris ~90 &amp; ~62 — `@turf/area` menghitung luas geodesik yang BENAR dari GeoJSON lon/lat, bukan matematika derajat naif), disimpan sebagai kolom biasa; (b) TIDAK PERNAH dihitung ulang dari geometri via PostGIS di database. **Kesimpulan: bersih, tidak ada bug serupa di perhitungan luas/jarak.**
6. **Pola hardcode `done: true` serupa temuan 24 Juli** — grep menyeluruh `components/**/*.tsx` untuk pola `done:`/`completed:`/`verified:`/dll: hanya 1 hit lain di luar yang sudah diperbaiki 24 Juli — `PlotDashboard.tsx:2112`, checklist "Pelacakan Poligon" `done: true`. **Diverifikasi bukan bug**: `geo_data` adalah kolom `not null` di tabel `plots` sejak `migration_v1.sql` baris 44 — sebuah plot secara struktural TIDAK BISA ada tanpa polygon, jadi `done: true` di sini genuinely selalu benar (beda dari kasus "Log AWD Tracker" 24 Juli yang hardcode padahal datanya BISA kosong). Menutup rekomendasi audit menyeluruh yang tercatat di entri 24 Juli di atas.

- `npx tsc --noEmit`: 3 error pre-existing yang sama (tidak terkait file yang diubah sesi ini — `PlotMapInner.tsx`, `PlotDashboard.tsx`, `test-nbr.ts`, sudah ada sebelum sesi ini mulai), 0 error baru.

**Keputusan/catatan penting:** dicatat juga di `docs/BRIEF_AgriMRV.md` bagian RIWAYAT KEPUTUSAN (sesuai CLAUDE.md §4) — termasuk alasan kenapa pendekatan "konstanta derajat tetap" dipilih dibanding reproyeksi UTM (risiko lebih rendah untuk cakupan geografis project ini yang sempit/lokal Bali).

**Status berikutnya (severity TINGGI/KRITIS — REKOMENDASI EKSPLISIT):**
- **AMAN lanjut reprocess plot lain** — Tugas 1 mengonfirmasi upsert idempotent, Tugas 3 membuktikan fix bekerja dengan bukti nyata di 1 plot. TIDAK ada blocker teknis untuk reprocess plot berikutnya.
- **BELUM direkomendasikan reprocess SEMUA plot sekaligus tanpa sepengetahuan user** — mengingat skala dampak (SEMUA data historis sejak 2023, kemungkinan mengubah banyak `estimated_phase` secara dramatis seperti contoh Budidaya BSO), keputusan KAPAN &amp; BAGAIMANA reprocess massal (satu per satu dengan review, atau sekaligus semua) sebaiknya keputusan eksplisit user, bukan otomatis dieksekusi sesi ini — terutama karena reprocess akan MENGUBAH riwayat NDVI/fase yang mungkin sudah pernah ditunjukkan ke pihak lain (Rikolto dll).
- Rekomendasi tambahan (non-urgent): tambah `resx`/`resy` eksplisit di `sar.ts` untuk konsistensi (temuan Tugas 4 poin 3).
- `update_owner.html` (root+public) diupdate dengan entri severity KRITIS, bahasa awam, sesuai CLAUDE.md §9.

---

## [2026-07-25 14:32] — Reprocess kawasan "Kelompok tani Sri Galih" (23 petak) pakai fix resx/resy — Subak Sangeh SENGAJA dilewati (ditangani user terpisah)

**Konteks:** Lanjutan langsung dari entri fix resx/resy di atas (sesi sebelumnya, hari yang sama). User secara eksplisit meminta reprocess kawasan "Kelompok tani Sri Galih" (`de5b6d6a-bad0-4da7-8034-e7a6c6bd49da`), BUKAN kawasan "Subak Sangeh" — kawasan itu rencananya akan dihapus &amp; diulang manual oleh user sendiri, jadi SENGAJA tidak disentuh sesi ini (termasuk "Budidaya BSO" yang sudah selesai kemarin, dibiarkan apa adanya).

**TUGAS 0 — Konfirmasi bug sama ada di kawasan ini (SEBELUM reprocess apapun):**
- Cek agregat `cloud_cover_percent` untuk SEMUA 23 petak: dari 948 baris terisi, distinct value HANYA `[0, 100]` — persis pola biner yang jadi ciri khas bug 1-pixel (sama seperti temuan Budidaya BSO kemarin).
- Verifikasi langsung ke Sentinel Hub API untuk 1 petak sampel (MM04/I Made Sengger, tanggal 2023-08-10): `resx=10,resy=10` (bug lama) → `sampleCount=1`; `resx=0.00009083,resy=0.00009042` (fix) → `sampleCount=26`. **Konfirmasi: kawasan ini kena bug identik.**
- **Temuan tambahan penting:** dari 23 petak, cuma 4 yang PERNAH punya histori data optik lengkap sebelumnya (MJ31, MM15/Ni Made Glembug, MM04/I Made Sengger, MM05 — masing-masing 474 baris, ditarik dulu pakai kode lama yang buggy). 19 petak lainnya cuma punya 0-3 baris (SAR-only dari cron harian, NDVI/NDWI belum pernah ditarik sama sekali) — jadi buat 19 petak ini, operasi hari ini SECARA FAKTUAL adalah "tarik data pertama kali" (data baru, bukan data lama yang diganti), bukan "reprocess" dalam arti sempit.

**TUGAS 1 — Estimasi kuota (sebelum eksekusi):**
- 23 petak terkonfirmasi (sesuai perkiraan user). Total luas gabungan: 6,058 ha (0,06 km²).
- Referensi dari `docs/Architecture_Review_SINAGRI.md`: baseline 1x = 5 request Sentinel Hub/petak (3 statistik NDVI/NDWI/NBR + 2 SAR ascending/descending) → 23 × 5 = **115 request**, cuma 0,38% dari kuota gratis 30.000 request/bulan.
- Referensi luas dari `docs/BRIEF_AgriMRV.md`: 413 km²/tahun ≈ 886 Processing Unit — luas kawasan ini (0,06 km²) jauh di bawah skala itu.
- **Kesimpulan: risiko RENDAH, dilanjutkan tanpa STOP** (sesuai kondisi yang ditetapkan user sendiri: STOP hanya kalau "berisiko besar").

**TUGAS 2 — Reprocess 23 petak (satu per satu, TIDAK paralel):**
- **Insiden operasional (bukan bug kode, murni infra dev-server):** batch pertama crash setelah 1 petak (MJ07) — dev server Turbopack/Jest-worker pool mati ("Jest worker encountered 2 child process exceptions"). Server lama (proses peninggalan sesi kemarin yang ternyata belum benar-benar mati meski sempat di-`TaskStop`) di-kill paksa, server baru dinyalakan bersih. Batch kedua (7 petak lagi) sukses lalu kena **429 Too Many Requests** dari Sentinel Hub (rate limit per-detik, BEDA dari kuota bulanan di Tugas 1) mulai petak ke-9 — dihentikan, tunggu 30 detik, lanjut batch ketiga dengan jeda 15 detik/petak → SEMUA 15 petak sisanya sukses.
- **Hasil akhir: 23/23 petak berhasil direprocess.**

**TUGAS 3 — Recompute `fn_analyze_season_water_pattern`:**
- Ditemukan 4 musim tanam aktif/panen di kawasan ini yang plotnya baru direprocess: MM15/Ni Made Glembug, MM04/I Made Sengger, MM09/I Wayan Sentana, MM18/I Wayan Budiartha.
- RPC `fn_analyze_season_water_pattern(p_season_id)` dipanggil untuk keempatnya — semua sukses (upsert ke `season_water_pattern_analysis`, kolom `planting_season_id`). **Catatan jujur:** state "sebelum recompute" gagal terekam karena salah nama kolom di script verifikasi pertama (`season_id` vs `planting_season_id` yang benar) — RPC-nya sendiri sudah terlanjur sukses jalan sebelum kesalahan ketahuan, jadi tabel perbandingan before/after untuk metrik AWD/CO2e turunan ini TIDAK bisa ditampilkan (beda dari before/after NDVI/NDWI/NBR mentah yang lengkap terekam). Nilai SESUDAH recompute dikonfirmasi tersimpan &amp; konsisten dengan data satelit yang sudah diperbaiki.

**Verifikasi keamanan upsert (Tugas 1 sesi kemarin, dibuktikan lagi di sini):**
- 4 petak yang SUDAH punya 474 baris lama: tetap 474 baris sesudah reprocess (TIDAK bertambah — upsert menimpa, bukan duplikat).
- 19 petak yang cuma 0-3 baris: naik ke 473-474 baris (data BARU terisi, bukan duplikasi — wajar untuk first-time pull).
- `cloud_cover_percent` sesudah fix: 236 nilai unik (dari sebelumnya cuma 2 nilai [0,100]) — bukti tidak langsung tambahan bahwa sampling multi-pixel benar-benar jalan di seluruh kawasan.

**Perubahan signifikan yang di-highlight (4 petak reprocess sungguhan):**
- MJ31: 22/237 baris comparable berubah fase (9,3%) — dominan pergeseran generatif↔pematangan.
- **MM15/Ni Made Glembug: 46/237 (19,4%) — PALING BANYAK berubah** di antara 4 petak ini.
- MM04/I Made Sengger: 12/237 (5,1%) — termasuk 3 tanggal lompat EKSTREM 2 tahap (semai→pematangan): 2023-10-19, 2023-11-08, 2023-12-23.
- MM05: 13/237 (5,5%) — juga 3 tanggal lompat ekstrem serupa (semai→pematangan): 2023-11-08, 2023-12-23, 2024-05-21.
- Tidak ada kasus "kosong→pematangan" se-ekstrem Budidaya BSO kemarin di 4 petak ini — mayoritas transisi antar-tahap yang berdekatan, TAPI pola semai→pematangan (lompat signifikan, radar mendeteksi tanaman jauh lebih matang dari yang tercatat sebelumnya) muncul berulang di MM04 &amp; MM05.

**Verifikasi Subak Sangeh TIDAK tersentuh (dibuktikan lewat query, bukan asumsi):**
- Dicek `created_at` semua baris `satellite_logs` di SELURUH kawasan Subak Sangeh (termasuk Budidaya BSO) — 0 baris baru/diupdate sejak jam 05:30 UTC hari ini (yaitu SEBELUM sesi Sri Galih ini dimulai).
- **Koreksi kecil ke laporan sesi sebelumnya:** total baris Budidaya BSO dilaporkan kemarin "tetap 473" — ternyata setelah dicek ulang sekarang, angka sebenarnya 475. Ini BUKAN duplikasi (dikonfirmasi tidak ada baris baru dibuat sejak sesi kemarin berakhir) — selisihnya berasal dari sifat window bergulir 1095-hari (dihitung relatif ke waktu request, sehingga tanggal tepi window bisa geser 1-2 hari antar pemanggilan berbeda). Klaim "473→473" kemarin adalah kesimpulan yang TIDAK diverifikasi langsung dari angka final (cuma dari pesan API, bukan query ulang) — dikoreksi di sini sesuai CLAUDE.md §6 (poin 2: akui eksplisit kalau klaim sebelumnya tidak lengkap/kurang tepat, jangan menimpali diam-diam).

- `npx tsc --noEmit`: 3 error pre-existing yang sama (tidak ada kode diubah sesi ini — murni operasi data), 0 error baru.

**Status berikutnya:** Kawasan Sri Galih (23 petak) selesai direprocess &amp; divalidasi. Kawasan Subak Sangeh SENGAJA menunggu penanganan manual user (rencana hapus &amp; ulang). Kawasan-kawasan lain di luar Sri Galih &amp; Sangeh BELUM diproses — masih menunggu keputusan/arahan user berikutnya kawasan mana selanjutnya. `update_owner.html` (root+public) diupdate dengan entri progress baru.

---

## [2026-07-25 14:45] — RENCANA (belum dibuat): fitur "Import dari KML" bulk-tambah petak + deteksi collision 2 lapis — "cicilan pertama" Opsi D

**Konteks:** Sesi ini MURNI DOKUMENTASI — TIDAK ADA kode aplikasi (app/, components/, lib/) yang disentuh sama sekali. Reprocess bug resx/resy (lihat 2 entri di atas) masih prioritas kerja utama saat ini; fitur ini dicatat dulu sebagai spesifikasi yang disepakati, menyusul urutan prioritas di poin "Status" di bawah.

**Spesifikasi yang disepakati:**

1. **Lokasi fitur:** tombol "Import dari KML" di halaman kawasan, sejajar dengan tombol "+ Gambar Polygon Baru" yang sudah ada. **BUKAN** membuat kawasan baru otomatis dari upload — user harus sudah berada di 1 kawasan tujuan dulu sebelum import.

2. **Alur:** user upload file `.kml` → sistem parse jadi GeoJSON (pakai library standar seperti `togeojson`) → tampilkan HALAMAN PREVIEW di peta (semua polygon yang terbaca, dengan nama dari tag `<name>` KML sebagai usulan nama petani) → user review → user konfirmasi → baru benar-benar tersimpan (panggil `insert_plot` untuk tiap polygon, RPC yang sudah ada sejak `migration_v3_rpc_functions.sql`).

3. **Deteksi collision 2 lapis, di tahap PREVIEW (sebelum simpan apapun):**
   - **Lapis 1 — Internal (dalam file yang sama):** bandingkan semua polygon DALAM 1 file yang sama satu-sama-lain, pakai metode overlap &gt;30% yang SUDAH divalidasi bekerja (`@turf/boolean-intersects` + `@turf/intersect`, metodologi sama persis dengan investigasi duplikasi lahan 23 Juli 2026 — lihat entri PROJECT_LOG 23 Juli &amp; BRIEF_AgriMRV.md). Kalau ada pasangan overlap → tampilkan peringatan di preview: "Polygon [nama A] dan [nama B] dalam file ini tumpang tindih [X]% — mungkin duplikat, cek dulu."
   - **Lapis 2 — Eksternal (vs database):** bandingkan SETIAP polygon baru terhadap SEMUA petak yang SUDAH ADA di database — **LINTAS SEMUA kawasan**, bukan cuma kawasan tujuan import, metode sama. Kalau overlap signifikan ditemukan → peringatan spesifik: "Polygon [nama] ini [X]% tumpang tindih dengan petak [nama] yang sudah ada di kawasan [nama kawasan lain] — [opsi: Tetap Import / Lewati Polygon Ini]."

4. **Hubungan dengan Opsi D (rencana 23 Juli 2026):** fitur ini adalah **"cicilan pertama"** dari Opsi D (deteksi duplikasi lahan lintas-kawasan) yang sudah direncanakan sebelumnya — scope-nya LEBIH KECIL dari Opsi D penuh (yang mencakup peninjauan SEMUA data existing yang sudah kadung dobel). Fitur ini HANYA mencegah duplikat BARU masuk lewat jalur import KML ke depan — **TIDAK menyelesaikan** duplikat yang SUDAH ada di database sekarang (kasus Subak Sangeh vs Kelompok tani Sri Galih yang ditemukan 23 Juli tetap PR Opsi D terpisah, belum tersentuh oleh fitur ini).

5. **Urutan prioritas &amp; timing (disepakati eksplisit, BUKAN ditunda ke pasca-Rikolto seperti fitur besar lainnya):**
   (a) selesaikan reprocess bug resx/resy ke SEMUA kawasan dulu (sedang berjalan — Sri Galih selesai 25 Juli, Sangeh menunggu user, kawasan lain belum diproses),
   (b) baru bangun fitur Import KML ini —
   **keduanya harus selesai SEBELUM Rikolto**, beda dari redesign UI besar &amp; fitur "Semua Petak"/Opsi D penuh yang tetap ditunda pasca-Rikolto.

**Status:** BELUM diimplementasi sama sekali — murni spesifikasi/kesepakatan tertulis. Dicatat juga di `docs/BRIEF_AgriMRV.md` bagian RIWAYAT KEPUTUSAN (sesuai CLAUDE.md §4). `update_owner.html` (root+public) diupdate dengan entri baru, ditandai jelas sebagai rencana (belum ada di aplikasi).

**Validasi sesi ini:** dikonfirmasi tidak ada file di `app/`, `components/`, atau `lib/` yang tersentuh — `git status --short` sesudah sesi ini hanya menunjukkan perubahan di 3 file dokumentasi (`docs/PROJECT_LOG.md`, `docs/BRIEF_AgriMRV.md`, `update_owner.html`/`public/update_owner.html`).

**Status berikutnya:** lanjutkan reprocess resx/resy ke kawasan-kawasan lain (di luar Sri Galih &amp; Sangeh) sesuai arahan user berikutnya. Implementasi Import KML menyusul setelah semua kawasan selesai direprocess.

---

## [2026-07-25 15:21] — Fitur "Import dari KML" SELESAI diimplementasi (sebelumnya rencana di entri 14:45) — deteksi collision 2 lapis terverifikasi bukti nyata

**Konteks:** Lanjutan langsung dari entri spesifikasi 25 Juli 14:45 di atas. Fitur diimplementasikan penuh sesuai spesifikasi yang disepakati — bukan cuma rencana lagi.

**File baru:**
- `lib/collision-detection.ts` (112 baris) — fungsi `overlapPercent()` generik (`@turf/boolean-intersects` untuk cek cepat + `@turf/intersect` + `@turf/area` untuk persentase presisi, ambang 30%) — metodologi SAMA PERSIS dengan investigasi duplikasi lahan 23 Juli 2026, dipakai ulang lewat 1 fungsi bersama untuk Lapis 1 (`findInternalCollisions`) &amp; Lapis 2 (`findExternalCollisions`), BUKAN ditulis ulang dari nol untuk tiap lapis.
- `lib/kml-parser.ts` (104 baris) — `parseKmlText()` pakai `@tmcw/togeojson` + `DOMParser` bawaan browser (client-only, tidak diimpor di server). Menangani: (a) fallback nama non-standar tag `<n>` (di luar skema KML resmi, togeojson tidak mengenalinya) — HANYA dipakai kalau jumlah `<Placemark>` cocok persis jumlah polygon hasil parse, supaya tidak salah pasang nama di file berstruktur kompleks; (b) `MultiPolygon` dipecah jadi beberapa petak terpisah (skema `geo_data` cuma dukung `Polygon` tunggal — `migration_v1.sql` baris 44); (c) `stripZ()` membuang koordinat altitude KML (3D "lon,lat,alt") supaya tidak bentrok dengan kolom `geometry(Polygon,4326)` yang 2D murni.
- `app/api/kml-import/check-collisions/route.ts` (54 baris) — endpoint POST yang jalankan KEDUA lapis collision sekaligus server-side (butuh akses `v_plots` + `kawasan` lintas SEMUA kawasan untuk Lapis 2, jadi tidak masuk akal dilakukan client-side).

**File diubah:**
- `components/kawasan/KmlImportModal.tsx` (343 baris, komponen baru) — tombol "📥 Import dari KML" + modal preview (peta Leaflet mini menampilkan semua polygon berwarna sesuai status collision + list petak dengan nama bisa diedit, checkbox, badge peringatan per-collision, tombol "Tetap Import"/"Lewati Polygon Ini") + alur simpan satu-per-satu dengan laporan hasil per-polygon.
- `components/maps/KawasanMapInner.tsx` — tombol `KmlImportModal` ditambahkan SEJAJAR "+ Gambar Polygon Baru" (sama seperti spesifikasi); fungsi refresh-plot-dari-server yang sebelumnya inline di `handleSave` diekstrak jadi `refreshPlotsFromServer()` supaya bisa dipakai ulang oleh callback `onImported` dari modal KML — bukan ditulis dobel.
- `package.json` — 3 dependency baru: `@tmcw/togeojson@7.1.2`, `@turf/intersect@7.3.5`, `@turf/boolean-intersects@7.3.5` (SEMUA dari `npm install` asli user via `!`, bukan diedit manual — sempat 2x gagal karena permission Bash saya sendiri diblokir, akhirnya user yang jalankan langsung).

**TUGAS 4 — Simpan ke database:** dikonfirmasi memakai endpoint `POST /api/plots` yang SUDAH ADA (yang memanggil RPC `insert_plot`) — TIDAK membuat cara simpan baru. Proses satu-per-satu (bukan bulk), tiap hasil (berhasil/gagal) dilaporkan terpisah di UI.

**Validasi nyata (bukan asumsi) — dibagi per lapisan karena tidak ada chromium-cli/Playwright di environment lokal ini untuk drive browser (dikonfirmasi ke user, disepakati: bagian logic diverifikasi lewat Node/curl langsung, bagian UI klik-demi-klik diserahkan ke tes manual user):**

1. **Logic collision murni** (Node, tanpa DOM) — 4 polygon test dibuat: 1 duplikat PERSIS geometri petak asli "MJ07" (Sri Galih), 2 polygon di area kosong saling overlap 50% by design, 1 polygon bersih di area kosong lain.
   - Duplikat MJ07 vs MJ07 asli: **100%** (harusnya tinggi) ✅
   - Internal A vs Internal B: **50%** (sesuai perhitungan manual: overlap 0.0008°/0.0016° lebar) ✅
   - Bersih vs semua yang lain: **0%** (3 kombinasi dicek) ✅

2. **API route nyata** (`curl` ke `http://localhost:3000/api/kml-import/check-collisions`, database produksi asli, bukan mock) — 4 polygon yang SAMA dikirim sebagai payload:
   - kml-1 (duplikat MJ07): `external: [{plotId: MJ07, kawasanName: "Kelompok tani Sri Galih", percent: 100}]`, `internal: []` — **Lapis 2 (eksternal, lintas-kawasan) terbukti bekerja, termasuk resolve nama kawasan yang benar.**
   - kml-2 &amp; kml-3 (Internal A/B): saling terdeteksi `internal` 50%, `external: []` — **Lapis 1 (internal, dalam file yang sama) terbukti bekerja, tidak salah tangkap sebagai eksternal.**
   - kml-4 (Bersih): `internal: []`, `external: []` — **tidak ada false-positive.**

3. **Simpan ke database nyata** — `POST /api/plots` dipanggil langsung dengan geometry polygon "Bersih" (tanpa collision) → berhasil (`{id: "4fa700db-..."}`) → diverifikasi ulang lewat query `v_plots`: geometry tersimpan PERSIS 2D (altitude KML sudah terbuang benar oleh `stripZ()`), nama tersimpan di `farmer_name`/`nama_penggarap`/`nama_pemilik` sesuai alur `POST /api/plots` yang sudah ada. Data test dihapus lagi setelah verifikasi (`DELETE FROM plots`) — tidak ada jejak permanen di database produksi.

4. **UI klik-demi-klik (upload file asli → preview → konfirmasi) — BELUM divalidasi otomatis oleh Claude Code**, diserahkan ke tes manual user. File test tersedia di `scripts/test-import-sample.kml` (4 polygon yang SAMA seperti tes di atas — 1 tag `<name>` duplikat MJ07 buat tes eksternal, 2 polygon area kosong saling tumpang tindih buat tes internal — salah satunya SENGAJA pakai tag non-standar `<n>` buat tes fallback nama, 1 polygon bersih).

- `npx tsc --noEmit`: 3 error pre-existing yang sama (tidak terkait file yang diubah/dibuat sesi ini), 0 error baru.
- `npx eslint` pada semua file baru/diubah: 2 error ditemukan di `KawasanMapInner.tsx` — DIKONFIRMASI keduanya pre-existing (baris 58 `any` type di `GeomanController`, baris 415 `setState` dalam `useEffect` di logic boundary Nominatim) — TIDAK ada di baris yang saya tambahkan, dicek lewat `git diff` untuk pastikan.

**Keputusan/catatan penting:** deteksi collision ini SENGAJA cuma dipakai di jalur import KML — TIDAK dipasang di alur "+ Gambar Polygon Baru" manual maupun di tempat lain manapun (sesuai instruksi eksplisit: "Opsi D" penuh, termasuk peninjauan duplikat yang SUDAH ada di database, tetap PR terpisah yang belum dikerjakan).

**Status berikutnya:** fitur SELESAI diimplementasi &amp; siap dites manual oleh user (dev server sudah berjalan di `localhost:3000`, tidak dimatikan sengaja supaya bisa langsung dites). Setelah user konfirmasi hasil tes manual UI, `update_owner.html` sudah diupdate statusnya dari "rencana" jadi "sudah dibuat" (lihat entri terkait). Reprocess resx/resy ke kawasan lain (di luar Sri Galih &amp; Sangeh) masih menunggu arahan terpisah.

---

## [2026-07-25 17:20] — Audit kerapian kode Import KML (4 fix diterapkan, behavior tidak berubah) + cek data kawasan "Regenerative" (1 petak lama masih pakai bug resx/resy, 19 petak baru dari KML belum ditarik)

**Konteks:** 2 tugas terpisah. Tugas 1: audit kerapian kode fitur Import KML menjelang refactor besar (kesepakatan sebelumnya soal kerapian kode). Tugas 2: cek kawasan "Regenerative" (`9af7dae3-72d4-4218-8b80-c7011b2722df`) yang ternyata SUDAH diisi 20 petak baru oleh user via fitur Import KML sungguhan (bukan cuma tes sintetis saya) — dikonfirmasi dari timestamp `created_at` (2026-07-25 07:29-07:32 UTC, persis setelah fitur selesai dibangun sesi sebelumnya).

**TUGAS 1 — Audit &amp; fix (detail lengkap di laporan sesi, ringkas di sini):**
1. Sisa console.log: BERSIH, tidak ada.
2. Duplikasi logic: DITEMUKAN &amp; DIPERBAIKI — `components/kawasan/KmlImportModal.tsx` sebelumnya mendefinisikan ulang `CollisionMatch`/`ExternalCollisionMatch`/`CollisionResult` sendiri padahal bentuknya identik dengan yang sudah diekspor `lib/collision-detection.ts`. Fix: tambah `PolygonCollisionResult` di `lib/collision-detection.ts`, modal &amp; API route sekarang import tipe yang sama, bukan definisi dobel.
3. Type safety: BERSIH, tidak ada `any` eksplisit di 4 file baru. TAPI ditemukan celah validasi nyata: `lib/kml-parser.ts` tidak memvalidasi ring polygon dari KML rusak/kosong sebelum dipakai — bisa crash UI preview (`coordinates[0].map(...)` di `KmlImportModal.tsx`) kalau ring-nya `undefined`/terlalu pendek. Fix: `isValidRing()` (ring valid minimal 4 titik) — polygon/bagian MultiPolygon yang tidak valid dilewati (skip), tidak lagi bikin crash.
4. Penanganan error: DITEMUKAN &amp; DIPERBAIKI — `app/api/kml-import/check-collisions/route.ts` tidak punya try/catch sama sekali (beda dari konvensi `baseline/route.ts`/`scan/route.ts` yang lebih hati-hati) — body JSON rusak atau exception dari fungsi turf (geometri aneh) akan lolos jadi 500 HTML generik Next.js, bukan JSON rapi yang bisa dibaca `KmlImportModal.tsx`. Fix: seluruh handler dibungkus try/catch, dites langsung dengan body JSON sengaja dirusak → sebelumnya (kalau dites) akan crash, sekarang balikin `{"error": "..."}` rapi dengan `content-type: application/json`.
5. Konsistensi pola: BERSIH — penamaan, struktur file, cara import (NextRequest/NextResponse, createAdminClient, 'use client', styling Tailwind) konsisten dengan konvensi project. Satu perbedaan POSITIF dicatat (bukan masalah): route KML pakai interface eksplisit utk request body, lebih ketat dari sebagian route lama yang destructure langsung tanpa tipe — sengaja TIDAK diturunkan supaya matching gaya lama, karena lebih aman.
6. Reusability `collision-detection.ts`: BERSIH — pure functions, cuma import `geojson` types + turf, tidak ada dependensi React/UI/Next.js sama sekali. Siap dipakai ulang untuk "Opsi D" penuh nanti tanpa modifikasi (`findInternalCollisions` bisa langsung dipanggil ke SEMUA data existing, bukan cuma kandidat baru).
7. Unused imports: BERSIH setelah fix duplikasi di poin 2 (import lokal yang tadinya duplikat sekarang dihapus, diganti impor dari lib bersama).
8. File test `scripts/test-import-sample.kml`: DIPUTUSKAN tetap di `scripts/` (tidak ada folder fixtures/test-data lain di project ini — project tidak punya test suite otomatis sama sekali) — didokumentasikan lewat komentar XML di awal file: skenario tiap placemark + hasil yang diharapkan, supaya bisa dipakai ulang manual kapan saja `lib/kml-parser.ts`/`lib/collision-detection.ts` diubah, tanpa perlu baca ulang PROJECT_LOG.md.

**Verifikasi behavior TIDAK berubah:** skenario A/B/C dari sesi sebelumnya diulang persis via `curl` ke `/api/kml-import/check-collisions` (server yang sama, hot-reload Turbopack) — hasil BYTE-IDENTIK: duplikat MJ07 100%, internal A/B 50%, bersih 0%. Ditambah 1 tes baru (di luar cakupan sebelumnya): body JSON sengaja dirusak → sebelum fix akan crash tanpa pesan jelas, sesudah fix balik `{"error":"Unexpected token 'i', ... is not valid JSON"}` rapi.

`npx tsc --noEmit`: 3 error pre-existing yang sama, 0 error baru.
`npx eslint` pada 4 file yang diaudit: 0 error (bersih total, beda dari `KawasanMapInner.tsx` yang punya 2 error pre-existing tidak terkait sesi ini).

**File diubah (delta baris):**
- `lib/collision-detection.ts`: 112 → 121 baris (+`PolygonCollisionResult`)
- `lib/kml-parser.ts`: 104 → 115 baris (+`isValidRing` + pemakaiannya)
- `app/api/kml-import/check-collisions/route.ts`: 54 → 63 baris (+try/catch)
- `components/kawasan/KmlImportModal.tsx`: 343 → 340 baris (−3, hapus definisi tipe dobel)
- `scripts/test-import-sample.kml`: +25 baris komentar dokumentasi

**update_owner.html: TIDAK diupdate untuk Tugas 1** — murni cleanup kode internal (duplikasi tipe, validasi tambahan, error handling lebih rapi), TIDAK ADA perubahan perilaku/tampilan yang terlihat user. Behavior yang sudah divalidasi &amp; ditunjukkan ke user di entri sebelumnya tetap identik (dibuktikan ulang di atas).

---

**TUGAS 2 — Cek data kawasan "Regenerative" (murni observasi, TIDAK ada badge/UI dibuat, TIDAK ada data diubah):**

Kawasan "Regenerative" (`9af7dae3-72d4-4218-8b80-c7011b2722df`) berisi 21 petak: 1 petak lama ("Regenerative/001", dibuat 24 Juli — subjek investigasi AWD tracker bug sebelumnya) + 20 petak BARU yang ternyata sudah diimpor user via fitur Import KML sungguhan (bukan tes saya) tanggal 25 Juli 07:29-07:32 UTC.

**Status data satelit per petak:**
- **19 dari 20 petak baru: KOSONG TOTAL** (0 baris `satellite_logs`) — belum pernah ditarik baseline sama sekali. TIDAK ditarik otomatis (sesuai instruksi eksplisit).
- **1 petak baru ("I Putu Ruja (Pondok)"): SUDAH ada data lengkap** (473 baris, 237 NDVI terisi) — kemungkinan user sempat klik "Tarik Data Baseline Satelit" manual untuk petak ini secara terpisah. **Diverifikasi PAKAI KODE YANG SUDAH DIPERBAIKI** — dites langsung ke Sentinel Hub dengan resx/resy fix untuk tanggal 2023-07-26: mean=0.04774 (dibulatkan 0.0477), PERSIS SAMA dengan nilai tersimpan di database (0.0477). Data ini VALID, tidak perlu direprocess.
- **"Regenerative/001" (petak lama): DATA LAMA/BUGGY** — 474 baris, 237 NDVI terisi, TAPI `cloud_cover_percent` cuma 2 nilai unik (biner 0/100 murni). Diverifikasi langsung ke Sentinel Hub: simulasi bug lama (resx=10) untuk tanggal 2023-07-26 menghasilkan mean=0.6686 — **PERSIS SAMA** dengan nilai tersimpan di database. Simulasi versi fix menghasilkan mean=0.6505 (BEDA). **Kesimpulan pasti: data petak ini ditarik SEBELUM fix 25 Juli, perlu direprocess** — belum dilakukan sesi ini (nunggu keputusan user, konsisten dengan pola kawasan lain).

**Analisis indikasi regenerative (HANYA untuk petak yang datanya valid &amp; cukup — "I Putu Ruja (Pondok)", 64 baris valid cloud&lt;=15%, rentang 2023-08 s/d 2026-07):**
- **NBR TIDAK PERNAH negatif di seluruh 64 baris** (nilai terendah ≈0,246) — TIDAK ADA indikasi pembakaran lahan sepanjang ~3 tahun record.
- Ditemukan 2-3 dip NDVI rendah (&lt;0,3): sekitar Feb 2025 (2 titik berdekatan, NDVI 0,13-0,22), Sep 2025 (1 titik, NDVI 0,23), dan awal record Agu 2023 (1 titik, NDVI 0,21 — tapi ini titik PALING AWAL data jadi tidak ada "sebelum" untuk dibandingkan).
- **Kesimpulan JUJUR (bukan dipaksakan):** dip Feb 2025 NBR-nya tetap positif/moderat (~0,47-0,48) — SESUAI pola "bukan lahan gundul terbakar", TAPI NDVI-nya sendiri terlalu rendah (0,13-0,22) untuk dibilang "cover crop terjaga" ala kasus Budidaya BSO (yang NDVI-nya tetap MODERAT-TINGGI saat kering). Pola di sini LEBIH konsisten dengan jeda tanam/olah lahan normal antar-musim biasa (rotasi tanam standar) daripada bukti spesifik praktik regeneratif — **data TIDAK CUKUP untuk klaim regenerative-specific, dilaporkan apa adanya, bukan disimpulkan paksa.**
- **Catatan penting:** gap kalender panjang antar-baris (mis. Des 2023-Apr 2024, Des 2024-Feb 2025) BUKAN berarti lahan kosong selama itu — itu cuma celah ketersediaan citra Sentinel-2 bebas awan dalam window 1095 hari, bukan data aktivitas lahan kontinu.

- **18 petak baru lainnya (selain Pondok &amp; Regenerative/001): TIDAK ADA DATA SAMA SEKALI** — tidak bisa dianalisis, tidak ditarik otomatis, menunggu keputusan user.

**Rekomendasi:**
1. "Regenerative/001" perlu direprocess (data lama/buggy, sama seperti kawasan lain yang belum ditangani) — aman dilakukan kapan saja (upsert idempotent, sudah dikonfirmasi berulang kali di sesi-sesi sebelumnya).
2. 19 dari 20 petak baru dari KML belum punya data sama sekali — user perlu klik "Tarik Data Baseline Satelit" satu-per-satu kalau mau data lengkap (TIDAK ditarik otomatis sesi ini, sesuai instruksi).
3. "I Putu Ruja (Pondok)" datanya sudah benar, tidak perlu tindakan apapun untuk validitas data — tapi analisis regenerative-nya sendiri belum konklusif (poin di atas).

**Status berikutnya:** Tugas 1 selesai, kode lebih rapi tanpa ubah behavior. Tugas 2 murni temuan untuk didiskusikan user — TIDAK ada tindakan otomatis diambil (tidak reprocess Regenerative/001, tidak tarik baseline 19 petak baru). Kawasan lain di luar Sri Galih, Sangeh, dan Regenerative masih belum dicek/diproses sama sekali — status resx/resy reprocessing project-wide masih parsial.

---

## [2026-07-25 17:41] — Investigasi NBR "tidak pernah deteksi bakar" — formula benar, TAPI metodologi absolut kurang sensitif (literatur: seharusnya dNBR) + bug resx/resy TERBUKTI bikin NBR palsu-rendah (false alarm), bukan menyembunyikan bakar

**Konteks:** User curiga NBR tidak pernah mendeteksi pembakaran padahal pernah melihat sendiri ada bakar jerami di lapangan (tidak ingat petak/tanggal spesifik). Investigasi murni — TIDAK ADA kode/data diubah sesi ini.

**TUGAS 1 — Verifikasi formula &amp; ambang batas (web search literatur):**
- Formula `nbr = (B08-B12)/(B08+B12)` — DIKONFIRMASI BENAR, salah satu dari 2 varian standar Sentinel-2 (varian lain: B8A/B12 di resolusi native 20m — B08/B12 dipilih project ini untuk resolusi NIR native 10m lebih halus, wajar untuk petak kecil).
- Ambang kode SEBENARNYA (bukan `-0.1` di komentar migration_v16, itu cuma teks dokumentasi tidak dipakai) — `< -0.25` = indikasi kuat, `< 0.1` = kemungkinan ringan (kode sendiri sudah mengakui ambigu dengan tanah kosong pasca panen di `PlotDashboard.tsx:104`).
- **TEMUAN PENTING dari literatur:** metodologi standar riset kebakaran (USGS FIREMON) pakai **dNBR** (selisih NBR sebelum-sesudah), BUKAN nilai absolut 1 waktu. Literatur SPESIFIK untuk bakar jerami sawah (bukan hutan) menegaskan: "dNBR exhibited the highest sensitivity for distinguishing harvested fields from burnt residues" — NBR absolut TIDAK cukup sensitif membedakan "baru dipanen" (bare soil) dari "bekas dibakar" (juga bare/dark), butuh SELISIH. Ini pas dengan ambiguitas yang sudah diakui sendiri di kode. NBR absolut juga "well-suited... shortly after fire but loses effectiveness as vegetation regrows" — window scan proyek ini (~6-10 hari, kadang lebih jarang) bisa saja melewatkan sinyal bakar singkat yang cepat pulih.
- Sumber: [Mapping rice residues burning Sentinel-2 (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S2352938521000227), [UN-SPIDER NBR](https://un-spider.org/advisory-support/recommended-practices/recommended-practice-burn-severity/in-detail/normalized-burn-ratio), [USFS RdNBR calibration](https://research.fs.usda.gov/treesearch/35671).

**TUGAS 2 — Distribusi NBR seluruh database (2174 baris valid, cloud≤15%, semua kawasan):**
- Genuinely HAMPIR TIDAK ADA yang negatif: cuma 2 dari 2174 baris (0,09%) — TAPI ini cuma yang lolos filter cloud≤15%.
- **TEMUAN KRITIS terpisah:** saat threshold cloud dilonggarkan, DITEMUKAN banyak baris NBR rendah/negatif (termasuk -0,3948, nilai paling ekstrem di seluruh database) yang SEMUANYA berstatus `cloud_cover_percent=100%` — di 2 petak Subak Sangeh ("Made sengger", "Men Lembug", keduanya masih data lama/buggy, cloud biner 0/100). Karena bug resx/resy bikin cloud_cover_percent juga cuma dihitung dari 1 pixel (biner, bukan representatif), banyak baris berpotensi salah ditandai "100% awan" (padahal cuma 1 pixel acak yang kebetulan awan) — MENYEMBUNYIKAN kandidat dip NBR dari analisis (termasuk analisis Tugas 2 investigasi kawasan Regenerative sebelumnya yang cuma cek cloud≤15%).
- `NbrTrendChart.tsx` TERNYATA TIDAK memfilter cloud — semua baris tetap dirender di chart (ditandai titik merah "tidak reliable"), dan `PlotDashboard.tsx` insight NBR (baris 99-106) SENGAJA SELALU tampil tanpa gerbang cloud ("diminta user 18 Juli"). Jadi secara teknis TIDAK sepenuhnya "disembunyikan" dari UI — tapi ditandai "tidak reliable" yang wajar bikin diabaikan user, apalagi kalau frekuensi false-cloud-flag tinggi akibat bug.
- **7 dari 8 musim tanam** yang punya tanggal panen ADA data satelit di window pasca-panen (1-4 minggu) — 7 di antaranya nunjukkin dip NBR &lt;0,3 (WAJAR, ini justru pola normal lahan abis panen: kanopi hilang, NBR/NDVI turun, TIDAK otomatis berarti dibakar).

**TUGAS 3 — Verifikasi langsung ke Sentinel Hub (query saja, TIDAK reprocess permanen) — 5 sampel tanggal dip NBR dari data lama/buggy:**
| Petak | Tanggal | NBR di DB (bug) | NBR simulasi FIX (multi-pixel) |
|---|---|---|---|
| Made sengger | 2023-12-18 | -0,148 | **+0,165** |
| Made sengger | 2024-05-31 (paling ekstrem di database) | -0,395 | **+0,380** |
| Made sengger | 2026-07-05 (TIDAK di-flag cloud, dalam window pasca-panen) | -0,155 | **+0,273** (cloud sebenarnya 51,9%, bukan 0%!) |
| Men Lembug | 2024-10-23 | -0,163 | **+0,529** |
| Budidaya BSO 1 | 2026-06-15 (dekat tanggal panen) | -0,164 | **+0,278** (tapi min pixel individual -0,134 — ada kemungkinan noktah kecil, rata-rata tetap sehat) |

**SEMUA 5 sampel: NBR versi fix jauh LEBIH SEHAT/POSITIF dari data lama.** Catatan jujur: simulasi bug (resx=10) HANYA cocok PERSIS dengan nilai DB di 2 dari 5 kasus (Men Lembug &amp; BSO1) — 3 lainnya berbeda (kemungkinan drift baseline reprocessing L2A Copernicus dari waktu penarikan asli ke sekarang, BELUM dikonfirmasi pasti, dilaporkan sebagai observasi terbuka bukan kesimpulan final) — TAPI pola inti (fix selalu jauh lebih sehat dari DB) konsisten di semua 5 kasus terlepas dari itu.

**Kesimpulan Tugas 3: bug resx/resy TERBUKTI memproduksi NBR PALSU-RENDAH (false alarm), BUKAN menyembunyikan bakar asli** — di semua kandidat dip yang dites, versi tersampling-benar menunjukkan lahan SEHAT. Kemungkinan penyebab: 1 pixel acak dari kotak sampel raksasa (~1,1km) kena bayangan, genangan, atau fitur non-representatif di luar petak asli.

**Kesimpulan keseluruhan:** kekhawatiran user ("NBR tidak pernah deteksi bakar") kemungkinan besar BUKAN murni bug resx/resy (bug justru condong bikin false-alarm rendah, bukan menyembunyikan). Kombinasi 3 faktor lebih mungkin: (1) metodologi absolut-threshold memang kurang sensitif dibanding dNBR standar literatur, (2) interval scan (~6-10 hari) bisa melewatkan sinyal bakar singkat yang cepat pulih, (3) TIDAK BISA dipastikan kejadian spesifik yang user lihat langsung ada di data — user sendiri tidak ingat petak/tanggalnya, jadi tidak bisa diverifikasi langsung.

**Rekomendasi (BELUM dieksekusi):**
1. Reprocess Subak Sangeh (termasuk 2 petak sampel Tugas 3) — sudah diketahui perlu, makin diperkuat temuan ini.
2. Pertimbangkan tambah metodologi dNBR (selisih NBR antar-scan berurutan) sebagai pelengkap (bukan pengganti) ambang absolut yang sudah ada — sesuai rekomendasi literatur riset bakar jerami sawah.
3. Pertimbangkan investigasi kenapa `cloud_cover_percent` bisa false-flag 100% di data lama — dampaknya BUKAN cuma NBR, kemungkinan besar juga bikin baris NDVI/estimated_phase valid ikut ter-null-kan secara keliru di data lama (di luar scope sesi ini, perlu sesi terpisah).

**Status berikutnya:** murni investigasi, TIDAK ada kode/data diubah. `update_owner.html` TIDAK diupdate (tidak ada perubahan produk, ini temuan analitis untuk didiskusikan).

---

## [2026-07-26 07:05] — Reprocess Regenerative/001 SELESAI + fitur dNBR (pelengkap NBR absolut) diimplementasi & di-backfill — TAPI ambang -0.1 ternyata terlalu sensitif (11,6% baris kena flag)

**Konteks:** Lanjutan langsung dari investigasi NBR 25 Juli. 2 tugas: (1) reprocess petak "Regenerative/001" yang dikonfirmasi masih data lama/buggy, (2) implementasi dNBR sebagai pelengkap ambang absolut NBR sesuai rekomendasi literatur.

**TUGAS 1 — Reprocess "Regenerative/001" (`8886313e-a25a-4184-bd30-db3bfd4e7f27`):**
- `POST /api/plots/.../baseline` dipanggil — sukses, "474 data satelit ASLI". Total baris 474→475 (varians wajar dari window bergulir 1095-hari, sudah dijelaskan di sesi-sesi sebelumnya — BUKAN duplikasi).
- `cloud_cover_percent` sesudah reprocess: 10 nilai unik (dari sebelumnya biner 2 nilai) — fix bekerja.
- Before/after 5 tanggal sampel:
  | Tanggal | NDVI sebelum→sesudah | NBR sebelum→sesudah | cloud sebelum→sesudah |
  |---|---|---|---|
  | 2023-07-26 | 0,6686→0,6505 | 0,4337→0,4104 | 0%→0% |
  | 2024-11-12 | 0,0371→0,1161 | 0,0087→0,0435 | 100%→100% |
  | 2026-05-01 | 0,1200→0,2064 | 0,0304→0,0468 | 100%→100% |
  | 2025-03-17 | 0,1700→0,1761 | 0,0669→0,0656 | 100%→100% (hampir sama — wajar, tidak semua tanggal berubah dramatis) |
  | 2026-07-05 | 0,1947→0,4641 | 0,0964→0,3854 | 100%→100% (paling dramatis) |

**TUGAS 2 — Fitur dNBR:**

*Migration:* `docs/migration_v22_dnbr.sql` — kolom `dnbr_score numeric`, `dnbr_reference_scan_date date` di `satellite_logs`. **Koneksi otomatis ke DB gagal** (masalah SUPABASE_DB_URL yang sudah dikenal) — user menjalankan manual lewat Supabase SQL Editor, dikonfirmasi lewat query langsung sebelum lanjut (bukan asumsi, sesuai CLAUDE.md §6).

*File baru/diubah:*
- `lib/dnbr.ts` (baru) — `computeDnbrSeries()` (pure), `isSuddenBurnFlag()`, `recomputeDnbrForPlot()` (DB-touching, upsert 1x per plot).
- `app/api/plots/[plotId]/baseline/route.ts`, `app/api/plots/[plotId]/scan/route.ts` — panggil `recomputeDnbrForPlot` setelah upsert NBR (fire-and-forget, tidak menggagalkan flow utama).
- `app/api/cron/satellite-scan/route.ts` — **SENGAJA TIDAK diubah**: route ini tidak menghitung NBR sama sekali (issue lama sejak 19 Juli, terpisah dari scope ini), jadi tidak ada nbr_score baru untuk dihitung dNBR-nya dari situ.
- `lib/types/plot.ts`, `app/kawasan/[kawasanId]/plot/[plotId]/page.tsx` — tambah field `dnbr_score`/`dnbr_reference_scan_date` ke tipe & query select.
- `components/plots/PlotDashboard.tsx` — flag baru di `deriveInsights()`, tepat setelah insight NBR absolut yang sudah ada (BERDAMPINGAN, bukan menggantikan).
- `scripts/backfill-dnbr.mjs` (baru) — backfill histori, exclude Subak Sangeh total + skip petak dengan cloud_cover biner (masih buggy).

**Rujukan ambang dNBR:** batas bawah kelas "low severity" USGS FIREMON (raw dNBR 100, skala natural -1..1 project ini → 0,1) — lihat entri 25 Juli 2026 untuk sumber lengkap. **CATATAN TANDA:** project ini hitung SEKARANG minus SEBELUMNYA (kebalikan FIREMON tekstual pra-minus-pasca) — kebakaran ditandai NEGATIF di sini. Gap maksimal 15 hari (KEPUTUSAN DESAIN sendiri, bukan literatur) supaya flag cuma nyala untuk penurunan "mendadak", bukan siklus panen normal.

**Koreksi jujur ke laporan sesi sebelumnya (25 Juli):** klaim "`PlotDashboard.tsx` insight NBR SENGAJA SELALU tampil tanpa gerbang cloud" — SALAH. Ditelusuri ulang: ada `if (dataUnreliable) { ...; return out }` (baris 54-60) yang return LEBIH AWAL untuk scan cloud&gt;15%, SEBELUM baris NBR (99-106) sempat dijalankan — komentar kode "SELALU ditampilkan" tidak sesuai kenyataan behavior. Klaim sebelumnya dibuat dari baca cuplikan kode terisolasi tanpa telusur alur lengkap — tidak diverifikasi langsung waktu itu. Dampak: insight NBR (dan flag dNBR baru ini) TIDAK muncul kalau `activeScan` (default: scan TERBARU, regardless validity) kebetulan cloud&gt;15% — user perlu klik titik lain di chart untuk lihatnya. DI LUAR SCOPE sesi ini untuk diperbaiki, dicatat sebagai temuan terpisah.

**Backfill dijalankan (`node --env-file=.env.local scripts/backfill-dnbr.mjs`):**
- 25 petak berhasil dihitung dNBR (Sri Galih 21 petak + Regenerative/001 + Pondok + 2 lainnya)
- 3 petak "dilewati" — TAPI catatan jujur: bukan konfirmasi buggy sungguhan, cuma punya 1 baris NBR (SSB/001, SSB/002, I Wayan Ditha) — heuristik "cloud biner" salah-label alasan skip (harusnya "data belum cukup", bukan "buggy") — TAPI hasil akhirnya tetap benar (dNBR memang tidak bisa dihitung dari 1 titik data, apapun alasannya).
- 19 petak dilewati (belum ada data NBR sama sekali — 19 petak baru KML Regenerative yang memang belum ditarik).
- Kawasan Subak Sangeh dikecualikan TOTAL (tidak disentuh sama sekali).

**Verifikasi nyata dNBR terhitung** (Regenerative/001): `2023-08-25: NBR=0.4132 dNBR=-0.0676 (vs 2023-08-15)` — contoh konkret, bukan klaim tanpa bukti.

**🔴 TEMUAN PENTING — kalibrasi ambang -0.1 TERLALU SENSITIF:** dicek sistematis ke SELURUH data yang sudah di-backfill (1000 baris ber-dNBR) — **116 baris (11,6%) memicu flag** (dNBR≤-0,1 DAN gap≤15 hari), dan **SEMUA 18 petak yang punya dNBR pernah kena flag minimal 1x**. Ini jauh lebih sering dari yang diharapkan untuk sinyal "indikasi tambahan" yang seharusnya jarang — kemungkinan besar karena fluktuasi NBR NORMAL antar-fase pertumbuhan padi (bukan cuma pasca-panen) SERING melebihi 0,1 dalam rentang 10-15 hari (transisi vegetatif→generatif→pematangan juga mengubah NBR signifikan, bukan cuma panen→bera). **Ambang literatur (-0,1, kelas "low severity") diimplementasikan PERSIS sesuai instruksi, TAPI hasil kalibrasinya di data nyata project ini kurang berguna sebagai sinyal (terlalu sering nyala, berisiko fatigue-alert).**

**Status berikutnya (REKOMENDASI, belum dieksekusi):**
1. Pertimbangkan naikkan ambang ke kelas "moderate-low" FIREMON (-0,27) supaya lebih jarang nyala, atau
2. Tambah syarat tambahan (mis. HANYA flag kalau NDVI juga turun tajam bersamaan — menyingkirkan transisi fase pertumbuhan normal yang NBR-nya turun tapi NDVI-nya justru masih naik/stabil), atau
3. Biarkan seperti ini dulu (ambang literatur murni) dan lihat apakah user merasa berguna/mengganggu setelah dipakai beberapa minggu, baru dikalibrasi ulang berdasar feedback nyata.
Keputusan kalibrasi ini SENGAJA belum diambil sepihak — perlu didiskusikan dengan user.

Temuan terpisah (di luar scope, dicatat untuk sesi depan): insight NBR/dNBR tidak tergerak kalau scan terbaru cloud&gt;15% (lihat koreksi di atas).

`npx tsc --noEmit`: 3 error pre-existing yang sama, 0 error baru.
`npx eslint`: 3 error, SEMUA dikonfirmasi pre-existing (baseline/route.ts `catch (error: any)` &amp; 2 `setState`-in-effect di useEffect True Color/NBR heatmap URL — tidak terkait perubahan sesi ini, dicek lewat pembacaan langsung baris kode + git diff).

Verifikasi UI nyata: dev server sempat crash "Jest worker" (masalah stabilitas Turbopack yang sudah dikenal dari server lama yang jalan lintas-sesi, BUKAN bug kode) — di-restart bersih, halaman detail petak Regenerative/001 berhasil dimuat (200) dan flag dNBR baru **terkonfirmasi tampil di HTML nyata**: "Penurunan NBR mendadak terdeteksi (dNBR -0.13 dalam 5 hari sejak scan 15 Jul 2026) — kemungkinan indikasi tambahan, perlu konfirmasi lapangan."

`update_owner.html` (root+public) diupdate — lihat entri terkait.

---

## [2026-07-26 07:23] — Daftar lengkap baris kena flag dNBR untuk ditinjau manual user + koreksi angka statistik sesi sebelumnya (bug pagination PostgREST)

**Konteks:** Murni query &amp; laporan (TIDAK ada kode/data diubah) — user minta daftar lengkap semua baris yang memicu flag dNBR dari backfill sesi sebelumnya, untuk ditinjau manual satu-per-satu.

**🔴 Koreksi angka dari laporan sesi sebelumnya:** statistik "1000 baris ber-dNBR, 116 baris (11,6%) kena flag" ternyata SALAH — kena bug PostgREST default limit 1000 baris/request yang sudah pernah ditemukan di project ini sebelumnya (data cuaca, lihat `update_owner.html` entri 18 Juli). Setelah query di-paginate dengan benar: **total baris ber-dNBR sebenarnya 1739** (bukan 1000), **total baris kena flag sebenarnya 196** (bukan 116). Persentase akhirnya hampir sama (196/1739 = 11,3% vs 11,6% sebelumnya) — kesimpulan kalibrasi "terlalu sensitif" dari sesi sebelumnya TETAP VALID, cuma angka absolutnya dikoreksi.

**Daftar lengkap 196 baris** (nama petak, kawasan, tanggal flag, dNBR, tanggal pembanding, gap hari, NBR &amp; NDVI di kedua tanggal) dikirim langsung ke user dalam format tabel — tidak diduplikasi di sini (lihat laporan sesi ini untuk tabel lengkap). Sebaran: SEMUA dari kawasan "Kelompok tani Sri Galih" (23 petak, mayoritas — 190 dari 196 baris), "Regenerative" (Regenerative/001: 5 baris), dan "Subak Selan Bawak" (SSB/001: 2 baris) — TIDAK ada dari Subak Sangeh (dikecualikan total sejak backfill).

**Pengamatan tambahan (bukan kesimpulan final, cuma catatan bantu tinjau):** sebagian besar baris menunjukkan NDVI ikut turun bersamaan dengan NBR (konsisten pola pergantian fase tanaman/panen normal) — TAPI ada beberapa baris pengecualian dengan NDVI justru NAIK/stabil sementara NBR turun tajam (contoh: MM04 23 Okt 2023, MM05 23 Okt 2023, MM48 23 Sep 2025) — pola ini lebih janggal untuk dijelaskan murni sebagai transisi fase wajar, mungkin layak diprioritaskan kalau user mau mengecek manual ke lapangan/citra asli lebih dulu.

**Status berikutnya:** murni laporan, tidak ada tindakan diambil. Keputusan kalibrasi ambang dNBR (opsi naikkan ambang / tambah syarat NDVI / biarkan dulu) masih menunggu keputusan user dari sesi sebelumnya.

---

## [2026-07-26 07:39] — Fix: peta tidak termuat saat diakses dari HP/perangkat lain di WiFi yang sama — Next.js 16 memblokir cross-origin dev asset request, ditambah `allowedDevOrigins`

**Konteks:** User melaporkan peta macet di "Memuat peta..." kalau app diakses dari perangkat lain lewat IP LAN laptop (`http://192.168.100.50:3000`), bukan `localhost`. Dugaan awal (dari user): Next.js 16 blokir cross-origin dev asset secara default sejak Maret 2026, perlu `allowedDevOrigins`.

**Dugaan DIKONFIRMASI dengan bukti log langsung (bukan asumsi):** dev server di-restart bersih, lalu diakses ulang lewat IP LAN — log server persis menunjukkan:
```
⚠ Blocked cross-origin request to Next.js dev resource /_next/static/chunks/...js from "192.168.100.50".
Cross-origin access to Next.js dev resources is blocked by default for safety.
```
Dites juga langsung lewat `curl` ke salah satu chunk JS peta — status `403` (terblokir), match persis dengan gejala "peta tidak pernah selesai memuat" (JS chunk yang dibutuhkan peta gagal dimuat browser, HTML/konten lain normal karena itu bukan aset `/_next/*`).

**Fix:** `next.config.ts` — tambah `allowedDevOrigins: ['192.168.100.50', '192.168.100.*']`.

**Riset wildcard subnet (diminta user, dijawab EMPIRIS bukan cuma baca dokumentasi):** dokumentasi resmi Next.js cuma kasih contoh wildcard untuk domain (`*.local-origin.dev`), tidak eksplisit soal wildcard IP. Dites langsung: `192.168.100.*` DIKONFIRMASI bekerja untuk IP LAIN di subnet yang sama (dites pakai header `Host` di-spoof ke `192.168.100.99` — hasil `200`, diizinkan), DAN dikonfirmasi IP DI LUAR subnet itu (`10.0.0.5`) TETAP diblokir seperti biasa (`403`, muncul warning log yang sama) — jadi wildcard-nya benar-benar ter-scope ke subnet, tidak diam-diam menonaktifkan proteksi total. Keterbatasan: wildcard ini HANYA jalan kalau laptop tetap di jaringan/subnet `192.168.100.x` yang sama — kalau pindah ke WiFi lain dengan rentang IP beda, perlu entri baru.

**Validasi:** setelah restart dengan config baru — request yang SEBELUMNYA `403` (dites ulang persis) sekarang `200`, tidak ada lagi warning "Blocked cross-origin" di log untuk IP manapun dalam subnet `192.168.100.x`.

`npx tsc --noEmit`: 3 error pre-existing yang sama, 0 error baru. Tidak ada file lain yang disentuh selain `next.config.ts` (sesuai instruksi eksplisit — murni config dev server, tidak menyentuh logic aplikasi).

**Catatan:** `allowedDevOrigins` HANYA berlaku di mode `next dev` — TIDAK berpengaruh ke build/deploy production sama sekali. `update_owner.html` TIDAK diupdate — ini murni perbaikan environment development lokal, tidak ada perubahan yang terlihat/berdampak ke aplikasi yang dipakai user akhir.

**Status berikutnya:** perlu dikonfirmasi user — coba akses ulang dari HP, pastikan peta benar-benar termuat (saya sudah verifikasi lewat curl/log server, tapi belum ada verifikasi visual asli dari browser HP).

---

## [2026-07-26 07:58] — Cek indikasi bakar petak "SSB/001" (Subak Selan Bawak) — TIDAK ada indikasi kuat, tapi kecocokan jendela pasca-panen tidak bisa diuji (data panen historis kosong)

**Konteks:** Murni query &amp; laporan (TIDAK ada kode/data diubah). Tindak lanjut daftar flag dNBR sesi sebelumnya — cek detail SSB/001 pakai metodologi diperbaiki (cocokkan waktu flag vs jendela pasca-panen, bukan cuma lihat NDVI naik/turun).

**Identitas dikonfirmasi:** SSB/001 (`6bcac02f-af34-429d-b3f2-0b85e8391ef6`), kawasan Subak Selan Bawak (`fbc758ec-7343-4aea-a35f-c54931de39ed`), 0,151 ha. Data BUKAN buggy (8 nilai cloud_cover berbeda, sudah pakai fix resx/resy).

**Hasil:**
- NBR absolut ≤-0,25 (zona bakar kuat): **0 baris** dari 237 baris ber-NBR — TIDAK PERNAH masuk zona ini sepanjang histori.
- Flag dNBR: **2 baris** (dikonfirmasi ulang, cocok temuan sesi lalu) — 2023-12-18 (dNBR=-0,2528, NBR 0,4852→0,2324, NDVI 0,5952→0,3192) dan 2025-10-13 (dNBR=-0,1713, NBR 0,3737→0,2024, NDVI 0,5034→0,3948). Di KEDUA kasus, NDVI ikut turun proporsional bareng NBR — pola ini konsisten transisi vegetasi normal (panen/land-clearing), BUKAN pola "NBR anjlok sendiri sementara NDVI tetap hijau" yang lebih mencurigakan.
- **Kecocokan jendela pasca-panen: TIDAK BISA DIUJI SECARA BERMAKNA** — petak ini cuma punya **1 musim tanam tercatat** (`planting_date` 14 Mei 2026, `estimated_harvest_date` 1 Sep 2026, masih "aktif", belum ada `actual_harvest_date`). Kedua tanggal flag (2023, 2025) jauh SEBELUM satu-satunya musim yang tercatat — bukan berarti "tidak cocok jendela panen", tapi karena TIDAK ADA data panen historis yang mencakup periode itu sama sekali. Ini keterbatasan data, BUKAN bukti yang meniadakan indikasi bakar.

**Kesimpulan jujur:** TIDAK ADA indikasi KUAT pembakaran di SSB/001 — absolut NBR tidak pernah masuk zona bakar, dan pola dNBR+NDVI yang ada lebih cocok dijelaskan sebagai transisi vegetasi wajar. TAPI kesimpulan ini tidak bisa diperkuat lewat kecocokan waktu panen (metodologi yang diminta) karena keterbatasan data historis musim tanam petak ini — bukan "sudah pasti bukan bakar", cuma "tidak ada bukti kuat yang mendukung indikasi bakar dari data yang tersedia".

**Status berikutnya:** murni laporan, tidak ada tindakan diambil.

---

## [2026-07-26 10:37] — Fitur "Indikator Pembakaran Gabungan" (dNBR + waktu panen, 3 kategori) SELESAI diimplementasi + bersihkan istilah internal "update owner" dari UI

**Konteks:** 2 tugas. Tugas 1: gabungkan dNBR (sudah ada) dengan kecocokan waktu panen jadi 1 indikator otomatis di semua petak, mengotomasi apa yang sebelumnya harus diinvestigasi manual satu-satu (lihat entri SSB/001 26 Juli pagi). Tugas 2: user menemukan tooltip UI menyebut nama file dokumentasi internal "update_owner.html" — membingungkan untuk user biasa, harus dibersihkan.

**TUGAS 1 — Indikator Pembakaran Gabungan:**

*Logika* (`lib/dnbr.ts`, fungsi baru `classifyBurnIndication()`): untuk tiap baris yang SUDAH kena flag dNBR (`isSuddenBurnFlag`, logika lama tidak diubah), cek apakah petak itu punya tanggal panen (actual ATAU estimated, dari SEMUA musim tanam tercatat — bukan cuma musim aktif) yang jatuh 1-21 hari SEBELUM tanggal flag. 3 kategori: `likely_burn` (cocok jendela panen), `sudden_drop_not_harvest` (flag ada tapi tidak cocok jendela), `insufficient_data` (petak tidak punya tanggal panen tercatat sama sekali). Return `null` kalau baris itu tidak kena flag dNBR sama sekali (tidak perlu badge).

*UI* — `components/plots/BurnIndicatorBadge.tsx` (37 baris, komponen baru): badge dengan 3 warna sesuai kategori (merah=likely_burn, kuning=sudden_drop_not_harvest, abu=insufficient_data), teks PERSIS sesuai spesifikasi (selalu "kemungkinan"/"indikasi", tidak pernah "pasti"/"terbukti"). Ditampilkan di panel "Tren NBR (Indikasi Pembakaran)" `PlotDashboard.tsx`, tepat di bawah chart NBR.

*Konsolidasi (bukan duplikasi):* insight dNBR-sendirian yang ditambahkan sesi 25 Juli (di `deriveInsights()`, cuma cek dNBR tanpa waktu panen) DIHAPUS — digantikan badge baru yang lebih akurat. Menghindari 2 sinyal berbeda untuk hal yang sama.

**Validasi NYATA (logika production yang SAMA persis dites terhadap SELURUH database, bukan asumsi):**
- Kategori (a) likely_burn: **1 kasus ditemukan** — Regenerative/001, scan 2026-07-20 (dNBR=-0,1286), cocok 3 hari setelah panen AKTUAL (bukan estimasi) tanggal 2026-07-17. **Dikonfirmasi live di UI production** (bukan cuma backend): "Kemungkinan pembakaran terdeteksi — 3 hari setelah panen (17 Jul 2026). Indikasi otomatis, BUKAN bukti pasti — perlu konfirmasi lapangan."
- Kategori (b) sudden_drop_not_harvest: **40 kasus** — termasuk SSB/001 2023-12-18 &amp; 2025-10-13 (KONSISTEN dengan investigasi manual sesi 26 Juli pagi — bukti logic otomatis ini menghasilkan kesimpulan yang sama dengan analisis manual sebelumnya).
- Kategori (c) insufficient_data: **155 kasus** — mayoritas, karena banyak petak belum punya riwayat musim tanam lengkap.
- Kategori (b)/(c) TIDAK ada contoh live-UI (tidak ada petak yang scan TERBARUnya kebetulan kena flag ini — perlu klik titik lama di chart untuk lihat, bukan tampilan default) — divalidasi via logika production yang sama persis terhadap data nyata (angka konkret di atas), TAPI belum di-klik manual di browser sungguhan (keterbatasan tools, sama seperti sesi-sesi sebelumnya).

`npx tsc --noEmit`: 3 error pre-existing yang sama, 0 error baru.
`npx eslint`: 2 error, KEDUANYA dikonfirmasi pre-existing (useEffect True Color/NBR heatmap URL, tidak terkait perubahan sesi ini — sudah dikonfirmasi pre-existing di sesi-sesi sebelumnya juga).

**File diubah/dibuat (Tugas 1):**
- `lib/dnbr.ts`: +52 baris (`classifyBurnIndication()`, tipe `BurnIndicationCategory`/`HarvestDateInput`/`BurnIndicationResult`)
- `components/plots/BurnIndicatorBadge.tsx`: baru, 37 baris
- `components/plots/PlotDashboard.tsx`: net +~15 baris (hapus insight dNBR lama ~14 baris, tambah `useMemo` burnIndication ~17 baris, render badge ~3 baris, 2 baris import)

---

**TUGAS 2 — Bersihkan istilah internal "update owner":**

Grep menyeluruh `app/` &amp; `components/` untuk "update owner"/"update_owner" (case-insensitive) — **HANYA 1 lokasi ditemukan**:

| File | Baris | Teks asli | Konteks |
|---|---|---|---|
| `components/plots/PlotDashboard.tsx` | ~1871 | "...Metodologi lengkap + rujukan ada di update_owner.html bagian Rumus &amp; Referensi." | `InfoTooltip` "Bukti Intentionality AWD" |

**Perbaikan:** kalimat rujukan ke `update_owner.html` DIHAPUS sepenuhnya (bukan diganti rujukan lain) — tooltip itu SUDAH menjelaskan metodologi lengkap secara mandiri di kalimat-kalimat sebelumnya (cek hujan ≥5mm 5 hari sebelum, dst.), jadi tidak kehilangan informasi apapun bagi user, cuma menghapus pointer ke dokumen yang tidak bisa mereka akses.

Grep ulang setelah perbaikan (`app/` + `components/`, sama persis pattern): **0 hasil** — dikonfirmasi bersih total. Grep diperluas juga ke pola `owner.html`/`update.owner` (jaga-jaga variasi lain) — juga 0 hasil.

**File diubah (Tugas 2):** `components/plots/PlotDashboard.tsx` — 1 baris dihapus (bagian dari total delta di atas).

**Status berikutnya:** kedua tugas selesai &amp; tervalidasi. `update_owner.html` (root+public) diupdate — lihat entri terkait (menjelaskan fitur baru DAN mengonfirmasi pembersihan istilah internal).

---

## [2026-07-26 16:06] — Tambah "Lihat Detail Analisis" expand/collapse di BurnIndicatorBadge — jelaskan dasar angka di balik tiap kategori

**Konteks:** User sudah konfirmasi badge merah bekerja live, minta tambahan: tampilkan DASAR ANALISIS (angka NBR/NDVI/tanggal mentah), bukan cuma kesimpulan, untuk ketiga kategori.

**Implementasi:** `components/plots/BurnIndicatorBadge.tsx` diperluas (37→123 baris) — toggle "Lihat detail analisis" (`useState` lokal, expand/collapse inline dalam badge yang sama, BUKAN komponen tooltip baru — `InfoTooltip` yang sudah ada lebarnya cuma 260px, terlalu sempit untuk data sebanyak ini, jadi dipertahankan sebagai referensi gaya visual tapi tidak dipakai langsung). Kalimat detail BEDA per kategori sesuai spesifikasi persis: (a) NBR/NDVI before→after + tanggal + selisih dNBR + hari sejak panen; (b) sama + penjelasan kenapa TIDAK dianggap indikasi bakar; (c) penjelasan APA yang kurang (data musim tanam) + saran mengisi data.

**TIDAK ADA perubahan ke `classifyBurnIndication()`** di `lib/dnbr.ts` — dikonfirmasi lewat `git diff` (0 baris berubah di file itu sesi ini). Data detail (NBR/NDVI mentah scan sekarang &amp; scan pembanding) diambil dari `satelliteLogs` yang SUDAH di-fetch di `PlotDashboard.tsx` (dicari via `dnbr_reference_scan_date`), TIDAK ada query baru ke database.

**Validasi 3 kategori dengan data nyata:**
- **(a) Regenerative/001, merah** — dikonfirmasi toggle button tampil di HTML live (`curl` ke server sungguhan). Teks detail (dihitung dari data real via logic yang PERSIS sama dengan komponen, dikutip transparan sebagai metode validasi karena toggle-nya `useState` client-side — collapsed by default berarti kontennya TIDAK ADA di initial SSR HTML sebelum diklik, bukan cuma disembunyikan CSS, jadi tidak bisa di-scrape curl tanpa eksekusi JS/klik sungguhan, keterbatasan tools yang sama seperti sesi-sesi sebelumnya):
  "NBR turun dari 0.36 (15 Jul 2026) ke 0.23 (20 Jul 2026) — selisih -0.13 dalam 5 hari, 3 hari setelah tanggal panen tercatat (17 Jul 2026). NDVI juga turun dari 0.55 ke 0.42 di periode yang sama."
  — hasil ini COCOK PERSIS dengan contoh kalimat di spesifikasi tugas (bukti implementasi benar).
- **(b) SSB/001, kuning:** "NBR turun dari 0.49 (3 Des 2023) ke 0.23 (18 Des 2023) — selisih -0.25 dalam 15 hari. NDVI turun dari 0.60 ke 0.32 di periode yang sama. Tidak ada tanggal panen tercatat dalam 21 hari sebelum penurunan ini, jadi kemungkinan besar ini transisi fase tanaman biasa (bukan bekas panen), atau gangguan data lain."
- **(c) MM34, abu-abu:** "Petak ini terdeteksi penurunan NBR mendadak pada 28 Okt 2024 (dNBR -0.10), TAPI tidak ada data tanggal panen tercatat sama sekali untuk musim tanam yang relevan — sistem tidak bisa menilai apakah ini terkait pembakaran atau bukan. Isi data &quot;Musim Tanam&quot; untuk petak ini supaya penilaian ke depan lebih akurat."

**Catatan format angka:** dipakai `toFixed(2)` (titik desimal, mis. "0.36") — KONSISTEN dengan format angka yang SUDAH dipakai di seluruh `PlotDashboard.tsx` (mis. insight NBR/NDWI lama), bukan koma ala Indonesia — keputusan sadar demi konsistensi visual dengan angka lain di halaman yang sama, bukan lupa localize.

`npx tsc --noEmit`: 3 error pre-existing yang sama, 0 error baru.
`npx eslint`: 2 error, KEDUANYA dikonfirmasi pre-existing (sama seperti sesi-sesi sebelumnya) — `BurnIndicatorBadge.tsx` sendiri 0 error.

**File diubah:**
- `components/plots/BurnIndicatorBadge.tsx`: 37 → 123 baris (+86)
- `components/plots/PlotDashboard.tsx`: +~12 baris (`burnReferenceScan` useMemo + props tambahan ke `BurnIndicatorBadge`)

**Status berikutnya:** murni perubahan tampilan (detail tambahan untuk badge yang sudah ada) — `update_owner.html` diupdate ringan, lihat entri terkait.

---

## [2026-07-27 05:46] — RENCANA (mockup saja, BELUM diimplementasi): PWA Mobile Petugas Lapangan + Checklist Validasi 5 Kategori — fondasi database ground-truth

**Konteks:** Sesi ini MURNI DOKUMENTASI — TIDAK ADA kode aplikasi (app/, components/, lib/) yang disentuh sama sekali. 2 mockup HTML dibuat TERPISAH di luar Claude Code (`Sinagri_UI_Mockup.html` diperbarui, `Sinagri_Mobile_Lapangan.html` baru) berisi rencana besar aplikasi mobile khusus petugas lapangan. Dicatat di sini sebagai spesifikasi yang disepakati, menyusul prioritas kerja (refactor dulu, lihat `docs/CHECKPOINTS.md`).

**Konsep besar:** aplikasi mobile terpisah (kandidat PWA) khusus petugas lapangan — BUKAN versi diciutkan dari desktop, tapi alur native mobile dengan 3 menu utama setelah pilih kawasan:

1. **📝 Update Lahan** — pilih nama petani dari DAFTAR petak yang sudah ada (bukan pencocokan otomatis nama/Excel yang rawan salah) → form ringkas (foto, tanggal tanam, tanggal panen, hasil panen, catatan) → submit. Edit detail lengkap (varietas, kepemilikan, dll) TETAP hanya lewat web/desktop.
2. **✏️ Polygon Baru** — peta penuh layar, gambar langsung di lapangan, isi nama petani, luas otomatis, simpan. EDIT ULANG bentuk polygon (setelah tersimpan) TETAP hanya lewat web/desktop — HP cuma bisa BUAT baru, konsisten dengan batasan yang sudah ada di alur desktop untuk drawing tool.
3. **🛰️ Analisa Satelit (BARU, paling penting)** — pilih petak dari daftar (ada penanda ⚠️ untuk yang terdeteksi perlu dicek dari sistem deteksi otomatis yang SUDAH ADA — dNBR+waktu panen dkk, lihat entri 26 Juli — TAPI SEMUA petak tetap bisa dibuka untuk audit rutin, tidak dibatasi cuma yang bermasalah) → tampilkan: badge status (merah/hijau sesuai deteksi otomatis yang sudah ada), 3 chart ringkas versi mobile-native (NDVI, NBR, SAR VH/VV — didesain ulang khusus mobile, BUKAN kompresi tampilan desktop), foto umum lapangan (opsional), dan **Checklist Validasi 5 Kategori** (baru, lihat di bawah).

**Checklist Validasi Lapangan — 5 kategori:**
Tiap kategori menampilkan "klaim sistem" saat itu (mis. "NDVI 0.23, fase: generatif" atau "dNBR -0.13, indikasi bakar"), tombol konfirmasi cepat (Sesuai / Tidak Sesuai / Tidak Yakin — khusus kategori Fase &amp; Jenis Lahan cukup Sesuai/Beda tanpa opsi "Tidak Yakin"), dan tombol foto TERPISAH per kategori (semua opsional, boleh dilewati):
- 🔥 Indikasi Pembakaran
- 💧 Pola Air (AWD)
- 🌾 Fase Tanaman
- 🌱 Jenis Lahan
- 📝 Catatan Umum (bebas teks, BUKAN konfirmasi klaim — untuk hal yang satelit tidak bisa lihat: hama, penyakit, tanaman rebah)

**Tujuan jangka panjang (alasan nilai tinggi fitur ini):** membangun **database ground-truth** dari konfirmasi lapangan. **Persyaratan teknis KRUSIAL:** tiap konfirmasi WAJIB menyimpan SNAPSHOT/SALINAN PERSIS nilai sistem saat itu (NDVI, NBR, dNBR, fase, dll) — BUKAN cuma referensi/link ke data live, karena data live bisa berubah di masa depan (reprocess, perbaikan formula — persis seperti insiden resx/resy 25 Juli) dan akan merusak validitas historis perbandingan "klaim sistem vs kondisi asli". Setelah data ground-truth terkumpul banyak (ratusan/ribuan), bisa dipakai untuk:
- Menghitung akurasi SUNGGUHAN per kategori — bukan tebakan/kalibrasi dari sample kecil seperti kasus dNBR yang ternyata terlalu sensitif (11,3% baris kena flag, lihat entri 25-26 Juli) atau SAR yang cuma pernah divalidasi n=1 plot.
- Kalibrasi ulang ambang batas berdasarkan bukti statistik nyata, bukan literatur umum yang belum tentu pas untuk konteks sawah Bali spesifik.
- Fondasi migrasi ke pendekatan machine learning di masa depan (platform seperti "Mittilabs" sudah pernah dibahas) — saat ini rule-based, ground-truth data ini jadi "bahan baku" kalau suatu saat mau upgrade ke model yang belajar dari data.

**Prasyarat WAJIB sebelum implementasi sungguhan (BUKAN sekadar "nice to have"):**
1. **Refactor kode** — sudah direncanakan &amp; checkpoint git sudah dibuat (`docs/CHECKPOINTS.md`, tag `checkpoint-before-refactor`, commit `37974c5`).
2. **Sistem auth multi-role** (rencana 19 Juli 2026, `docs/BRIEF_AgriMRV.md`) — HARUS tahu SIAPA yang mengisi validasi lapangan, terhubung ke akun/role pengguna (kandidat role `pekaseh`) — data ground-truth tanpa identitas pengisi yang jelas kurang bisa dipercaya/dilacak untuk keperluan akurasi/audit di atas.

**Status:** murni mockup/rencana, BELUM ADA implementasi kode sama sekali. `docs/BRIEF_AgriMRV.md` RIWAYAT KEPUTUSAN diupdate. `update_owner.html` (root+public) diupdate, ditandai TEGAS sebagai rencana belum dikerjakan.

**Validasi sesi ini:** dikonfirmasi tidak ada file di `app/`, `components/`, atau `lib/` yang tersentuh — `git status --short` sesudah sesi ini hanya menunjukkan perubahan di file dokumentasi (`docs/PROJECT_LOG.md`, `docs/BRIEF_AgriMRV.md`, `update_owner.html`/`public/update_owner.html`) plus `docs/CHECKPOINTS.md` yang masih untracked dari sesi sebelumnya (tidak disentuh sesi ini).

**Status berikutnya:** menunggu refactor selesai + keputusan eksplisit soal auth multi-role sebelum PWA lapangan ini bisa mulai diimplementasi.

---

## [2026-07-27 06:35] — INVESTIGASI MURNI (tanpa perubahan kode produksi): FeatureCollection Sentinel Hub Statistical API TIDAK didukung — premis penghematan PU tidak berlaku

**Konteks:** Sesi ini MURNI INVESTIGASI untuk rencana skala "seluruh Bali" (~160.000 petak), memeriksa apakah Statistical API (sinkron) Sentinel Hub bisa menerima banyak polygon dalam 1 request (`FeatureCollection`) untuk hemat kuota. TIDAK ADA kode produksi (`lib/sentinel-hub/*`, `app/api/cron/*`, `app/api/plots/*/scan/*`) yang disentuh — dikonfirmasi via `git status --short` di akhir sesi.

**Temuan utama — premis TIDAK terbukti benar, dikonfirmasi 3 lapis bukti independen:**
1. **Dokumentasi resmi** (`documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html` + halaman Examples) — tidak ada satupun contoh request pakai `FeatureCollection`, semua contoh pakai `bbox` atau 1 `Polygon` tunggal.
2. **Forum resmi Sentinel Hub, staf langsung** (thread "Statistical API & multipart POLYGON geometry") — dikutip persis: *"This is not possible for the moment, sorry, so you have to make a loop."* Multi-polygon batch HANYA tersedia lewat API terpisah, **Batch Statistical API** (async, upload GeoPackage ke S3-compatible storage, sampai 700.000 fitur per submission) — arsitektur yang JAUH berbeda dari yang diasumsikan (bukan sekadar ganti format body).
3. **UJI NYATA ke endpoint produksi sungguhan** (evalscript NDVI PERSIS sama dengan `lib/sentinel-hub/ndvi.ts`, token OAuth asli, 8 petak asli dari kawasan Kelompok tani Sri Galih — yang resx/resy-nya sudah diperbaiki): request `FeatureCollection` DAN `GeometryCollection` (dicoba jaga-jaga) SAMA-SAMA ditolak dengan **HTTP 400 `COMMON_BAD_PAYLOAD`**, pesan error persis menunjuk `input.bounds.geometry` sebagai field yang invalid. Tidak ada PU terpakai untuk request yang gagal ini (`x-processingunits-spent` kosong).

**Temuan sampingan penting (mengoreksi asumsi awal tugas — sesuai disiplin CLAUDE.md §6, tidak menutupi kesalahan info sebelumnya):**
- Klaim "100 PU minimum per request" yang sempat ditemukan lewat pencarian web TIDAK terbukti benar untuk Statistical API — dicek ulang di halaman resmi Quotas, tidak disebutkan sama sekali. **Bukti nyata dari 4x request sungguhan ke endpoint produksi** (3 request baseline per-polygon terpisah + 1 request dengan data valid, tanggal 2026-07-15, cloud 8.3%): PU terpakai konsisten **0.01 PU per request** — jauh lebih murah dari yang diasumsikan.
- Kuota free tier CDSE yang benar (dicek ulang di halaman resmi Quotas): **10.000 request/bulan DAN 10.000 PU/bulan** (rate limit 300/menit) — BUKAN 30.000 request/bulan seperti diasumsikan di awal tugas.
- Pola request produksi sungguhan (dibaca dari `app/api/cron/satellite-scan/route.ts`) TIDAK seragam "4 request/petak/hari" seperti asumsi awal: NDVI+NDWI (2 request Statistical API) hanya jalan kalau lolos `getEffectiveScanInterval` (adaptif, TIDAK selalu harian), SAR independen tiap 6 hari, dan NBR TIDAK ada di cron harian sama sekali (NBR cuma dipanggil manual lewat tombol scan di halaman detail petak, bukan otomatis harian).

**Estimasi biaya request/bulan (BUKAN jaminan, angka kasar berdasarkan pola cron nyata di atas, asumsi rata-rata ~3 request Statistical API/petak/hari mencakup NDVI+NDWI+SAR tergabung):**
- **Skala sekarang (~50 petak):** ±50 × 3 × 30 ≈ 4.500 request/bulan — MASIH DI BAWAH kuota gratis 10.000/bulan, konsisten dengan tidak adanya masalah kuota yang dialami sampai saat ini.
- **Skala menengah (~5.000 petak):** ±5.000 × 3 × 30 ≈ 450.000 request/bulan — ±45x di atas kuota gratis, PASTI perlu upgrade paket berbayar, dengan atau tanpa FeatureCollection (karena FeatureCollection tidak tersedia).
- **Skala seluruh Bali (~160.000 petak):** ±160.000 × 3 × 30 ≈ 14.400.000 request/bulan — skala yang jauh melampaui pola pakai Statistical API sinkron per-petak sama sekali, kemungkinan besar BUKAN arsitektur yang tepat pada skala ini terlepas dari isu kuota.

**Rekomendasi:**
- **TIDAK PERLU dikerjakan sekarang** — FeatureCollection terbukti tidak tersedia untuk Statistical API sinkron, jadi tidak ada yang bisa diimplementasikan dari premis awal tugas ini.
- **Kalau skala "seluruh Bali" benar-benar akan direalisasikan di masa depan:** solusi yang relevan BUKAN FeatureCollection, tapi evaluasi terpisah & jauh lebih besar cakupannya — migrasi ke **Batch Statistical API** (arsitektur async + GeoPackage + S3-compatible storage) dan/atau upgrade paket berbayar Sentinel Hub dan/atau menurunkan frekuensi scan per petak. ini layak jadi investigasi TERPISAH kalau/waktu skala itu jadi nyata, bukan pekerjaan sekarang.

**File yang disentuh:** HANYA dokumentasi (`docs/PROJECT_LOG.md`, `update_owner.html` + `public/update_owner.html`) dan 3 script investigasi sementara (`scripts/_tmp_featurecollection_test.mjs`, `scripts/_tmp_check_scandates.mjs`, `scripts/_tmp_pu_realdata_test.mjs`) yang SUDAH DIHAPUS di akhir sesi sesuai pola project ini — dikonfirmasi lewat `git status --short`, tidak ada kode produksi yang berubah.

**Status berikutnya:** tidak ada tindak lanjut kode. Kalau target "seluruh Bali" jadi konkret di masa depan, mulai investigasi terpisah soal Batch Statistical API (bukan lanjutan investigasi ini).

---

## [2026-07-27 07:10] — RENCANA (murni dokumentasi, BELUM diimplementasi): 7 spesifikasi pendukung "Skala Seluruh Bali"

**Konteks:** Sesi ini MURNI DOKUMENTASI — TIDAK ADA kode aplikasi (`app/`, `components/`, `lib/`) yang disentuh sama sekali, dikonfirmasi via `git status --short` di akhir sesi. Menyambung rencana besar "Skala Seluruh Bali" (~160.000 petak) yang mulai dibahas di investigasi FeatureCollection (27 Juli, entri di atas) — 7 spesifikasi berikut dicatat sebagai bagian dari rencana yang sama, saling terhubung.

**1. Saklar "Perlu Pemantauan Satelit" (per petak, toggle Ya/Tidak):**
"Tidak" (default untuk pemetaan massal) = petak cuma tersimpan bentuknya untuk peta "Semua Petak" (rencana 23 Juli), TIDAK PERNAH dipanggil `app/api/cron/satellite-scan/route.ts`, TIDAK makan kuota Sentinel Hub sama sekali. "Ya" = masuk daftar pemantauan otomatis seperti alur sekarang (tidak berubah). **Tujuan:** kendali kuota Sentinel Hub secara sadar di skala besar — langsung menjawab temuan investigasi FeatureCollection (27 Juli) bahwa kebutuhan request jauh melebihi kuota gratis (10.000/bulan) kalau SEMUA petak dipantau otomatis tanpa terkecuali. Implementasi teknis: kolom boolean baru di `plots`, filter tambahan di query `v_plots` yang dipakai cron.

**2. Toggle Pembibitan/Budidaya (per polygon, saat dibuat):**
Reuse pola dropdown "Jenis Lahan" (`status_lahan`) yang sudah ada di form petak. Kalau dipilih "Pembibitan" — form menampilkan field tambahan: Nomor Sertifikat Benih, dkk (field spesifik belum final, menyusul saat implementasi). **Keputusan penting:** diputuskan PER-POLYGON (bukan per-akun/saat pendaftaran petani) — supaya 1 kawasan/petani bisa punya campuran budidaya & pembibitan dalam petak-petak berbeda, tidak dipaksa 1 kategori untuk semua lahannya.

**3. Tema White-Label (Sinagri Organik/Regeneratif/Konversi, dll):**
Dikonfirmasi eksplisit oleh user: CUMA beda warna/logo/nama — BUKAN beda fitur/fungsi. Teknis: 1 field config tema per user/organisasi, mengganti nilai CSS variable (`--forest`, `--gold`, dkk yang sudah dipakai di seluruh aplikasi) + logo/nama saat render. **PRASYARAT KERAS:** sistem auth multi-role (rencana 19 Juli 2026, `docs/BRIEF_AgriMRV.md`) harus selesai dulu — perlu tahu SIAPA yang login untuk menentukan tema mana yang dipakai, tidak bisa dikerjakan sebelum itu.

**4. Mode Presentasi (BEDA dari role Viewer di poin 5 — bisa dikerjakan LEBIH CEPAT, TIDAK terikat auth):**
Tombol di akun admin sendiri (Ichan) yang menyembunyikan SEMUA tombol edit SECARA SEMENTARA — murni state tampilan/UI di sisi client, BUKAN pembatasan akses sungguhan di server. Tujuan: kebutuhan presentasi Ichan sendiri (mis. demo ke Rikolto/Dinas), supaya tidak ada tombol edit ter-klik tidak sengaja saat presentasi live. Klik lagi untuk kembali ke mode normal. **Karena murni UI state tanpa pembatasan server-side, ini AMAN dikerjakan kapan saja** — tidak butuh auth multi-role selesai dulu, beda dari poin 5.

**5. Role "Viewer" untuk pihak eksternal (Rikolto/Dinas/mahasiswa) — WAJIB tunggu auth multi-role, BEDA dari Mode Presentasi (poin 4):**
Login/akun terpisah, read-only + bisa download, TIDAK BISA edit/tambah/trigger apapun — pembatasan DITEGAKKAN DI SERVER (bukan cuma sembunyikan tombol di tampilan, beda mendasar dari poin 4). Sama dengan role "viewer" yang sudah direncanakan di keputusan arsitektur auth (23 Juli 2026) — sekarang dikonfirmasi juga dipakai untuk kebutuhan BARU: mahasiswa yang diminta mengaudit formula (NDVI dkk), butuh akses read-only murni tanpa risiko mengubah data produksi.

**6. Kurasi Manual Sumber Data per Kategori (untuk agregasi "Semua Petak" se-Bali — SOLUSI TAMBAHAN yang lebih murah, BUKAN pengganti Opsi D):**
Admin (Save Subak) MEMILIH SECARA MANUAL, per kategori Jenis Lahan, organisasi/sumber mana yang jadi "kebenaran resmi" untuk ditampilkan di total agregat (contoh: kategori Organik → ambil data dari LSO Kertha Bali Sejahtera saja; kategori Regenerative → dari Astungkara Way saja, dst — daftar sumber per kategori final menyusul saat implementasi). **Klarifikasi penting:** ini JAUH LEBIH MURAH dibanding deteksi otomatis lintas-semua-sumber (Opsi D penuh, rencana 23 Juli) karena tidak perlu deteksi collision otomatis untuk SEMUA pasangan petak se-Bali — TAPI ini BUKAN pengganti Opsi D, cuma solusi PERTAMA yang lebih murah untuk kasus SPESIFIK "total agregat Semua Petak Bali". Opsi D penuh (deteksi & review manual pasangan overlap individual, kasus Sangeh vs Sri Galih) tetap dicatat terpisah sebagai kebutuhan berbeda yang belum selesai.

**7. Deteksi Tumpang Tindih Real-Time saat Gambar Polygon Manual (reuse `lib/collision-detection.ts` yang SUDAH ADA & TERBUKTI BEKERJA dari fitur Import KML 25 Juli — logic yang sama, dipasang di titik tambahan, bukan logic baru):**
Alur 2 tahap:
- **Tahap 1 (real-time, saat user manapun selesai gambar polygon manual lewat tombol "+ Gambar Polygon Baru" yang sudah ada — BUKAN cuma lewat Import KML seperti sekarang):** sistem cek overlap terhadap SEMUA petak yang sudah ada di database, lintas kawasan/organisasi (pakai `lib/collision-detection.ts` yang sudah dites & terbukti bekerja di fitur KML). Kalau overlap signifikan terdeteksi — tampilkan pertanyaan RINGAN yang bisa dijawab langsung oleh orang di lapangan: "Apakah ini memang lahan yang SAMA dengan [nama petak lain]? Ya / Tidak / Tidak Yakin" — sengaja TIDAK meminta mereka memutuskan prioritas/mana data yang benar (keputusan itu terlalu besar untuk diputuskan di lapangan tanpa konteks penuh). Data TETAP tersimpan apapun jawabannya, jawaban cuma jadi metadata tambahan.
- **Tahap 2 (nanti, halaman admin terpisah — bagian dari Opsi D):** semua yang dijawab "Ya" atau "Tidak Yakin" di Tahap 1 masuk ke antrian/daftar tinjauan admin. Admin (dengan konteks lebih luas dibanding petugas lapangan) yang memutuskan mana yang jadi acuan resmi untuk laporan/total, atau ditandai "terkait" tanpa menghapus salah satu pihak.

**Urutan prioritas pengerjaan (TIDAK ADA yang dikerjakan sesi ini, murni dicatat untuk rencana):**
- **Poin 4 (Mode Presentasi):** bisa dikerjakan KAPAN SAJA, tidak terikat prasyarat lain — kandidat paling cepat kalau mau quick win.
- **Poin 2 & 7a (toggle Pembibitan, deteksi real-time Tahap 1):** bisa dikerjakan setelah refactor selesai (checkpoint `37974c5` sudah ada), TIDAK perlu auth multi-role dulu.
- **Poin 1, 6, 7b:** bagian dari fitur besar "Semua Petak" (sudah direncanakan 23 Juli), tetap menunggu giliran setelah refactor.
- **Poin 3 & 5:** WAJIB menunggu sistem auth multi-role selesai lebih dulu (prasyarat keras, secara teknis tidak bisa dikerjakan sebelum itu ada).

**Koneksi ke keputusan/rencana sebelumnya (untuk konteks siapapun yang baca log ini nanti):** investigasi FeatureCollection & kuota Sentinel Hub (27 Juli, entri di atas), fitur Import KML & `lib/collision-detection.ts` (25 Juli), rencana Opsi D deteksi duplikasi lahan (23 Juli), rencana auth multi-role & role viewer (23 Juli), rencana PWA Mobile Petugas Lapangan (27 Juli, entri sebelumnya), checkpoint refactor tag `checkpoint-before-refactor` commit `37974c5` (`docs/CHECKPOINTS.md`).

**Validasi sesi ini:** dikonfirmasi lewat `git status --short` bahwa TIDAK ADA file di `app/`, `components/`, atau `lib/` yang berubah sesi ini — hanya `docs/PROJECT_LOG.md`, `docs/BRIEF_AgriMRV.md`, `update_owner.html` + `public/update_owner.html` yang berubah, dan keduanya (`update_owner.html` root & public) dikonfirmasi identik lewat `diff`.

**Status berikutnya:** murni rencana, menunggu prioritas & giliran implementasi sesuai urutan di atas — belum ada satupun dari 7 poin ini yang mulai dikerjakan kodenya.

---

## [2026-07-27 08:15] — BUG FIX: "Kuota Lahan 45/100 Ha" di header TERNYATA hardcode, sekarang dihubungkan ke data asli

**Konteks:** User curiga elemen "Kuota Lahan X/100 Ha" di pojok kanan-atas header (tampil di SEMUA halaman kecuali landing page — `components/layout/AppTopbar.tsx`, dipasang global di `app/layout.tsx`) nilainya statis/palsu. Diminta investigasi dulu sebelum diperbaiki.

**Investigasi (root cause, dibuktikan bukan asumsi):**
- Kode: `const mockUser = { usedAreaHa: 45, maxAreaHa: 100 }` — literal hardcode, dengan komentar eksplisit `// TODO: Fetch real user and organization data from Supabase` di baris sebelumnya. Pengakuan langsung dari kode aslinya.
- Dicek langsung ke database (bukan diasumsikan "mungkin kebetulan cocok"): SUM(`plots.area_ha`) untuk SEMUA petak non-dihapus (60 petak, lintas 5 kawasan) = **18,40 Ha** — BUKAN 45 Ha. `kawasan.total_area_ha` NULL untuk semua kawasan. Angka 45 terbukti TIDAK terhubung ke data apapun.
- Ditelusuri asal-usulnya: `docs/migration_v2_saas.sql` (rencana SaaS multi-tenant lama) mendefinisikan `organizations.max_area_ha_limit numeric not null default 100` — PERSIS sama dengan angka 100 di AppTopbar, bukan kebetulan. `app/superadmin/page.tsx` (halaman admin developer) punya mock data IDENTIK (`limit: 100, used: 45` untuk org fiktif "Kelompok Tani Makmur", nama yang tidak cocok kawasan asli manapun). Dicek langsung: tabel `organizations` dari migration itu **belum pernah dijalankan ke database** (query `select * from organizations` gagal "table not found"). Kesimpulan: sisa scaffolding rencana SaaS multi-tenant yang tidak pernah selesai sampai ke database sungguhan.

**Fix — Tugas 1 (pembilang dinamis):**
- `app/layout.tsx` diubah jadi `async function`, hitung `usedAreaHa = SUM(plots.area_ha)` untuk semua petak `is_deleted=false` (query `createAdminClient()`, server-side, sekali per request halaman), dikirim sebagai prop ke `AppTopbar`.
- `components/layout/AppTopbar.tsx`: `mockUser` dihapus total, komponen sekarang terima `usedAreaHa`/`maxAreaHa` sebagai props. Format tampilan pakai `.toFixed(3)` — SAMA dengan pola pembulatan "Total Luas Terdaftar" yang sudah ada di `KawasanPageClient.tsx`, bukan format baru.
- **Verifikasi:** dihitung manual langsung ke database (script sementara, dihapus setelah dipakai) = 18,398 Ha. Dicurl LANGSUNG ke server dev sungguhan (2 halaman berbeda: `/kawasan`, `/superadmin`) — HTML asli menampilkan `18.398 / 100` di kedua halaman, cocok PERSIS dengan hitungan manual. Dicurl juga `/` (landing page) — 0 kemunculan "Kuota Lahan", mengonfirmasi topbar tetap tersembunyi di sana seperti sebelumnya (tidak ada regresi ke behavior lama).

**Fix — Tugas 2 (batas maksimal dinamis via tabel settings):**
- Migration baru `docs/migration_v23_app_settings.sql`: tabel generik `app_settings (key text primary key, value text not null, updated_at timestamptz)`, RLS aktif + 1 policy baca-publik (sesuai checklist wajib CLAUDE.md §7), baris default `('max_quota_ha', '100')` — SAMA dengan nilai lama supaya tidak ada perubahan tampilan mendadak. Berisi komentar panjang & jelas: nilai ini SEMENTARA GLOBAL (1 baris untuk semua user), BUKAN desain final — begitu auth multi-role & tabel `organizations` (migration v2 lama) benar-benar dibangun, HARUS dipindah jadi per-organisasi (`organizations.max_area_ha_limit`).
- `app/layout.tsx` query `app_settings` untuk `key='max_quota_ha'`, parse ke Number, dengan **fallback graceful ke 100** kalau tabel belum ada/nilai bukan angka valid (`Number.isFinite(...) && > 0`) — sesuai CLAUDE.md §6 poin 6 (migration belum dikonfirmasi jalan, kode HARUS tidak crash kalau tabel belum ada, apalagi ini layout global yang membungkus SEMUA halaman).
- **PERLU DIJALANKAN MANUAL oleh user** lewat Supabase SQL Editor — dicek dulu, `run-migration.js` masih gagal dengan error yang SAMA PERSIS seperti sebelumnya ("tenant not found"), dikonfirmasi ulang lewat percobaan nyata (bukan diasumsikan dari histori), bukan cuma diasumsikan. Sampai migration dijalankan, batas maksimal TETAP tampil 100 (fallback aktif, dibuktikan lewat curl live server — tidak ada tabel `app_settings` di DB saat ini, dan tampilan tetap `/ 100`, membuktikan fallback bekerja).
- **BELUM DIVALIDASI (menunggu user run migration):** skenario "ubah `app_settings.max_quota_ha` lewat SQL, refresh, batas berubah" — TIDAK BISA dites sampai tabelnya benar-benar ada. Logic kode sudah benar secara pembacaan (parse + fallback), tapi bukti end-to-end nyata baru bisa didapat setelah migration dijalankan.

**Validasi:** `npx tsc --noEmit` — 3 error, SEMUA dikonfirmasi PRE-EXISTING (sama seperti sesi Tahap 1 refactor sebelumnya, dicek ulang lewat `git stash` compare) — 0 error baru. `npx eslint app/layout.tsx components/layout/AppTopbar.tsx` — 0 masalah.

**File yang diubah/dibuat:**
- `app/layout.tsx` — jadi async, fetch usedAreaHa+maxAreaHa
- `components/layout/AppTopbar.tsx` — mockUser dihapus, terima props
- `docs/migration_v23_app_settings.sql` — BARU, belum dijalankan user

**Status berikutnya:** menunggu user menjalankan `migration_v23_app_settings.sql` via Supabase SQL Editor, lalu verifikasi end-to-end "ubah nilai → refresh → batas berubah" bisa diselesaikan.

---

## [2026-07-27 08:40] — Tambah total luas (Ha) ke kartu kawasan di Dashboard Kawasan

**Konteks:** Kartu kawasan di halaman `/kawasan` (Dashboard Kawasan, `KawasanListClient.tsx`) cuma tampil "X petak" — total luas TIDAK PERNAH tampil, meski ada kode `{k.total_area_ha != null && ...}` yang seharusnya menampilkannya. Root cause: `kawasan.total_area_ha` NULL untuk SEMUA kawasan (dikonfirmasi sebelumnya di investigasi Kuota Lahan 27 Juli), jadi kondisi itu tidak pernah terpenuhi — bukan bug tampilan salah, tapi info yang hilang total.

**Fix:** `app/kawasan/page.tsx` sekarang menghitung `plot_area_ha` LANGSUNG dari `v_plots.area_ha` per `kawasan_id` (pola sama seperti `app/kawasan/[kawasanId]/page.tsx` menghitung "Total Luas Terdaftar" di dalam 1 kawasan) — BUKAN dari kolom `total_area_ha` yang mati. `KawasanListClient.tsx` tampilkan `plot_area_ha.toFixed(3)` — format PERSIS sama dengan "Total Luas Terdaftar" (3 desimal, satuan "ha" terpisah).

**PENTING — beda dari Kuota Lahan header:** ini SUM per-kawasan (masing-masing kartu beda angka), BUKAN gabungan semua kawasan seperti Kuota Lahan di header (fix sesi sebelumnya) — 2 fitur terpisah, tidak saling menyentuh. Dikonfirmasi `app/layout.tsx` & `components/layout/AppTopbar.tsx` (file Kuota Lahan) TIDAK disentuh sesi ini (`git diff --stat` sama persis dengan sebelumnya).

**Validasi:** dicurl LANGSUNG ke server dev sungguhan — angka di kartu `/kawasan` dibandingkan dengan "Total Luas Terdaftar" di halaman detail masing-masing dari 5 kawasan, SEMUA COCOK PERSIS (Subak Sangeh 6.396, Regenerative 4.821, Kelompok tani Sri Galih 6.058, Subak Selan Bawak 1.098, Subak Timbul 0.025 — semua satuan ha). `npx tsc --noEmit`: 3 error, sama persis pre-existing seperti sesi-sesi sebelumnya (dikonfirmasi `git stash` compare) — 0 error baru.

**File diubah:** `app/kawasan/page.tsx` (+12/-2), `components/kawasan/KawasanListClient.tsx` (+8/-1).

**Status berikutnya:** tidak ada — fitur kecil ini selesai & mandiri.

---

## [2026-07-28] — Tahap 2 refactor: konsolidasi evalscript NDVI/NDWI/NBR + estimatePhase() SELESAI & di-commit (tag `refactor-tahap-2`)

**Konteks:** Lanjutan refactor bertahap (7 tahap disepakati), checkpoint sebelumnya `refactor-tahap-1` (commit `4152406`). Audit Tahap 0 menemukan evalscript NDVI/NDWI/NBR (Statistical API) dan `estimatePhase()` ditulis ulang di beberapa lokasi terpisah — pola persis yang menyebabkan bug resx/resy sebelumnya perlu diperbaiki di 4 lokasi kode berbeda.

**Verifikasi ulang lokasi (Tugas 0):** `app/api/plots/[plotId]/scan/route.ts` dan `.../baseline/route.ts` punya evalscript NDVI/NDWI/NBR + `estimatePhase()` BYTE-FOR-BYTE IDENTIK (dikonfirmasi `diff`, 0 baris beda) — 2 duplikat murni. `app/api/cron/satellite-scan/route.ts` TIDAK punya evalscript inline — memanggil `fetchNdvi()`/`fetchNdwi()` dari `lib/sentinel-hub/ndvi.ts`/`ndwi.ts`, yang punya evalscript lokal sendiri (parameter `samples`, bukan `s`) — matematis identik tapi teks beda (duplikat ke-3 secara tidak langsung). Koreksi kecil dari premis awal: `NBR_STATS_EVALSCRIPT` HANYA duplikat 2x (scan+baseline), cron TIDAK PERNAH menghitung NBR sama sekali. `estimatePhase()` tergandakan di 3 lokasi (2 fungsi identik + 1 logic inline di cron).

**Snapshot "sebelum" (Tugas 1):** Regenerative/001 (`8886313e-a25a-4184-bd30-db3bfd4e7f27`) tanggal 2026-07-20: ndvi=0.4152, ndwi=-0.4138, nbr=0.2335, cloud=0%, fase=pematangan (+ tanggal 2026-07-15 sebagai pembanding kedua). SSB004 (`cb705501-8233-4804-b4f1-519aec43b87d`) tanggal 2026-07-27: ndvi=0.3207, ndwi=-0.2785, nbr=0.2618, cloud=100%, fase=null (cloud di atas ambang 15%, phase memang harus null).

**Konsolidasi (Tugas 2 & 3):** File baru `lib/sentinel-hub/formulas.ts` (bukan `lib/sentinel-formulas.ts` seperti disebut awal — dipindah ke folder `lib/sentinel-hub/` supaya konsisten konvensi project yang sudah ada) — export `NDVI_EVALSCRIPT`, `NDWI_EVALSCRIPT`, `NBR_STATS_EVALSCRIPT`, `estimatePhase()`, `fetchSentinelStats()`. Teks evalscript copy-paste PERSIS dari duplikat scan/baseline (dipilih sebagai kanonis, mayoritas 2 dari 3 turunan). `scan/route.ts` & `baseline/route.ts` diupdate import dari file baru, hapus duplikat lokal. `lib/sentinel-hub/ndvi.ts`/`ndwi.ts` diupdate import constant yang sama (ganti teks `samples`→`s`, matematis identik). `cron/satellite-scan/route.ts`: blok if/else-if inline diganti panggilan `estimatePhase()`. resx/resy & `CLOUD_COVER_THRESHOLD` (hasil Tahap 1, di `lib/plot-geo.ts`) TIDAK disentuh/dipindah — tetap dari sumber yang sudah ada.

**Validasi (WAJIB, paling ketat karena menyentuh data satelit sungguhan):**
- `npx tsc --noEmit`: 3 error, SEMUA pre-existing (PlotMapInner.tsx, PlotDashboard.tsx, test-nbr.ts — dikonfirmasi tidak ada di file yang diubah sesi ini). 0 error baru.
- `npx eslint`: 1 error pre-existing (`baseline/route.ts:129 catch (error: any)`, dikonfirmasi via `git diff` baris itu tidak berubah). 0 error baru.
- **Validasi live 8/8 angka identik**: dipanggil `POST .../baseline` untuk KEDUA petak snapshot (server dev sungguhan) — Regenerative/001 tanggal 2026-07-20 (ndvi/ndwi/nbr/fase) DAN 2026-07-15 (tambahan) SAMA PERSIS dengan snapshot sebelum. SSB004 tanggal 2026-07-27 SAMA PERSIS termasuk kasus tepi cloud=100%→fase=null. Ditampilkan user dalam tabel terpisah, dikonfirmasi 8/8 "Ya" (identik).

**TEMUAN PENTING TERPISAH — bug PRE-EXISTING di jalur cron, TIDAK disebabkan Tahap 2:** Saat validasi live jalur cron diminta user (dites lewat route test sementara yang memanggil PERSIS `fetchNdvi()`/`fetchNdwi()` seperti cron, tanpa menulis ke DB, dihapus setelah dipakai) — hasil NULL untuk kedua tanggal snapshot. Diisolasi (sesuai disiplin CLAUDE.md §6, bukti bukan teori): (1) evalscript LAMA pre-Tahap-2 dengan window sama JUGA gagal → evalscript BUKAN penyebab; (2) evalscript BARU dengan window lebar (±5 hari) → data ketemu, identik dengan nilai tersimpan → evalscript hasil konsolidasi TERBUKTI benar; (3) window 1-hari tapi `to` digeser ke tengah malam berikutnya (bukan `23:59:59Z` hari yang sama) → data ketemu. **Kesimpulan berbukti:** `fetchNdvi()`/`fetchNdwi()` (`lib/sentinel-hub/ndvi.ts`/`ndwi.ts`, SATU-SATUNYA pemanggil dari cron) memakai window query 1-hari persis dengan batas `to: ${date}T23:59:59Z` yang membuat Sentinel Hub Statistics API mengembalikan data kosong — bug ini SUDAH ADA SEBELUM Tahap 2 (kode `timeRange` tidak disentuh sama sekali sesi ini). Indikasi kuat (belum pasti 100%, cuma dites 2 tanggal): cron harian kemungkinan besar TIDAK PERNAH berhasil mengisi NDVI/NDWI di produksi sejak awal. `scan/route.ts` (window 30 hari), `baseline/route.ts` (window 1095 hari), dan `scripts/backfill-satellite.mjs` (chunk 15 hari) semua pakai window LEBAR — TIDAK kena bug ini.

**Keputusan:** bug ini TIDAK diperbaiki sesi ini (di luar mandat, murni tugas validasi) — dicatat sebagai temuan terpisah untuk investigasi/perbaikan mandiri, TIDAK dicampur ke commit Tahap 2.

**Commit & tag:** commit `1ebcf76` ("Tahap 2 refactor: konsolidasi evalscript NDVI/NDWI/NBR + estimatePhase()"), tag `refactor-tahap-2`. TIDAK di-push (lokal saja, sesuai instruksi). `docs/CHECKPOINTS.md` diupdate dengan entri checkpoint ini (termasuk catatan bug pre-existing di atas).

**File yang diubah:** `app/api/plots/[plotId]/scan/route.ts`, `app/api/plots/[plotId]/baseline/route.ts`, `app/api/cron/satellite-scan/route.ts`, `lib/sentinel-hub/ndvi.ts`, `lib/sentinel-hub/ndwi.ts` (semua M), `lib/sentinel-hub/formulas.ts` (baru).

`update_owner.html` **BELUM diupdate** untuk Tahap 2 ini — perlu ditambahkan entri baru di tab "🔧 Progress Refactor" (REFACTOR_LOG array) sesuai pola Tahap 1, plus pertimbangkan apakah temuan bug cron di atas perlu masuk tab "Log Error" juga (dampak potensial ke user: NDVI/NDWI harian mungkin tidak pernah terupdate otomatis via cron).

**Status berikutnya:** (1) `update_owner.html` (root+public) perlu diupdate untuk Tahap 2 + temuan bug cron. (2) Bug window-1-hari di `fetchNdvi()`/`fetchNdwi()` menunggu keputusan user soal prioritas investigasi/perbaikan terpisah. (3) Lanjut ke Tahap 3 refactor kalau user siap.

---

## [2026-07-31] — ⚠️ INSIDEN KEAMANAN: email Supabase "Table publicly accessible" — diinvestigasi, TIDAK ditemukan tabel bocor baru, tapi verifikasi resmi TIDAK BISA dijalankan + 2 temuan lain

**Dikerjakan:**
- **Trigger:** User menerima email peringatan otomatis Supabase "Table publicly accessible" untuk project `fxuexjlvmbswnddwlbey` — jenis sama persis dengan insiden 07 Juli (`user_profiles`).
- **Blocker utama:** `SUPABASE_DB_URL` (dipakai `run-migration.js` dan untuk query langsung `pg`) GAGAL konek dengan error persis sama seperti yang sudah dicatat sejak 18 Juli ("tenant/user ... not found") — dicoba ulang di pooler port 6543 (transaction) dan 5432 (session), keduanya gagal identik. Ini BUKAN masalah baru, dan berarti query resmi yang diminta (`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'`) **TIDAK BISA dijalankan otomatis dari sesi ini** — beda dari insiden 07 Juli di mana user sendiri yang menjalankan query itu di SQL Editor.
- **RPC `exec_sql` dicoba sebagai jalan alternatif** (ditemukan referensinya di `test-rpc.js`) — dikonfirmasi RPC ini **tidak ada** di database saat ini (`PGRST202`, function not found). Bukan jalan keluar.
- **Investigasi pengganti (empiris, TIDAK 100% setara query resmi):**
  1. Diambil daftar semua tabel aplikasi yang benar-benar ada di database lewat OpenAPI spec PostgREST (`GET /rest/v1/`, service_role key) — 11 tabel: `season_water_pattern_analysis`, `plots`, `field_logs`, `mrv_methodology_analysis`, `kawasan`, `plot_ownership_history`, `mrv_carbon_records`, `user_profiles`, `weather_logs`, `planting_seasons`, `satellite_logs`. (`organizations` dan `app_settings` dari migration v2_saas/v23 dikonfirmasi masih belum pernah dijalankan — konsisten dengan catatan sesi-sesi sebelumnya.)
  2. Tiap 1 dari 11 tabel itu di-query lewat **anon key** (persis seperti akses publik tanpa login yang jadi concern email Supabase): 10 tabel mengembalikan HTTP 500 "infinite recursion detected in policy for relation user_profiles" (artinya RLS **aktif** di tabel-tabel itu, tapi ada bug terpisah — lihat temuan (b) di bawah). 1 tabel (`planting_seasons`) mengembalikan HTTP 200 dengan 0 baris.
  3. `planting_seasons` dicek lebih lanjut via service_role (bypass RLS) — isi asli **14 baris**, membuktikan 0 baris yang didapat anon BUKAN karena tabel kosong, tapi karena RLS aktif+benar (policy `admin_all` di migration v6 memang hanya untuk `service_role`, default-deny untuk anon — sesuai desain).
  4. Cross-check ke SEMUA file `docs/migration_v*.sql`: ke-11 tabel di atas tercatat sudah pernah `ENABLE ROW LEVEL SECURITY` (7 tabel di v1 + fix v11 untuk `user_profiles`, `plot_ownership_history` v9, `planting_seasons` v6, `season_water_pattern_analysis` v12, `weather_logs` v20).
  5. `spatial_ref_sys` (tabel bawaan PostGIS, 8500 baris) dikonfirmasi tetap terbuka lewat anon key — SESUAI ekspektasi, ini false-positive standar yang SUDAH diterima sejak insiden 07 Juli (dicatat eksplisit "sengaja tidak disentuh" di entri itu).
- **Kesimpulan (bukan kepastian mutlak):** dari 11 tabel aplikasi yang bisa dicek, TIDAK ada yang RLS-nya benar-benar mati. Kemungkinan besar email baru ini soal `spatial_ref_sys` yang muncul lagi (advisory Supabase kadang mengulang notifikasi False-positive PostGIS ini). **TAPI tidak bisa dipastikan 100%** karena: (i) query resmi ke `pg_tables` tidak bisa dijalankan langsung (blocker di atas), (ii) ada kemungkinan kecil ada tabel baru dibuat lewat Supabase Table Editor yang belum tercermin di cache schema PostgREST saat pengecekan ini dilakukan.
- **Temuan tambahan (a) — kredensial ter-hardcode:** `test-rpc.js` (file ter-commit ke git) menyimpan API key `service_role` (bypass semua RLS) secara polos di kode. Dicek: hash key ini TIDAK COCOK dengan `SUPABASE_SERVICE_ROLE_KEY` yang aktif sekarang di `.env.local` — key ini sudah tidak valid/sudah pernah diganti, jadi TIDAK berbahaya saat ini. Dicek juga `git remote -v` — kosong, repo ini tidak pernah di-push/dibagikan, jadi eksposur terbatas ke mesin lokal. **Diperbaiki:** key hardcode dihapus, diganti baca dari `process.env.SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_URL` (pola sama seperti fix `run-migration.js` 18 Juli).
- **Temuan tambahan (b) — bug baru, BELUM diperbaiki:** 10 dari 11 tabel gagal total (HTTP 500 "infinite recursion") saat diakses tanpa autentikasi lewat anon key, karena policy RLS di tabel-tabel itu melakukan subquery ke `user_profiles`, dan `user_profiles` sendiri punya policy yang balik memeriksa dirinya sendiri → rekursi tak berujung. **Ini bug fail-safe** (dampaknya over-blocking/500 error, BUKAN kebocoran data) tapi berarti kemungkinan besar ada jalur akses publik/anon di aplikasi yang SAAT INI rusak total, bukan cuma "kurang aman". Butuh akses database langsung (definisi policy) untuk didiagnosis & diperbaiki — tidak bisa dari sesi ini karena blocker koneksi di atas.
- Script diagnostik sementara (`scripts/_tmp_check_rls*.mjs`) dibuat & dihapus lagi setelah dipakai, sesuai pola project.

**Keputusan/catatan penting:**
- TIDAK melakukan `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` apapun sesi ini — karena tidak ada tabel yang terbukti perlu itu dari pengecekan yang bisa dilakukan, dan lagipula tidak ada jalur database yang berfungsi untuk mengeksekusinya seandainya perlu.
- Blocker koneksi database (`SUPABASE_DB_URL` "tenant not found") sekarang tercatat SUDAH terjadi konsisten di 3 sesi terpisah (18 Juli, 27 Juli migration v23, dan sesi ini) — pola ini sendiri layak jadi prioritas untuk diselesaikan (kemungkinan password di `.env.local` sudah tidak sinkron dengan password asli di Supabase), supaya migration/investigasi berikutnya tidak selalu buntu di titik yang sama.

**PERLU DIKERJAKAN USER (SQL Editor, read-only, aman):**
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```
Kalau hasilnya cuma `spatial_ref_sys` yang `rowsecurity=false` → aman, insiden ini ditutup sebagai false-positive berulang. Kalau ada tabel LAIN yang `false` → sampaikan nama tabelnya untuk dibuatkan migration perbaikan (pola `ENABLE ROW LEVEL SECURITY` + policy `admin_full_access`/`auditor_read`, sama seperti v11).

**File yang diubah:** `test-rpc.js` (hapus service_role key hardcode, +0/-1 baris berubah jadi baca dari env), `update_owner.html` + `public/update_owner.html` (1 entri baru di `ERROR_LOG`, disinkronkan & dikonfirmasi identik lewat `diff`).

**Status berikutnya:** (1) Menunggu user menjalankan query verifikasi di atas dan melaporkan hasilnya. (2) Kalau ada tabel baru yang perlu RLS — siapkan & minta user jalankan migration fix. (3) Investigasi terpisah untuk bug rekursi kebijakan `user_profiles` (temuan b) — prioritas tinggi karena kemungkinan mematikan akses publik/anon di aplikasi saat ini. (4) Pertimbangkan menyelesaikan blocker koneksi `SUPABASE_DB_URL` yang sudah berulang 3x, supaya sesi berikutnya tidak selalu manual lewat SQL Editor.

---

## [2026-10-23 22:53] — Fix 3 bug: window cron Sentinel (T23:59:59Z), rekursi RLS user_profiles (migration v24), diagnosa SUPABASE_DB_URL (host pooler aws-0 → aws-1)

**Dikerjakan:**
- Checkpoint: tag `backup-before-bugfix-rls-cron-2026-10-23` (working tree bersih, cuma `RINGKASAN_UNTUK_CHAT_BARU.md` untracked — tidak disentuh).
- **BUG 2 — window 1 hari Sentinel (commit `d54017e`).** Direproduksi dulu dengan request nyata (plot Regenerative/001 `8886313e`): `07-20T00:00Z → 07-20T23:59:59Z` = **0 interval**; `→ 07-21T00:00Z` = **1 interval**; window multi-hari `07-15 → 07-20T23:59:59Z` = **hanya 07-15, tanggal 07-20 hilang**. Kesimpulan berbukti: Statistical API (aggregationInterval P1D) membuang interval terakhir yang tidak penuh — bukan cuma cron yang kena, tapi SEMUA pemanggil Statistical API kehilangan hari terakhir. Fix: helper `statsTimeRange()` di `lib/sentinel-hub/formulas.ts` (batas akhir eksklusif = tengah malam hari berikutnya, aman lintas bulan/tahun — dites 07-31→08-01, 12-31→2027-01-01), dipakai di `ndvi.ts`, `ndwi.ts`, `sar.ts`, `fetchSentinelStats` (scan & baseline); `scripts/backfill-satellite.mjs` & `backfill-sar.mjs` diperbaiki inline (helper `nextDay`). **Validasi:** `fetchNdvi()`/`fetchNdwi()` asli (jalur cron) dipanggil untuk 3 snapshot sesi Tahap 2 — Regenerative/001 07-20: NDVI 0.4152 / NDWI −0.4138 / cloud 0% (sebelumnya NULL), SSB004 07-27: 0.3207 / −0.2785 / cloud 100% → **identik dengan snapshot tersimpan**.
  - TIDAK diubah (sengaja): `truecolor.ts`, `nbr.ts` (Process API, `dataFilter.timeRange` tanpa interval agregasi), `catalog.ts`/`backfill-metadata.mjs` (STAC datetime), `plot-insights.tsx` (WMS), `scripts/audit-cloud-cover.mjs`, `scripts/test-sentinel1.mjs`, `test-nbr.ts` (skrip uji/audit sekali pakai — masih pola lama, perbaiki kalau dipakai lagi).
- **BUG 1 — rekursi RLS (commit `29e3857` + `3429af6`).** Dikonfirmasi dari kode: `migration_v11:49-50` policy `admin_full_access_user_profiles` PADA `user_profiles` berisi `exists (select 1 from user_profiles …)` → rekursi 42P17. Direproduksi live (anon key, read-only): 10/11 tabel HTTP 500 `42P17`, `planting_seasons` 200 (satu-satunya tanpa subquery ke user_profiles). Inventaris live `pg_policies` (read-only): tepat **24 policy** subquery ke `user_profiles` (19 public + 5 storage.objects) — semuanya ada di file migration, tidak ada policy liar. Ditulis `docs/migration_v24_fix_rls_recursion.sql` (nama query `24_fix_rls_recursion_is_admin`): fungsi `public.is_admin()` & `public.get_my_role()` (SECURITY DEFINER, STABLE, `SET search_path = public`), 24 policy diganti, `self_read_own_profile` dipertahankan, `ENABLE RLS` diulang untuk 11 tabel, dibungkus `BEGIN/COMMIT`, bagian storage kondisional (hanya ganti kalau policy ada) + tahan `insufficient_privilege`. Verifikasi: `docs/migration_v24_verifikasi.sql` (nama query `24b_verifikasi_rls_recursion`).
  - **Temuan penting:** `auth.users` DAN `user_profiles` **KOSONG (0 baris)** di DB live; seluruh app (22 file) pakai client `service_role` (`lib/supabase/admin.ts`), client anon/browser (`client.ts`, `server.ts`) tidak dipakai di mana pun → bug rekursi **belum berdampak ke user**, tapi akan memblokir total begitu login dipakai. Karena itu skrip verifikasi membuat 4 user uji (admin/auditor/2 pekaseh) di sub-transaksi yang SELALU dibatalkan, lalu cek data uji tidak tertinggal.
  - Kedua file SQL lolos parser Postgres asli (`@libpg-query/parser`, termasuk body PL/pgSQL; kontrol negatif membuktikan parser menangkap error). Itu validasi SINTAKS saja — belum dieksekusi ke DB (sesuai instruksi, user yang menjalankan).
  - Semantik akses 1:1 dengan sebelumnya (fungsi hanya melihat baris milik `auth.uid()`, persis yang bisa dibaca lewat `self_read_own_profile`; tidak menambah cek `is_active`).
- **BUG 3 — `SUPABASE_DB_URL` (diagnosa, `.env.local` TIDAK diubah).** Struktur dicek tanpa menampilkan nilai: format benar (`postgresql://postgres.<ref>:…@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`), ref cocok, password ter-URL-encode benar & decode OK. Uji koneksi nyata: DNS `aws-0` resolve (3× IPv4), server menjawab `XX000 tenant/user postgres.<ref> not found`; **dengan password yang sama, host `aws-1-ap-southeast-1.pooler.supabase.com:6543` BERHASIL** (PostgreSQL 17.6). Direct host `db.<ref>.supabase.co` = ENOTFOUND dari mesin ini (kemungkinan host IPv6-only tanpa IPv6 di jaringan lokal — tidak dibuktikan lebih lanjut, tidak dibutuhkan).
  - **Koreksi eksplisit atas dugaan lama (sesi 18 Juli, 27 Juli, 31 Juli):** dugaan "password di .env.local tidak sinkron" itu **SALAH**. Supavisor mencari tenant sebelum memeriksa password, jadi password tidak pernah diperiksa; penyebab sebenarnya host cluster pooler (`aws-0` vs `aws-1`).
  - Koneksi `aws-1` (hanya di memori skrip) dipakai untuk query **read-only** (`BEGIN TRANSACTION READ ONLY`): inventaris policy, status RLS (hanya `spatial_ref_sys` tanpa RLS — menutup pertanyaan insiden 31 Juli), jumlah user. Tidak ada write ke DB sesi ini.
- **tsc 0 error (commit `3cabb75`)** — 3 error lama dibereskan: `PlotDashboard.tsx` InfoTooltip "Tutupan awan" pakai prop `text` yang tidak ada (komponen baca `children`) → tooltip selama ini KOSONG, teks dipindah ke children; `PlotMapInner.tsx` perbandingan mati `activeLayer !== 'sar'` dihapus (perilaku sama); `test-nbr.ts` anotasi parameter. `npx tsc --noEmit` exit 0.
- Docs: `BRIEF_AgriMRV.md` (Riwayat Keputusan 23 Okt), `STATUS_SAAT_INI.md`, `update_owner.html` + `public/update_owner.html` (entri ERROR_LOG 23 Okt, identik dicek `diff`, JS parse OK).
- Skrip diagnostik di scratchpad sesi (di luar repo), tidak ada file sementara di project.

**Keputusan/catatan penting:**
- Policy RLS baru WAJIB pakai `(SELECT public.is_admin())` / `(SELECT public.get_my_role()) = '<role>'`, jangan subquery ke `user_profiles`. `migration_v2_saas` (belum dijalankan) masih pakai pola lama — ubah dulu kalau kelak dijalankan.
- Statistical API: batas akhir selalu via `statsTimeRange()`.

**Baris berubah:** `formulas.ts` 111→124, `ndvi.ts` 88→85, `ndwi.ts` 58→55, `sar.ts` 114→115, `backfill-satellite.mjs` 302→306, `backfill-sar.mjs` 311→315, `PlotDashboard.tsx` 2262→2262, `PlotMapInner.tsx` 198→198, `test-nbr.ts` 72→73, `update_owner.html` 697→700; file baru `migration_v24_fix_rls_recursion.sql`, `migration_v24_verifikasi.sql`.

**PERLU DIKERJAKAN USER:**
1. Supabase SQL Editor: jalankan `docs/migration_v24_fix_rls_recursion.sql` (nama query `24_fix_rls_recursion_is_admin`) — hasil terakhir harus **0 baris**.
2. Lalu `docs/migration_v24_verifikasi.sql` (nama query `24b_verifikasi_rls_recursion`) — harus 8 baris `LULUS`.
3. `.env.local` baris `SUPABASE_DB_URL`: ganti `aws-0-` → `aws-1-` (password jangan diubah).
4. Buka halaman petak, arahkan ke ikon ⓘ di samping "Tutupan awan" — sekarang harus ada teksnya.

**Status berikutnya:** menunggu hasil (1)–(2). Setelah host DB diganti, `run-migration.js` & query `pg` langsung bisa dipakai lagi untuk migration/investigasi berikutnya. Cron belum dibuktikan jalan di produksi (belum deploy) — saat deploy, cek `satellite_logs` hari berikutnya terisi NDVI/NDWI.

---
