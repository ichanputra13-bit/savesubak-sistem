# INSTRUKSI UNTUK CLAUDE CODE — PROJECT AgriMRV

Baca file ini SETIAP sesi dibuka sebelum mulai kerja apapun. Ini aturan main project.

## 1. Dokumen Rujukan (baca urutan ini)

1. `docs/PRD_AgriMRV.md` — roadmap 7 tahap, status terkini project
2. `docs/BRIEF_AgriMRV.md` — spesifikasi teknis, skema database, keputusan produk
3. `docs/TECHNICAL_DESIGN_Tahap3.md` — arsitektur detail Tahap 3
4. `docs/PROJECT_LOG.md` — log kronologis semua perubahan/sesi kerja (BACA PALING BAWAH dulu untuk tahu progress paling baru)

**Catatan:** dokumen-dokumen ini TIDAK lagi pakai suffix versi di nama file (v1.1, v1.2, dst) — nama file tetap sama selamanya, isinya yang berubah. Riwayat perubahan cukup dilacak lewat PROJECT_LOG.md, bukan lewat rename file.

## 2. Wajib: Update PROJECT_LOG.md Setiap Akhir Sesi Kerja

Setelah menyelesaikan pekerjaan apapun (baik kecil maupun besar), SELALU tambahkan entri baru di `docs/PROJECT_LOG.md` — jangan menunggu diminta. Format entri:

```
## [YYYY-MM-DD HH:mm] — <ringkasan singkat 1 baris>

**Dikerjakan:**
- poin 1
- poin 2

**Keputusan/catatan penting:** (kalau ada)
- ...

**Status berikutnya:** <apa yang perlu dikerjakan/divalidasi selanjutnya>

---
```

Entri BARU selalu ditambahkan di PALING BAWAH file (kronologis), bukan di atas.

## 3. Wajib: Update PRD_AgriMRV.md Kalau Ada Perubahan Status Tahap

Kalau pekerjaan yang baru selesai mengubah status salah satu dari 7 Tahap di PRD (misal dari "Belum dimulai" jadi "Sedang berjalan", atau ada item checklist yang selesai):
- Update kolom Status, Tanggal Selesai, dan "Keputusan yang Diambil" di bagian tahap yang relevan
- Centang `[x]` item checklist yang sudah selesai
- JANGAN hapus histori keputusan lama — selalu tambahkan, bukan menimpa

## 4. Kalau Ada Keputusan Teknis Baru (bukan cuma progress biasa)

Kalau selama sesi kerja ada keputusan arsitektur/desain baru yang diambil (misal ganti library, ubah skema, ubah pendekatan), tambahkan juga ke bagian "RIWAYAT KEPUTUSAN" di `docs/BRIEF_AgriMRV.md` — bukan cuma dicatat di PROJECT_LOG.md saja, supaya orang yang cuma baca BRIEF (tanpa baca log lengkap) tetap dapat konteks penting.

## 5. Aturan Kredensial (SELALU BERLAKU)

- JANGAN PERNAH menampilkan isi `.env.local`, API key, client secret, atau kredensial apapun di chat/output — meskipun diminta secara implisit
- Kalau perlu konfirmasi kredensial ada/valid, cukup laporkan status (ada/tidak ada, valid/tidak valid) tanpa expose nilainya

## 6. Disiplin Debugging — Jangan Percaya Teori Tanpa Bukti Konsisten

**Konteks:** insiden 04 Juli 2026 — bug "batas desa hilang saat zoom" butuh 4+ iterasi perbaikan (z-index pane → custom pane → restructure fetch ke parent → klaim "HMR/Turbopack cache basi") sebelum akar masalah sebenarnya ketemu. Beberapa "root cause" yang diklaim ternyata SALAH atau TIDAK LENGKAP, dan sempat menyebabkan halaman 404 total yang tidak langsung diakui sebagai bug baru.

**Aturan wajib ke depannya:**

1. **Setiap klaim "root cause ditemukan" HARUS didukung log/bukti konkret dari kejadian yang sedang didiagnosis** — bukan teori masuk akal yang "terdengar teknis" (istilah seperti "HMR loop", "Turbopack cache") tanpa data pendukung dari log/console yang benar-benar direproduksi saat itu.

2. **Kalau fix yang diklaim "sudah benar" ternyata bug yang sama masih muncul** — JANGAN lanjut ke teori baru tanpa mengakui eksplisit bahwa penjelasan sebelumnya salah/tidak lengkap. Nyatakan itu jelas ke user, jangan menimpali dengan teori berikutnya seolah yang sebelumnya tidak pernah terjadi.

3. **Kalau gejala baru muncul (misal 404) SETELAH sebuah "fix" diklaim selesai** — treat itu sebagai kemungkinan REGRESI dari fix itu sendiri, bukan cuma "masalah lama yang belum sempat hilang". Investigasi dulu apakah perubahan terakhir yang menyebabkan gejala baru itu.

4. **Log yang menunjukkan hasil TIDAK KONSISTEN dengan teori yang diajukan (misal: klaim "restart akan memperbaiki" tapi restart tidak memperbaiki) adalah sinyal untuk STOP dan minta bukti lebih dalam** — jangan lanjut mengajukan penjelasan baru sebelum kontradiksi itu diselesaikan/dijelaskan.

5. **Preferensi debugging: minta output nyata (isi file, hasil `npm run build`, log lengkap) di atas teori** — terutama untuk bug yang sudah gagal diperbaiki lebih dari 1 kali berturut-turut.

6. **Sebelum menulis kode yang bergantung ke kolom/tabel baru, cek dulu apakah migration terkait sudah dikonfirmasi USER benar-benar dijalankan** — jangan asumsi migration akan segera dijalankan. Kalau menulis kode yang query kolom baru sebelum migration jalan, pastikan ada fallback graceful (try/catch atau query terpisah) supaya halaman tidak 404/crash total kalau kolom belum ada. Insiden nyata: 04 Juli 2026, halaman kawasan 404 total karena query `boundary_geojson` ditulis sebelum migration `05_add_boundary_geojson_kawasan` dikonfirmasi jalan.

## 7. Checklist RLS Wajib Setiap Bikin Tabel Baru

**Konteks:** insiden 07 Juli 2026 — tabel `user_profiles` terlewat diaktifkan RLS-nya sejak migration v1 (awal project), tidak ketahuan sampai Supabase mengirim email peringatan otomatis berbulan-bulan kemudian. Selama periode itu, data profil (termasuk telegram_id) berpotensi bisa diakses publik tanpa autentikasi lewat anon key. Root cause: saat migration v1 menulis blok "ENABLE RLS" untuk banyak tabel sekaligus, satu tabel (`user_profiles`) tidak sengaja terlewat dari daftar.

**Aturan wajib:** setiap kali membuat tabel baru (migration manapun), WAJIB langsung sertakan dalam migration yang sama:
1. `ALTER TABLE <nama_tabel> ENABLE ROW LEVEL SECURITY;`
2. Minimal 1 policy yang sesuai (jangan biarkan RLS aktif tanpa policy sama sekali — itu default-deny yang aman tapi bisa bikin fitur diam-diam gagal tanpa error jelas, seperti kejadian `plot_ownership_history` yang RLS aktif tapi kosong policy sejak v9)
3. Query verifikasi di akhir migration yang mengecek RLS benar-benar aktif untuk tabel baru itu (bukan asumsi)

Sebelum melaporkan migration "selesai", jalankan mental checklist: "Apakah SEMUA tabel baru di migration ini punya RLS aktif DAN minimal 1 policy?" — jangan asumsi tabel lain yang sudah ada otomatis mencakup tabel baru.

## 8. Penamaan Query di Supabase SQL Editor

Setiap kali menjalankan/menyimpan query SQL di Supabase SQL Editor (baik lewat Chrome plugin maupun manual), SELALU beri nama deskriptif ke query itu — jangan biarkan tersimpan dengan nama default seperti "dummy_query" atau "New query". Rename query itu (via UI SQL Editor Supabase, klik nama query di sidebar untuk edit) sesuai isi/tujuannya, contoh:
- `01_initial_schema_kawasan_plots` — untuk DDL awal tabel kawasan & plots
- `02_rls_policies_role_based` — untuk RLS policy
- `03_add_n2o_columns_mrv` — untuk migrasi tambahan kolom N2O

Format disarankan: `<nomor_urut>_<deskripsi_singkat>`, biar riwayat query di sidebar Supabase kebaca kronologis dan jelas fungsinya tanpa perlu buka isinya satu-satu.


## 9. Wajib: update_owner.html + Laporan Terstruktur Setiap Selesai Perubahan

**Konteks:** user (Ichan) bukan programmer, dan sering meninggalkan sesi jalan tanpa diawasi lama. Dia mengandalkan laporan terstruktur ini, bukan baca diff sendiri.

**Aturan wajib setelah SETIAP perubahan yang cukup besar (edit file, refactor, bug fix)** — bukan cuma di akhir sesi, langsung tanpa diminta:
1. File apa saja yang berubah
2. Jumlah baris sebelum → sesudah (contoh: "PlotDashboard.tsx: 2034 → 1450 baris")
3. Apa yang perlu ditest/divalidasi user dari perubahan ini
4. Konfirmasi eksplisit apakah `update_owner.html` (dashboard interaktif bilingual untuk pemilik non-teknis — root `update_owner.html` DAN `public/update_owner.html` harus selalu identik, sync keduanya tiap edit) sudah diupdate untuk merefleksikan perubahan ini. Kalau perubahan itu murni internal (refactor tanpa efek ke user/formula), tetap nyatakan itu secara eksplisit ("tidak perlu update update_owner.html karena—") — jangan diam saja, karena diam akan ditafsirkan user sebagai "belum dicek".

**Sebelum bikin perubahan besar/berisiko:** buat checkpoint dulu (git tag di working tree yang bersih) — pola yang sudah dipakai di project ini (contoh: `beta.v.1.0`, `backup-before-claudecode-refactor-2026-07-18`).

## 10. Kalau User Buka Sesi Baru dan Bilang "Lanjutkan"

Langsung baca PROJECT_LOG.md bagian paling bawah (entri terbaru) untuk tahu di titik mana pekerjaan terakhir berhenti, lalu berikan ringkasan singkat ke user sebelum lanjut kerja — supaya user tahu kamu sudah "nyambung" dengan konteks sebelumnya, tanpa mereka perlu jelaskan ulang dari nol.
