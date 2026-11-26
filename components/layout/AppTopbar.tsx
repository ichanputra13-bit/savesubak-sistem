'use client'

import Image from 'next/image'
import Link from 'next/link'
import { User } from 'lucide-react'
import { usePathname } from 'next/navigation'

interface Props {
  // Diambil dari database di app/layout.tsx (server-side) — usedAreaHa =
  // SUM(area_ha) SEMUA petak lintas kawasan/organisasi; maxAreaHa =
  // app_settings.max_quota_ha. Lihat komentar lengkap di app/layout.tsx dan
  // docs/migration_v23_app_settings.sql soal kenapa maxAreaHa SEMENTARA
  // masih 1 nilai global (belum per-organisasi — auth multi-role belum ada).
  usedAreaHa: number
  maxAreaHa: number
}

export default function AppTopbar({ usedAreaHa, maxAreaHa }: Props) {
  const pathname = usePathname()

  const usagePercentage = maxAreaHa > 0 ? Math.round((usedAreaHa / maxAreaHa) * 100) : 0

  // Hide the global topbar on the landing page
  if (pathname === '/') return null;

  return (
    <header className="w-full bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-between shadow-sm z-50 relative">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo-save-subak.png" alt="Save Subak" width={38} height={38} className="object-contain" unoptimized />
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-extrabold text-green-800 tracking-wide">Save Subak Sistem</span>
            <span className="text-[10px] text-gray-500">Pemantauan sawah berbasis satelit</span>
          </span>
        </Link>
      </div>
      
      <div className="flex items-center gap-6">
        {/* Kuota Indicator */}
        <div className="hidden md:flex flex-col items-end">
          <div className="flex justify-between w-full text-xs mb-1">
            <span className="text-gray-500 font-medium">Kuota Lahan</span>
            <span className="text-gray-700 font-bold">{usedAreaHa.toFixed(3)} / {maxAreaHa} Ha</span>
          </div>
          <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${usagePercentage > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${usagePercentage}%` }}
            ></div>
          </div>
        </div>

        <div className="w-px h-8 bg-gray-200 hidden md:block"></div>

        {/* User Profile Info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-green-100 text-green-700 rounded-full flex items-center justify-center cursor-pointer hover:bg-green-200 transition-colors">
            <User className="w-5 h-5" />
          </div>
        </div>
      </div>
    </header>
  )
}
