import { useState, useRef, useEffect, useCallback } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Slider } from '../../components/ui/Slider'
import { Download, Play, Pause, Loader2, ArrowRightLeft, GripVertical, Trash2 } from 'lucide-react'
import { fileToDataURL, loadImage, downloadBlob } from '../../lib/utils'
import { encodeGif } from '../../lib/gif-encoder'
import { decodeGifFrames, type GifFrame } from '../../lib/gif-decoder'
import { PreviewCanvas } from '../../components/ui/PreviewCanvas'
import { cn } from '../../lib/utils'
import { canvasToBlob } from '../../lib/utils'

type PageMode = 'sprite-to-gif' | 'gif-to-sprite'
type SeparateMode = 'none' | 'rows' | 'cols'

interface GeneratedGif {
  label: string
  blob: Blob
  url: string
}

export function SpriteToGifPage() {
  const [mode, setMode] = useState<PageMode>('sprite-to-gif')
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [cols, setCols] = useState(4)
  const [rows, setRows] = useState(1)
  const [fps, setFps] = useState(12)
  const [scale, setScale] = useState(1)
  const [playing, setPlaying] = useState(true)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [separateMode, setSeparateMode] = useState<SeparateMode>('none')
  const [gifBlob, setGifBlob] = useState<Blob | null>(null)
  const [gifUrl, setGifUrl] = useState<string | null>(null)
  const [separateGifs, setSeparateGifs] = useState<GeneratedGif[]>([])
  // GIF-to-Sprite state
  const [gifFrames, setGifFrames] = useState<GifFrame[]>([])
  const [frameOrder, setFrameOrder] = useState<number[]>([]) // indices into gifFrames
  const [gifWidth, setGifWidth] = useState(0)
  const [gifHeight, setGifHeight] = useState(0)
  const [sheetCols, setSheetCols] = useState(8)
  const [sheetUrl, setSheetUrl] = useState<string | null>(null)
  const [sheetBlob, setSheetBlob] = useState<Blob | null>(null)
  const [frameThumbs, setFrameThumbs] = useState<string[]>([]) // data URLs per frame
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const lastTimeRef = useRef(0)

  const handleFiles = async (files: File[]) => {
    const url = await fileToDataURL(files[0])
    const img = await loadImage(url)
    setImage(img)
    setGifBlob(null)
    setGifUrl(null)
    setSeparateGifs((prev) => { prev.forEach((g) => URL.revokeObjectURL(g.url)); return [] })
    setCurrentFrame(0)
  }

  const frameW = image ? Math.floor(image.width / cols) : 0
  const frameH = image ? Math.floor(image.height / rows) : 0
  const totalFrames = cols * rows

  // Animate preview
  const animate = useCallback((time: number) => {
    if (!image || !canvasRef.current || !playing) {
      animRef.current = requestAnimationFrame(animate)
      return
    }

    const interval = 1000 / fps
    if (time - lastTimeRef.current >= interval) {
      lastTimeRef.current = time
      const frame = currentFrame % totalFrames
      const col = frame % cols
      const row = Math.floor(frame / cols)

      const canvas = canvasRef.current
      const displayW = frameW * scale
      const displayH = frameH * scale
      canvas.width = displayW
      canvas.height = displayH
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, displayW, displayH)
      ctx.drawImage(image, col * frameW, row * frameH, frameW, frameH, 0, 0, displayW, displayH)
      setCurrentFrame((prev) => (prev + 1) % totalFrames)
    }
    animRef.current = requestAnimationFrame(animate)
  }, [image, playing, fps, currentFrame, totalFrames, cols, frameW, frameH, scale])

  useEffect(() => {
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [animate])

  // Draw static frame when paused
  useEffect(() => {
    if (!image || !canvasRef.current || playing) return
    const frame = currentFrame % totalFrames
    const col = frame % cols
    const row = Math.floor(frame / cols)
    const canvas = canvasRef.current
    const displayW = frameW * scale
    const displayH = frameH * scale
    canvas.width = displayW
    canvas.height = displayH
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(image, col * frameW, row * frameH, frameW, frameH, 0, 0, displayW, displayH)
  }, [image, currentFrame, playing, cols, totalFrames, frameW, frameH, scale])

  const handleGenerateGif = async () => {
    if (!image) return
    setGenerating(true)

    const w = frameW * scale
    const h = frameH * scale
    const delay = Math.round(100 / fps)
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = w
    tempCanvas.height = h
    const ctx = tempCanvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    // Clean up previous separate GIFs
    separateGifs.forEach((g) => URL.revokeObjectURL(g.url))
    setSeparateGifs([])

    if (separateMode === 'rows') {
      // Generate one GIF per row
      const gifs: GeneratedGif[] = []
      for (let r = 0; r < rows; r++) {
        const frames: ImageData[] = []
        for (let c = 0; c < cols; c++) {
          ctx.clearRect(0, 0, w, h)
          ctx.drawImage(image, c * frameW, r * frameH, frameW, frameH, 0, 0, w, h)
          frames.push(ctx.getImageData(0, 0, w, h))
        }
        const gifData = encodeGif(w, h, frames, delay)
        const blob = new Blob([gifData.buffer as ArrayBuffer], { type: 'image/gif' })
        gifs.push({ label: `Row ${r + 1}`, blob, url: URL.createObjectURL(blob) })
      }
      setSeparateGifs(gifs)
      if (gifUrl) URL.revokeObjectURL(gifUrl)
      setGifBlob(null)
      setGifUrl(null)
    } else if (separateMode === 'cols') {
      // Generate one GIF per column
      const gifs: GeneratedGif[] = []
      for (let c = 0; c < cols; c++) {
        const frames: ImageData[] = []
        for (let r = 0; r < rows; r++) {
          ctx.clearRect(0, 0, w, h)
          ctx.drawImage(image, c * frameW, r * frameH, frameW, frameH, 0, 0, w, h)
          frames.push(ctx.getImageData(0, 0, w, h))
        }
        const gifData = encodeGif(w, h, frames, delay)
        const blob = new Blob([gifData.buffer as ArrayBuffer], { type: 'image/gif' })
        gifs.push({ label: `Col ${c + 1}`, blob, url: URL.createObjectURL(blob) })
      }
      setSeparateGifs(gifs)
      if (gifUrl) URL.revokeObjectURL(gifUrl)
      setGifBlob(null)
      setGifUrl(null)
    } else {
      // All frames as single GIF
      const frames: ImageData[] = []
      for (let i = 0; i < totalFrames; i++) {
        const col = i % cols
        const row = Math.floor(i / cols)
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(image, col * frameW, row * frameH, frameW, frameH, 0, 0, w, h)
        frames.push(ctx.getImageData(0, 0, w, h))
      }
      const gifData = encodeGif(w, h, frames, delay)
      const blob = new Blob([gifData.buffer as ArrayBuffer], { type: 'image/gif' })
      if (gifUrl) URL.revokeObjectURL(gifUrl)
      setGifBlob(blob)
      setGifUrl(URL.createObjectURL(blob))
    }

    setGenerating(false)
  }

  const handleDownload = () => {
    if (!gifBlob) return
    downloadBlob(gifBlob, 'sprite_animation.gif')
  }

  const handleDownloadSeparate = (gif: GeneratedGif) => {
    downloadBlob(gif.blob, `animation_${gif.label.toLowerCase().replace(' ', '_')}.gif`)
  }

  const handleDownloadAllSeparate = async () => {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    for (const gif of separateGifs) {
      const buf = await gif.blob.arrayBuffer()
      zip.file(`${gif.label.toLowerCase().replace(' ', '_')}.gif`, buf)
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, 'animations.zip')
  }

  // --- GIF-to-Sprite handlers ---
  const handleGifFile = async (files: File[]) => {
    const file = files[0]
    const arrayBuf = await file.arrayBuffer()
    const data = new Uint8Array(arrayBuf)
    const { frames, width, height } = decodeGifFrames(data)
    if (frames.length === 0) return
    setGifFrames(frames)
    setGifWidth(width)
    setGifHeight(height)
    setSheetUrl(null)
    setSheetBlob(null)
    setFrameOrder(frames.map((_, i) => i))
    // Generate thumbnails for each frame
    const thumbs: string[] = []
    const tc = document.createElement('canvas')
    tc.width = width
    tc.height = height
    const tctx = tc.getContext('2d')!
    for (const frame of frames) {
      tctx.putImageData(frame.imageData, 0, 0)
      thumbs.push(tc.toDataURL())
    }
    setFrameThumbs(thumbs)
    const autoCols = Math.min(frames.length, Math.ceil(Math.sqrt(frames.length)))
    setSheetCols(autoCols)
  }

  const handleGenerateSheet = async () => {
    if (frameOrder.length === 0) return
    setGenerating(true)
    const c = Math.min(sheetCols, frameOrder.length)
    const r = Math.ceil(frameOrder.length / c)
    const canvas = document.createElement('canvas')
    canvas.width = gifWidth * c
    canvas.height = gifHeight * r
    const ctx = canvas.getContext('2d')!
    for (let i = 0; i < frameOrder.length; i++) {
      const col = i % c
      const row = Math.floor(i / c)
      ctx.putImageData(gifFrames[frameOrder[i]].imageData, col * gifWidth, row * gifHeight)
    }
    const blob = await canvasToBlob(canvas)
    if (sheetUrl) URL.revokeObjectURL(sheetUrl)
    setSheetBlob(blob)
    setSheetUrl(URL.createObjectURL(blob))
    setGenerating(false)
  }

  const handleDownloadSheet = () => {
    if (!sheetBlob) return
    downloadBlob(sheetBlob, `spritesheet_${sheetCols}x${Math.ceil(frameOrder.length / sheetCols)}.png`)
  }

  const handleFrameDragStart = (idx: number) => setDragIdx(idx)
  const handleFrameDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOverIdx(idx)
  }
  const handleFrameDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return }
    const newOrder = [...frameOrder]
    const [moved] = newOrder.splice(dragIdx, 1)
    newOrder.splice(idx, 0, moved)
    setFrameOrder(newOrder)
    setDragIdx(null)
    setDragOverIdx(null)
  }
  const handleRemoveFrame = (idx: number) => {
    setFrameOrder(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">
          {mode === 'sprite-to-gif' ? 'Spritesheet to GIF' : 'GIF to Spritesheet'}
        </h2>
        <p className="text-sm text-zinc-500 mt-2">
          {mode === 'sprite-to-gif'
            ? 'Convert a spritesheet into an animated GIF'
            : 'Extract frames from a GIF and compose a spritesheet'}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-zinc-200 overflow-hidden w-fit">
        <button
          onClick={() => setMode('sprite-to-gif')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2',
            mode === 'sprite-to-gif' ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'
          )}
        >
          Sprite → GIF
        </button>
        <button
          onClick={() => setMode('gif-to-sprite')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2',
            mode === 'gif-to-sprite' ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'
          )}
        >
          GIF → Sprite
        </button>
      </div>

      {/* GIF-to-Sprite mode */}
      {mode === 'gif-to-sprite' && (
        <>
          <FileDropzone onFiles={handleGifFile} accept="image/gif" label="Drop a GIF file here" />

          {frameOrder.length > 0 && (
            <div className="space-y-4">
              {/* Frame grid — draggable to reorder */}
              <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">
                    Frames ({frameOrder.length})
                  </p>
                  <p className="text-[10px] text-zinc-400">Drag to reorder · Click × to remove</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {frameOrder.map((frameIdx, i) => (
                    <div
                      key={`${frameIdx}-${i}`}
                      draggable
                      onDragStart={() => handleFrameDragStart(i)}
                      onDragOver={(e) => handleFrameDragOver(e, i)}
                      onDrop={() => handleFrameDrop(i)}
                      onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                      className={cn(
                        'relative group border rounded-lg overflow-hidden cursor-grab active:cursor-grabbing transition-all',
                        dragOverIdx === i ? 'border-blue-400 ring-2 ring-blue-200' : 'border-zinc-200 hover:border-zinc-300',
                        dragIdx === i ? 'opacity-40' : ''
                      )}
                    >
                      <div className="bg-zinc-100 p-1" style={{
                        backgroundImage: 'repeating-conic-gradient(#e4e4e7 0% 25%, #f4f4f5 0% 50%)',
                        backgroundSize: '8px 8px',
                      }}>
                        <img
                          src={frameThumbs[frameIdx]}
                          alt={`Frame ${i + 1}`}
                          className="block"
                          style={{ width: Math.min(80, gifWidth), height: Math.min(80, gifHeight), imageRendering: 'pixelated', objectFit: 'contain' }}
                        />
                      </div>
                      <div className="absolute top-0 left-0 bg-black/50 text-white text-[9px] px-1 rounded-br">
                        {i + 1}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveFrame(i) }}
                        className="absolute top-0 right-0 bg-black/50 text-white p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={10} />
                      </button>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-zinc-400 opacity-0 group-hover:opacity-60 transition-opacity">
                        <GripVertical size={10} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Controls & output */}
              <div className="grid grid-cols-[1fr_260px] gap-6">
                <div className="space-y-4">
                  {sheetUrl && (
                    <PreviewCanvas
                      label={`Spritesheet (${Math.min(sheetCols, frameOrder.length)}×${Math.ceil(frameOrder.length / sheetCols)})`}
                      maxHeight={400}
                      minHeight={100}
                      actions={
                        <Button onClick={handleDownloadSheet} size="sm">
                          <Download size={12} /> Download PNG
                        </Button>
                      }
                    >
                      <img src={sheetUrl} alt="Generated spritesheet" style={{ imageRendering: 'pixelated' }} className="max-w-full" />
                    </PreviewCanvas>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
                    <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Spritesheet Layout</p>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-zinc-600">Columns</span>
                      <input type="number" min={1} max={frameOrder.length} value={sheetCols}
                        onChange={(e) => setSheetCols(Math.max(1, Math.min(frameOrder.length, +e.target.value)))}
                        className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
                    </label>
                    <p className="text-xs text-zinc-500">
                      {frameOrder.length} frames · {gifWidth}×{gifHeight}px each
                      <br />
                      Sheet: {gifWidth * Math.min(sheetCols, frameOrder.length)}×{gifHeight * Math.ceil(frameOrder.length / sheetCols)}px
                    </p>
                  </div>

                  <Button onClick={handleGenerateSheet} disabled={generating || frameOrder.length === 0} className="w-full">
                    {generating ? (
                      <><Loader2 size={16} className="animate-spin" /> Generating...</>
                    ) : (
                      <><ArrowRightLeft size={16} /> Generate Spritesheet</>
                    )}
                  </Button>

                  {frameOrder.length < gifFrames.length && (
                    <button
                      onClick={() => setFrameOrder(gifFrames.map((_, i) => i))}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium w-full text-center"
                    >
                      Reset all frames ({gifFrames.length})
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Sprite-to-GIF mode */}
      {mode === 'sprite-to-gif' && (
        <>
      <FileDropzone onFiles={handleFiles} accept="image/*" label="Drop your spritesheet here" />

      {image && (
        <div className="grid grid-cols-[1fr_260px] gap-6">
          <div className="space-y-4">
            <PreviewCanvas
              label={`Preview (frame ${(currentFrame % totalFrames) + 1}/${totalFrames})`}
              maxHeight={280}
              minHeight={100}
              actions={
                <button onClick={() => setPlaying(!playing)} className="text-zinc-400 hover:text-zinc-600">
                  {playing ? <Pause size={16} /> : <Play size={16} />}
                </button>
              }
            >
              <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />
            </PreviewCanvas>

            {gifUrl && (
              <PreviewCanvas
                label="Generated GIF"
                maxHeight={280}
                minHeight={100}
                actions={
                  <Button onClick={handleDownload} size="sm">
                    <Download size={12} /> Download GIF
                  </Button>
                }
              >
                <img src={gifUrl} alt="Generated GIF" style={{ imageRendering: 'pixelated' }} />
              </PreviewCanvas>
            )}

            {separateGifs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-700">Generated {separateGifs.length} animations</p>
                  <Button onClick={handleDownloadAllSeparate} size="sm" variant="secondary">
                    <Download size={12} /> Download All (ZIP)
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {separateGifs.map((gif, i) => (
                    <div key={i} className="bg-white border border-zinc-200 rounded-lg p-2 space-y-2">
                      <div className="bg-zinc-100 rounded flex items-center justify-center p-2 min-h-[64px]">
                        <img src={gif.url} alt={gif.label} style={{ imageRendering: 'pixelated' }} className="max-w-full max-h-24" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-zinc-600">{gif.label}</span>
                        <button
                          onClick={() => handleDownloadSeparate(gif)}
                          className="text-zinc-400 hover:text-blue-600 transition-colors"
                          title="Download"
                        >
                          <Download size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Spritesheet Grid</p>
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
              <p className="text-xs text-zinc-500">{totalFrames} frames ({frameW}x{frameH} each)</p>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Animation</p>
              <Slider label="FPS" displayValue={String(fps)}
                min={1} max={60} value={fps}
                onChange={(e) => setFps(+(e.target as HTMLInputElement).value)} />
              <Slider label="Scale" displayValue={`${scale}x`}
                min={1} max={8} value={scale}
                onChange={(e) => setScale(+(e.target as HTMLInputElement).value)} />
            </div>

            {/* Separate by rows/cols */}
            {rows > 1 && (
              <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
                <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Separate Animations</p>
                <p className="text-[11px] text-zinc-500">Generate one GIF per row or column instead of a single GIF</p>
                <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
                  {(['none', 'rows', 'cols'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setSeparateMode(m)}
                      className={`flex-1 px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                        separateMode === m ? 'bg-blue-600 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'
                      }`}
                    >
                      {m === 'none' ? 'All Frames' : m === 'rows' ? `By Rows (${rows})` : `By Cols (${cols})`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleGenerateGif} disabled={generating} className="w-full">
              {generating ? (
                <><Loader2 size={16} className="animate-spin" /> Generating...</>
              ) : separateMode !== 'none' ? (
                `Generate ${separateMode === 'rows' ? rows : cols} GIFs`
              ) : (
                'Generate GIF'
              )}
            </Button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
