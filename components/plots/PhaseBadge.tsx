import { PHASE_LABEL, PHASE_BADGE_STYLE, PHASE_BADGE_EMPTY } from '@/lib/plot-geo'

interface Props {
  phase: string | null | undefined
  // Opsional — kalau `phase` null TAPI ada histori fase valid dari tanggal
  // lain (scan terbaru tertutup awan, tapi bukan berarti "belum pernah
  // discan"), tampilkan badge informatif alih-alih "Belum ada scan" generik.
  cloudCover?: number | null
  fallbackPhase?: string | null
  fallbackPhaseDate?: string | null
  emptyLabel?: string
  className?: string
}

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export default function PhaseBadge({
  phase,
  cloudCover,
  fallbackPhase,
  fallbackPhaseDate,
  emptyLabel = 'Belum ada scan',
  className = '',
}: Props) {
  // Cloud-aware: scan terbaru tidak valid (phase null), TAPI ada fase valid
  // dari scan sebelumnya — beda kondisi dari "belum pernah discan sama sekali".
  if (!phase && fallbackPhase && fallbackPhaseDate) {
    const fallbackLabel = PHASE_LABEL[fallbackPhase] ?? fallbackPhase
    const cloudText = cloudCover != null ? `☁️ Awan ${cloudCover.toFixed(0)}%` : '☁️ Awan'
    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${className}`}
        style={{ backgroundColor: PHASE_BADGE_EMPTY.bg, color: PHASE_BADGE_EMPTY.text }}
        title={`Scan terbaru tertutup awan — data fase terakhir yang valid: ${fallbackLabel} (${fmtShortDate(fallbackPhaseDate)})`}
      >
        {cloudText} — data terakhir: {fallbackLabel} ({fmtShortDate(fallbackPhaseDate)})
      </span>
    )
  }

  const style = phase ? (PHASE_BADGE_STYLE[phase] ?? PHASE_BADGE_EMPTY) : PHASE_BADGE_EMPTY
  const label = phase ? (PHASE_LABEL[phase] ?? phase) : emptyLabel

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${className}`}
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {label}
    </span>
  )
}
