import { useState, useRef, useEffect, useCallback } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Download, Loader2 } from 'lucide-react'
import { fileToDataURL, loadImage, downloadBlob } from '../../lib/utils'
import JSZip from 'jszip'

export function SpritesheetCutterPage() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [cols, setCols] = useState(4)
  const [rows, setRows] = useState(4)
  const [mode, setMode] = useState<'grid' | 'size'>('grid')
  const [frameW, setFrameW] = useState(32)
  const [frameH, setFrameH] = useState(32)
  const [exporting, setExporting] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFiles = async (files: File[]) => {
    const url = await fileToDataURL(files[0])
    const img = await loadImage(url)
    setImage(img)
    setFrameW(Math.floor(img.width / cols))
    setFrameH(Math.floor(img.height / rows))
  }

  const effectiveCols = mode === 'grid' ? cols : Math.floor((image?.width ?? 1) / frameW)
  const effectiveRows = mode === 'grid' ? rows : Math.floor((image?.height ?? 1) / frameH)
  const effectiveFrameW = mode === 'grid' ? Math.floor((image?.width ?? 1) / cols) : frameW
  const effectiveFrameH = mode === 'grid' ? Math.floor((image?.height ?? 1) / rows) : frameH

  const drawPreview = useCallback(() => {
    if (!image || !canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(image, 0, 0)

    ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])

    for (let c = 1; c < effectiveCols; c++) {
      const x = c * effectiveFrameW
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, image.height)
      ctx.stroke()
    }
    for (let r = 1; r < effectiveRows; r++) {
      const y = r * effectiveFrameH
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(image.width, y)
      ctx.stroke()
    }
  }, [image, effectiveCols, effectiveRows, effectiveFrameW, effectiveFrameH])

  useEffect(() => { drawPreview() }, [drawPreview])

  const handleExport = async () => {
    if (!image) return
    setExporting(true)
    const zip = new JSZip()
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = effectiveFrameW
    tempCanvas.height = effectiveFrameH
    const ctx = tempCanvas.getContext('2d')!

    let idx = 0
    for (let r = 0; r < effectiveRows; r++) {
      for (let c = 0; c < effectiveCols; c++) {
        ctx.clearRect(0, 0, effectiveFrameW, effectiveFrameH)
        ctx.drawImage(
          image,
          c * effectiveFrameW, r * effectiveFrameH,
          effectiveFrameW, effectiveFrameH,
          0, 0,
          effectiveFrameW, effectiveFrameH
        )
        const dataUrl = tempCanvas.toDataURL('image/png')
        const base64 = dataUrl.split(',')[1]
        zip.file(`frame_${String(idx).padStart(3, '0')}.png`, base64, { base64: true })
        idx++
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, 'sprites.zip')
    setExporting(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Spritesheet Cutter</h2>
        <p className="text-sm text-zinc-500 mt-2">Cut a spritesheet into individual frames</p>
      </div>

      <FileDropzone
        onFiles={handleFiles}
        accept="image/*"
        label="Drop your spritesheet here"
      />

      {image && (
        <div className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
            <div className="flex gap-4 items-center">
              <label className="text-xs font-medium text-zinc-600 flex items-center gap-2">
                <input
                  type="radio"
                  checked={mode === 'grid'}
                  onChange={() => setMode('grid')}
                  className="accent-blue-600"
                />
                By Grid (Rows/Cols)
              </label>
              <label className="text-xs font-medium text-zinc-600 flex items-center gap-2">
                <input
                  type="radio"
                  checked={mode === 'size'}
                  onChange={() => setMode('size')}
                  className="accent-blue-600"
                />
                By Frame Size
              </label>
            </div>

            {mode === 'grid' ? (
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
                  <span className="text-xs font-medium text-zinc-600">Rows</span>
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={rows}
                    onChange={(e) => setRows(Math.max(1, Number(e.target.value)))}
                    className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                  />
                </label>
              </div>
            ) : (
              <div className="flex gap-4">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-600">Frame Width</span>
                  <input
                    type="number"
                    min={1}
                    value={frameW}
                    onChange={(e) => setFrameW(Math.max(1, Number(e.target.value)))}
                    className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-600">Frame Height</span>
                  <input
                    type="number"
                    min={1}
                    value={frameH}
                    onChange={(e) => setFrameH(Math.max(1, Number(e.target.value)))}
                    className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                  />
                </label>
              </div>
            )}

            <p className="text-xs text-zinc-500">
              {effectiveCols * effectiveRows} frames ({effectiveFrameW}x{effectiveFrameH} each)
            </p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-zinc-500">Preview</p>
              <Button onClick={handleExport} disabled={exporting} size="sm">
                {exporting ? (
                  <><Loader2 size={12} className="animate-spin" /> Exporting...</>
                ) : (
                  <><Download size={12} /> Export as ZIP</>
                )}
              </Button>
            </div>
            <div className="overflow-auto max-h-96 bg-zinc-100 rounded p-2">
              <canvas ref={canvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
