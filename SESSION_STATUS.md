# Status Sesi Kerja — Baca Ini Dulu Kalau Sesi Claude Code Terputus

**Terakhir diupdate:** 18 Juli 2026 (siang)
**Untuk:** Claude (sesi baru) — baca file ini SEBELUM mulai kerja apa pun, supaya langsung paham konteks tanpa user perlu jelaskan ulang dari nol.

---

## Instruksi untuk Claude yang baca file ini

1. Baca dulu `CLAUDE.md` di root project (aturan wajib project).
2. Baca `docs/PROJECT_LOG.md` bagian PALING BAWAH untuk histori lengkap.
3. Baca file ini untuk tahu di titik mana sesi sebelumnya berhenti.
4. Beri ringkasan singkat ke user bahwa kamu sudah "nyambung", sebelum lanjut kerja.

## Konteks penting yang mungkin tidak ada di CLAUDE.md/PROJECT_LOG

- User (Ichan) **bukan programmer** — jelaskan semua hal teknis pakai bahasa awam, jangan asumsikan dia paham jargon.
- Ada 2 folder project yang mirip:
  - `C:\Users\Ichan\Desktop\agrimrv` — **folder LIVE/aktif**, ini yang jadi fokus kerja sekarang.
  - `C:\Users\Ichan\Documents\Backup agrimv\agrimrv` — folder backup lama, JANGAN dikira folder utama.
- Sebelumnya project ini dikerjakan pakai **Google Antigravity** (Gemini + Claude Code + Testsprite 3-agen). User sudah menutup Antigravity dan pindah penuh ke Claude Code per 18 Juli 2026.
- User minta dikurangi prompt "yes/no" tiap tool call — sudah dikonfigurasi di `.claude/settings.local.json` (auto-allow Read/Edit/Write/git/npm run, TAPI tetap minta izin untuk push/reset --hard/install-uninstall package/rm -rf).
- **Aturan kerja wajib** (diminta user 18 Juli): setiap selesai 1 perubahan, WAJIB laporkan tanpa diminta: (1) file mana yang berubah, (2) jumlah baris sebelum→sesudah, (3) apa yang perlu ditest, (4) konfirmasi sudah/belum update `update_owner.html`.
- Selalu bikin backup (git tag) sebelum perubahan besar. Tag terakhir: `backup-before-claudecode-refactor-2026-07-18` di commit `b023c95`.

## Posisi kerja terakhir (urutan prioritas yang disepakati)

1. ✅ **Audit rumus satelit (NDVI/NDWI/NBR/SAR/CO2e)** — SELESAI. NDVI/NDWI/NBR dikonfirmasi benar. SAR flood_index (VH/VV) masih "belum diverifikasi ke data lapangan riil" — item terbuka.
2. ✅ **Fix formula CO2e** — SELESAI. Migration v18 (bug: CO2e cuma dari CH4, GWP salah generasi AR5=28) diperbaiki jadi migration v19 (`docs/migration_v19_co2e_net_formula_fix.sql`) — NET CH4-N2O, GWP 27 (AR6), sudah dijalankan user di Supabase & diverifikasi aktif. Data lama sudah direcalculate via `scripts/recalculate-water-patterns.mjs` (6 musim tanam, semua berhasil).
3. ⏳ **Belum dimulai:** audit kode umum (cari file "gemuk"/duplikat, prioritas #1 dari daftar user) — target `PlotDashboard.tsx` (2034 baris), `KawasanMapInner.tsx` (881 baris).
4. ⏳ **Belum dimulai:** folder dokumentasi tim + file prompt (`docs/handbook/`, `docs/handbook/CONTEXT_PROMPT.md`).
5. 🟡 **Sebagian:** `update_owner.html` sudah dibuat (root project) — dashboard interaktif bilingual ID/EN, tombol download PDF (A4). Section Overview, Rumus, Changelog, Log Error, Roadmap sudah terisi. Section "Dokumentasi Tim" masih placeholder.
6. ⏳ **Belum dibahas tuntas:** perubahan UI aplikasi (lebih modern, bilingual ID/EN, detail kecil: huruf "RI" di logo SINAGRI diberi warna merah — SUDAH diterapkan di `update_owner.html` sebagai contoh, BELUM diterapkan ke UI aplikasi utama).
7. Keputusan model: pindah ke **Claude Fable 5** ditunda sampai audit kode umum (poin 3) selesai dan rencana refactor besar disepakati — baru pas untuk kerjaan jangka panjang lintas-file.

## Insiden yang baru terjadi (18 Juli, sore) — PENTING dibaca

**Kejadian:** laptop user hang parah. Ditemukan **637 proses `node.exe`** menumpuk, semuanya berasal dari 1 sumber: worker Turbopack yang crash-loop dari folder **backup** (`Documents\Backup agrimv\agrimrv`), dipicu oleh dev server yang saya nyalakan di awal sesi ini dan tidak pernah dimatikan eksplisit — kemungkinan besar worker-nya crash lalu Turbopack coba spawn ulang tanpa henti (infinite respawn loop), khas masalah Turbopack+Windows yang sudah pernah tercatat sebelumnya di `PROJECT_LOG.md` (09 Juli 2026).

**Fix yang sudah dilakukan:** `taskkill /F /IM node.exe` (aman — dicek dulu semua 637 proses itu, tidak ada satu pun yang terkait proses Claude Code sendiri), lalu cache `.next` di KEDUA folder (backup & live) dihapus.

**Pencegahan ke depan:**
- JANGAN nyalakan dev server di 2 folder project sekaligus (backup DAN live) — pilih 1, dan **selalu `preview_stop` eksplisit** sebelum pindah folder/selesai sesi, jangan biarkan tergantung.
- Kalau localhost tidak bisa dibuka lagi, cek dulu jumlah proses `node.exe` (`tasklist /FI "IMAGENAME eq node.exe"`) SEBELUM curiga ke hal lain — kalau jumlahnya banyak (puluhan+), itu tandanya crash-loop, bukan sekadar "belum nyala".
- Folder backup (`Documents\Backup...`) sebaiknya tidak lagi dipakai untuk development aktif sekarang bahwa folder live (`Desktop\agrimrv`) sudah jadi fokus kerja — kalau tidak dipakai lagi, sebaiknya user putuskan mau dihapus atau dibiarkan (jangan asumsikan, tanya dulu).

---
*File ini murni jaga-jaga kontinuitas sesi — bukan pengganti `PROJECT_LOG.md` yang tetap jadi log resmi kronologis project.*
