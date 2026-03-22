import { useState, useRef, useEffect, useCallback } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Slider } from '../../components/ui/Slider'
import { Download, Play, Pause, Loader2 } from 'lucide-react'
import { fileToDataURL, loadImage, downloadBlob } from '../../lib/utils'
import { encodeGif } from '../../lib/gif-encoder'
import { PreviewCanvas } from '../../components/ui/PreviewCanvas'

export function SpriteToGifPage() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [cols, setCols] = useState(4)
  const [rows, setRows] = useState(1)
  const [fps, setFps] = useState(12)
  const [scale, setScale] = useState(1)
  const [playing, setPlaying] = useState(true)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [gifBlob, setGifBlob] = useState<Blob | null>(null)
  const [gifUrl, setGifUrl] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const lastTimeRef = useRef(0)

  const handleFiles = async (files: File[]) => {
    const url = await fileToDataURL(files[0])
    const img = await loadImage(url)
    setImage(img)
    setGifBlob(null)
    setGifUrl(null)
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

    // Build GIF manually using minimal GIF encoder
    const w = frameW * scale
    const h = frameH * scale
    const delay = Math.round(100 / fps) // GIF delay is in centiseconds
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = w
    tempCanvas.height = h
    const ctx = tempCanvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    // Collect frames as ImageData
    const frames: ImageData[] = []
    for (let i = 0; i < totalFrames; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(image, col * frameW, row * frameH, frameW, frameH, 0, 0, w, h)
      frames.push(ctx.getImageData(0, 0, w, h))
    }

    // Encode GIF
    const gifData = encodeGif(w, h, frames, delay)
    const blob = new Blob([gifData.buffer as ArrayBuffer], { type: 'image/gif' })

    if (gifUrl) URL.revokeObjectURL(gifUrl)
    const url = URL.createObjectURL(blob)
    setGifBlob(blob)
    setGifUrl(url)
    setGenerating(false)
  }

  const handleDownload = () => {
    if (!gifBlob) return
    downloadBlob(gifBlob, 'sprite_animation.gif')
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

            <Button onClick={handleGenerateGif} disabled={generating} className="w-full">
              {generating ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : 'Generate GIF'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// GIF encoder imported from ../../lib/gif-encoder
