// Kalender Bali sederhana (26 Nov 2026) — dihitung, tanpa sumber luar.
// - Purnama/Tilem: posisi bulan rata-rata (siklus sinodis 29,530588853 hari),
//   akurat ±1 hari. Kalender Bali sesekali bergeser 1 hari (ngunaratri),
//   jadi tetap perlu dicocokkan dengan kalender cetak.
// - Wuku (pawukon 210 hari) dari jangkar Galungan 17 Jun 2026 (Buda Kliwon
//   Dungulan). Hari raya pawukon mengikuti.
// - Sasih: Tilem Kasanga = tilem terdekat ke awal Maret; Nyepi = sehari
//   sesudahnya. Urutan sasih mundur/maju dari situ.
const DAY = 864e5
const SYN = 29.530588853
const NM0 = Date.UTC(2000, 0, 6, 18, 14)

export const WUKU = ['Sinta','Landep','Ukir','Kulantir','Tolu','Gumbreg','Wariga','Warigadean','Julungwangi','Sungsang','Dungulan','Kuningan','Langkir','Medangsia','Pujut','Pahang','Krulut','Merakih','Tambir','Medangkungan','Matal','Uye','Menail','Prangbakat','Bala','Ugu','Wayang','Kelawu','Dukut','Watugunung']
export const SASIH = ['Kasa','Karo','Katiga','Kapat','Kalima','Kanem','Kapitu','Kawolu','Kasanga','Kadasa','Destha','Sada']

const GALUNGAN_ANCHOR = new Date(2026, 5, 17)
const SINTA0 = new Date(+GALUNGAN_ANCHOR - 73 * DAY)

export interface MoonEvent { t: 'Purnama' | 'Tilem'; d: Date }
export interface Raya { t: string; d: Date }
export interface SasihMonth { name: string; s: Date; e: Date }

function localDay(t: number) {
  const d = new Date(t + 8 * 36e5) // WITA
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function moonEvents(from: Date, to: Date): MoonEvent[] {
  const out: MoonEvent[] = []
  let k = Math.floor((+from - NM0) / DAY / SYN) - 1
  for (;; k++) {
    const nm = NM0 + k * SYN * DAY
    const fm = nm + (SYN / 2) * DAY
    if (nm > +to) break
    if (nm >= +from) out.push({ t: 'Tilem', d: localDay(nm) })
    if (fm >= +from && fm <= +to) out.push({ t: 'Purnama', d: localDay(fm) })
  }
  return out.sort((a, b) => +a.d - +b.d)
}

export function wukuOf(d: Date) {
  const n = (((Math.round((+d - +SINTA0) / DAY)) % 210) + 210) % 210
  return WUKU[Math.floor(n / 7)]
}

export function rayaBetween(from: Date, to: Date): Raya[] {
  const r: Raya[] = []
  const offs: [number, string][] = [[3, 'Pagerwesi'], [48, 'Tumpek Wariga'], [73, 'Galungan'], [83, 'Kuningan'], [209, 'Saraswati']]
  for (let c = -3; c < 8; c++) {
    const s = +SINTA0 + c * 210 * DAY
    for (const [o, n] of offs) {
      const d = new Date(s + o * DAY)
      if (d >= from && d <= to) r.push({ t: n, d })
    }
  }
  return r.sort((a, b) => +a.d - +b.d)
}

export function sasihMonths(from: Date, to: Date): { months: SasihMonth[]; nyepi: Date[] } {
  const tilems = moonEvents(new Date(+from - 400 * DAY), new Date(+to + 400 * DAY)).filter((m) => m.t === 'Tilem')
  // Tilem Kasanga tiap tahun = tilem terdekat ke 8 Maret
  const isKasanga = (d: Date) => { const ref = new Date(d.getFullYear(), 2, 8); return Math.abs(+d - +ref) <= 14.7 * DAY }
  const kIdx = tilems.map((t, i) => (isKasanga(t.d) ? i : -1)).filter((i) => i >= 0)
  const months: SasihMonth[] = []
  const nyepi: Date[] = []
  for (let i = 1; i < tilems.length; i++) {
    const prevK = [...kIdx].reverse().find((j) => j < i)
    const nextK = kIdx.find((j) => j >= i)
    if (prevK === undefined || nextK === undefined) continue
    const p = i - prevK, q = nextK - i
    // Bulan yang berakhir di Tilem Kasanga = Sasih Kasanga (q=0), mundur ke Kasa (q=8).
    // Sesudah Kasanga: Kadasa, Destha, Sada. Tahun 13 bulan → bulan ke-4 = Sada nampih.
    const name = q <= 8 ? SASIH[8 - q] : p <= 3 ? SASIH[(8 + p) % 12] : 'Sada (nampih)'
    months.push({ name, s: new Date(+tilems[i - 1].d + DAY), e: tilems[i].d })
    if (q === 0) nyepi.push(new Date(+tilems[i].d + DAY))
  }
  return { months: months.filter((m) => m.e >= from && m.s <= to), nyepi: nyepi.filter((d) => d >= from && d <= to) }
}
