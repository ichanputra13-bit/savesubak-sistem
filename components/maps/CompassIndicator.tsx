// Penunjuk arah mata angin statis — peta di project ini pakai proyeksi
// Web Mercator standar Leaflet (utara selalu lurus ke atas), jadi cukup
// ikon "N" diam, tidak perlu logic rotasi dinamis apapun.
export default function CompassIndicator({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm border border-gray-200 shadow-md select-none ${className}`}
      title="Utara — peta menghadap ke atas"
    >
      <span className="block w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-red-500 -mb-0.5" />
      <span className="text-[11px] font-bold text-gray-700 leading-none">N</span>
    </div>
  )
}
