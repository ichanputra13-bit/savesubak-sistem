# Panduan Sistem 3 Agen (Optimized Vibecoding) di Google Antigravity

Dokumen ini berfungsi sebagai instruksi utama (*system instructions/skills*) bagi Google Antigravity untuk menjalankan alur kerja pengembangan menggunakan sistem hibrida 3 agen. Ketika folder proyek ini dibuka, seluruh agen AI harus membaca dan mematuhi kerangka kerja ini secara otomatis.

---

## 1. Arsitektur dan Alokasi Peran Agen

Sistem ini membagi tugas pengembangan ke dalam tiga agen terspesialisasi untuk memaksimalkan efisiensi kode dan menghemat penggunaan token/kredit API:

### Agen 1: Gemini (The Planner / Perencana)
* **Lokasi Kerja:** Panel Chat / Antarmuka Utama Antigravity.
* **Tugas Utama:** * Merancang arsitektur sistem, skema database, dan alur logika aplikasi.
    * Menyusun *blueprint* atau spesifikasi teknis sebelum kode ditulis.
    * Fokus pada perancangan sistem yang ramah pengguna, terstruktur, terutama untuk sistem edukasi finansial, pencatatan kas, dan kalkulasi data yang ditujukan bagi kalangan umum serta UMKM kecil.
* **Output:** Instruksi langkah-demi-langkah (*pseudo-code*, struktur folder, skema `.json`) yang siap dieksekusi oleh Agen 2.

### Agen 2: Claude Code (The Builder / Pengembang)
* **Lokasi Kerja:** Terminal Bawaan / Command Line Interface (CLI) di Antigravity.
* **Tugas Utama:**
    * Mengeksekusi *blueprint* dari Gemini.
    * Membaca file yang sudah ada di folder proyek (termasuk file konfigurasi `.json`, skrip utama, dan dependensi).
    * Menulis kode baris-demi-baris secara konsisten dengan arsitektur yang sudah ada.
    * Meneruskan proyek yang sedang berjalan tanpa merusak logika yang telah mapan.
* **Aturan:** Dilarang melakukan *debugging* berulang secara mandiri jika menemui kegagalan tes; serahkan pembacaan error ke Agen 3.

### Agen 3: Testsprite MCP (The Tester / Penguji)
* **Lokasi Kerja:** Integrasi Model Context Protocol (MCP) di lingkungan Antigravity.
* **Tugas Utama:**
    * Melakukan pengujian otomatis (*automated testing*) pada setiap komponen kode baru yang selesai ditulis oleh Claude Code.
    * Memvalidasi fungsionalitas logika sistem (seperti akurasi kalkulasi angka, manipulasi data JSON, dan validasi input pengguna).
    * Menangkap *bug* atau *error* sejak dini untuk mencegah pemborosan token pemrosesan pada Gemini atau Claude.
* **Output:** Laporan kegagalan/keberhasilan tes (*test report*) yang ringkas untuk diumpankan kembali ke Claude Code jika perbaikan diperlukan.

---

## 2. Alur Kerja Operasional (Workflow Steps)

Setiap kali ada pembaruan fitur, perbaikan, atau kelanjutan proyek, ikuti siklus berikut:

1.  **Tahap 1: Konseptualisasi (Gemini)**
    * Input file `.json` atau struktur kode lama ke panel chat jika membutuhkan modifikasi.
    * Minta Gemini menyusun rancangan fitur baru dengan mempertimbangkan kemudahan implementasi dan kesederhanaan sistem untuk skala UMKM atau penggunaan pribadi.
2.  **Tahap 2: Implementasi Kode (Claude Code)**
    * Jalankan `claude-code` di terminal folder kerja.
    * Umpankan rancangan dari Gemini. Biarkan Claude memeriksa file `.json` konfigurasi lokal untuk memastikan integrasi data tidak mengalami bentrokan (*conflict*).
3.  **Tahap 3: Validasi Otomatis (Testsprite MCP)**
    * Jalankan skrip pengujian lewat server MCP.
    * Jika tes lolos, fitur dinyatakan selesai. Jika gagal, salin *error log* langsung ke terminal Claude Code untuk otomatis ditambal.

---

## 3. Panduan Pembacaan File Lokal & Konteks Sistem

* **Akses Folder:** Antigravity memiliki izin penuh untuk membaca seluruh struktur folder proyek ini secara *real-time*.
* **Manajemen File `.json`:** File JSON di dalam proyek ini (seperti konfigurasi, data master transaksi, atau aturan sistem) adalah kebenaran tunggal (*single source of truth*) untuk struktur data. Agen pembangun harus selalu mencocokkan tipe data dan kunci (*keys*) dengan file JSON yang sudah ada sebelum menulis fungsi baru.
* **Prinsip Desain:** Sistem yang dibangun harus memprioritaskan performa yang ringan, antarmuka yang intuitif, dan validasi data yang ketat agar aman digunakan oleh semua kalangan.

---
*Catatan: File instruksi ini wajib dibaca ulang oleh Agen AI setiap kali sesi kerja baru di Antigravity dimulai.*
