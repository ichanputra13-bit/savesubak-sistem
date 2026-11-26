import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 memblokir cross-origin request ke aset dev (/_next/*) secara
  // default kalau diakses BUKAN dari localhost — termasuk dari HP/perangkat
  // lain di WiFi yang sama lewat IP LAN laptop (mis. saat testing responsif
  // di HP, peta jadi macet di "Memuat peta..." karena chunk JS peta gagal
  // dimuat). Dikonfirmasi lewat log server: "⚠ Blocked cross-origin request
  // to Next.js dev resource ... from '192.168.100.50'" (25/26 Juli 2026).
  //
  // Wildcard '192.168.100.*' DIKONFIRMASI bekerja (dites empiris dengan IP
  // lain di subnet yang sama, DAN dikonfirmasi IP di luar subnet ini tetap
  // diblokir seperti biasa) — jadi tetap aman kalau laptop dapat IP baru
  // dari DHCP SELAMA masih di jaringan WiFi/subnet 192.168.100.x yang sama.
  // IP presis 192.168.100.50 tetap dicantumkan sebagai dokumentasi kejadian
  // aslinya (redundan secara fungsi dengan wildcard di atas, tidak masalah).
  //
  // KALAU laptop pindah ke jaringan/subnet LAIN (mis. WiFi kantor/kafe beda
  // rentang IP), wildcard ini TIDAK otomatis ikut — perlu ditambah entri
  // baru sesuai subnet baru itu (cek IP laptop lewat `ipconfig`).
  allowedDevOrigins: ['192.168.100.50', '192.168.100.*'],
};

export default nextConfig;
