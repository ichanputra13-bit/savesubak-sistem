// Formula karbon v1.1 NET CH4-N2O (Technical Design §3.8)
// GWP100 IPCC AR6: CH4 = 27, N2O = 273
// Faktor kenaikan N2O default konservatif 0.15 (rentang literatur: 0.074–0.234)

const GWP_CH4 = 27
const GWP_N2O = 273
const DEFAULT_N2O_INCREASE_FACTOR = 0.15

export interface CarbonInput {
  area_ha: number
  dry_ratio: number             // 0–1, proporsi lahan yang dikelola AWD
  baseline_ch4_per_ha: number   // kg CH4/ha per musim tanpa intervensi
  baseline_n2o_per_ha: number   // kg N2O/ha per musim tanpa intervensi
  n2o_increase_factor?: number  // default 0.15
}

export interface CarbonResult {
  prevented_ch4_kg: number
  additional_n2o_kg: number
  co2e_from_ch4_kg: number
  co2e_from_n2o_kg: number
  co2e_net_kg: number
}

export function calculateCarbon(input: CarbonInput): CarbonResult {
  const factor = input.n2o_increase_factor ?? DEFAULT_N2O_INCREASE_FACTOR

  const prevented_ch4_kg = input.baseline_ch4_per_ha * input.area_ha * input.dry_ratio
  const additional_n2o_kg =
    input.baseline_n2o_per_ha * input.area_ha * input.dry_ratio * factor

  const co2e_from_ch4_kg = prevented_ch4_kg * GWP_CH4
  const co2e_from_n2o_kg = additional_n2o_kg * GWP_N2O
  const co2e_net_kg = co2e_from_ch4_kg - co2e_from_n2o_kg

  return {
    prevented_ch4_kg,
    additional_n2o_kg,
    co2e_from_ch4_kg,
    co2e_from_n2o_kg,
    co2e_net_kg,
  }
}
