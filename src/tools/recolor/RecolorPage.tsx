import { useState, useRef, useEffect } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Download, Plus, Trash2, Loader2 } from 'lucide-react'
import { fileToDataURL, loadImage, downloadBlob, canvasToBlob } from '../../lib/utils'
import { encodeGif } from '../../lib/gif-encoder'
import { decodeGifFrames, type GifFrame } from '../../lib/gif-decoder'

interface ColorMapping {
  from: string
  to: string
}

export function RecolorPage() {
  const [mode, setMode] = useState<'manual' | 'lut'>('manual')
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null)
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [isGif, setIsGif] = useState(false)
  const [gifFrames, setGifFrames] = useState<GifFrame[]>([])
  const [gifDimensions, setGifDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [recoloredGifUrl, setRecoloredGifUrl] = useState<string | null>(null)
  const [recoloredGifBlob, setRecoloredGifBlob] = useState<Blob | null>(null)
  const [processing, setProcessing] = useState(false)
  const [mappings, setMappings] = useState<ColorMapping[]>([
    { from: '#000000', to: '#1a1a2e' },
  ])
  const [tolerance, setTolerance] = useState(10)
  const [lutSource, setLutSource] = useState<HTMLImageElement | null>(null)
  const [lutTarget, setLutTarget] = useState<HTMLImageElement | null>(null)
  const [lutBuilt, setLutBuilt] = useState(false)
  const [lutMap, setLutMap] = useState<Map<number, [number, number, number]>>(new Map())
  const srcCanvasRef = useRef<HTMLCanvasElement>(null)
  const dstCanvasRef = useRef<HTMLCanvasElement>(null)

  const handleSourceFiles = async (files: File[]) => {
    const file = files[0]
    setSourceFile(file)
    const gifFile = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')
    setIsGif(gifFile)
    setRecoloredGifUrl(null)
    setRecoloredGifBlob(null)

    if (gifFile) {
      const buf = await file.arrayBuffer()
      const { frames, width, height } = decodeGifFrames(new Uint8Array(buf))
      setGifFrames(frames)
      setGifDimensions({ width, height })
      // Show first frame as preview
      if (frames.length > 0) {
        const c = document.createElement('canvas')
        c.width = width
        c.height = height
        c.getContext('2d')!.putImageData(frames[0].imageData, 0, 0)
        const img = new Image()
        img.src = c.toDataURL()
        await new Promise<void>((r) => { img.onload = () => r() })
        setSourceImage(img)
      }
    } else {
      setGifFrames([])
      const url = await fileToDataURL(file)
      const img = await loadImage(url)
      setSourceImage(img)
    }
  }

  const handleLutSourceFiles = async (files: File[]) => {
    const url = await fileToDataURL(files[0])
    const img = await loadImage(url)
    setLutSource(img)
    setLutBuilt(false)
  }

  const handleLutTargetFiles = async (files: File[]) => {
    const url = await fileToDataURL(files[0])
    const img = await loadImage(url)
    setLutTarget(img)
    setLutBuilt(false)
  }

  const addMapping = () => setMappings([...mappings, { from: '#ff0000', to: '#00ff00' }])
  const removeMapping = (i: number) => setMappings(mappings.filter((_, idx) => idx !== i))
  const updateMapping = (i: number, field: 'from' | 'to', value: string) => {
    const updated = [...mappings]
    updated[i] = { ...updated[i], [field]: value }
    setMappings(updated)
  }

  // Pick color from source image
  const handleSourceClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!srcCanvasRef.current) return
    const rect = srcCanvasRef.current.getBoundingClientRect()
    const scaleX = srcCanvasRef.current.width / rect.width
    const scaleY = srcCanvasRef.current.height / rect.height
    const x = Math.floor((e.clientX - rect.left) * scaleX)
    const y = Math.floor((e.clientY - rect.top) * scaleY)
    const ctx = srcCanvasRef.current.getContext('2d')!
    const pixel = ctx.getImageData(x, y, 1, 1).data
    const hex = '#' + [pixel[0], pixel[1], pixel[2]].map((c) => c.toString(16).padStart(2, '0')).join('')
    // Add as new mapping with this color as "from"
    setMappings([...mappings, { from: hex, to: hex }])
  }

  // Build LUT from source/target pair
  const buildLut = () => {
    if (!lutSource || !lutTarget) return
    const w = Math.min(lutSource.width, lutTarget.width)
    const h = Math.min(lutSource.height, lutTarget.height)

    const c1 = document.createElement('canvas')
    c1.width = w; c1.height = h
    const ctx1 = c1.getContext('2d')!
    ctx1.drawImage(lutSource, 0, 0)
    const d1 = ctx1.getImageData(0, 0, w, h).data

    const c2 = document.createElement('canvas')
    c2.width = w; c2.height = h
    const ctx2 = c2.getContext('2d')!
    ctx2.drawImage(lutTarget, 0, 0)
    const d2 = ctx2.getImageData(0, 0, w, h).data

    const map = new Map<number, [number, number, number]>()
    for (let i = 0; i < d1.length; i += 4) {
      if (d1[i + 3] < 128 || d2[i + 3] < 128) continue
      const key = (d1[i] << 16) | (d1[i + 1] << 8) | d1[i + 2]
      if (!map.has(key)) {
        map.set(key, [d2[i], d2[i + 1], d2[i + 2]])
      }
    }

    setLutMap(map)
    setLutBuilt(true)
  }

  // Draw source image
  useEffect(() => {
    if (!sourceImage || !srcCanvasRef.current) return
    const c = srcCanvasRef.current
    c.width = sourceImage.width
    c.height = sourceImage.height
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(sourceImage, 0, 0)
  }, [sourceImage])

  // Recolor pixel data in-place
  const recolorPixels = (data: Uint8ClampedArray) => {
    if (mode === 'manual') {
      const parsedMappings = mappings.map((m) => ({
        from: hexToRgb(m.from),
        to: hexToRgb(m.to),
      }))
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue
        for (const m of parsedMappings) {
          const dist = Math.abs(data[i] - m.from[0]) + Math.abs(data[i + 1] - m.from[1]) + Math.abs(data[i + 2] - m.from[2])
          if (dist <= tolerance) {
            data[i] = m.to[0]
            data[i + 1] = m.to[1]
            data[i + 2] = m.to[2]
            break
          }
        }
      }
    } else if (lutBuilt) {
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue
        const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
        const mapped = lutMap.get(key)
        if (mapped) {
          data[i] = mapped[0]
          data[i + 1] = mapped[1]
          data[i + 2] = mapped[2]
        }
      }
    }
  }

  // Apply recolor
  const applyRecolor = async () => {
    if (!sourceImage) return

    if (isGif && gifFrames.length > 0) {
      setProcessing(true)
      // Recolor every GIF frame, then re-encode
      const { width, height } = gifDimensions
      const recoloredFrames: ImageData[] = []
      let avgDelay = 10
      let totalDelay = 0

      for (const frame of gifFrames) {
        const copy = new ImageData(
          new Uint8ClampedArray(frame.imageData.data),
          frame.imageData.width,
          frame.imageData.height
        )
        recolorPixels(copy.data)
        recoloredFrames.push(copy)
        totalDelay += frame.delay
      }
      avgDelay = Math.round(totalDelay / gifFrames.length)

      const gifData = encodeGif(width, height, recoloredFrames, avgDelay)
      const blob = new Blob([gifData.buffer as ArrayBuffer], { type: 'image/gif' })
      if (recoloredGifUrl) URL.revokeObjectURL(recoloredGifUrl)
      const url = URL.createObjectURL(blob)
      setRecoloredGifUrl(url)
      setRecoloredGifBlob(blob)

      // Also draw the first recolored frame on the dest canvas
      if (dstCanvasRef.current && recoloredFrames.length > 0) {
        const c = dstCanvasRef.current
        c.width = width
        c.height = height
        c.getContext('2d')!.putImageData(recoloredFrames[0], 0, 0)
      }
      setProcessing(false)
    } else {
      if (!dstCanvasRef.current) return
      const c = dstCanvasRef.current
      c.width = sourceImage.width
      c.height = sourceImage.height
      const ctx = c.getContext('2d')!
      ctx.drawImage(sourceImage, 0, 0)
      const imgData = ctx.getImageData(0, 0, c.width, c.height)
      recolorPixels(imgData.data)
      ctx.putImageData(imgData, 0, 0)
    }
  }

  const handleDownload = async () => {
    if (isGif && recoloredGifBlob) {
      downloadBlob(recoloredGifBlob, 'recolored.gif')
      return
    }
    if (!dstCanvasRef.current) return
    const blob = await canvasToBlob(dstCanvasRef.current)
    downloadBlob(blob, 'recolored.png')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Sprite Recolor</h2>
        <p className="text-sm text-zinc-500 mt-2">Recolor sprites by mapping colors manually or learning from example pairs</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setMode('manual')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
          Manual Mapping
        </button>
        <button onClick={() => setMode('lut')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'lut' ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
          Learn from Example
        </button>
      </div>

      {/* Source Image */}
      <FileDropzone onFiles={handleSourceFiles} accept="image/*,.gif" label="Drop sprite or GIF to recolor" description="Supports PNG, JPG, and animated GIF files" />

      {mode === 'lut' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-600">Original example</p>
            <FileDropzone onFiles={handleLutSourceFiles} accept="image/*" label="Drop original sprite" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-600">Recolored example</p>
            <FileDropzone onFiles={handleLutTargetFiles} accept="image/*" label="Drop recolored version" />
          </div>
          {lutSource && lutTarget && (
            <div className="col-span-2">
              <Button onClick={buildLut} size="sm" variant={lutBuilt ? 'secondary' : 'primary'}>
                {lutBuilt ? `LUT built (${lutMap.size} colors)` : 'Build Color LUT'}
              </Button>
            </div>
          )}
        </div>
      )}

      {sourceImage && (
        <div className="space-y-4">
          {mode === 'manual' && (
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Color Mappings</p>
                <button onClick={addMapping} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  <Plus size={12} /> Add
                </button>
              </div>
              <p className="text-xs text-zinc-500">Click the source image to pick a color. Tolerance: ±{tolerance}</p>
              <input type="range" min={0} max={50} value={tolerance}
                onChange={(e) => setTolerance(+e.target.value)}
                className="w-full h-1.5 bg-zinc-200 rounded-full appearance-none cursor-pointer accent-blue-600" />
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {mappings.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="color" value={m.from} onChange={(e) => updateMapping(i, 'from', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-zinc-200" />
                    <span className="text-xs text-zinc-400">→</span>
                    <input type="color" value={m.to} onChange={(e) => updateMapping(i, 'to', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-zinc-200" />
                    <span className="text-[10px] text-zinc-400 font-mono">{m.from} → {m.to}</span>
                    <button onClick={() => removeMapping(i)} className="text-zinc-400 hover:text-red-500 ml-auto">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button onClick={applyRecolor} disabled={(mode === 'lut' && !lutBuilt) || processing}>
            {processing ? <><Loader2 size={16} className="animate-spin" /> Processing GIF...</> : 'Apply Recolor'}
          </Button>

          {isGif && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
              🎞️ Animated GIF detected — {gifFrames.length} frames will be recolored
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-zinc-200 rounded-lg p-3">
              <p className="text-xs font-medium text-zinc-500 mb-2">Original (click to pick color)</p>
              <div className="overflow-auto max-h-64 bg-zinc-100 rounded cursor-crosshair">
                {isGif && sourceFile ? (
                  <img src={URL.createObjectURL(sourceFile)} alt="GIF preview" className="max-w-full" style={{ imageRendering: 'pixelated' }} />
                ) : (
                  <canvas ref={srcCanvasRef} onClick={handleSourceClick} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
                )}
              </div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-zinc-500">Recolored</p>
                <Button onClick={handleDownload} size="sm" variant="secondary" disabled={isGif ? !recoloredGifBlob : false}>
                  <Download size={12} /> Save {isGif ? 'GIF' : 'PNG'}
                </Button>
              </div>
              <div className="overflow-auto max-h-64 bg-zinc-100 rounded">
                {isGif && recoloredGifUrl ? (
                  <img src={recoloredGifUrl} alt="Recolored GIF" className="max-w-full" style={{ imageRendering: 'pixelated' }} />
                ) : (
                  <canvas ref={dstCanvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)]
}
