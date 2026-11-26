// Open-Meteo — gratis, tanpa API key. Dites manual 18 Juli 2026 pakai
// koordinat plot Wayan Suparta, termasuk tanggal hari-ini (tidak ada lag
// data reanalysis seperti yang dikhawatirkan di awal).
// 26 Nov 2026: diperluas — angin (kecepatan, hembusan, arah), tekanan,
// radiasi & lama penyinaran, penguapan ET0 (untuk neraca air), dan
// kelembapan tanah (perkiraan model, bukan sensor).
export interface WeatherDay {
  date: string
  rainfall_mm: number | null
  temp_avg_c: number | null
  humidity_avg_pct: number | null
  temp_min_c: number | null
  temp_max_c: number | null
  wind_speed_max_ms: number | null
  wind_gust_max_ms: number | null
  wind_dir_deg: number | null
  pressure_hpa: number | null
  radiation_mj_m2: number | null
  sunshine_hours: number | null
  et0_mm: number | null
  soil_moisture_m3m3: number | null
}

const DAILY = [
  'precipitation_sum', 'temperature_2m_mean', 'relative_humidity_2m_mean',
  'temperature_2m_min', 'temperature_2m_max',
  'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant',
  'shortwave_radiation_sum', 'sunshine_duration', 'et0_fao_evapotranspiration',
].join(',')
const HOURLY = 'pressure_msl,soil_moisture_0_to_7cm'

function dailyMean(times: string[], vals: (number | null)[], date: string): number | null {
  const xs = vals.filter((v, i) => times[i]?.startsWith(date) && v != null) as number[]
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1000) / 1000 : null
}

export async function fetchWeatherRange(
  lat: number,
  lon: number,
  fromDate: string,
  toDate: string
): Promise<WeatherDay[]> {
  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat}&longitude=${lon}` +
    `&start_date=${fromDate}&end_date=${toDate}` +
    `&daily=${DAILY}&hourly=${HOURLY}` +
    `&wind_speed_unit=ms&timezone=Asia%2FMakassar`

  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Open-Meteo request failed (${res.status}): ${err}`)
  }

  const data = await res.json()
  const d = data.daily ?? {}
  const h = data.hourly ?? {}
  const days: string[] = d.time ?? []
  const at = (k: string, i: number): number | null => (d[k]?.[i] ?? null)

  return days.map((date, i) => ({
    date,
    rainfall_mm: at('precipitation_sum', i),
    temp_avg_c: at('temperature_2m_mean', i),
    humidity_avg_pct: at('relative_humidity_2m_mean', i),
    temp_min_c: at('temperature_2m_min', i),
    temp_max_c: at('temperature_2m_max', i),
    wind_speed_max_ms: at('wind_speed_10m_max', i),
    wind_gust_max_ms: at('wind_gusts_10m_max', i),
    wind_dir_deg: at('wind_direction_10m_dominant', i),
    pressure_hpa: dailyMean(h.time ?? [], h.pressure_msl ?? [], date),
    radiation_mj_m2: at('shortwave_radiation_sum', i),
    sunshine_hours: at('sunshine_duration', i) != null ? Math.round((at('sunshine_duration', i)! / 3600) * 10) / 10 : null,
    et0_mm: at('et0_fao_evapotranspiration', i),
    soil_moisture_m3m3: dailyMean(h.time ?? [], h.soil_moisture_0_to_7cm ?? [], date),
  }))
}
