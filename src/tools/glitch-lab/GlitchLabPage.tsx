import { useState, useRef, useEffect, useCallback } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Slider } from '../../components/ui/Slider'
import { Download, Loader2, Trash2, Plus, Shuffle, RotateCcw, X, Check } from 'lucide-react'
import { downloadBlob, canvasToBlob, fileToDataURL, loadImage } from '../../lib/utils'
import { encodeGif } from '../../lib/gif-encoder'

/* ─── Types ─── */

const EFFECT_TYPES = [
  'rgbShift',
  'pixelSort',
  'glitchSlice',
  'scanLines',
  'noise',
  'chromaticAberration',
  'wave',
  'posterize',
  'invert',
  'vhs',
] as const

type EffectType = (typeof EFFECT_TYPES)[number]

const EFFECT_LABELS: Record<EffectType, string> = {
  rgbShift: 'RGB Shift',
  pixelSort: 'Pixel Sort',
  glitchSlice: 'Glitch Slice',
  scanLines: 'Scan Lines',
  noise: 'Noise',
  chromaticAberration: 'Chromatic Aberration',
  wave: 'Wave',
  posterize: 'Posterize',
  invert: 'Invert',
  vhs: 'VHS',
}

interface GlitchEffect {
  id: string
  type: EffectType
  enabled: boolean
  intensity: number
}

/* ─── Seeded PRNG ─── */

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ─── Effect Processing Functions ─── */

function applyRgbShift(data: Uint8ClampedArray, w: number, h: number, intensity: number) {
  const offset = Math.round((intensity / 100) * 30)
  if (offset === 0) return
  const copy = new Uint8ClampedArray(data)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      // Shift red channel right
      const rxSrc = x - offset
      if (rxSrc >= 0 && rxSrc < w) {
        data[i] = copy[(y * w + rxSrc) * 4]
      }
      // Shift blue channel left
      const bxSrc = x + offset
      if (bxSrc >= 0 && bxSrc < w) {
        data[i + 2] = copy[(y * w + bxSrc) * 4 + 2]
      }
    }
  }
}

function applyPixelSort(data: Uint8ClampedArray, w: number, h: number, intensity: number) {
  const threshold = ((100 - intensity) / 100) * 255
  for (let y = 0; y < h; y++) {
    const row: { idx: number; lum: number; r: number; g: number; b: number; a: number }[] = []
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      row.push({ idx: i, lum, r, g, b, a })
    }
    // Find runs of pixels above threshold and sort them
    let runStart = -1
    for (let x = 0; x <= w; x++) {
      const aboveThreshold = x < w && row[x].lum > threshold
      if (aboveThreshold && runStart === -1) {
        runStart = x
      } else if (!aboveThreshold && runStart !== -1) {
        const run = row.slice(runStart, x)
        run.sort((a, b) => a.lum - b.lum)
        for (let j = 0; j < run.length; j++) {
          const idx = row[runStart + j].idx
          data[idx] = run[j].r
          data[idx + 1] = run[j].g
          data[idx + 2] = run[j].b
          data[idx + 3] = run[j].a
        }
        runStart = -1
      }
    }
  }
}

function applyGlitchSlice(data: Uint8ClampedArray, w: number, h: number, intensity: number, seed: number) {
  const rng = mulberry32(seed)
  const numSlices = Math.round((intensity / 100) * 40) + 1
  const maxDisplace = Math.round((intensity / 100) * w * 0.3)
  const copy = new Uint8ClampedArray(data)
  for (let s = 0; s < numSlices; s++) {
    const sliceY = Math.floor(rng() * h)
    const sliceH = Math.floor(rng() * 20) + 2
    const displacement = Math.round((rng() - 0.5) * 2 * maxDisplace)
    for (let dy = 0; dy < sliceH && sliceY + dy < h; dy++) {
      const y = sliceY + dy
      for (let x = 0; x < w; x++) {
        const srcX = x - displacement
        const dstI = (y * w + x) * 4
        if (srcX >= 0 && srcX < w) {
          const srcI = (y * w + srcX) * 4
          data[dstI] = copy[srcI]
          data[dstI + 1] = copy[srcI + 1]
          data[dstI + 2] = copy[srcI + 2]
          data[dstI + 3] = copy[srcI + 3]
        }
      }
    }
  }
}

function applyScanLines(data: Uint8ClampedArray, w: number, h: number, intensity: number) {
  const opacity = intensity / 100
  const spacing = Math.max(2, Math.round(10 - (intensity / 100) * 8))
  for (let y = 0; y < h; y++) {
    if (y % spacing === 0) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        data[i] = Math.round(data[i] * (1 - opacity * 0.6))
        data[i + 1] = Math.round(data[i + 1] * (1 - opacity * 0.6))
        data[i + 2] = Math.round(data[i + 2] * (1 - opacity * 0.6))
      }
    }
  }
}

function applyNoise(data: Uint8ClampedArray, w: number, h: number, intensity: number, seed: number) {
  const rng = mulberry32(seed)
  const opacity = intensity / 100
  const total = w * h
  const affectedCount = Math.round(total * opacity * 0.5)
  for (let n = 0; n < affectedCount; n++) {
    const i = Math.floor(rng() * total) * 4
    const nr = Math.floor(rng() * 256)
    const ng = Math.floor(rng() * 256)
    const nb = Math.floor(rng() * 256)
    data[i] = Math.round(data[i] * (1 - opacity) + nr * opacity)
    data[i + 1] = Math.round(data[i + 1] * (1 - opacity) + ng * opacity)
    data[i + 2] = Math.round(data[i + 2] * (1 - opacity) + nb * opacity)
  }
}

function applyChromaticAberration(data: Uint8ClampedArray, w: number, h: number, intensity: number) {
  const spread = (intensity / 100) * 20
  if (spread < 0.5) return
  const copy = new Uint8ClampedArray(data)
  const cx = w / 2
  const cy = h / 2
  const maxDist = Math.sqrt(cx * cx + cy * cy)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const factor = (dist / maxDist) * spread
      const angle = Math.atan2(dy, dx)
      // Shift red outward
      const rxSrc = Math.round(x - Math.cos(angle) * factor)
      const rySrc = Math.round(y - Math.sin(angle) * factor)
      if (rxSrc >= 0 && rxSrc < w && rySrc >= 0 && rySrc < h) {
        data[i] = copy[(rySrc * w + rxSrc) * 4]
      }
      // Shift blue inward
      const bxSrc = Math.round(x + Math.cos(angle) * factor)
      const bySrc = Math.round(y + Math.sin(angle) * factor)
      if (bxSrc >= 0 && bxSrc < w && bySrc >= 0 && bySrc < h) {
        data[i + 2] = copy[(bySrc * w + bxSrc) * 4 + 2]
      }
    }
  }
}

function applyWave(data: Uint8ClampedArray, w: number, h: number, intensity: number) {
  const amplitude = (intensity / 100) * 30
  const frequency = 0.05 + (intensity / 100) * 0.1
  if (amplitude < 0.5) return
  const copy = new Uint8ClampedArray(data)
  for (let y = 0; y < h; y++) {
    const offset = Math.round(Math.sin(y * frequency) * amplitude)
    for (let x = 0; x < w; x++) {
      const srcX = x - offset
      const dstI = (y * w + x) * 4
      if (srcX >= 0 && srcX < w) {
        const srcI = (y * w + srcX) * 4
        data[dstI] = copy[srcI]
        data[dstI + 1] = copy[srcI + 1]
        data[dstI + 2] = copy[srcI + 2]
        data[dstI + 3] = copy[srcI + 3]
      } else {
        data[dstI] = 0
        data[dstI + 1] = 0
        data[dstI + 2] = 0
        data[dstI + 3] = 255
      }
    }
  }
}

function applyPosterize(data: Uint8ClampedArray, _w: number, _h: number, intensity: number) {
  const levels = Math.round(2 + ((100 - intensity) / 100) * 30)
  const step = 255 / (levels - 1)
  const len = data.length
  for (let i = 0; i < len; i += 4) {
    data[i] = Math.round(Math.round(data[i] / step) * step)
    data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step)
    data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step)
  }
}

function applyInvert(data: Uint8ClampedArray, _w: number, _h: number, intensity: number) {
  const t = intensity / 100
  const len = data.length
  for (let i = 0; i < len; i += 4) {
    data[i] = Math.round(data[i] * (1 - t) + (255 - data[i]) * t)
    data[i + 1] = Math.round(data[i + 1] * (1 - t) + (255 - data[i + 1]) * t)
    data[i + 2] = Math.round(data[i + 2] * (1 - t) + (255 - data[i + 2]) * t)
  }
}

function applyVhs(data: Uint8ClampedArray, w: number, h: number, intensity: number, seed: number) {
  const rng = mulberry32(seed)
  const strength = intensity / 100

  // Horizontal jitter on random rows
  const copy = new Uint8ClampedArray(data)
  const jitterRows = Math.round(h * strength * 0.05)
  for (let j = 0; j < jitterRows; j++) {
    const y = Math.floor(rng() * h)
    const offset = Math.round((rng() - 0.5) * 20 * strength)
    for (let x = 0; x < w; x++) {
      const srcX = x - offset
      const dstI = (y * w + x) * 4
      if (srcX >= 0 && srcX < w) {
        const srcI = (y * w + srcX) * 4
        data[dstI] = copy[srcI]
        data[dstI + 1] = copy[srcI + 1]
        data[dstI + 2] = copy[srcI + 2]
      }
    }
  }

  // Color bleed: blur red channel horizontally
  const bleedRadius = Math.round(strength * 4)
  if (bleedRadius > 0) {
    const copy2 = new Uint8ClampedArray(data)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, count = 0
        for (let dx = -bleedRadius; dx <= bleedRadius; dx++) {
          const sx = x + dx
          if (sx >= 0 && sx < w) {
            sum += copy2[(y * w + sx) * 4]
            count++
          }
        }
        data[(y * w + x) * 4] = Math.round(sum / count)
      }
    }
  }

  // Faint horizontal lines
  for (let y = 0; y < h; y++) {
    if (y % 3 === 0) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const dim = 1 - strength * 0.15
        data[i] = Math.round(data[i] * dim)
        data[i + 1] = Math.round(data[i + 1] * dim)
        data[i + 2] = Math.round(data[i + 2] * dim)
      }
    }
  }
}

/* ─── Apply Single Effect ─── */

function applyEffect(data: Uint8ClampedArray, w: number, h: number, effect: GlitchEffect, seed: number) {
  switch (effect.type) {
    case 'rgbShift': return applyRgbShift(data, w, h, effect.intensity)
    case 'pixelSort': return applyPixelSort(data, w, h, effect.intensity)
    case 'glitchSlice': return applyGlitchSlice(data, w, h, effect.intensity, seed)
    case 'scanLines': return applyScanLines(data, w, h, effect.intensity)
    case 'noise': return applyNoise(data, w, h, effect.intensity, seed)
    case 'chromaticAberration': return applyChromaticAberration(data, w, h, effect.intensity)
    case 'wave': return applyWave(data, w, h, effect.intensity)
    case 'posterize': return applyPosterize(data, w, h, effect.intensity)
    case 'invert': return applyInvert(data, w, h, effect.intensity)
    case 'vhs': return applyVhs(data, w, h, effect.intensity, seed)
  }
}

/* ─── Render Pipeline ─── */

function renderEffects(
  sourceData: ImageData,
  effects: GlitchEffect[],
  seed: number
): ImageData {
  const w = sourceData.width
  const h = sourceData.height
  const output = new ImageData(new Uint8ClampedArray(sourceData.data), w, h)
  for (const effect of effects) {
    if (effect.enabled && effect.intensity > 0) {
      applyEffect(output.data, w, h, effect, seed)
    }
  }
  return output
}

/* ─── Component ─── */

let nextId = 0
function uid() {
  return `fx-${++nextId}`
}

export function GlitchLabPage() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [sourceData, setSourceData] = useState<ImageData | null>(null)
  const [effects, setEffects] = useState<GlitchEffect[]>([])
  const [seed, setSeed] = useState(1)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [gifFrames, setGifFrames] = useState(10)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  /* Load image */
  const handleFiles = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    const dataUrl = await fileToDataURL(file)
    const img = await loadImage(dataUrl)
    setImage(img)
    // Extract source pixel data
    const offscreen = document.createElement('canvas')
    offscreen.width = img.naturalWidth
    offscreen.height = img.naturalHeight
    const ctx = offscreen.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    setSourceData(ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight))
    setEffects([])
    setSeed(1)
  }, [])

  /* Render to canvas whenever effects/seed change */
  useEffect(() => {
    if (!sourceData || !canvasRef.current) return
    const canvas = canvasRef.current
    const w = sourceData.width
    const h = sourceData.height
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    const output = renderEffects(sourceData, effects, seed)
    ctx.putImageData(output, 0, 0)
  }, [sourceData, effects, seed])

  /* Effect management */
  const addEffect = (type: EffectType) => {
    setEffects(prev => [...prev, { id: uid(), type, enabled: true, intensity: 50 }])
    setShowAddMenu(false)
  }

  const removeEffect = (id: string) => {
    setEffects(prev => prev.filter(e => e.id !== id))
  }

  const toggleEffect = (id: string) => {
    setEffects(prev => prev.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e))
  }

  const setIntensity = (id: string, intensity: number) => {
    setEffects(prev => prev.map(e => e.id === id ? { ...e, intensity } : e))
  }

  const resetAll = () => {
    setEffects([])
    setSeed(1)
  }

  const randomize = () => {
    const count = 3 + Math.floor(Math.random() * 3)
    const shuffled = [...EFFECT_TYPES].sort(() => Math.random() - 0.5)
    const picked = shuffled.slice(0, count)
    setEffects(picked.map(type => ({
      id: uid(),
      type,
      enabled: true,
      intensity: Math.round(20 + Math.random() * 60),
    })))
    setSeed(Math.floor(Math.random() * 100000))
  }

  /* Export PNG */
  const downloadPng = async () => {
    if (!canvasRef.current) return
    const blob = await canvasToBlob(canvasRef.current)
    downloadBlob(blob, 'glitch-lab.png')
  }

  /* Export GIF */
  const downloadGifFile = async () => {
    if (!sourceData) return
    setExporting(true)
    try {
      const w = sourceData.width
      const h = sourceData.height
      const frames: ImageData[] = []
      for (let f = 0; f < gifFrames; f++) {
        const frameSeed = seed + f * 7919
        frames.push(renderEffects(sourceData, effects, frameSeed))
      }
      const gifData = encodeGif(w, h, frames, 100)
      const blob = new Blob([gifData], { type: 'image/gif' })
      downloadBlob(blob, 'glitch-lab.gif')
    } finally {
      setExporting(false)
    }
  }

  /* Which effect types are already added */
  const usedTypes = new Set(effects.map(e => e.type))
  const availableTypes = EFFECT_TYPES.filter(t => !usedTypes.has(t))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Glitch Lab</h2>
        <p className="text-zinc-500 text-sm mt-1">Apply glitch and distortion effects to your images</p>
      </div>

      <FileDropzone
        onFiles={handleFiles}
        accept="image/*"
        label="Drop an image here or click to browse"
        description="PNG, JPG, WebP supported"
        expanded={!image}
      />

      {image && sourceData && (
        <div className="flex gap-6 items-start">
          {/* Canvas preview */}
          <div className="flex-1 min-w-0">
            <canvas
              ref={canvasRef}
              className="w-full h-auto rounded-lg border border-zinc-200 bg-zinc-100"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>

          {/* Effects panel */}
          <div className="w-[300px] shrink-0 space-y-4">
            {/* Effect cards */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {effects.length === 0 && (
                <p className="text-sm text-zinc-400 text-center py-4">
                  No effects added yet. Click "Add Effect" below.
                </p>
              )}
              {effects.map(effect => (
                <div
                  key={effect.id}
                  className="border border-zinc-200 rounded-lg p-3 space-y-2 bg-white"
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleEffect(effect.id)}
                      className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        effect.enabled
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-zinc-300 bg-white'
                      }`}
                    >
                      {effect.enabled && <Check size={12} />}
                    </button>
                    <span className="text-sm font-medium text-zinc-700 flex-1">
                      {EFFECT_LABELS[effect.type]}
                    </span>
                    <button
                      onClick={() => removeEffect(effect.id)}
                      className="text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <Slider
                    label="Intensity"
                    displayValue={`${effect.intensity}`}
                    min={0}
                    max={100}
                    value={effect.intensity}
                    onChange={e => setIntensity(effect.id, Number(e.target.value))}
                  />
                </div>
              ))}
            </div>

            {/* Add Effect dropdown */}
            <div className="relative">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => setShowAddMenu(!showAddMenu)}
                disabled={availableTypes.length === 0}
              >
                <Plus size={14} />
                Add Effect
              </Button>
              {showAddMenu && availableTypes.length > 0 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
                  <div className="absolute left-0 right-0 bottom-full mb-1 z-20 bg-white border border-zinc-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {availableTypes.map(type => (
                      <button
                        key={type}
                        onClick={() => addEffect(type)}
                        className="w-full text-left px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {EFFECT_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={randomize}>
                <Shuffle size={14} />
                Randomize
              </Button>
              <Button variant="secondary" size="sm" className="flex-1" onClick={resetAll}>
                <RotateCcw size={14} />
                Reset All
              </Button>
            </div>

            {/* Re-roll seed for animated effects */}
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => setSeed(s => s + 1)}
            >
              <Shuffle size={14} />
              New Seed
            </Button>

            {/* Export section */}
            <div className="border-t border-zinc-200 pt-4 space-y-3">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Export</p>
              <Button variant="primary" size="sm" className="w-full" onClick={downloadPng}>
                <Download size={14} />
                Download PNG
              </Button>
              <div className="space-y-2">
                <Slider
                  label="GIF Frames"
                  displayValue={`${gifFrames}`}
                  min={2}
                  max={30}
                  value={gifFrames}
                  onChange={e => setGifFrames(Number(e.target.value))}
                />
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={downloadGifFile}
                  disabled={exporting}
                >
                  {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {exporting ? 'Encoding...' : 'Download GIF'}
                </Button>
              </div>
            </div>

            {/* Clear image */}
            <Button
              variant="danger"
              size="sm"
              className="w-full"
              onClick={() => { setImage(null); setSourceData(null); setEffects([]) }}
            >
              <Trash2 size={14} />
              Remove Image
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
