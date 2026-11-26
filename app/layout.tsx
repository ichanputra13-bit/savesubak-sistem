import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import AppTopbar from "@/components/layout/AppTopbar";
import { createAdminClient } from "@/lib/supabase/admin";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Save Subak Sistem — Pemantauan sawah subak berbasis satelit",
  description: "Save Subak Sistem: pemantauan sawah subak berbasis satelit — status air, fase tanam, kalender sasih, dan perkiraan pengurangan emisi.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Kuota Lahan di AppTopbar — SEBELUMNYA hardcode statis (45/100), terbukti
  // palsu lewat investigasi 27 Juli 2026 (lihat docs/PROJECT_LOG.md). Sekarang:
  // usedAreaHa = SUM(area_ha) SEMUA petak non-dihapus, lintas kawasan/organisasi
  // (dihitung di sini, server-side, supaya tidak perlu API route terpisah untuk
  // 1 angka sederhana). maxAreaHa = app_settings.max_quota_ha — SEMENTARA GLOBAL
  // untuk SEMUA user (belum ada auth multi-role/multi-tenant, lihat
  // docs/migration_v23_app_settings.sql untuk catatan lengkap kenapa & kapan ini
  // harus dipindah jadi per-organisasi).
  //
  // Fallback ke 100 (nilai lama) kalau tabel app_settings BELUM ADA — migration
  // v23 belum tentu sudah dijalankan user saat kode ini pertama di-deploy (lihat
  // CLAUDE.md §6 poin 6) — JANGAN sampai 1 baris config hilang bikin SELURUH
  // aplikasi gagal render, karena layout ini membungkus semua halaman.
  const supabase = createAdminClient()
  const [plotsResult, settingsResult] = await Promise.all([
    supabase.from('plots').select('area_ha').eq('is_deleted', false),
    supabase.from('app_settings').select('value').eq('key', 'max_quota_ha').maybeSingle(),
  ])

  const usedAreaHa = (plotsResult.data ?? []).reduce((s, p) => s + (p.area_ha ?? 0), 0)
  const parsedMax = Number(settingsResult.data?.value)
  const maxAreaHa = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 100

  return (
    <html
      lang="id"
      className={`${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-montserrat)]">
        <AppTopbar usedAreaHa={usedAreaHa} maxAreaHa={maxAreaHa} />
        {children}
      </body>
    </html>
  );
}
