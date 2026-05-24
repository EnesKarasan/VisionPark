import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  getVideoFrame,
  getAdminSpots,
  saveAdminSpotsBulk,
  deleteAllAdminSpots,
  redirectIfUnauthorized,
  type SpotWithSection,
  type SpotCreatePayload,
} from '../api'

interface DrawnSpot {
  id: string
  x: number
  y: number
  w: number
  h: number
  section: string
  row_number: number
  spot_number: string
}

const SECTION_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#ef4444',
  E: '#a855f7',
  F: '#ec4899',
  G: '#14b8a6',
  H: '#f97316',
}

function getSectionColor(section: string): string {
  return SECTION_COLORS[section.toUpperCase()] ?? '#6b7280'
}

function generateSpotNumber(section: string, row: number, index: number): string {
  if (!section) return `P-${String(index).padStart(3, '0')}`
  return `${section.toUpperCase()}-${row}${String(index).padStart(2, '0')}`
}

export default function SpotEditorPage() {
  const token = localStorage.getItem('token') ?? ''

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const bgImage = useRef<HTMLImageElement | null>(null)

  const [frameUrl, setFrameUrl] = useState<string | null>(null)
  const [frameLoading, setFrameLoading] = useState(false)
  const [spots, setSpots] = useState<DrawnSpot[]>([])
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null)
  const [drawMode, setDrawMode] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null)

  const [naturalW, setNaturalW] = useState(1920)
  const [naturalH, setNaturalH] = useState(1080)

  const [defaultSection, setDefaultSection] = useState('A')
  const [defaultRow, setDefaultRow] = useState(1)

  // Frame yükle
  const loadFrame = useCallback(async () => {
    setFrameLoading(true)
    try {
      const url = await getVideoFrame()
      if (frameUrl) URL.revokeObjectURL(frameUrl)
      setFrameUrl(url)
    } catch {
      setSaveMsg({ kind: 'err', text: 'Frame yüklenemedi - backend çalışıyor mu?' })
    } finally {
      setFrameLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mevcut spotları DB'den yükle
  const loadExistingSpots = useCallback(async () => {
    try {
      const dbSpots: SpotWithSection[] = await getAdminSpots(token)
      const mapped: DrawnSpot[] = dbSpots.map((s) => ({
        id: `db-${s.id}`,
        x: s.bbox[0],
        y: s.bbox[1],
        w: s.bbox[2],
        h: s.bbox[3],
        section: s.section ?? 'A',
        row_number: s.row_number ?? 1,
        spot_number: s.spot_number,
      }))
      setSpots(mapped)
      setSelectedSpotId(null)
      setHasUnsavedChanges(false)
    } catch (e) {
      if (redirectIfUnauthorized(e)) return
    }
  }, [token])

  useEffect(() => {
    loadFrame()
    loadExistingSpots()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // bgImage yüklendiğinde natural boyutları al
  useEffect(() => {
    if (!frameUrl) return
    const img = new Image()
    img.onload = () => {
      bgImage.current = img
      setNaturalW(img.naturalWidth)
      setNaturalH(img.naturalHeight)
      redraw()
    }
    img.src = frameUrl
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameUrl])

  // Canvas'ı yeniden çiz
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !bgImage.current) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = naturalW
    canvas.height = naturalH

    ctx.drawImage(bgImage.current, 0, 0, naturalW, naturalH)

    for (const spot of spots) {
      const color = getSectionColor(spot.section)
      const isSelected = spot.id === selectedSpotId

      ctx.fillStyle = color + '40'
      ctx.fillRect(spot.x, spot.y, spot.w, spot.h)

      ctx.strokeStyle = isSelected ? '#ffffff' : color
      ctx.lineWidth = isSelected ? 3 : 2
      ctx.strokeRect(spot.x, spot.y, spot.w, spot.h)

      const label = spot.spot_number
      ctx.font = 'bold 14px sans-serif'
      const tm = ctx.measureText(label)
      const tx = spot.x + (spot.w - tm.width) / 2
      const ty = spot.y + spot.h / 2 + 5

      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(tx - 3, ty - 13, tm.width + 6, 16)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, tx, ty)
    }

    if (isDrawing && drawStart && drawCurrent) {
      const rx = Math.min(drawStart.x, drawCurrent.x)
      const ry = Math.min(drawStart.y, drawCurrent.y)
      const rw = Math.abs(drawCurrent.x - drawStart.x)
      const rh = Math.abs(drawCurrent.y - drawStart.y)
      ctx.strokeStyle = '#facc15'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(rx, ry, rw, rh)
      ctx.setLineDash([])
      ctx.fillStyle = '#facc1530'
      ctx.fillRect(rx, ry, rw, rh)
    }
  }, [spots, selectedSpotId, isDrawing, drawStart, drawCurrent, naturalW, naturalH])

  useEffect(() => {
    redraw()
  }, [redraw])

  // Mouse -> canvas coordinate dönüşümü
  const toCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = naturalW / rect.width
    const scaleY = naturalH / rect.height
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawMode) {
      const { x, y } = toCanvasCoords(e)
      const clicked = [...spots].reverse().find(
        (s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h
      )
      setSelectedSpotId(clicked?.id ?? null)
      return
    }

    if (e.button !== 0) return
    const pos = toCanvasCoords(e)
    setIsDrawing(true)
    setDrawStart(pos)
    setDrawCurrent(pos)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    setDrawCurrent(toCanvasCoords(e))
  }

  const handleMouseUp = () => {
    if (!isDrawing || !drawStart || !drawCurrent) {
      setIsDrawing(false)
      return
    }

    const rx = Math.min(drawStart.x, drawCurrent.x)
    const ry = Math.min(drawStart.y, drawCurrent.y)
    const rw = Math.abs(drawCurrent.x - drawStart.x)
    const rh = Math.abs(drawCurrent.y - drawStart.y)

    setIsDrawing(false)
    setDrawStart(null)
    setDrawCurrent(null)

    if (rw < 10 || rh < 10) return

    const sectionSpots = spots.filter(
      (s) => s.section === defaultSection && s.row_number === defaultRow
    )
    const nextIdx = sectionSpots.length + 1

    const newSpot: DrawnSpot = {
      id: `new-${Date.now()}-${Math.random()}`,
      x: rx,
      y: ry,
      w: rw,
      h: rh,
      section: defaultSection,
      row_number: defaultRow,
      spot_number: generateSpotNumber(defaultSection, defaultRow, nextIdx),
    }

    setSpots((prev) => [...prev, newSpot])
    setSelectedSpotId(newSpot.id)
    setHasUnsavedChanges(true)
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const { x, y } = toCanvasCoords(e)
    const clicked = [...spots].reverse().find(
      (s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h
    )
    if (clicked) {
      setSpots((prev) => prev.filter((s) => s.id !== clicked.id))
      if (selectedSpotId === clicked.id) setSelectedSpotId(null)
      setHasUnsavedChanges(true)
    }
  }

  // Spot güncelleme
  const updateSpotField = (id: string, field: keyof DrawnSpot, value: string | number) => {
    setSpots((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        const updated = { ...s, [field]: value }
        if (field === 'section' || field === 'row_number') {
          const sectionSpots = prev.filter(
            (sp) =>
              sp.id !== id &&
              sp.section === (field === 'section' ? value : s.section) &&
              sp.row_number === (field === 'row_number' ? value : s.row_number)
          )
          const sec = field === 'section' ? (value as string) : s.section
          const row = field === 'row_number' ? (value as number) : s.row_number
          updated.spot_number = generateSpotNumber(sec, row, sectionSpots.length + 1)
        }
        return updated
      })
    )
    setHasUnsavedChanges(true)
  }

  // Toplu kaydet
  const handleSave = useCallback(async () => {
    if (spots.length === 0) {
      setSaveMsg({ kind: 'err', text: 'Kaydedilecek park alanı yok' })
      return
    }
    setSaving(true)
    setSaveMsg(null)
    try {
      const payload: SpotCreatePayload[] = spots.map((s) => ({
        spot_number: s.spot_number,
        bbox: [s.x, s.y, s.w, s.h],
        section: s.section || undefined,
        row_number: s.row_number || undefined,
      }))
      await saveAdminSpotsBulk(token, payload)
      setSaveMsg({ kind: 'ok', text: `${spots.length} park alanı kaydedildi` })
      setHasUnsavedChanges(false)
      await loadExistingSpots()
    } catch (err) {
      setSaveMsg({ kind: 'err', text: (err as Error).message || 'Kaydetme hatası' })
    } finally {
      setSaving(false)
    }
  }, [spots, token, loadExistingSpots])

  // Tümünü sil
  const handleDeleteAll = async () => {
    if (!confirm('Tüm park alanlarını silmek istediğinizden emin misiniz?')) return
    try {
      await deleteAllAdminSpots(token)
      setSpots([])
      setSelectedSpotId(null)
      setSaveMsg({ kind: 'ok', text: 'Tüm park alanları silindi' })
      setHasUnsavedChanges(false)
    } catch (err) {
      setSaveMsg({ kind: 'err', text: (err as Error).message || 'Silme hatası' })
    }
  }

  // Seçili spot sil
  const deleteSelectedSpot = useCallback(() => {
    if (!selectedSpotId) return
    setSpots((prev) => prev.filter((s) => s.id !== selectedSpotId))
    setSelectedSpotId(null)
    setHasUnsavedChanges(true)
  }, [selectedSpotId])

  // Klavye kısayolları
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Input içindeyse görmezden gel
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSpotId) {
        e.preventDefault()
        deleteSelectedSpot()
      } else if (e.key === 'Escape') {
        setSelectedSpotId(null)
      } else if (e.key.toLowerCase() === 'd') {
        setDrawMode((v) => !v)
      } else if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (!saving) handleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedSpotId, deleteSelectedSpot, saving, handleSave])

  const selectedSpot = spots.find((s) => s.id === selectedSpotId)

  const sectionGroups = useMemo(() => {
    return spots.reduce<Record<string, DrawnSpot[]>>((acc, s) => {
      const key = `${s.section}-${s.row_number}`
      if (!acc[key]) acc[key] = []
      acc[key].push(s)
      return acc
    }, {})
  }, [spots])

  const usedSections = useMemo(() => {
    const set = new Set(spots.map((s) => s.section))
    return Array.from(set).sort()
  }, [spots])

  return (
    <div className="space-y-4">
      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Toplam alan" value={spots.length.toString()} accent="indigo" />
        <StatTile label="Bölüm sayısı" value={usedSections.length.toString()} accent="emerald" />
        <StatTile label="Kayıtsız değişiklik" value={hasUnsavedChanges ? 'Var' : 'Yok'} accent={hasUnsavedChanges ? 'amber' : 'slate'} />
        <StatTile label="Çözünürlük" value={`${naturalW}×${naturalH}`} accent="slate" mono />
      </div>

      {/* Toolbar kart */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
          {/* Sayfa eylemleri grubu */}
          <ToolGroup label="Veri">
            <button
              onClick={loadFrame}
              disabled={frameLoading}
              className="px-2.5 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 disabled:opacity-50 inline-flex items-center gap-1.5"
              title="Video'dan yeni kare al"
            >
              <RefreshIcon /> {frameLoading ? 'Yükleniyor…' : 'Yeni kare'}
            </button>
            <button
              onClick={loadExistingSpots}
              className="px-2.5 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 inline-flex items-center gap-1.5"
              title="Veritabanından spotları yeniden yükle"
            >
              <DownloadIcon /> Yeniden yükle
            </button>
          </ToolGroup>

          <ToolGroup label="Mod">
            <button
              onClick={() => setDrawMode(!drawMode)}
              className={`px-2.5 py-1.5 text-xs rounded-md inline-flex items-center gap-1.5 ${
                drawMode
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title="Çizim / Seçim modu (D)"
            >
              {drawMode ? <DrawIcon /> : <CursorIcon />}
              {drawMode ? 'Çizim' : 'Seçim'}
              <kbd className="ml-1 px-1 py-0 text-[10px] bg-black/10 rounded">D</kbd>
            </button>
          </ToolGroup>

          <ToolGroup label="Varsayılan">
            <div className="flex items-center gap-1">
              <label className="text-[11px] text-slate-500 font-medium">Bölüm</label>
              <select
                value={defaultSection}
                onChange={(e) => setDefaultSection(e.target.value)}
                className="px-2 py-1 text-xs border border-slate-200 rounded-md bg-white"
              >
                {Object.keys(SECTION_COLORS).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-[11px] text-slate-500 font-medium">Sıra</label>
              <input
                type="number"
                min={1}
                max={99}
                value={defaultRow}
                onChange={(e) => setDefaultRow(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-12 px-1.5 py-1 text-xs border border-slate-200 rounded-md"
              />
            </div>
          </ToolGroup>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleDeleteAll}
              disabled={spots.length === 0}
              className="px-2.5 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded-md inline-flex items-center gap-1.5"
            >
              <TrashIcon /> Tümünü sıfırla
            </button>
          </div>
        </div>

        {/* Bölüm renkleri legend */}
        <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Bölümler</span>
          {Object.entries(SECTION_COLORS).map(([sec, color]) => {
            const used = usedSections.includes(sec)
            return (
              <span
                key={sec}
                className={`inline-flex items-center gap-1 text-xs ${used ? 'text-slate-700' : 'text-slate-400'}`}
              >
                <span
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: color, opacity: used ? 1 : 0.3 }}
                />
                {sec}
              </span>
            )
          })}
          <span className="ml-auto text-[11px] text-slate-400">
            <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">Del</kbd> sil
            &nbsp;·&nbsp;
            <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">Esc</kbd> seçimi temizle
            &nbsp;·&nbsp;
            <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">Ctrl+S</kbd> kaydet
          </span>
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="bg-slate-900 relative"
        >
          {frameUrl ? (
            <canvas
              ref={canvasRef}
              className={`w-full h-auto ${drawMode ? 'cursor-crosshair' : 'cursor-pointer'}`}
              style={{ display: 'block' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                if (isDrawing) handleMouseUp()
              }}
              onContextMenu={handleContextMenu}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-40 text-slate-400 gap-3">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
              </svg>
              <p className="text-sm font-medium">Video frame yükleyin</p>
              <p className="text-xs text-slate-500">Yukarıdaki "Yeni kare" düğmesine tıklayın</p>
            </div>
          )}

          {frameUrl && (
            <div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-3 py-1.5 rounded-lg">
              {drawMode
                ? 'Sol tık + sürükle: alan çiz  ·  Sağ tık: sil'
                : 'Sol tık: seç  ·  Sağ tık: sil'}
            </div>
          )}
        </div>
      </div>

      {/* Alt panel: Seçili spot + Bölüm listesi */}
      {spots.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Seçili Spot Detay */}
          {selectedSpot ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 lg:col-span-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Seçili Park Alanı</h3>
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: getSectionColor(selectedSpot.section) }}
                />
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Park No</label>
                  <input
                    type="text"
                    value={selectedSpot.spot_number}
                    onChange={(e) => updateSpotField(selectedSpot.id, 'spot_number', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Bölüm</label>
                    <select
                      value={selectedSpot.section}
                      onChange={(e) => updateSpotField(selectedSpot.id, 'section', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      {Object.keys(SECTION_COLORS).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Sıra</label>
                    <input
                      type="number"
                      min={1}
                      value={selectedSpot.row_number}
                      onChange={(e) =>
                        updateSpotField(selectedSpot.id, 'row_number', Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  Konum: {selectedSpot.x}, {selectedSpot.y} &mdash; Boyut: {selectedSpot.w} × {selectedSpot.h}
                </div>
                <button
                  onClick={deleteSelectedSpot}
                  className="w-full px-2 py-1.5 text-xs text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <TrashIcon /> Bu alanı sil
                  <kbd className="ml-auto px-1 py-0 text-[10px] bg-white border border-red-200 rounded">Del</kbd>
                </button>
              </div>
            </div>
          ) : null}

          {/* Bölüm Listesi */}
          <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${selectedSpot ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Çizilen Park Alanları</h3>
              <span className="text-xs text-slate-400">{spots.length} alan · {Object.keys(sectionGroups).length} grup</span>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-x divide-slate-100">
                {Object.entries(sectionGroups)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([groupKey, groupSpots]) => {
                    const [sec, row] = groupKey.split('-')
                    return (
                      <div key={groupKey} className="min-w-0">
                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 sticky top-0">
                          <div
                            className="w-3 h-3 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: getSectionColor(sec) }}
                          />
                          <span className="text-xs font-semibold text-slate-600">
                            {sec}-{row}
                          </span>
                          <span className="text-xs text-slate-400 ml-auto">{groupSpots.length}</span>
                        </div>
                        {groupSpots.map((spot) => (
                          <button
                            key={spot.id}
                            onClick={() => setSelectedSpotId(spot.id)}
                            className={`w-full text-left px-3 py-1.5 text-sm border-b border-slate-50 hover:bg-slate-50 transition-colors flex items-center justify-between ${
                              spot.id === selectedSpotId ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: getSectionColor(spot.section) }}
                              />
                              <span className="font-medium text-slate-700 text-xs">{spot.spot_number}</span>
                            </div>
                            <span className="text-xs text-slate-400">{spot.w}×{spot.h}</span>
                          </button>
                        ))}
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating action panel — alt sağda */}
      <div className="fixed bottom-6 right-6 z-30 print:hidden">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-2 flex items-center gap-2">
          {saveMsg && (
            <span
              className={`text-xs px-2 py-1 rounded-md ${
                saveMsg.kind === 'ok'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {saveMsg.text}
            </span>
          )}
          {hasUnsavedChanges && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Kaydedilmemiş
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || spots.length === 0}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white rounded-lg font-medium inline-flex items-center gap-2 shadow-sm"
          >
            {saving ? (
              <>
                <SpinnerIcon /> Kaydediliyor…
              </>
            ) : (
              <>
                <SaveIcon /> Kaydet ({spots.length})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Mini bileşenler ────────────────────────────────────────────────────── */

interface StatTileProps {
  label: string
  value: string
  accent: 'indigo' | 'emerald' | 'amber' | 'slate'
  mono?: boolean
}

const statAccent: Record<StatTileProps['accent'], string> = {
  indigo: 'border-l-indigo-500',
  emerald: 'border-l-emerald-500',
  amber: 'border-l-amber-500',
  slate: 'border-l-slate-300',
}

function StatTile({ label, value, accent, mono }: StatTileProps) {
  return (
    <div className={`bg-white border border-slate-200 border-l-4 ${statAccent[accent]} rounded-lg px-3 py-2.5`}>
      <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-base font-semibold text-slate-800 mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

function ToolGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pl-2 pr-3 py-1 border border-slate-100 rounded-lg bg-slate-50/50">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">{label}</span>
      {children}
    </div>
  )
}

function RefreshIcon() {
  return (<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>)
}
function DownloadIcon() {
  return (<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>)
}
function DrawIcon() {
  return (<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>)
}
function CursorIcon() {
  return (<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15 6 9.75v9.75H15.75V13.5L20.25 18l-3.182.91L19.5 21 15 15Z" /></svg>)
}
function TrashIcon() {
  return (<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>)
}
function SaveIcon() {
  return (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>)
}
function SpinnerIcon() {
  return (<svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" /><path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>)
}
