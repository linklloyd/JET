import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Slider } from '../../components/ui/Slider'
import { Download, Play, Pause, Shuffle, Loader2, Film } from 'lucide-react'
import { setRomData } from './rom'
import { Engine, SNES_WIDTH, SNES_HEIGHT } from './engine'
import { BackgroundLayer } from './background-layer'
import { encodeGif } from '../../lib/gif-encoder'
import { downloadBlob } from '../../lib/utils'

const TOTAL_BACKGROUNDS = 327

function buildLayerOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [{ value: '-1', label: 'None' }]
  for (let i = 0; i < TOTAL_BACKGROUNDS; i++) {
    opts.push({ value: String(i), label: `BG ${i}` })
  }
  return opts
}

const layerOptions = buildLayerOptions()
const fpsOptions = [
  { value: '15', label: '15 FPS' },
  { value: '30', label: '30 FPS' },
  { value: '60', label: '60 FPS' },
]

export function EarthboundBGPage() {
  const [romLoaded, setRomLoaded] = useState(false)
  const [romError, setRomError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [layer1, setLayer1] = useState(0)
  const [layer2, setLayer2] = useState(-1)
  const [fps, setFps] = useState(30)
  const [aspectRatioMode, setAspectRatioMode] = useState(0)
  const [frameSkip, setFrameSkip] = useState(1)
  const [playing, setPlaying] = useState(true)
  const [gifFrames, setGifFrames] = useState(60)
  const [exporting, setExporting] = useState(false)

  // Convert aspect ratio mode to letterbox pixel count
  // Native 8:7 = 0, 4:3 = 16px, 16:9 = 40px
  const letterboxMap: Record<number, number> = { 0: 0, 1: 16, 2: 40 }
  const aspectRatio = letterboxMap[aspectRatioMode] ?? 0

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)

  // Load ROM data on mount
  useEffect(() => {
    let cancelled = false

    async function loadRom() {
      try {
        const response = await fetch('/assets/earthbound-bg/rom.bin')
        if (!response.ok) {
          throw new Error(`Failed to load ROM data (HTTP ${response.status}). Place the ROM data file at public/assets/earthbound-bg/rom.bin`)
        }
        const buffer = await response.arrayBuffer()
        const romData = new Uint8Array(buffer)
        if (cancelled) return
        setRomData(romData)
        setRomLoaded(true)
      } catch (err) {
        if (cancelled) return
        setRomError(
          err instanceof Error
            ? err.message
            : 'Failed to load ROM data. Ensure rom.bin is placed in public/assets/earthbound-bg/'
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadRom()
    return () => { cancelled = true }
  }, [])

  // Initialize / reinitialize engine when parameters change
  const initEngine = useCallback(() => {
    if (!romLoaded || !canvasRef.current) return

    // Stop existing engine
    if (engineRef.current) {
      engineRef.current.stop()
    }

    try {
      const l1 = new BackgroundLayer(layer1)
      const l2 = new BackgroundLayer(layer2)

      const engine = new Engine([l1, l2], {
        fps,
        aspectRatio,
        frameSkip,
        alpha: [0.5, 0.5],
        canvas: canvasRef.current,
      })

      engineRef.current = engine

      if (playing) {
        engine.start()
      }
    } catch (err) {
      console.error('Engine initialization error:', err)
    }
  }, [romLoaded, layer1, layer2, fps, aspectRatio, aspectRatioMode, frameSkip, playing])

  useEffect(() => {
    initEngine()
    return () => {
      if (engineRef.current) {
        engineRef.current.stop()
      }
    }
  }, [initEngine])

  // Toggle play/pause
  const togglePlay = () => {
    const engine = engineRef.current
    if (!engine) return
    if (playing) {
      engine.stop()
    } else {
      engine.start()
    }
    setPlaying(!playing)
  }

  // Randomize layers
  const randomize = () => {
    const r1 = Math.floor(Math.random() * TOTAL_BACKGROUNDS)
    let r2 = Math.floor(Math.random() * (TOTAL_BACKGROUNDS + 1)) - 1 // -1 = None
    // Avoid same layer
    if (r2 === r1) r2 = -1
    setLayer1(r1)
    setLayer2(r2)
  }

  // Export current frame as PNG
  const exportPng = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `eb-bg-${layer1}-${layer2}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  // Export animated GIF
  const exportGif = async () => {
    if (!canvasRef.current || !romLoaded) return
    setExporting(true)

    // Pause current engine
    if (engineRef.current) engineRef.current.stop()

    try {
      // Create a temporary engine to capture frames
      const l1 = new BackgroundLayer(layer1)
      const l2 = new BackgroundLayer(layer2)
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = SNES_WIDTH
      tempCanvas.height = SNES_HEIGHT
      const tempEngine = new Engine([l1, l2], {
        fps,
        aspectRatio,
        frameSkip,
        alpha: [0.5, 0.5],
        canvas: tempCanvas,
      })

      const frames: ImageData[] = []
      const ctx = tempCanvas.getContext('2d')!

      // Capture frames by stepping the engine manually
      for (let i = 0; i < gifFrames; i++) {
        tempEngine.renderFrame()
        frames.push(ctx.getImageData(0, 0, SNES_WIDTH, SNES_HEIGHT))
      }

      tempEngine.stop()

      // Encode GIF (delay in centiseconds: 1000ms/30fps = 33ms ≈ 3cs)
      await new Promise(r => setTimeout(r, 10))
      const gifData = encodeGif(SNES_WIDTH, SNES_HEIGHT, frames, 3)
      const blob = new Blob([gifData as BlobPart], { type: 'image/gif' })
      downloadBlob(blob, `eb-bg-${layer1}-${layer2}.gif`)
    } catch (err) {
      console.error('GIF export error:', err)
    } finally {
      setExporting(false)
      // Restart engine if it was playing
      if (playing) initEngine()
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">EB Battle Backgrounds</h2>
          <p className="text-sm text-zinc-500 mt-2">
            Animated battle backgrounds from Earthbound, rendered in real-time
          </p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-zinc-400" />
          <span className="ml-3 text-sm text-zinc-500">Loading ROM data...</span>
        </div>
      </div>
    )
  }

  if (romError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">EB Battle Backgrounds</h2>
          <p className="text-sm text-zinc-500 mt-2">
            Animated battle backgrounds from Earthbound, rendered in real-time
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 space-y-3">
          <p className="text-sm font-medium text-red-800">ROM Data Not Found</p>
          <p className="text-sm text-red-700">{romError}</p>
          <div className="text-xs text-red-600 space-y-1">
            <p>To use this tool, you need the Earthbound battle background ROM data file.</p>
            <p>
              Download <code className="bg-red-100 px-1 rounded">truncated_backgrounds.dat</code> from
              the{' '}
              <a
                href="https://github.com/gjtorikian/Earthbound-Battle-Backgrounds-JS/tree/gh-pages/data"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-red-800"
              >
                source repository
              </a>{' '}
              and place it at:
            </p>
            <code className="block bg-red-100 px-2 py-1 rounded">
              public/assets/earthbound-bg/rom.bin
            </code>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">EB Battle Backgrounds</h2>
        <p className="text-sm text-zinc-500 mt-2">
          Animated battle backgrounds from Earthbound, rendered in real-time
        </p>
      </div>

      <div className="grid grid-cols-[1fr_240px] gap-6">
        {/* Canvas */}
        <div className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-zinc-500">
                Layer 1: {layer1 >= 0 ? `BG ${layer1}` : 'None'} | Layer 2:{' '}
                {layer2 >= 0 ? `BG ${layer2}` : 'None'}
              </p>
              <button
                onClick={togglePlay}
                className="text-zinc-400 hover:text-zinc-600"
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
            </div>
            <div
              className="flex items-center justify-center bg-black rounded overflow-hidden"
              style={{ minHeight: '280px' }}
            >
              <canvas
                ref={canvasRef}
                width={SNES_WIDTH}
                height={SNES_HEIGHT}
                style={{
                  width: '512px',
                  height: `${Math.round(512 * (SNES_HEIGHT / SNES_WIDTH))}px`,
                  imageRendering: 'pixelated',
                }}
              />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
            <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Layers</p>
            <Select
              label="Layer 1"
              options={layerOptions}
              value={String(layer1)}
              onChange={(e) => setLayer1(Number(e.target.value))}
            />
            <Select
              label="Layer 2"
              options={layerOptions}
              value={String(layer2)}
              onChange={(e) => setLayer2(Number(e.target.value))}
            />
            <Button onClick={randomize} variant="secondary" className="w-full" size="sm">
              <Shuffle size={14} /> Randomize
            </Button>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
            <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Playback</p>
            <Select
              label="Frame Rate"
              options={fpsOptions}
              value={String(fps)}
              onChange={(e) => setFps(Number(e.target.value))}
            />
            <Select
              label="Aspect Ratio"
              options={[
                { value: '0', label: 'Native (8:7)' },
                { value: '1', label: '4:3' },
                { value: '2', label: '16:9' },
              ]}
              value={String(aspectRatioMode)}
              onChange={(e) => setAspectRatioMode(Number(e.target.value))}
            />
            <Slider
              label="Frame Skip"
              displayValue={String(frameSkip)}
              min={1}
              max={6}
              value={frameSkip}
              onChange={(e) => setFrameSkip(+(e.target as HTMLInputElement).value)}
            />
            <Button
              onClick={togglePlay}
              variant="secondary"
              className="w-full"
              size="sm"
            >
              {playing ? (
                <>
                  <Pause size={14} /> Pause
                </>
              ) : (
                <>
                  <Play size={14} /> Play
                </>
              )}
            </Button>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
            <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Export</p>
            <Button onClick={exportPng} variant="secondary" className="w-full" size="sm">
              <Download size={14} /> Export Frame (PNG)
            </Button>
            <Slider
              label="GIF Frames"
              displayValue={`${gifFrames} (~${(gifFrames / 30).toFixed(1)}s)`}
              min={15}
              max={180}
              value={gifFrames}
              onChange={(e) => setGifFrames(+(e.target as HTMLInputElement).value)}
            />
            <Button onClick={exportGif} variant="primary" className="w-full" size="sm" disabled={exporting}>
              {exporting ? (
                <><Loader2 size={14} className="animate-spin" /> Encoding...</>
              ) : (
                <><Film size={14} /> Export GIF</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
