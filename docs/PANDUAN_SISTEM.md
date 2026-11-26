# Pusat Bantuan & Panduan Sistem AgriMRV

Dokumen ini menjelaskan bagaimana sistem AgriMRV bekerja, frekuensi pemantauan satelit, cara membaca data peta, serta istilah-istilah penting yang digunakan di dalam platform.

---

## 1. Cara Sistem Bekerja & Pengambilan Data Satelit

**Bagaimana AgriMRV memantau lahan?**
Sistem AgriMRV tidak memerlukan perangkat sensor fisik yang ditanam di sawah. Sebagai gantinya, sistem bekerja dengan cara:
1. Pengguna memasukkan batas lahan (polygon) ke dalam peta sistem.
2. Sistem secara otomatis meminta data dari satelit Eropa (Sentinel-1 dan Sentinel-2) melalui layanan Copernicus/Sentinel Hub.
3. Mesin AgriMRV mengolah pantulan cahaya (optik) dan gelombang radar dari satelit menjadi indeks yang mudah dipahami (seperti NDVI dan NDWI).
4. Data ini digunakan untuk melacak fase tanam, jadwal panen, hingga kalkulasi kredit karbon secara digital.

**Berapa sering satelit mengambil foto/data?**
- Satelit Sentinel melintas dan mengambil data di lokasi yang sama secara global setiap **5 hingga 6 hari sekali**.
- **Di dalam AgriMRV (Adaptive Scan):** Untuk menghemat kuota dan menyesuaikan dengan kebutuhan, sistem memindai lahan secara adaptif. Saat **Musim Tanam Aktif**, sistem akan menarik data intensif (sekitar tiap 6 hari). Saat lahan sedang kosong atau di luar musim tanam, frekuensi tarikan data bisa diturunkan (misalnya 10-15 hari sekali).

---

## 2. Panduan Membaca Peta (Warna) dan Indeks Satelit

Sistem AgriMRV menggunakan beberapa indeks utama untuk menilai kondisi lahan dari luar angkasa:

### A. NDVI (Normalized Difference Vegetation Index)
*   **Apa itu:** Indeks untuk mengukur kepadatan, kehijauan, dan kesehatan tanaman (vegetasi).
*   **Cara Membaca Warna Peta NDVI:**
    *   🟤 **Merah / Coklat:** Lahan kosong, tanah kering, atau tidak ada tanaman hidup (biasanya usai panen atau persiapan lahan).
    *   🟡 **Kuning / Hijau Muda:** Fase awal pertumbuhan, padi baru ditanam (vegetatif awal).
    *   🟢 **Hijau Tua:** Tanaman sangat lebat, sehat, dan sedang di puncak pertumbuhan (fase generatif/menjelang matang).
*   **Rumus:** `(Band 08 - Band 04) / (Band 08 + Band 04)` (Menggunakan spektrum Near-Infrared dan Merah).

### B. NDWI (Normalized Difference Water Index)
*   **Apa itu:** Indeks untuk mendeteksi keberadaan air atau tingkat genangan (kelembapan tinggi) pada permukaan lahan.
*   **Cara Membaca Warna Peta NDWI:**
    *   🟤 **Coklat / Putih:** Lahan dalam kondisi kering (tidak tergenang air).
    *   💧 **Biru Muda:** Tanah basah atau lembab.
    *   🌊 **Biru Tua:** Lahan tergenang air penuh (biasanya terjadi di fase penggenangan awal sebelum padi ditanam atau saat penerapan pengairan penuh).
*   **Rumus:** `(Band 03 - Band 08) / (Band 03 + Band 08)` (Menggunakan spektrum Hijau dan Near-Infrared).

### C. NBR (Normalized Burn Ratio)
*   **Apa itu:** Indeks untuk mendeteksi area yang terbakar (seperti pembakaran jerami pasca panen) dan menilai tingkat keparahan api.
*   **Cara Membaca Warna Peta NBR:**
    *   🔴 **Merah Gelap / Hitam:** Terjadi pembakaran dengan tingkat keparahan tinggi (lahan hangus).
    *   🟠 **Oranye / Coklat:** Pembakaran tingkat rendah-sedang.
    *   🟢 **Hijau Transparan:** Lahan sehat, tidak ada pembakaran (vegetasi aman).
*   **Rumus:** `(Band 08 - Band 12) / (Band 08 + Band 12)` (Menggunakan spektrum Near-Infrared dan Shortwave-Infrared). Gelombang SWIR (Band 12) akan melonjak tajam saat mendeteksi lahan bekas terbakar.

### D. VV & VH (Data Satelit Radar / Sentinel-1 SAR)
*   **Apa itu:** Ini adalah gelombang radar yang ditembakkan ke bumi dan ditangkap pantulannya. Keunggulannya: **Radar bisa menembus awan tebal**, sangat diandalkan saat musim hujan ketika satelit optik (NDVI/NDWI) tertutup awan.
*   **Kegunaan:**
    *   **VV (Vertical-Vertical):** Sensitif terhadap genangan air di permukaan. Saat lahan tiba-tiba digenangi air, nilai VV akan turun drastis (gelap) karena air memantulkan radar menjauh dari satelit.
    *   **VH (Vertical-Horizontal):** Sensitif terhadap bentuk dan biomassa tanaman (batang padi). Digunakan untuk melacak seberapa tinggi padi tumbuh tanpa takut terhalang cuaca.
*   **Perhitungan:** Diukur dalam kekuatan pantulan (Desibel / dB).

---

## 3. Apa itu AWD (Alternate Wetting and Drying)?

Di dalam rincian **Musim Tanam**, Anda akan melihat istilah/indikator **AWD**. 

*   **Apa itu AWD?** 
    AWD (Pengairan Basah-Kering Berselang) adalah teknik manajemen irigasi sawah. Alih-alih merendam sawah terus-menerus selama berbulan-bulan, petani membiarkan sawah mengering (air surut hingga ke bawah permukaan tanah) selama beberapa hari secara berkala sebelum digenangi kembali.
*   **Mengapa AWD penting di Musim Tanam?**
    Sawah yang terus-menerus tergenang air adalah tempat hidup ideal bagi bakteri metanogen yang menghasilkan gas Metana (CH4)—salah satu gas rumah kaca paling berbahaya. Dengan mengeringkan lahan sejenak (AWD), bakteri ini mati dan **emisi metana bisa dipangkas hingga 50%**. Penghematan emisi inilah yang kelak dikonversi menjadi **Kredit Karbon (Net CO2e)**.

*   **Bagaimana AgriMRV melacak AWD?**
    Sistem memantau "pola nadi" lahan menggunakan radar SAR (VV/VH) dan optik (NDWI). Namun, AgriMRV menggunakan filter ketat untuk menghindari deteksi palsu akibat fluktuasi cuaca sesaat:
    1.  **Histeresis (Ambang Batas Tegas):** Nilai SAR harus murni basah (>0.28) atau murni kering (<0.22). Nilai di antaranya dianggap area abu-abu dan diabaikan.
    2.  **Debounce (Anti-Noise):** Perubahan fase dari basah ke kering (atau sebaliknya) harus **bertahan minimal 2 titik data berturut-turut**. Jika lahan hanya mengering 1 hari lalu basah lagi, itu dianggap anomali/hujan, bukan kesengajaan.
    3.  **Klasifikasi:** Butuh minimal 5 kali transisi sah untuk dikategorikan sebagai **"Valid AWD"**. Jika hanya 2-4 transisi, sistem akan menyebutnya **"Pola Campuran"** (bukti kurang kuat). Di bawah 2 transisi berarti lahan tergenang terus (*Continuous Flooding*).

*   **Mengapa peta berubah abu-abu pada hari tertentu?**
    Sensor optik satelit Sentinel-2 tidak dapat menembus awan. Jika tutupan awan di atas 15%, cahaya inframerah yang memantul dari awan bisa mengecoh sistem pembacaan (menganggap awan sebagai vegetasi sehat). Untuk mencegah salah analisa, AgriMRV secara otomatis akan menolak data tersebut, mewarnai area di grafik/kolom menjadi **Abu-abu**, dan memunculkan peringatan bahwa datanya tertutup awan. 

*   **Teknologi Multi-Sensor Fusion (Penambal Data):**
    Sebagai kalimat kunci untuk presentasi: *"Saat satelit biasa (optik) gagal melihat lahan karena tertutup awan pada suatu tanggal (misal 10 Juli), sistem Sinagri kami otomatis **menambal lubang data** tersebut dengan menarik pindaian satelit Radar (SAR) terdekat di tanggal 12 Juli, karena radar bisa menembus awan dan cuaca buruk."* Inilah keunggulan sistem Sinagri yang menggabungkan optik dan radar secara bersamaan.

---

## 4. Integrasi Kecerdasan Buatan (AI) di AgriMRV

AgriMRV tidak hanya menampilkan data mentah dari satelit, tetapi juga dapat ditingkatkan kemampuannya menggunakan algoritma AI / *Machine Learning*:

*   **Pendeteksian Fase Tanam Otomatis:** Sistem dapat dilatih dengan data historis NDVI dan Radar untuk secara otomatis menebak fase tanaman (semai, vegetatif, generatif, atau panen) tanpa input manual dari pengguna.
*   **Akurasi NBR (Koreksi Awan & Bayangan):** Salah satu kelemahan satelit optik adalah bayangan awan tebal yang sering disalahartikan sebagai "lahan basah" atau "bekas terbakar". Dengan model AI pengenalan pola spasial (*Computer Vision*), sistem dapat membedakan mana yang benar-benar lahan terbakar dan mana yang sekadar bayangan awan.
*   **Prediksi Emisi (Predictive Analytics):** Berbekal data suhu, iklim makro, dan pola historis AWS (*Alternate Wetting and Drying*), AI dapat meramalkan potensi penghematan karbon di masa depan dan menyarankan jadwal pengeringan sawah yang optimal untuk petani.
