-- Migration v16: Tambahan kolom NBR (Normalized Burn Ratio) untuk deteksi pembakaran jerami

ALTER TABLE satellite_logs 
ADD COLUMN IF NOT EXISTS nbr_score numeric,
ADD COLUMN IF NOT EXISTS nbr_heatmap_path text;

COMMENT ON COLUMN satellite_logs.nbr_score IS 'Nilai rata-rata NBR pada petak. Nilai sangat negatif (contoh: < -0.1) mengindikasikan area bekas terbakar.';
COMMENT ON COLUMN satellite_logs.nbr_heatmap_path IS 'Path ke gambar peta NBR di bucket Supabase.';
