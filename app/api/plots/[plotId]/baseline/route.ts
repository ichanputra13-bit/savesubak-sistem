import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSentinelToken } from '@/lib/sentinel-hub/auth'
import { fetchSar } from '@/lib/sentinel-hub/sar'
import { recomputeDnbrForPlot } from '@/lib/dnbr'
import { CLOUD_COVER_THRESHOLD } from '@/lib/plot-geo'
import {
  NDVI_EVALSCRIPT,
  NDWI_EVALSCRIPT,
  NBR_STATS_EVALSCRIPT,
  estimatePhase,
  fetchSentinelStats as fetchStats,
} from '@/lib/sentinel-hub/formulas'

// Evalscript NDVI/NDWI/NBR + estimatePhase() dikonsolidasi ke
// lib/sentinel-hub/formulas.ts (Tahap 2 refactor, 28 Juli 2026) — dulu
// duplikat persis di sini dan di app/api/plots/[plotId]/scan/route.ts.

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ plotId: string }> }
) {
  const { plotId } = await params
  const supabase = createAdminClient()
  
  if (!plotId) {
    return NextResponse.json({ error: 'Plot ID required' }, { status: 400 })
  }

  try {
    // 1. Get plot geo data
    const { data: plot, error: plotErr } = await supabase
      .from('v_plots')
      .select('id, geo_data')
      .eq('id', plotId)
      .single()

    if (plotErr || !plot) throw new Error('Plot tidak ditemukan')

    // 2. Define 1095-day (3 years) window for historical baseline (Verra VM0051 requirement)
    const today = new Date()
    const toDate = today.toISOString().split('T')[0]
    const fromDate = new Date(today.getTime() - 1095 * 86400000).toISOString().split('T')[0]

    // 3. Fetch Sentinel-2 (Optical) and Sentinel-1 (SAR) in parallel
    const token = await getSentinelToken()
    
    const [ndviIntervals, ndwiIntervals, nbrIntervals, sarData] = await Promise.all([
      fetchStats(token, plot.geo_data, NDVI_EVALSCRIPT, 'ndvi', fromDate, toDate),
      fetchStats(token, plot.geo_data, NDWI_EVALSCRIPT, 'ndwi', fromDate, toDate),
      fetchStats(token, plot.geo_data, NBR_STATS_EVALSCRIPT, 'nbr', fromDate, toDate),
      fetchSar(plot.geo_data, fromDate, toDate),
    ])

    // 4. Merge Data by Date
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logsMap = new Map<string, any>()
    
    // 4a. Process Optical Data (Sentinel-2)
    for (const d of ndviIntervals) {
      const ndviMean = d.outputs?.ndvi?.bands?.B0?.stats?.mean
      if (ndviMean == null) continue
      
      const scanDate = d.interval.from.split('T')[0]
      const cloudMaskMean = d.outputs?.cloudMask?.bands?.B0?.stats?.mean ?? 0
      const cloudPct = Math.round(cloudMaskMean * 1000) / 10
      
      const matchNdwi = ndwiIntervals.find((n) => n.interval.from.split('T')[0] === scanDate)
      const ndwiMean = matchNdwi?.outputs?.ndwi?.bands?.B0?.stats?.mean ?? null
      
      const matchNbr = nbrIntervals.find((n) => n.interval.from.split('T')[0] === scanDate)
      const nbrMean = matchNbr?.outputs?.nbr?.bands?.B0?.stats?.mean ?? null
      
      const isValid = cloudPct <= CLOUD_COVER_THRESHOLD
      const estimated_phase = isValid ? estimatePhase(ndviMean, ndwiMean) : null

      logsMap.set(scanDate, {
        plot_id: plotId,
        scan_date: scanDate,
        ndvi_score: Math.round(ndviMean * 10000) / 10000,
        ndwi_score: ndwiMean !== null ? Math.round(ndwiMean * 10000) / 10000 : null,
        nbr_score: nbrMean !== null ? Math.round(nbrMean * 10000) / 10000 : null,
        cloud_cover_percent: cloudPct,
        estimated_phase,
      })
    }

    // 4b. Process SAR Data (Sentinel-1)
    for (const sar of sarData) {
      const existing = logsMap.get(sar.date) || { plot_id: plotId, scan_date: sar.date }
      
      existing.sar_vv = sar.vv
      existing.sar_vh = sar.vh
      existing.sar_flood_index = sar.flood_index
      existing.sar_orbit_direction = sar.orbit_direction
      existing.sar_source = 'Sentinel-1 (Baseline API)'
      
      logsMap.set(sar.date, existing)
    }

    const logsToInsert = Array.from(logsMap.values())
    
    if (logsToInsert.length > 0) {
      // 5. Hapus data dummy kotor dari uji coba sebelumnya (penting)
      await supabase
        .from('satellite_logs')
        .delete()
        .eq('plot_id', plotId)
        .eq('sar_source', 'Sentinel-1 (Dummy Baseline)')
        
      // 6. Upsert the real satellite data
      const { error } = await supabase
        .from('satellite_logs')
        .upsert(logsToInsert, { onConflict: 'plot_id,scan_date' })

      if (error) throw error

      // 7. Hitung ulang dNBR (selisih NBR antar-scan) untuk seluruh histori
      // petak ini — pelengkap ambang absolut NBR, lihat lib/dnbr.ts.
      // Kegagalan di sini tidak boleh menggagalkan baseline utama.
      await recomputeDnbrForPlot(supabase, plotId).catch(() => null)
    }

    return NextResponse.json({ 
      success: true, 
      message: `Berhasil menarik ${logsToInsert.length} data satelit ASLI (Sentinel-1 & 2) untuk 3 tahun terakhir (1095 hari)!`,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
