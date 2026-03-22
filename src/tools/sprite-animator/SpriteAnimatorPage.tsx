import { useState, useRef, useEffect, useCallback } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Slider } from '../../components/ui/Slider'
import { Download, Play, Pause, SkipBack, SkipForward, Loader2, Repeat, ArrowLeftRight } from 'lucide-react'
import { fileToDataURL, loadImage, downloadBlob } from '../../lib/utils'
import { encodeGif } from '../../lib/gif-encoder'
import { PreviewCanvas } from '../../components/ui/PreviewCanvas'

export function SpriteAnimatorPage() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [cols, setCols] = useState(4)
  const [rows, setRows] = useState(1)
  const [fps, setFps] = useState(12)
  const [scale, setScale] = useState(2)
  const [playing, setPlaying] = useState(true)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [loop, setLoop] = useState(true)
  const [pingPong, setPingPong] = useState(false)
  const [frameStart, setFrameStart] = useState(0)
  const [frameEnd, setFrameEnd] = useState(0)
  const [onionSkin, setOnionSkin] = useState(false)
  const [onionOpacity, setOnionOpacity] = useState(30)
  const [generating, setGenerating] = useState(false)
  const [direction, setDirection] = useState(1) // 1 = forward, -1 = backward
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const lastTimeRef = useRef(0)

  const handleFiles = async (files: File[]) => {
    const url = await fileToDataURL(files[0])
    const img = await loadImage(url)
    setImage(img)
    setCurrentFrame(0)
    setFrameStart(0)
    setFrameEnd(cols * rows - 1)
  }

  const totalFrames = cols * rows
  const frameW = image ? Math.floor(image.width / cols) : 0
  const frameH = image ? Math.floor(image.height / rows) : 0
  const rangeEnd = Math.min(frameEnd, totalFrames - 1)
  const rangeStart = Math.min(frameStart, rangeEnd)
  const activeFrameCount = rangeEnd - rangeStart + 1

  // Update frame end when grid changes
  useEffect(() => {
    setFrameEnd(totalFrames - 1)
    setFrameStart(0)
  }, [totalFrames])

  const drawFrame = useCallback((frameIdx: number, canvas: HTMLCanvasElement, alpha = 1) => {
    if (!image) return
    const col = frameIdx % cols
    const row = Math.floor(frameIdx / cols)
    const displayW = frameW * scale
    const displayH = frameH * scale
    canvas.width = displayW
    canvas.height = displayH
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    if (alpha < 1) {
      ctx.globalAlpha = alpha
    }
    ctx.drawImage(image, col * frameW, row * frameH, frameW, frameH, 0, 0, displayW, displayH)
    ctx.globalAlpha = 1
  }, [image, cols, frameW, frameH, scale])

  // Animation loop
  const animate = useCallback((time: number) => {
    if (!image || !canvasRef.current) {
      animRef.current = requestAnimationFrame(animate)
      return
    }

    if (!playing) {
      animRef.current = requestAnimationFrame(animate)
      return
    }

    const interval = 1000 / fps
    if (time - lastTimeRef.current >= interval) {
      lastTimeRef.current = time

      const canvas = canvasRef.current
      const displayW = frameW * scale
      const displayH = frameH * scale
      canvas.width = displayW
      canvas.height = displayH
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, displayW, displayH)

      // Draw onion skin
      if (onionSkin) {
        const prevFrame = currentFrame - 1
        if (prevFrame >= rangeStart) {
          ctx.globalAlpha = onionOpacity / 100
          const pCol = prevFrame % cols
          const pRow = Math.floor(prevFrame / cols)
          ctx.drawImage(image, pCol * frameW, pRow * frameH, frameW, frameH, 0, 0, displayW, displayH)
          ctx.globalAlpha = 1
        }
      }

      // Draw current frame
      const col = currentFrame % cols
      const row = Math.floor(currentFrame / cols)
      ctx.drawImage(image, col * frameW, row * frameH, frameW, frameH, 0, 0, displayW, displayH)

      // Advance frame
      setCurrentFrame((prev) => {
        let next = prev + direction

        if (pingPong) {
          if (next > rangeEnd) {
            setDirection(-1)
            return rangeEnd - 1
          }
          if (next < rangeStart) {
            setDirection(1)
            return rangeStart + 1
          }
          return next
        }

        if (next > rangeEnd) {
          return loop ? rangeStart : rangeEnd
        }
        if (next < rangeStart) {
          return rangeEnd
        }
        return next
      })
    }

    animRef.current = requestAnimationFrame(animate)
  }, [image, playing, fps, currentFrame, direction, cols, frameW, frameH, scale, rangeStart, rangeEnd, loop, pingPong, onionSkin, onionOpacity])

  useEffect(() => {
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [animate])

  // Draw static frame when paused
  useEffect(() => {
    if (!image || !canvasRef.current || playing) return
    const canvas = canvasRef.current
    const displayW = frameW * scale
    const displayH = frameH * scale
    canvas.width = displayW
    canvas.height = displayH
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, displayW, displayH)

    if (onionSkin && currentFrame > rangeStart) {
      ctx.globalAlpha = onionOpacity / 100
      const pCol = (currentFrame - 1) % cols
      const pRow = Math.floor((currentFrame - 1) / cols)
      ctx.drawImage(image, pCol * frameW, pRow * frameH, frameW, frameH, 0, 0, displayW, displayH)
      ctx.globalAlpha = 1
    }

    const col = currentFrame % cols
    const row = Math.floor(currentFrame / cols)
    ctx.drawImage(image, col * frameW, row * frameH, frameW, frameH, 0, 0, displayW, displayH)
  }, [image, currentFrame, playing, cols, frameW, frameH, scale, onionSkin, onionOpacity, rangeStart])

  const handleExportGif = async () => {
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

    const frames: ImageData[] = []
    const frameIndices: number[] = []

    for (let i = rangeStart; i <= rangeEnd; i++) frameIndices.push(i)
    if (pingPong) {
      for (let i = rangeEnd - 1; i > rangeStart; i--) frameIndices.push(i)
    }

    for (const fi of frameIndices) {
      const col = fi % cols
      const row = Math.floor(fi / cols)
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(image, col * frameW, row * frameH, frameW, frameH, 0, 0, w, h)
      frames.push(ctx.getImageData(0, 0, w, h))
    }

    const gifData = encodeGif(w, h, frames, delay)
    const blob = new Blob([gifData.buffer as ArrayBuffer], { type: 'image/gif' })
    downloadBlob(blob, 'animation.gif')
    setGenerating(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Sprite Animator</h2>
        <p className="text-sm text-zinc-500 mt-2">Preview and export spritesheet animations with onion skinning</p>
      </div>

      <FileDropzone onFiles={handleFiles} accept="image/*" label="Drop a spritesheet to animate" />

      {image && (
        <div className="grid grid-cols-[1fr_260px] gap-6">
          <div className="space-y-4">
            <PreviewCanvas
              label={`Frame ${currentFrame - rangeStart + 1}/${activeFrameCount}${pingPong ? ' (ping-pong)' : ''}`}
              maxHeight={280}
              minHeight={100}
              actions={
                <div className="flex items-center gap-1">
                  <button onClick={() => { setCurrentFrame(Math.max(rangeStart, currentFrame - 1)); setPlaying(false) }}
                    className="text-zinc-400 hover:text-zinc-600 p-1"><SkipBack size={14} /></button>
                  <button onClick={() => setPlaying(!playing)}
                    className="text-zinc-400 hover:text-zinc-600 p-1">
                    {playing ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button onClick={() => { setCurrentFrame(Math.min(rangeEnd, currentFrame + 1)); setPlaying(false) }}
                    className="text-zinc-400 hover:text-zinc-600 p-1"><SkipForward size={14} /></button>
                </div>
              }
            >
              <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />
            </PreviewCanvas>

            {/* Frame Strip */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide mb-2">Frames</p>
              <div className="flex gap-1 overflow-x-auto pb-2">
                {Array.from({ length: totalFrames }, (_, i) => {
                  const col = i % cols
                  const row = Math.floor(i / cols)
                  const isActive = i === currentFrame
                  const inRange = i >= rangeStart && i <= rangeEnd
                  return (
                    <button
                      key={i}
                      onClick={() => { setCurrentFrame(i); setPlaying(false) }}
                      className={`shrink-0 border-2 rounded overflow-hidden ${isActive ? 'border-blue-500' : inRange ? 'border-zinc-300' : 'border-zinc-200 opacity-40'}`}
                      style={{ width: 48, height: 48 }}
                    >
                      <canvas
                        ref={(el) => {
                          if (!el || !image) return
                          el.width = 48
                          el.height = 48
                          const ctx = el.getContext('2d')!
                          ctx.imageSmoothingEnabled = false
                          ctx.clearRect(0, 0, 48, 48)
                          const aspect = frameW / frameH
                          const dw = aspect >= 1 ? 48 : 48 * aspect
                          const dh = aspect >= 1 ? 48 / aspect : 48
                          ctx.drawImage(image, col * frameW, row * frameH, frameW, frameH,
                            (48 - dw) / 2, (48 - dh) / 2, dw, dh)
                        }}
                        style={{ imageRendering: 'pixelated' }}
                      />
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
              <p className="text-xs text-zinc-500">{totalFrames} frames ({frameW}x{frameH} each)</p>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Playback</p>
              <Slider label="FPS" displayValue={String(fps)}
                min={1} max={60} value={fps}
                onChange={(e) => setFps(+(e.target as HTMLInputElement).value)} />
              <Slider label="Scale" displayValue={`${scale}x`}
                min={1} max={8} value={scale}
                onChange={(e) => setScale(+(e.target as HTMLInputElement).value)} />
              <Slider label="Start Frame" displayValue={String(frameStart)}
                min={0} max={totalFrames - 1} value={frameStart}
                onChange={(e) => setFrameStart(+(e.target as HTMLInputElement).value)} />
              <Slider label="End Frame" displayValue={String(frameEnd)}
                min={0} max={totalFrames - 1} value={frameEnd}
                onChange={(e) => setFrameEnd(+(e.target as HTMLInputElement).value)} />

              <div className="flex gap-2">
                <button
                  onClick={() => setLoop(!loop)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${loop ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-zinc-200 text-zinc-500'}`}
                >
                  <Repeat size={12} /> Loop
                </button>
                <button
                  onClick={() => setPingPong(!pingPong)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${pingPong ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-zinc-200 text-zinc-500'}`}
                >
                  <ArrowLeftRight size={12} /> Ping Pong
                </button>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Onion Skin</p>
                <button
                  onClick={() => setOnionSkin(!onionSkin)}
                  className={`w-8 h-4 rounded-full transition-colors ${onionSkin ? 'bg-blue-500' : 'bg-zinc-300'}`}
                >
                  <div className={`w-3 h-3 rounded-full bg-white transition-transform mx-0.5 ${onionSkin ? 'translate-x-4' : ''}`} />
                </button>
              </div>
              {onionSkin && (
                <Slider label="Opacity" displayValue={`${onionOpacity}%`}
                  min={10} max={80} value={onionOpacity}
                  onChange={(e) => setOnionOpacity(+(e.target as HTMLInputElement).value)} />
              )}
            </div>

            <Button onClick={handleExportGif} disabled={generating} className="w-full">
              {generating ? <><Loader2 size={16} className="animate-spin" /> Exporting...</> : <><Download size={16} /> Export GIF</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
