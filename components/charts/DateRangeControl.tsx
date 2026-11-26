'use client'

import { useEffect, useMemo, useState } from 'react'

type RangeKey = '1m' | '3m' | '1y' | 'all'

const RANGE_OPTIONS: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '1m', label: '1 Bulan', days: 30 },
  { key: '3m', label: '3 Bulan', days: 90 },
  { key: '1y', label: '1 Tahun', days: 365 },
  { key: 'all', label: 'Semua (3 Tahun)', days: null },
]

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })
}

interface Props<T> {
  items: T[]
  getDate: (item: T) => string
  getId: (item: T) => string
  activeId: string | null
  onSelect: (id: string) => void
  onRangeChange: (filtered: T[]) => void
  accent?: 'green' | 'blue'
  defaultRange?: RangeKey
}

export default function DateRangeControl<T>({
  items,
  getDate,
  getId,
  activeId,
  onSelect,
  onRangeChange,
  accent = 'green',
  defaultRange = 'all',
}: Props<T>) {
  const [rangeKey, setRangeKey] = useState<RangeKey>(defaultRange)

  // Rentang di-anchor ke tanggal data TERBARU yang tersedia, bukan tanggal
  // hari ini — supaya "1 Bulan" tetap berarti "1 bulan terakhir dari data
  // yang ada" walau tanggal sistem sudah lewat dari tanggal data terakhir.
  // Sengaja TIDAK menyertakan getDate/getId di dependency array: keduanya
  // biasanya di-pass sebagai inline arrow function dari parent (reference
  // baru tiap render). Kalau dimasukkan, `filtered` selalu jadi array baru
  // setiap render → useEffect di bawah retrigger terus → setState di parent
  // terus-menerus → "Maximum update depth exceeded". items + rangeKey saja
  // sudah cukup merepresentasikan kapan hasil filter benar-benar berubah.
  const filtered = useMemo(() => {
    if (items.length === 0) return []
    const opt = RANGE_OPTIONS.find((o) => o.key === rangeKey)!
    if (opt.days === null) return items
    const lastDate = new Date(getDate(items[items.length - 1])).getTime()
    const cutoff = lastDate - opt.days * 86400000
    return items.filter((i) => new Date(getDate(i)).getTime() >= cutoff)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, rangeKey])

  useEffect(() => {
    onRangeChange(filtered)
    // Kalau titik yang lagi dipilih jatuh di luar rentang baru, pindah ke titik terbaru dalam rentang
    if (filtered.length > 0 && !filtered.some((i) => getId(i) === activeId)) {
      onSelect(getId(filtered[filtered.length - 1]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered])

  if (items.length === 0) return null

  const activeIndex = Math.max(0, filtered.findIndex((i) => getId(i) === activeId))
  const accentBg = accent === 'blue' ? 'bg-blue-600 border-blue-600' : 'bg-green-700 border-green-700'
  const accentHex = accent === 'blue' ? '#2563eb' : '#15803d'

  return (
    <div className="space-y-2">
      {/* Toggle cepat */}
      <div className="flex flex-wrap gap-1.5">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setRangeKey(opt.key)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
              rangeKey === opt.key
                ? `${accentBg} text-white`
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Slider */}
      {filtered.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 shrink-0 w-14">
            {fmtShort(getDate(filtered[0]))}
          </span>
          <input
            type="range"
            min={0}
            max={filtered.length - 1}
            step={1}
            value={activeIndex}
            onChange={(e) => onSelect(getId(filtered[Number(e.target.value)]))}
            className="flex-1 h-1.5 cursor-pointer"
            style={{ accentColor: accentHex }}
          />
          <span className="text-[10px] text-gray-400 shrink-0 w-14 text-right">
            {fmtShort(getDate(filtered[filtered.length - 1]))}
          </span>
        </div>
      )}

      {/* Titik yang sedang dipilih */}
      {filtered.length > 0 && activeIndex >= 0 && (
        <p className="text-center text-xs font-medium text-gray-600">
          {fmtShort(getDate(filtered[activeIndex]))}
          <span className="text-gray-400 font-normal"> · {filtered.length} data point</span>
        </p>
      )}
    </div>
  )
}
