import { useState, useRef, useEffect, useCallback } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Slider } from '../../components/ui/Slider'
import { Download, Play, Pause, Loader2 } from 'lucide-react'
import { fileToDataURL, loadImage, downloadBlob } from '../../lib/utils'
import { encodeGif } from '../../lib/gif-encoder'
import { PreviewCanvas } from '../../components/ui/PreviewCanvas'

type SeparateMode = 'none' | 'rows' | 'cols'

interface GeneratedGif {
  label: string
  blob: Blob
  url: string
}

export function SpriteToGifPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Spritesheet to GIF</h2>
        <p className="text-sm text-zinc-500 mt-2">Convert a spritesheet into an animated GIF</p>
      </div>

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
    </div>
  )
}

// GIF encoder imported from ../../lib/gif-encoder
