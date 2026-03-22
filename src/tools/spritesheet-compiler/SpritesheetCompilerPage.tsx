import { useState, useRef, useEffect, useCallback } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Download, Trash2, Loader2 } from 'lucide-react'
import { fileToDataURL, loadImage, downloadBlob, canvasToBlob } from '../../lib/utils'
import { HitboxEditorContent } from '../hitbox-editor/HitboxEditorPage'
import JSZip from 'jszip'

type Mode = 'compile' | 'decompile' | 'hitbox'

interface SpriteFrame {
  id: string
  image: HTMLImageElement
  name: string
}

export function SpritesheetCompilerPage() {
  const [mode, setMode] = useState<Mode>('compile')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Spritesheet Compiler</h2>
        <p className="text-sm text-zinc-500 mt-2">Compile sprites into a sheet or decompile a sheet into frames</p>
      </div>

      <div className="flex gap-1 bg-zinc-100 rounded-lg p-1 w-fit">
        {(['compile', 'decompile', 'hitbox'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === m
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {m === 'compile' ? 'Compile' : m === 'decompile' ? 'Decompile' : 'Hitbox'}
          </button>
        ))}
      </div>

      {mode === 'compile' && <CompileView />}
      {mode === 'decompile' && <DecompileView />}
      {mode === 'hitbox' && <HitboxEditorContent />}
    </div>
  )
}

function CompileView() {
  const [frames, setFrames] = useState<SpriteFrame[]>([])
  const [cols, setCols] = useState(4)
  const [padding, setPadding] = useState(0)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFiles = async (files: File[]) => {
    const newFrames: SpriteFrame[] = []
    for (const f of files) {
      const url = await fileToDataURL(f)
      const img = await loadImage(url)
      newFrames.push({ id: crypto.randomUUID(), image: img, name: f.name })
    }
    setFrames((prev) => [...prev, ...newFrames])
  }

  const removeFrame = (id: string) => {
    setFrames((prev) => prev.filter((f) => f.id !== id))
  }

  const reorderFrame = (from: number | null, to: number) => {
    if (from === null || from === to) return
    setFrames((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const drawSheet = useCallback(() => {
    if (!frames.length || !canvasRef.current) return
    const canvas = canvasRef.current
    const maxW = Math.max(...frames.map((f) => f.image.width))
    const maxH = Math.max(...frames.map((f) => f.image.height))
    const effectiveCols = Math.min(cols, frames.length)
    const rows = Math.ceil(frames.length / effectiveCols)

    canvas.width = effectiveCols * (maxW + padding) - padding
    canvas.height = rows * (maxH + padding) - padding
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    frames.forEach((frame, i) => {
      const c = i % effectiveCols
      const r = Math.floor(i / effectiveCols)
      const x = c * (maxW + padding)
      const y = r * (maxH + padding)
      ctx.drawImage(frame.image, x, y)
    })
  }, [frames, cols, padding])

  useEffect(() => { drawSheet() }, [drawSheet])

  const handleDownload = async () => {
    if (!canvasRef.current) return
    const blob = await canvasToBlob(canvasRef.current)
    downloadBlob(blob, 'spritesheet.png')
  }

  return (
    <div className="space-y-4">
      <FileDropzone
        onFiles={handleFiles}
        accept="image/*"
        multiple
        label="Drop sprite frames here"
        description="Select multiple images to compile into a spritesheet"
      />

      {frames.length > 0 && (
        <>
          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-zinc-700">{frames.length} frames loaded</p>
              <button
                onClick={() => setFrames([])}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 size={12} /> Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {frames.map((f, i) => (
                <div
                  key={f.id}
                  draggable
                  onDragStart={(e) => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move' }}
                  onDragOver={(e) => { e.preventDefault(); setDropIdx(i) }}
                  onDragEnd={() => { setDragIdx(null); setDropIdx(null) }}
                  onDrop={(e) => { e.preventDefault(); reorderFrame(dragIdx, i); setDragIdx(null); setDropIdx(null) }}
                  className={`relative group cursor-grab active:cursor-grabbing transition-all ${
                    dragIdx === i ? 'opacity-40 scale-95' : ''
                  } ${dropIdx === i && dragIdx !== null && dragIdx !== i ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                >
                  <img
                    src={f.image.src}
                    alt={f.name}
                    className="w-12 h-12 object-contain bg-zinc-100 rounded border border-zinc-200 pointer-events-none"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] text-center rounded-b leading-tight py-px">{i + 1}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFrame(f.id) }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] hidden group-hover:flex items-center justify-center"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <label className="space-y-1">
              <span className="text-xs font-medium text-zinc-600">Columns</span>
              <input
                type="number"
                min={1}
                max={64}
                value={cols}
                onChange={(e) => setCols(Math.max(1, Number(e.target.value)))}
                className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-zinc-600">Padding (px)</span>
              <input
                type="number"
                min={0}
                max={32}
                value={padding}
                onChange={(e) => setPadding(Math.max(0, Number(e.target.value)))}
                className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </label>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-zinc-500">Preview</p>
              <Button onClick={handleDownload} size="sm">
                <Download size={12} /> Download PNG
              </Button>
            </div>
            <div className="overflow-auto max-h-96 bg-zinc-100 rounded p-2 flex items-center justify-center">
              <canvas ref={canvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

type ExportMode = 'frames' | 'rows' | 'cols'

function DecompileView() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [cols, setCols] = useState(4)
  const [rows, setRows] = useState(4)
  const [mode, setMode] = useState<'grid' | 'size'>('grid')
  const [frameW, setFrameW] = useState(32)
  const [frameH, setFrameH] = useState(32)
  const [exporting, setExporting] = useState(false)
  const [exportMode, setExportMode] = useState<ExportMode>('frames')
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [selectedCols, setSelectedCols] = useState<Set<number>>(new Set())
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFiles = async (files: File[]) => {
    const url = await fileToDataURL(files[0])
    const img = await loadImage(url)
    setImage(img)
    setFrameW(Math.floor(img.width / cols))
    setFrameH(Math.floor(img.height / rows))
    // Select all rows/cols by default
    setSelectedRows(new Set(Array.from({ length: rows }, (_, i) => i)))
    setSelectedCols(new Set(Array.from({ length: cols }, (_, i) => i)))
  }

  const effectiveCols = mode === 'grid' ? cols : Math.floor((image?.width ?? 1) / frameW)
  const effectiveRows = mode === 'grid' ? rows : Math.floor((image?.height ?? 1) / frameH)
  const effectiveFrameW = mode === 'grid' ? Math.floor((image?.width ?? 1) / cols) : frameW
  const effectiveFrameH = mode === 'grid' ? Math.floor((image?.height ?? 1) / rows) : frameH

  // Sync selection sets when grid dimensions change
  useEffect(() => {
    setSelectedRows(new Set(Array.from({ length: effectiveRows }, (_, i) => i)))
    setSelectedCols(new Set(Array.from({ length: effectiveCols }, (_, i) => i)))
  }, [effectiveCols, effectiveRows])

  // Draw preview with selection overlay
  useEffect(() => {
    if (!image || !canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(image, 0, 0)

    // Dim deselected cells
    for (let r = 0; r < effectiveRows; r++) {
      for (let c = 0; c < effectiveCols; c++) {
        if (!selectedRows.has(r) || !selectedCols.has(c)) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
          ctx.fillRect(c * effectiveFrameW, r * effectiveFrameH, effectiveFrameW, effectiveFrameH)
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    for (let c = 1; c < effectiveCols; c++) {
      ctx.beginPath()
      ctx.moveTo(c * effectiveFrameW, 0)
      ctx.lineTo(c * effectiveFrameW, image.height)
      ctx.stroke()
    }
    for (let r = 1; r < effectiveRows; r++) {
      ctx.beginPath()
      ctx.moveTo(0, r * effectiveFrameH)
      ctx.lineTo(image.width, r * effectiveFrameH)
      ctx.stroke()
    }
  }, [image, effectiveCols, effectiveRows, effectiveFrameW, effectiveFrameH, selectedRows, selectedCols])

  const toggleRow = (r: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(r)) next.delete(r)
      else next.add(r)
      return next
    })
  }

  const toggleCol = (c: number) => {
    setSelectedCols((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  const selectAll = () => {
    setSelectedRows(new Set(Array.from({ length: effectiveRows }, (_, i) => i)))
    setSelectedCols(new Set(Array.from({ length: effectiveCols }, (_, i) => i)))
  }

  const deselectAll = () => {
    setSelectedRows(new Set())
    setSelectedCols(new Set())
  }

  const selectedFrameCount = [...selectedRows].length * [...selectedCols].length

  const handleExport = async () => {
    if (!image || selectedFrameCount === 0) return
    setExporting(true)

    const selCols = [...selectedCols].sort((a, b) => a - b)
    const selRows = [...selectedRows].sort((a, b) => a - b)

    if (exportMode === 'frames') {
      // Export individual frames as ZIP
      const zip = new JSZip()
      const temp = document.createElement('canvas')
      temp.width = effectiveFrameW
      temp.height = effectiveFrameH
      const ctx = temp.getContext('2d')!
      let idx = 0
      for (const r of selRows) {
        for (const c of selCols) {
          ctx.clearRect(0, 0, effectiveFrameW, effectiveFrameH)
          ctx.drawImage(image, c * effectiveFrameW, r * effectiveFrameH, effectiveFrameW, effectiveFrameH, 0, 0, effectiveFrameW, effectiveFrameH)
          const data = temp.toDataURL('image/png').split(',')[1]
          zip.file(`frame_${String(idx).padStart(3, '0')}.png`, data, { base64: true })
          idx++
        }
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, 'frames.zip')
    } else if (exportMode === 'rows') {
      // Export each selected row as a spritesheet strip
      if (selRows.length === 1) {
        const rowCanvas = document.createElement('canvas')
        rowCanvas.width = selCols.length * effectiveFrameW
        rowCanvas.height = effectiveFrameH
        const ctx = rowCanvas.getContext('2d')!
        selCols.forEach((c, i) => {
          ctx.drawImage(image, c * effectiveFrameW, selRows[0] * effectiveFrameH, effectiveFrameW, effectiveFrameH, i * effectiveFrameW, 0, effectiveFrameW, effectiveFrameH)
        })
        const blob = await canvasToBlob(rowCanvas)
        downloadBlob(blob, `row_${selRows[0]}.png`)
      } else {
        const zip = new JSZip()
        for (const r of selRows) {
          const rowCanvas = document.createElement('canvas')
          rowCanvas.width = selCols.length * effectiveFrameW
          rowCanvas.height = effectiveFrameH
          const ctx = rowCanvas.getContext('2d')!
          selCols.forEach((c, i) => {
            ctx.drawImage(image, c * effectiveFrameW, r * effectiveFrameH, effectiveFrameW, effectiveFrameH, i * effectiveFrameW, 0, effectiveFrameW, effectiveFrameH)
          })
          const data = rowCanvas.toDataURL('image/png').split(',')[1]
          zip.file(`row_${String(r).padStart(2, '0')}.png`, data, { base64: true })
        }
        const blob = await zip.generateAsync({ type: 'blob' })
        downloadBlob(blob, 'rows.zip')
      }
    } else {
      // Export each selected column as a vertical strip
      if (selCols.length === 1) {
        const colCanvas = document.createElement('canvas')
        colCanvas.width = effectiveFrameW
        colCanvas.height = selRows.length * effectiveFrameH
        const ctx = colCanvas.getContext('2d')!
        selRows.forEach((r, i) => {
          ctx.drawImage(image, selCols[0] * effectiveFrameW, r * effectiveFrameH, effectiveFrameW, effectiveFrameH, 0, i * effectiveFrameH, effectiveFrameW, effectiveFrameH)
        })
        const blob = await canvasToBlob(colCanvas)
        downloadBlob(blob, `col_${selCols[0]}.png`)
      } else {
        const zip = new JSZip()
        for (const c of selCols) {
          const colCanvas = document.createElement('canvas')
          colCanvas.width = effectiveFrameW
          colCanvas.height = selRows.length * effectiveFrameH
          const ctx = colCanvas.getContext('2d')!
          selRows.forEach((r, i) => {
            ctx.drawImage(image, c * effectiveFrameW, r * effectiveFrameH, effectiveFrameW, effectiveFrameH, 0, i * effectiveFrameH, effectiveFrameW, effectiveFrameH)
          })
          const data = colCanvas.toDataURL('image/png').split(',')[1]
          zip.file(`col_${String(c).padStart(2, '0')}.png`, data, { base64: true })
        }
        const blob = await zip.generateAsync({ type: 'blob' })
        downloadBlob(blob, 'columns.zip')
      }
    }

    setExporting(false)
  }

  return (
    <div className="space-y-4">
      <FileDropzone
        onFiles={handleFiles}
        accept="image/*"
        label="Drop a spritesheet to split into frames"
      />

      {image && (
        <>
          <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
            <div className="flex gap-4 items-center">
              <label className="text-xs font-medium text-zinc-600 flex items-center gap-2">
                <input type="radio" checked={mode === 'grid'} onChange={() => setMode('grid')} className="accent-blue-600" />
                By Grid (Rows/Cols)
              </label>
              <label className="text-xs font-medium text-zinc-600 flex items-center gap-2">
                <input type="radio" checked={mode === 'size'} onChange={() => setMode('size')} className="accent-blue-600" />
                By Frame Size
              </label>
            </div>

            {mode === 'grid' ? (
              <div className="flex gap-4">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-600">Columns</span>
                  <input type="number" min={1} max={64} value={cols}
                    onChange={(e) => setCols(Math.max(1, Number(e.target.value)))}
                    className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-600">Rows</span>
                  <input type="number" min={1} max={64} value={rows}
                    onChange={(e) => setRows(Math.max(1, Number(e.target.value)))}
                    className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
                </label>
              </div>
            ) : (
              <div className="flex gap-4">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-600">Frame Width</span>
                  <input type="number" min={1} value={frameW}
                    onChange={(e) => setFrameW(Math.max(1, Number(e.target.value)))}
                    className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-600">Frame Height</span>
                  <input type="number" min={1} value={frameH}
                    onChange={(e) => setFrameH(Math.max(1, Number(e.target.value)))}
                    className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
                </label>
              </div>
            )}

            <p className="text-xs text-zinc-500">
              {effectiveCols * effectiveRows} total frames ({effectiveFrameW}×{effectiveFrameH} each)
              {selectedFrameCount < effectiveCols * effectiveRows && (
                <span className="text-blue-600 font-medium"> — {selectedFrameCount} selected</span>
              )}
            </p>
          </div>

          {/* Row / Column Selection */}
          <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Selection</p>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-[11px] text-blue-600 hover:text-blue-700 font-medium">Select All</button>
                <button onClick={deselectAll} className="text-[11px] text-zinc-500 hover:text-zinc-700">Deselect All</button>
              </div>
            </div>

            {/* Row toggles */}
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-zinc-500">Rows</p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: effectiveRows }, (_, r) => (
                  <button
                    key={`row-${r}`}
                    onClick={() => toggleRow(r)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      selectedRows.has(r)
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-zinc-50 text-zinc-400 border border-zinc-200'
                    }`}
                  >
                    R{r + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Column toggles */}
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-zinc-500">Columns</p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: effectiveCols }, (_, c) => (
                  <button
                    key={`col-${c}`}
                    onClick={() => toggleCol(c)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      selectedCols.has(c)
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-zinc-50 text-zinc-400 border border-zinc-200'
                    }`}
                  >
                    C{c + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-zinc-500">Preview</p>
              <div className="flex items-center gap-2">
                {/* Export mode toggle */}
                <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
                  {(['frames', 'rows', 'cols'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setExportMode(m)}
                      className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        exportMode === m ? 'bg-blue-600 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'
                      }`}
                    >
                      {m === 'frames' ? 'Frames' : m === 'rows' ? 'Rows' : 'Columns'}
                    </button>
                  ))}
                </div>
                <Button onClick={handleExport} disabled={exporting || selectedFrameCount === 0} size="sm">
                  {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  {exportMode === 'frames' ? 'Export Frames' : exportMode === 'rows' ? 'Export Rows' : 'Export Columns'}
                </Button>
              </div>
            </div>
            <div className="overflow-auto max-h-96 bg-zinc-100 rounded p-2">
              <canvas ref={canvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">
              {exportMode === 'frames'
                ? `Will export ${selectedFrameCount} individual frame PNGs as ZIP`
                : exportMode === 'rows'
                ? `Will export ${[...selectedRows].length} row strip${[...selectedRows].length !== 1 ? 's' : ''} (${[...selectedCols].length} cols each)`
                : `Will export ${[...selectedCols].length} column strip${[...selectedCols].length !== 1 ? 's' : ''} (${[...selectedRows].length} rows each)`
              }
            </p>
          </div>
        </>
      )}
    </div>
  )
}
