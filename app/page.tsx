import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CheckCircle, BarChart3, Globe, ShieldCheck, Satellite, MapPin, Radio, Leaf } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col" style={{ fontFamily: 'Montserrat, sans-serif' }}>

      {/* HEADER NAV */}
      <header className="sticky top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 md:px-12 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/logo-save-subak.png" alt="Save Subak Sistem" width={130} height={42} className="object-contain" priority unoptimized />
          </Link>
          <a href="https://www.savesubak.org" target="_blank" rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 text-slate-400 hover:text-slate-600 transition-colors ml-2">
            <Image src="/logo-save-subak.png" alt="Save Subak" width={20} height={20} className="rounded-sm object-contain" />
            <span className="text-[11px] leading-none font-medium">Powered by Save Subak</span>
          </a>
        </div>
        <nav className="hidden md:flex items-center gap-8 font-semibold text-slate-600 text-sm">
          <Link href="#fitur" className="hover:text-[#3C7A3F] transition">Platform</Link>
          <Link href="#karbon" className="hover:text-[#3C7A3F] transition">Estimasi Karbon</Link>
          <Link href="/docs" className="hover:text-[#3C7A3F] transition">Bantuan</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/kawasan" className="text-[#0E2B22] font-semibold hover:text-[#3C7A3F] transition px-2 text-sm">Log In</Link>
          <Link href="/register" className="bg-[#0E2B22] text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm hover:bg-[#1a4035] transition text-sm">
            Jadwalkan Demo
          </Link>
        </div>
      </header>

      <main className="flex-1">

        {/* ═══════════════════════════════════════════
            HERO — Full bleed satellite image
        ═══════════════════════════════════════════ */}
        <section className="relative w-full min-h-[92vh] flex flex-col items-center justify-center text-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <Image src="/images/sinagri_hero.png" alt="Sinagri Satellite over Bali" fill className="object-cover" priority />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0E2B22]/75 via-[#0E2B22]/55 to-[#0E2B22]/85" />
          </div>
          <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 py-24 flex flex-col items-center">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-sm text-white/90 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-8">
              <Satellite className="w-3.5 h-3.5" />
              IPCC Tier-2 · Verra VM0051 Compliant
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-4 tracking-tight leading-[1.05] drop-shadow-lg">
              SINAGRI
            </h1>
            <p className="text-lg md:text-2xl font-bold text-[#7BC67E] mb-2 tracking-[0.25em] uppercase drop-shadow-md">
              Satellite Intelligence
            </p>
            <p className="text-xs md:text-sm font-semibold text-white/80 mb-8 tracking-[0.2em] uppercase">
              For Agricultural Resilience &amp; Integrity
            </p>
            <p className="text-base md:text-lg text-white mb-10 max-w-2xl mx-auto leading-relaxed font-medium">
              Platform verifikasi pertanian berbasis satelit. Menghadirkan data agrikultur yang <em>traceable</em>, <em>auditable</em>, dan <em>Fairtrade-compliant</em> dengan bukti fisik langsung dari luar angkasa — tanpa memerlukan inspeksi lapangan.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="bg-[#3C7A3F] text-white px-8 py-4 rounded-lg font-bold shadow-lg hover:bg-[#2d5f30] hover:shadow-xl transition-all flex items-center gap-2 text-base">
                Mulai Digitalisasi <ArrowRight className="w-5 h-5"/>
              </Link>
              <Link href="/kawasan" className="bg-white/10 border border-white/30 text-white backdrop-blur-sm px-8 py-4 rounded-lg font-bold hover:bg-white/20 transition-all text-base">
                Log In Dashboard
              </Link>
            </div>
          </div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-white/40 text-xs font-medium tracking-widest">
            <span>SCROLL</span>
            <div className="w-px h-8 bg-white/20 animate-pulse" />
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            TRUST STRIP
        ═══════════════════════════════════════════ */}
        <section className="py-12 bg-white border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-6 md:px-12 text-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">Dirancang Untuk Transparansi Rantai Pasok</p>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-50 grayscale">
              <div className="flex items-center gap-2 text-lg font-black text-slate-800"><Globe className="w-7 h-7"/> Koperasi Tani</div>
              <div className="flex items-center gap-2 text-lg font-black text-slate-800"><ShieldCheck className="w-7 h-7"/> Auditor Karbon</div>
              <div className="flex items-center gap-2 text-lg font-black text-slate-800"><BarChart3 className="w-7 h-7"/> FMCG Brands</div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            FITUR 1 — GPS POLYGON TRACKING
        ═══════════════════════════════════════════ */}
        <section id="fitur" className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#3C7A3F]/10 text-[#3C7A3F] font-semibold rounded-full text-sm mb-6">
                <MapPin className="w-4 h-4" /> GPS Polygon Tracking
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#0E2B22] mb-6 leading-tight">
                Bukti Nyata, Bukan Sekadar Klaim.
              </h2>
              <p className="text-base text-slate-600 mb-6 leading-relaxed">
                Integritas data adalah kunci. Kami menggantikan klaim sepihak dengan pemetaan digital presisi. Pendekatan ini memberikan kemudahan luar biasa bagi auditor dan mitra bisnis Anda untuk mengecek keabsahan lahan secara independen, menjadikan proses due diligence jauh lebih cepat dan terpercaya.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-[#3C7A3F] w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700 text-sm font-medium">Overlay NDVI, NDWI, NBR, dan True Color langsung di atas citra satelit nyata.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-[#3C7A3F] w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700 text-sm font-medium">Deteksi fase tumbuh otomatis — label "Vegetatif", "Panen", atau "Bera" dari nilai NDVI real-time.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-[#3C7A3F] w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700 text-sm font-medium">Tidak ada manipulasi batas lahan — data bersumber langsung dari ESA, bukan dari klaim petani.</span>
                </li>
              </ul>
            </div>
            <div className="lg:w-1/2 w-full">
              <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl border border-slate-200 ring-1 ring-[#3C7A3F]/20">
                <Image
                  src="/images/feature_gps_polygon.png"
                  alt="GPS Polygon Tracking di citra satelit nyata"
                  width={900}
                  height={560}
                  className="w-full h-auto object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0E2B22]/80 to-transparent px-5 py-4">
                  <p className="text-white text-xs font-semibold">📍 Lahan Made Sengger · 0.424 Ha · Subak Sangeh, Bali · Scan: 15 Jul 2026</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            FITUR 2 — 3 TAHUN TIME-SERIES (NDVI/NDWI)
        ═══════════════════════════════════════════ */}
        <section className="py-24 px-6 md:px-12 bg-slate-50 border-y border-slate-100">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
              <div className="lg:w-1/2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#0E2B22]/5 text-[#0E2B22] font-semibold rounded-full text-sm mb-6">
                  <BarChart3 className="w-4 h-4" /> Baseline 3 Tahun · Standar Verra VM0051
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#0E2B22] mb-6 leading-tight">
                  Rekam Jejak Digital 3 Tahun yang Tidak Bisa Dipalsukan.
                </h2>
                <p className="text-base text-slate-600 mb-6 leading-relaxed">
                  Verra VM0051 mewajibkan minimal <strong>3 tahun data historis</strong> untuk membuktikan perubahan praktik petani dari kondisi <em>Business-As-Usual</em>. Begitu lahan didaftarkan, Sinagri otomatis menarik <strong>237 titik data scan satelit</strong> sejak 3 tahun ke belakang — tanpa biaya tambahan, tanpa perlu kunjungan lapangan.
                </p>
                <p className="text-sm text-slate-500 italic leading-relaxed bg-white border border-slate-200 rounded-xl p-4">
                  💡 <strong>Apa artinya grafik ini?</strong> Pola cermin antara NDVI (hijau naik saat padi tumbuh) dan NDWI (biru turun saat lahan mengering) adalah <em>"sidik jari digital"</em> siklus tanam padi yang mustahil direkayasa manusia. Ini adalah bukti ilmiah otomatis.
                </p>
              </div>
              <div className="lg:w-1/2 w-full">
                <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl border border-slate-200 bg-white p-4 ring-1 ring-[#0E2B22]/10">
                  <Image
                    src="/images/feature_ndvi_timeseries.png"
                    alt="Grafik Time-Series NDVI dan NDWI 3 Tahun"
                    width={900}
                    height={480}
                    className="w-full h-auto object-contain rounded-lg"
                  />
                  <div className="mt-3 flex items-center justify-between px-2">
                    <span className="text-xs text-slate-400 font-medium">237 scan · Jul 2023 — Jul 2026</span>
                    <span className="text-xs font-bold text-[#3C7A3F]">✓ Memenuhi Standar Verra VM0051</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            FITUR 3 — RADAR SAR TEMBUS AWAN
        ═══════════════════════════════════════════ */}
        <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 font-semibold rounded-full text-sm mb-6">
                <Radio className="w-4 h-4" /> Radar SAR Sentinel-1
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#0E2B22] mb-6 leading-tight">
                Radar Tembus Awan. Tidak Ada Data yang Hilang.
              </h2>
              <p className="text-base text-slate-600 mb-6 leading-relaxed">
                Di iklim tropis seperti Bali, satelit optik bisa tertutup awan hingga <strong>70% dari waktu pemantauan</strong>. Sinagri menggunakan Radar SAR Sentinel-1 yang bekerja dengan gelombang mikro 5.6cm — menembus awan lebat, hujan deras, dan kabut asap tanpa kompromi.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-blue-600 w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700 text-sm font-medium"><strong>294 lintasan Radar</strong> dalam 3 tahun — lebih banyak dari 237 scan optik karena Radar tidak pernah terhalang awan.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-blue-600 w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700 text-sm font-medium">Rasio VH/VV (<em>Flood Index</em>) secara otomatis menghitung hari aerasi (kering) yang diakui sebagai bukti AWD.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-blue-600 w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700 text-sm font-medium">Interval akuisisi ±6 hari — tidak ada "lubang buta" dalam rekam jejak data pertanian.</span>
                </li>
              </ul>
            </div>
            <div className="lg:w-1/2 w-full">
              <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl border border-slate-200 bg-white p-4 ring-1 ring-blue-100">
                <Image
                  src="/images/feature_radar_sar.png"
                  alt="Grafik Radar SAR Sentinel-1 294 pass 3 tahun"
                  width={900}
                  height={480}
                  className="w-full h-auto object-contain rounded-lg"
                />
                <div className="mt-3 flex items-center justify-between px-2">
                  <span className="text-xs text-slate-400 font-medium">294 pass SAR · ±6 hari · Orbit DESCENDING</span>
                  <span className="text-xs font-bold text-blue-600">0% Blind Spot</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            FITUR 4 — CARBON TAB (THE CLOSING ARGUMENT)
        ═══════════════════════════════════════════ */}
        <section id="karbon" className="py-24 px-6 md:px-12 bg-[#0E2B22]">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
              <div className="lg:w-1/2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#3C7A3F]/30 text-[#7BC67E] font-semibold rounded-full text-sm mb-6">
                  <Leaf className="w-4 h-4" /> Kalkulasi Karbon · IPCC Tier-2
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-6 leading-tight">
                  Dari Radar Satelit ke Ton CO₂e — Kalkulasi yang Siap Diaudit.
                </h2>
                <p className="text-base text-white/70 mb-6 leading-relaxed">
                  Sinagri menghitung reduksi emisi metana secara transparan menggunakan formula standar <strong className="text-white">IPCC Tier-2</strong>: setiap hari aerasi yang dibuktikan oleh Radar dikonversi menjadi kilogram CH₄ yang berhasil dicegah, lalu dikali GWP-27 dan faktor netting N₂O untuk menghasilkan estimasi Ton CO₂e NET yang dapat diverifikasi manual oleh siapapun.
                </p>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                  <p className="text-[#7BC67E] text-sm font-mono leading-relaxed">
                    NET CO₂e = (Hari Aerasi × 1.22 kg CH₄/ha/hari × Luas Ha × 27 GWP × 0.653 faktor netting N₂O) ÷ 1000
                  </p>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-[#7BC67E] w-5 h-5 mt-0.5 flex-shrink-0" />
                    <span className="text-white/80 text-sm font-medium">Checklist Verra VM0051 otomatis: ✓ GPS Polygon · ✓ Baseline 3 Tahun · ✓ Log Radar AWD</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-[#7BC67E] w-5 h-5 mt-0.5 flex-shrink-0" />
                    <span className="text-white/80 text-sm font-medium">Transparansi penuh — banner "Estimasi Internal" mencegah klaim prematur sebelum verifikasi lapangan.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-[#7BC67E] w-5 h-5 mt-0.5 flex-shrink-0" />
                    <span className="text-white/80 text-sm font-medium">Siap untuk ekspor laporan per petak sebagai <em>Verification Dossier</em> ke auditor VVB Verra.</span>
                  </li>
                </ul>
              </div>
              <div className="lg:w-1/2 w-full flex justify-center">
                <div className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-[#3C7A3F]/30">
                  <Image
                    src="/images/feature_carbon_tab.png"
                    alt="Tab Karbon: 54 Hari Kering, 0.77 Ton CO2e, Checklist Verra VM0051"
                    width={640}
                    height={900}
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            PROBLEM & SOLUTION SECTION
        ═══════════════════════════════════════════ */}
        <section className="py-24 px-6 md:px-12 bg-slate-900 text-white text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-extrabold mb-8 leading-tight">Mengapa Pemantauan Emisi Pertanian Sangat Rumit?</h2>
            <p className="text-lg md:text-xl text-white/70 mb-12 leading-relaxed">
              Pertanian tradisional, khususnya penanaman padi, adalah penyumbang emisi gas metana terbesar. Namun, membuktikan bahwa seorang petani telah menerapkan praktik ramah lingkungan sangatlah mahal, lambat, dan rentan manipulasi data.
            </p>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-3xl text-left">
              <h3 className="text-2xl font-bold mb-4 text-[#7BC67E]">Solusi Kami: Automasi &amp; Kredibilitas</h3>
              <p className="text-white/80 leading-relaxed text-lg mb-6">
                Sinagri menggabungkan data satelit Copernicus resolusi tinggi dengan algoritma AI untuk memantau ratusan hektar sawah secara <em>real-time</em>. Kami menghadirkan bukti fisik dari luar angkasa — sehingga klaim karbon Anda 100% <em>Traceable</em>, dapat diaudit, dan diakui pasar global.
              </p>
              <div className="bg-slate-900/60 p-5 rounded-xl border border-[#3C7A3F]/30">
                <p className="text-[#7BC67E] italic font-semibold leading-relaxed text-sm md:text-base">
                  &ldquo;Saat satelit optik gagal melihat lahan karena awan, sistem Sinagri otomatis menambal data tersebut dengan pindaian satelit Radar (SAR) — karena radar bisa menembus awan dan cuaca buruk.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            CTA SECTION
        ═══════════════════════════════════════════ */}
        <section className="py-24 px-6 md:px-12 bg-white text-center">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-[#3C7A3F]/10 text-[#3C7A3F] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-8">
              <Satellite className="w-3.5 h-3.5" /> Siap untuk Pilot Program?
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold text-[#0E2B22] mb-6 leading-tight">
              Mulai Pantau Lahan Anda dengan Kekuatan Satelit ESA.
            </h2>
            <p className="text-base md:text-lg text-slate-600 mb-10 leading-relaxed">
              Tidak perlu sensor IoT, tidak perlu tim lapangan besar. Cukup daftarkan koordinat lahan Anda, dan Sinagri akan otomatis menarik 3 tahun data historis satelit untuk memulai proses verifikasi karbon Anda.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="bg-[#0E2B22] text-white px-10 py-4 rounded-lg font-bold shadow-lg hover:bg-[#1a4035] hover:shadow-xl transition-all flex items-center gap-2 text-base">
                Mulai Gratis <ArrowRight className="w-5 h-5"/>
              </Link>
              <Link href="/kawasan" className="border-2 border-[#0E2B22] text-[#0E2B22] px-10 py-4 rounded-lg font-bold hover:bg-slate-50 transition-all text-base">
                Lihat Demo Dashboard
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="bg-[#0E2B22] text-white/50 py-16 text-center border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col items-center justify-center gap-4 mb-8">
            <div className="bg-white rounded-2xl p-3">
              <Image src="/logo-save-subak.png" alt="Save Subak Sistem" width={100} height={100} className="object-contain" unoptimized />
            </div>
            <p className="text-xs font-medium uppercase tracking-widest text-white/40">
              Satellite Intelligence for Agricultural Resilience &amp; Integrity
            </p>
          </div>
          <p className="mb-8 max-w-md mx-auto text-sm leading-relaxed">
            Platform MRV Digital (SaaS) untuk merancang, memantau, dan memverifikasi pertanian padi regeneratif secara presisi.
          </p>
          <div className="flex justify-center gap-8 font-semibold text-sm">
            <Link href="#" className="hover:text-white transition">Solusi Enterprise</Link>
            <Link href="/docs/PANDUAN_SISTEM.md" className="hover:text-white transition">Dokumentasi</Link>
            <Link href="#" className="hover:text-white transition">Kebijakan Privasi</Link>
          </div>
          <div className="mt-12 pt-8 border-t border-white/10 text-xs">
            © 2026 Sinagri by Save Subak. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
