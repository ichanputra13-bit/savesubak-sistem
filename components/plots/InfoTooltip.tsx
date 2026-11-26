'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  children: React.ReactNode
  title?: string
}

const PANEL_WIDTH = 260
const VIEWPORT_MARGIN = 8
const ARROW_SIZE = 10

interface Pos {
  top: number
  panelLeft: number
  arrowLeft: number
}

// Ikon info bulat abu-abu + panel gelap mengambang di bawahnya dengan panah
// penunjuk. Di-render via portal ke document.body — beberapa lokasi pakai
// (mis. tab Karbon) berada di dalam card ber-`overflow-hidden`; popover
// absolute biasa akan terpotong di situ, portal menghindari itu sepenuhnya.
export default function InfoTooltip({ children, title = 'Keterangan' }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  function computePosition(): Pos | null {
    const el = btnRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const iconCenter = rect.left + rect.width / 2
    let panelLeft = iconCenter - PANEL_WIDTH / 2
    panelLeft = Math.max(
      VIEWPORT_MARGIN,
      Math.min(panelLeft, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN)
    )
    return { top: rect.bottom + 8, panelLeft, arrowLeft: iconCenter - panelLeft }
  }

  function show() {
    setPos(computePosition())
    setOpen(true)
  }
  function hide() {
    setOpen(false)
  }

  // Klik di luar ikon & panel → tutup (penting untuk mode klik/touch)
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node
      if (btnRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      hide()
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={() => (open ? hide() : show())}
        aria-label={open ? 'Tutup info' : 'Lihat info'}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-300 hover:bg-gray-400 text-gray-600 hover:text-gray-900 text-[10px] font-bold leading-none transition-colors select-none"
      >
        i
      </button>

      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[9999]"
          style={{ top: pos.top, left: pos.panelLeft, width: PANEL_WIDTH }}
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          {/* Panah penunjuk ke arah ikon */}
          <div
            className="bg-gray-900"
            style={{
              width: ARROW_SIZE,
              height: ARROW_SIZE,
              marginLeft: pos.arrowLeft - ARROW_SIZE / 2,
              marginBottom: -ARROW_SIZE / 2,
              transform: 'rotate(45deg)',
            }}
          />
          <div className="relative bg-gray-900 text-white rounded-xl p-3.5 text-xs leading-relaxed shadow-xl">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="font-semibold text-white">{title}</span>
              <button
                type="button"
                onClick={hide}
                className="text-gray-400 hover:text-white text-sm leading-none shrink-0"
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>
            <div className="text-gray-200 space-y-2">{children}</div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
