# CHECKPOINTS.md — Titik Aman Sebelum Perubahan Besar

Catatan checkpoint git (tag) yang sengaja dibuat sebelum pekerjaan
besar/berisiko (refactor, migrasi besar, dll) — sesuai pola yang sudah
dipakai project ini (lihat juga tag `backup-before-claudecode-refactor-2026-07-18`,
`beta.v.1.0`, dst). Entri baru SELALU ditambahkan di PALING BAWAH
(kronologis), jangan menimpa entri lama.

---

## [2026-07-26 17:24] — checkpoint-before-refactor

- **Tanggal dibuat:** 26 Juli 2026, 17:24
- **Hash commit:** `37974c5` (lengkap: `37974c58969f2f02dafa8bb9b9cd599d701a158a`)
- **Nama tag:** `checkpoint-before-refactor`

**Ringkasan yang tercakup di checkpoint ini** (5 kategori pekerjaan dari commit message):

1. **Bug kritis resx/resy** — root cause ditemukan & diperbaiki di 4 lokasi (Sentinel Hub Statistical API salah baca resolusi piksel sebagai derajat, bukan meter). Kawasan Kelompok tani Sri Galih (23 petak) dan petak Regenerative/001 sudah direprocess & diverifikasi. Subak Sangeh SENGAJA belum disentuh (rencana dihapus & diulang manual oleh user).
2. **Fitur Import dari KML** — upload banyak petak sekaligus dari file KML, dengan deteksi tumpang tindih 2 lapis (dalam file yang sama + terhadap semua petak yang sudah ada di database) sebelum data disimpan.
3. **Fitur dNBR + Indikator Pembakaran Gabungan** — metodologi selisih NBR antar-scan (pelengkap ambang absolut lama) digabung dengan kecocokan tanggal panen, menghasilkan badge 3 kategori (merah/kuning/abu-abu) dengan detail analisis yang bisa di-expand.
4. **Fix dev server cross-origin** — `allowedDevOrigins` di `next.config.ts` supaya aplikasi bisa diakses & peta termuat normal dari perangkat lain (HP dll) di jaringan WiFi yang sama.
5. **Cleanup &amp; fitur pendukung lain** — pembersihan istilah internal "update owner" dari tampilan user, cleanup kode fitur Import KML, serta fitur-fitur pendukung dari sesi-sesi sebelumnya (cuaca/Open-Meteo, field log, dll).

**Cara kembali kalau refactor bermasalah:**

```
git reset --hard checkpoint-before-refactor
```

atau, kalau nama tag entah kenapa tidak bisa dipakai:

```
git reset --hard 37974c5
```

⚠️ `git reset --hard` akan MEMBUANG semua perubahan setelah checkpoint ini yang belum di-commit — pastikan itu memang yang diinginkan sebelum menjalankan.

---

## [2026-07-28] — refactor-tahap-1

- **Tanggal dibuat:** 28 Juli 2026
- **Hash commit:** `4152406` (lengkap: `4152406dfef41c79bc701461707622a6d3db0191`)
- **Nama tag:** `refactor-tahap-1`

**Ringkasan yang tercakup di checkpoint ini** (3 kategori pekerjaan dari commit message):

1. **Tahap 1 Refactor** — konsolidasi `fmtDate` (8 duplikat implementasi → 1, di `lib/format.ts`), konsolidasi `CLOUD_COVER_THRESHOLD` (9 duplikat → 1, juga di `lib/format.ts`), dan ekstraksi `lib/plot-insights.tsx` (267 baris logic dipindah keluar dari `PlotDashboard.tsx`, 2034 → ~1450 baris) tanpa mengubah perilaku aplikasi.
2. **Fix Kuota Lahan header jadi dinamis** — pembilang dihitung dari `SUM(plots.area_ha)` untuk semua petak aktif (server-side di `app/layout.tsx`, dikirim sebagai prop ke `AppTopbar`, `mockUser` dihapus total); penyebut dibaca dari tabel baru `app_settings.max_quota_ha` dengan fallback graceful ke 100 kalau tabel belum ada.
3. **Fitur baru: luas (ha) per kawasan** — kartu di Dashboard Kawasan (`/kawasan`) sekarang menampilkan total luas per kawasan, dihitung langsung dari `SUM(v_plots.area_ha)` per `kawasan_id` (bukan dari kolom `total_area_ha` yang selalu NULL).

**⚠️ CATATAN PENDING — migration belum dijalankan:**

`docs/migration_v23_app_settings.sql` (dibuat di commit ini) **BELUM dijalankan** di database production. Ini langkah manual terpisah yang harus dilakukan user lewat Supabase SQL Editor. Sampai migration ini dijalankan:
- Kode tetap berjalan normal (fallback aktif, batas Kuota Lahan tetap tampil `/ 100`)
- Skenario "ubah `app_settings.max_quota_ha` → refresh → batas berubah" belum bisa divalidasi end-to-end
- Setelah migration dijalankan, validasi end-to-end tsb perlu dilakukan dan dicatat di `PROJECT_LOG.md`

**Cara kembali kalau ada masalah setelah checkpoint ini:**

```
git reset --hard refactor-tahap-1
```

atau, kalau nama tag entah kenapa tidak bisa dipakai:

```
git reset --hard 4152406
```

⚠️ `git reset --hard` akan MEMBUANG semua perubahan setelah checkpoint ini yang belum di-commit — pastikan itu memang yang diinginkan sebelum menjalankan.

---

## [2026-07-28] — refactor-tahap-2

- **Tanggal dibuat:** 28 Juli 2026
- **Hash commit:** `1ebcf76` (lengkap: `1ebcf76787e9bef54cbd29ba2abb43b9ec744772`)
- **Nama tag:** `refactor-tahap-2`

**Ringkasan yang tercakup di checkpoint ini:**

Konsolidasi evalscript NDVI/NDWI/NBR (Statistical API) dan `estimatePhase()`
yang sebelumnya ditulis ulang di 3 lokasi terpisah (scan manual, tarik
baseline, cron harian via `lib/sentinel-hub/ndvi.ts`+`ndwi.ts`) — pola
persis yang menyebabkan bug resx/resy sebelumnya perlu diperbaiki di 4
lokasi kode berbeda. Semua dipindah ke 1 sumber baru:
`lib/sentinel-hub/formulas.ts` (`NDVI_EVALSCRIPT`, `NDWI_EVALSCRIPT`,
`NBR_STATS_EVALSCRIPT`, `estimatePhase()`, `fetchSentinelStats()`).

File yang diubah: `app/api/plots/[plotId]/scan/route.ts`,
`app/api/plots/[plotId]/baseline/route.ts`,
`app/api/cron/satellite-scan/route.ts`, `lib/sentinel-hub/ndvi.ts`,
`lib/sentinel-hub/ndwi.ts` + file baru `lib/sentinel-hub/formulas.ts`.

**Validasi:** murni pemindahan kode, TIDAK ada logic/hasil yang diubah —
dikonfirmasi live untuk 2 petak (Regenerative/001 tanggal 2026-07-20 &
2026-07-15, SSB004 tanggal 2026-07-27): 8/8 angka NDVI/NDWI/NBR/fase
identik persis sebelum vs sesudah (via jalur `scan`/`baseline`).
`npx tsc --noEmit` & `npx eslint`: 0 error baru. Detail lengkap snapshot
"sebelum/sesudah" ada di `docs/PROJECT_LOG.md` entri Tahap 2.

**⚠️ CATATAN PENTING — bug PRE-EXISTING ditemukan, TIDAK terkait tahap ini:**

Saat memvalidasi jalur cron secara live, ditemukan `fetchNdvi()`/`fetchNdwi()`
(`lib/sentinel-hub/ndvi.ts`, `ndwi.ts` — satu-satunya pemanggil dari
`app/api/cron/satellite-scan/route.ts`) memakai window query **1 hari
persis** (`to: ${date}T23:59:59Z`), yang membuat Sentinel Hub Statistics
API mengembalikan **data kosong** — dibuktikan lewat isolasi (evalscript
LAMA sebelum Tahap 2 dengan window sama JUGA gagal; window diperlebar atau
`to` digeser ke tengah malam berikutnya berhasil mengambil data yang cocok
persis dengan nilai tersimpan). Ini bug SEBELUM Tahap 2 ada, TIDAK
disebabkan konsolidasi evalscript di atas — kode `timeRange` di
`ndvi.ts`/`ndwi.ts` sama sekali tidak disentuh tahap ini. Indikasi: cron
harian kemungkinan besar TIDAK PERNAH berhasil mengisi NDVI/NDWI di
produksi sejak awal. **Belum diperbaiki — menunggu investigasi/keputusan
terpisah, di luar scope checkpoint ini.**

**Cara kembali kalau ada masalah setelah checkpoint ini:**

```
git reset --hard refactor-tahap-2
```

atau, kalau nama tag entah kenapa tidak bisa dipakai:

```
git reset --hard 1ebcf76
```

⚠️ `git reset --hard` akan MEMBUANG semua perubahan setelah checkpoint ini yang belum di-commit — pastikan itu memang yang diinginkan sebelum menjalankan.

---
