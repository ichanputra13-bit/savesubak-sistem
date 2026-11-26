-- Migration v22: Tambahan kolom dNBR (selisih NBR antar-scan berurutan)
--
-- PELENGKAP ambang absolut NBR yang sudah ada (nbr_score, migration v16) —
-- BUKAN pengganti. Investigasi 25 Juli 2026 (lihat PROJECT_LOG.md) menemukan
-- literatur riset bakar jerami sawah merekomendasikan dNBR (SELISIH NBR
-- sebelum-sesudah) untuk membedakan "baru dipanen" (bare soil, NBR rendah
-- tapi wajar) dari "bekas dibakar" (juga rendah, tapi karena insiden
-- mendadak) — NBR absolut 1 waktu kurang sensitif untuk perbedaan itu.
--
-- CATATAN PENTING SOAL TANDA (SIGN): dNBR standar tekstual (USGS FIREMON)
-- dihitung PRA-kebakaran MINUS PASCA-kebakaran (positif = kebakaran).
-- Project ini menghitung SEBALIKNYA — scan SEKARANG minus scan SEBELUMNYA
-- (kronologis, supaya intuitif dibaca "NBR naik/turun dari waktu ke waktu")
-- — jadi di sini KEBAKARAN ditandai dNBR NEGATIF, bukan positif. Lihat
-- lib/dnbr.ts untuk implementasi & ambang.

ALTER TABLE satellite_logs
ADD COLUMN IF NOT EXISTS dnbr_score numeric,
ADD COLUMN IF NOT EXISTS dnbr_reference_scan_date date;

COMMENT ON COLUMN satellite_logs.dnbr_score IS 'Selisih NBR scan ini dikurangi scan VALID sebelumnya (kronologis, BUKAN tekstual FIREMON pra-minus-pasca) — turun tajam (negatif, <= -0.1, ambang dari kelas "low severity" FIREMON/USGS) DAN gap <=15 hari = indikasi tambahan kemungkinan bakar mendadak, PELENGKAP ambang absolut nbr_score (bukan pengganti). NULL kalau scan ini atau scan sebelumnya tidak valid (cloud>15%) atau belum ada scan valid sebelumnya untuk petak ini.';
COMMENT ON COLUMN satellite_logs.dnbr_reference_scan_date IS 'Tanggal scan valid yang dipakai sebagai pembanding untuk dnbr_score — dipakai UI untuk tampilkan jarak hari (gap besar = bukan "mendadak", kemungkinan cuma siklus panen normal).';

-- Verifikasi
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'satellite_logs' AND column_name IN ('dnbr_score', 'dnbr_reference_scan_date');
