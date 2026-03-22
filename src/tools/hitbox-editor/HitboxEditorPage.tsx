import { useState, useRef, useEffect, useCallback } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Download, Trash2, SkipBack, SkipForward, Copy, Square, Circle } from 'lucide-react'
import { fileToDataURL, loadImage, downloadBlob } from '../../lib/utils'
import { PreviewCanvas } from '../../components/ui/PreviewCanvas'

type ShapeType = 'rect' | 'circle'
type ShapeLabel = 'body' | 'hurt' | 'hit' | 'trigger' | 'custom'

interface RectShape {
  type: 'rect'
  label: ShapeLabel
  x: number
  y: number
  w: number
  h: number
}

interface CircleShape {
  type: 'circle'
  label: ShapeLabel
  cx: number
  cy: number
  r: number
}

type Shape = RectShape | CircleShape

interface FrameData {
  shapes: Shape[]
}

const LABEL_COLORS: Record<ShapeLabel, string> = {
  body: 'rgba(59, 130, 246, 0.4)',
  hurt: 'rgba(239, 68, 68, 0.4)',
  hit: 'rgba(34, 197, 94, 0.4)',
  trigger: 'rgba(168, 85, 247, 0.4)',
  custom: 'rgba(245, 158, 11, 0.4)',
}

const LABEL_BORDERS: Record<ShapeLabel, string> = {
  body: '#3b82f6',
  hurt: '#ef4444',
  hit: '#22c55e',
  trigger: '#a855f7',
  custom: '#f59e0b',
}

export function HitboxEditorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Hitbox Editor</h2>
        <p className="text-sm text-zinc-500 mt-2">Draw collision shapes on spritesheet frames and export as JSON</p>
      </div>
      <HitboxEditorContent />
    </div>
  )
}

export function HitboxEditorContent() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [cols, setCols] = useState(4)
  const [rows, setRows] = useState(1)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [frames, setFrames] = useState<FrameData[]>([])
  const [drawMode, setDrawMode] = useState<ShapeType>('rect')
  const [activeLabel, setActiveLabel] = useState<ShapeLabel>('body')
  const [selectedShape, setSelectedShape] = useState<number | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const totalFrames = cols * rows
  const frameW = image ? Math.floor(image.width / cols) : 0
  const frameH = image ? Math.floor(image.height / rows) : 0

  // Dynamic scale: fit canvas within ~500px max width/height
  const maxCanvasDim = 500
  const scale = frameW > 0 && frameH > 0
    ? Math.max(1, Math.min(Math.floor(maxCanvasDim / frameW), Math.floor(maxCanvasDim / frameH), 6))
    : 3

  const handleFiles = async (files: File[]) => {
    const url = await fileToDataURL(files[0])
    const img = await loadImage(url)
    setImage(img)
    setCurrentFrame(0)
    setSelectedShape(null)
    const total = cols * rows
    setFrames(Array.from({ length: total }, () => ({ shapes: [] })))
  }

  // Re-init frames when grid changes
  useEffect(() => {
    if (!image) return
    setFrames((prev) => {
      const arr = Array.from({ length: totalFrames }, (_, i) => prev[i] || { shapes: [] })
      return arr
    })
  }, [totalFrames, image])

  const currentShapes = frames[currentFrame]?.shapes || []

  const drawCanvas = useCallback(() => {
    if (!image || !canvasRef.current) return
    const canvas = canvasRef.current
    const dw = frameW * scale
    const dh = frameH * scale
    canvas.width = dw
    canvas.height = dh
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    // Draw sprite frame
    const col = currentFrame % cols
    const row = Math.floor(currentFrame / cols)
    ctx.drawImage(image, col * frameW, row * frameH, frameW, frameH, 0, 0, dw, dh)

    // Draw shapes
    for (let i = 0; i < currentShapes.length; i++) {
      const shape = currentShapes[i]
      const isSelected = i === selectedShape
      ctx.fillStyle = LABEL_COLORS[shape.label]
      ctx.strokeStyle = LABEL_BORDERS[shape.label]
      ctx.lineWidth = isSelected ? 3 : 2
      if (isSelected) ctx.setLineDash([4, 4])
      else ctx.setLineDash([])

      if (shape.type === 'rect') {
        ctx.fillRect(shape.x * scale, shape.y * scale, shape.w * scale, shape.h * scale)
        ctx.strokeRect(shape.x * scale, shape.y * scale, shape.w * scale, shape.h * scale)
      } else {
        ctx.beginPath()
        ctx.arc(shape.cx * scale, shape.cy * scale, shape.r * scale, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      ctx.setLineDash([])

      // Label text
      const lx = shape.type === 'rect' ? shape.x * scale + 2 : (shape.cx - shape.r) * scale + 2
      const ly = shape.type === 'rect' ? shape.y * scale + 10 : (shape.cy - shape.r) * scale + 10
      ctx.font = '10px monospace'
      ctx.fillStyle = LABEL_BORDERS[shape.label]
      ctx.fillText(shape.label, lx, ly)
    }
  }, [image, currentFrame, cols, frameW, frameH, currentShapes, selectedShape])

  useEffect(() => { drawCanvas() }, [drawCanvas])

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: Math.round((e.clientX - rect.left) / scale),
      y: Math.round((e.clientY - rect.top) / scale),
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e)
    setDrawing(true)
    setDrawStart(pos)
    setSelectedShape(null)
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !drawStart) return
    const pos = getCanvasPos(e)
    setDrawing(false)

    let newShape: Shape
    if (drawMode === 'rect') {
      const x = Math.min(drawStart.x, pos.x)
      const y = Math.min(drawStart.y, pos.y)
      const w = Math.abs(pos.x - drawStart.x)
      const h = Math.abs(pos.y - drawStart.y)
      if (w < 2 || h < 2) return
      newShape = { type: 'rect', label: activeLabel, x, y, w, h }
    } else {
      const cx = drawStart.x
      const cy = drawStart.y
      const dx = pos.x - cx
      const dy = pos.y - cy
      const r = Math.round(Math.sqrt(dx * dx + dy * dy))
      if (r < 2) return
      newShape = { type: 'circle', label: activeLabel, cx, cy, r }
    }

    const next = [...frames]
    next[currentFrame] = { shapes: [...currentShapes, newShape] }
    setFrames(next)
    setDrawStart(null)
  }

  const deleteShape = (idx: number) => {
    const next = [...frames]
    next[currentFrame] = { shapes: currentShapes.filter((_, i) => i !== idx) }
    setFrames(next)
    if (selectedShape === idx) setSelectedShape(null)
  }

  const copyToAllFrames = () => {
    const src = currentShapes
    const next = frames.map(() => ({ shapes: [...src.map((s) => ({ ...s }))] }))
    setFrames(next)
  }

  const handleExport = () => {
    const data = {
      frameWidth: frameW,
      frameHeight: frameH,
      cols,
      rows,
      frames: frames.map((f) => ({ shapes: f.shapes })),
    }
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'hitboxes.json')
  }

  const handleImport = async (files: File[]) => {
    const text = await files[0].text()
    try {
      const data = JSON.parse(text)
      if (data.frames) {
        setFrames(data.frames)
        if (data.cols) setCols(data.cols)
        if (data.rows) setRows(data.rows)
      }
    } catch { /* ignore invalid json */ }
  }

  return (
    <div className="space-y-6">
      <FileDropzone onFiles={handleFiles} accept="image/*" label="Drop a spritesheet to add hitboxes" />

      {image && (
        <div className="grid grid-cols-[1fr_280px] gap-6">
          <div className="space-y-4">
            <PreviewCanvas
              label={`Frame ${currentFrame + 1}/${totalFrames} | ${currentShapes.length} shapes`}
              maxHeight={400}
              minHeight={100}
              draggable={false}
              actions={
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentFrame(Math.max(0, currentFrame - 1))}
                    className="text-zinc-400 hover:text-zinc-600 p-1"><SkipBack size={14} /></button>
                  <button onClick={() => setCurrentFrame(Math.min(totalFrames - 1, currentFrame + 1))}
                    className="text-zinc-400 hover:text-zinc-600 p-1"><SkipForward size={14} /></button>
                </div>
              }
            >
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                className="cursor-crosshair"
                style={{ imageRendering: 'pixelated', maxWidth: '100%' }}
              />
            </PreviewCanvas>

            {/* Frame strip */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide mb-2">Frames</p>
              <div className="flex gap-1 overflow-x-auto pb-2">
                {Array.from({ length: totalFrames }, (_, i) => {
                  const hasShapes = frames[i]?.shapes.length > 0
                  return (
                    <button
                      key={i}
                      onClick={() => { setCurrentFrame(i); setSelectedShape(null) }}
                      className={`shrink-0 w-10 h-10 rounded border-2 text-xs font-medium ${i === currentFrame ? 'border-blue-500 bg-blue-50' : 'border-zinc-200'} ${hasShapes ? 'text-green-600' : 'text-zinc-400'}`}
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Grid</p>
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-600">Columns</span>
                <input type="number" min={1} max={64} value={cols}
                  onChange={(e) => setCols(Math.max(1, +e.target.value))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-600">Rows</span>
                <input type="number" min={1} max={64} value={rows}
                  onChange={(e) => setRows(Math.max(1, +e.target.value))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
              </label>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Draw Tool</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDrawMode('rect')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${drawMode === 'rect' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-zinc-200 text-zinc-500'}`}
                >
                  <Square size={12} /> Rect
                </button>
                <button
                  onClick={() => setDrawMode('circle')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${drawMode === 'circle' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-zinc-200 text-zinc-500'}`}
                >
                  <Circle size={12} /> Circle
                </button>
              </div>
              <Select
                label="Label"
                options={[
                  { value: 'body', label: 'Body (blue)' },
                  { value: 'hurt', label: 'Hurt (red)' },
                  { value: 'hit', label: 'Hit (green)' },
                  { value: 'trigger', label: 'Trigger (purple)' },
                  { value: 'custom', label: 'Custom (orange)' },
                ]}
                value={activeLabel}
                onChange={(e) => setActiveLabel(e.target.value as ShapeLabel)}
              />
            </div>

            {/* Shape list */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-2">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Shapes</p>
              {currentShapes.length === 0 && (
                <p className="text-xs text-zinc-400">Draw on the canvas to add shapes</p>
              )}
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {currentShapes.map((shape, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedShape(i)}
                    className={`flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer ${selectedShape === i ? 'bg-zinc-100' : 'hover:bg-zinc-50'}`}
                  >
                    <span>
                      <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: LABEL_BORDERS[shape.label] }} />
                      {shape.label} ({shape.type})
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); deleteShape(i) }}
                      className="text-zinc-400 hover:text-red-500"><Trash2 size={10} /></button>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={copyToAllFrames} variant="secondary" size="sm" className="w-full">
              <Copy size={12} /> Copy Shapes to All Frames
            </Button>

            <Button onClick={handleExport} className="w-full">
              <Download size={16} /> Export JSON
            </Button>

            <div className="border-t border-zinc-200 pt-3">
              <p className="text-xs text-zinc-500 mb-2">Import existing hitbox data:</p>
              <FileDropzone onFiles={handleImport} accept=".json" label="Drop hitbox JSON" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
