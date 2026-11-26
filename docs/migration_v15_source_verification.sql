-- ============================================================
-- AgriMRV — Migration v15: Metadata verifikasi sumber data satelit
-- Nama query SQL Editor: 15_satellite_source_verification
-- ============================================================
-- Fitur: panel "Sumber Data / Verifikasi" di dashboard plot — bukti
-- ke pengguna (termasuk petani skeptis) bahwa data NDVI/NDWI/SAR
-- benar-benar berasal dari citra satelit resmi Copernicus, bukan
-- hasil AI/dikarang. Metadata diambil dari Sentinel Hub Catalog API
-- (STAC), TERPISAH dari Statistical API yang sudah dipakai untuk
-- hitung NDVI/NDWI/SAR — Statistical API cuma kasih angka agregat,
-- TIDAK menyertakan ID produk/tile resmi atau timestamp presisi.
--
-- Kolom NDVI (Sentinel-2) dan SAR (Sentinel-1) dipisah — konsisten
-- dengan pola kolom ndvi_*/ndwi_* vs sar_* yang sudah ada, karena satu
-- baris satellite_logs bisa punya salah satu, keduanya, atau tidak
-- ada sama sekali.
--
-- Aman dijalankan ulang (idempotent).
-- ============================================================

ALTER TABLE satellite_logs
  ADD COLUMN IF NOT EXISTS ndvi_product_id          text,
  ADD COLUMN IF NOT EXISTS ndvi_acquisition_datetime timestamptz,
  ADD COLUMN IF NOT EXISTS ndvi_platform             text,
  ADD COLUMN IF NOT EXISTS sar_product_id            text,
  ADD COLUMN IF NOT EXISTS sar_acquisition_datetime  timestamptz,
  ADD COLUMN IF NOT EXISTS sar_platform              text;

COMMENT ON COLUMN satellite_logs.ndvi_product_id IS 'ID produk resmi Sentinel-2 dari Sentinel Hub Catalog API (STAC), mis. S2C_MSIL2A_20260705T021531_..._T50LKR_....SAFE — untuk verifikasi independen';
COMMENT ON COLUMN satellite_logs.sar_product_id  IS 'ID produk resmi Sentinel-1 dari Sentinel Hub Catalog API (STAC), mis. S1D_IW_GRDH_1SDV_20260630T220044_....SAFE — untuk verifikasi independen';

-- ============ VERIFIKASI ============
SELECT column_name FROM information_schema.columns
WHERE table_name = 'satellite_logs' AND column_name LIKE '%product_id%';
