import { useCallback, useEffect, useRef, useState } from 'react'
import { getSpots, type SpotsSummary } from '../api'
import { bboxToLayoutInViewport, isValidBbox, unionBBoxViewport } from '../lib/parkingLayout'

type SpotRow = SpotsSummary['spots'][number]

function spotStatus(s: SpotRow): 'available' | 'occupied' | 'reserved' {
  if (s.is_reserved) return 'reserved'
  if (s.is_occupied) return 'occupied'
  return 'available'
}

const STATUS_STYLES: Record<
  'available' | 'occupied' | 'reserved',
  { bg: string; text: string; border: string }
> = {
  available: {
    bg: 'bg-emerald-500/90',
    text: 'text-white',
    border: 'border-emerald-700/50',
  },
  occupied: {
    bg: 'bg-red-700',
    text: 'text-white',
    border: 'border-red-900/40',
  },
  reserved: {
    bg: 'bg-amber-400',
    text: 'text-amber-950',
    border: 'border-amber-600/50',
  },
}

function useMinMapHeightPx() {
  const [minH, setMinH] = useState(400)
  useEffect(() => {
    const upd = () => setMinH(Math.max(400, Math.floor(window.innerHeight * 0.45)))
    upd()
    window.addEventListener('resize', upd)
    return () => window.removeEventListener('resize', upd)
  }, [])
  return minH
}

export default function DashboardParkingMap() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [summary, setSummary] = useState<SpotsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const minMapHeightPx = useMinMapHeightPx()

  const measure = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const w = el.getBoundingClientRect().width
    if (w > 0) setWidth(Math.floor(w))
  }, [])

  useEffect(() => {
    measure()
    const ro = new ResizeObserver(() => measure())
    const el = wrapRef.current
    if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  useEffect(() => {
    let cancelled = false
    function load() {
      getSpots()
        .then((data: SpotsSummary) => {
          if (!cancelled) {
            setSummary(data)
            setError(null)
          }
        })
        .catch(() => {
          if (!cancelled) setError('Park alanları yüklenemedi')
        })
    }
    load()
    const id = setInterval(load, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const sorted =
    summary?.spots
      .filter((s) => isValidBbox(s.bbox))
      .sort((a, b) => {
        const ay = a.bbox[1]
        const by = b.bbox[1]
        if (ay !== by) return ay - by
        return a.bbox[0] - b.bbox[0]
      }) ?? []

  const viewport = unionBBoxViewport(sorted.map((s) => s.bbox))
  const containerW = width || 400
  /** Geniş planlarda yükseklik çok küçük kalmasın: min yükseklik + en-boy korunur, gerekirse yatay kaydırma */
  let displayW = containerW
  let displayH = 200
  if (viewport && viewport.viewW > 0 && viewport.viewH > 0) {
    const naturalH = Math.round((containerW * viewport.viewH) / viewport.viewW)
    if (naturalH < minMapHeightPx) {
      displayH = minMapHeightPx
      displayW = Math.round((displayH * viewport.viewW) / viewport.viewH)
    } else {
      displayH = naturalH
      displayW = containerW
    }
  }

  if (error) {
    return (
      <div className="flex min-h-[200px] items-center justify-center bg-slate-800 px-4 text-center text-sm text-slate-400">
        {error}
      </div>
    )
  }

  if (!summary || sorted.length === 0 || !viewport) {
    return (
      <div className="flex min-h-[200px] items-center justify-center bg-slate-800 px-4 text-center text-sm text-slate-400">
        {!summary ? 'Yükleniyor...' : 'Tanımlı park alanı yok veya konum bilgisi eksik'}
      </div>
    )
  }

  const { viewX, viewY, viewW, viewH } = viewport

  return (
    <div ref={wrapRef} className="w-full bg-slate-800">
      <div className="flex w-full justify-center overflow-x-auto overflow-y-hidden">
        <div
          className="relative shrink-0 overflow-hidden"
          style={{ width: displayW, height: displayH }}
          role="img"
          aria-label="Park alanları haritası"
        >
        {sorted.map((item) => {
          const layout = bboxToLayoutInViewport(item.bbox, viewX, viewY, viewW, viewH, displayW, displayH)
          if (!layout) return null
          const st = spotStatus(item)
          const styles = STATUS_STYLES[st]
          const fs = Math.max(8, Math.min(14, Math.round(Math.min(layout.width, layout.height) * 0.36)))

          return (
            <div
              key={item.id}
              className={`absolute box-border flex items-center justify-center rounded border font-medium leading-tight shadow-sm ${styles.bg} ${styles.text} ${styles.border}`}
              style={{
                left: layout.left,
                top: layout.top,
                width: layout.width,
                height: layout.height,
                fontSize: fs,
                padding: 2,
              }}
              title={`${item.spot_number} — ${st === 'available' ? 'Boş' : st === 'occupied' ? 'Dolu' : 'Rezerve'}`}
            >
              <span className="truncate px-0.5 text-center">{item.spot_number}</span>
            </div>
          )
        })}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-6 border-t border-slate-700/80 px-4 py-3 text-xs text-slate-300">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Boş
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-700" /> Dolu
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Rezerve
        </span>
        {summary.parking_lot_name ? (
          <span className="text-slate-500">{summary.parking_lot_name}</span>
        ) : null}
      </div>
    </div>
  )
}
