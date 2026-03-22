import { useState, useRef, useEffect, useCallback } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Download, Trash2 } from 'lucide-react'
import { fileToDataURL, loadImage, downloadBlob, canvasToBlob } from '../../lib/utils'
import { PreviewCanvas } from '../../components/ui/PreviewCanvas'
import JSZip from 'jszip'

interface SpriteEntry {
  id: string
  name: string
  image: HTMLImageElement
  trimmed?: { x: number; y: number; w: number; h: number }
}

interface PackedSprite {
  entry: SpriteEntry
  x: number
  y: number
  w: number
  h: number
}

export function AtlasPackPage() {
  const [sprites, setSprites] = useState<SpriteEntry[]>([])
  const [padding, setPadding] = useState(1)
  const [trim, setTrim] = useState(true)
  const [powerOfTwo, setPowerOfTwo] = useState(true)
  const [packed, setPacked] = useState<PackedSprite[] | null>(null)
  const [atlasSize, setAtlasSize] = useState({ w: 0, h: 0 })
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFiles = async (files: File[]) => {
    const entries: SpriteEntry[] = []
    for (const f of files) {
      const url = await fileToDataURL(f)
      const img = await loadImage(url)
      const entry: SpriteEntry = {
        id: crypto.randomUUID(),
        name: f.name.replace(/\.[^.]+$/, ''),
        image: img,
        trimmed: getTrimBounds(img),
      }
      entries.push(entry)
    }
    setSprites((prev) => [...prev, ...entries])
    setPacked(null)
  }

  const getTrimBounds = (img: HTMLImageElement): { x: number; y: number; w: number; h: number } => {
    const c = document.createElement('canvas')
    c.width = img.width; c.height = img.height
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, img.width, img.height).data

    let minX = img.width, minY = img.height, maxX = 0, maxY = 0
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        if (data[(y * img.width + x) * 4 + 3] > 0) {
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
      }
    }
    if (maxX < minX) return { x: 0, y: 0, w: img.width, h: img.height }
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
  }

  const packSprites = useCallback(() => {
    if (!sprites.length) return

    // Get sprite dimensions (trimmed if enabled)
    const rects = sprites.map((s) => {
      const bounds = trim && s.trimmed ? s.trimmed : { x: 0, y: 0, w: s.image.width, h: s.image.height }
      return { entry: s, w: bounds.w + padding * 2, h: bounds.h + padding * 2 }
    })

    // Sort by height descending for better packing
    rects.sort((a, b) => b.h - a.h || b.w - a.w)

    // Simple shelf packing
    const result: PackedSprite[] = []
    let shelfY = 0
    let shelfH = 0
    let curX = 0
    let maxW = 0

    // Estimate initial width
    const totalArea = rects.reduce((sum, r) => sum + r.w * r.h, 0)
    let canvasW = Math.ceil(Math.sqrt(totalArea) * 1.1)

    for (const rect of rects) {
      if (curX + rect.w > canvasW) {
        // New shelf
        shelfY += shelfH
        shelfH = 0
        curX = 0
      }
      result.push({
        entry: rect.entry,
        x: curX + padding,
        y: shelfY + padding,
        w: rect.w - padding * 2,
        h: rect.h - padding * 2,
      })
      curX += rect.w
      maxW = Math.max(maxW, curX)
      shelfH = Math.max(shelfH, rect.h)
    }

    let finalW = maxW
    let finalH = shelfY + shelfH

    if (powerOfTwo) {
      finalW = nextPowerOfTwo(finalW)
      finalH = nextPowerOfTwo(finalH)
    }

    setAtlasSize({ w: finalW, h: finalH })
    setPacked(result)
  }, [sprites, padding, trim, powerOfTwo])

  useEffect(() => {
    if (packed && canvasRef.current) {
      const canvas = canvasRef.current
      canvas.width = atlasSize.w
      canvas.height = atlasSize.h
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, atlasSize.w, atlasSize.h)

      // Use putImageData for pixel-perfect atlas rendering (no blending, no smoothing, no alteration)
      const tmpCanvas = document.createElement('canvas')
      const tmpCtx = tmpCanvas.getContext('2d')!
      tmpCtx.imageSmoothingEnabled = false

      for (const p of packed) {
        const bounds = trim && p.entry.trimmed
          ? p.entry.trimmed
          : { x: 0, y: 0, w: p.entry.image.width, h: p.entry.image.height }

        // Extract exact source pixels at native resolution
        tmpCanvas.width = p.entry.image.width
        tmpCanvas.height = p.entry.image.height
        tmpCtx.imageSmoothingEnabled = false
        tmpCtx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height)
        tmpCtx.drawImage(p.entry.image, 0, 0)
        const srcData = tmpCtx.getImageData(bounds.x, bounds.y, bounds.w, bounds.h)

        // Place onto atlas using putImageData — exact pixel copy, no compositing
        ctx.putImageData(srcData, p.x, p.y)
      }
    }
  }, [packed, atlasSize, trim])

  const handleExport = async () => {
    if (!packed || !canvasRef.current) return
    const zip = new JSZip()

    // Atlas PNG
    const blob = await canvasToBlob(canvasRef.current)
    zip.file('atlas.png', blob)

    // JSON descriptor (compatible with Phaser / PixiJS)
    const frames: Record<string, object> = {}
    for (const p of packed) {
      const bounds = trim && p.entry.trimmed ? p.entry.trimmed : { x: 0, y: 0, w: p.entry.image.width, h: p.entry.image.height }
      frames[p.entry.name] = {
        frame: { x: p.x, y: p.y, w: p.w, h: p.h },
        rotated: false,
        trimmed: trim,
        spriteSourceSize: { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h },
        sourceSize: { w: p.entry.image.width, h: p.entry.image.height },
      }
    }
    const json = {
      frames,
      meta: {
        app: 'JET Atlas Pack',
        image: 'atlas.png',
        format: 'RGBA8888',
        size: { w: atlasSize.w, h: atlasSize.h },
        scale: '1',
      },
    }
    zip.file('atlas.json', JSON.stringify(json, null, 2))

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(zipBlob, 'atlas_pack.zip')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Atlas Pack</h2>
        <p className="text-sm text-zinc-500 mt-2">Pack sprites into an optimized texture atlas with JSON descriptor</p>
      </div>

      <FileDropzone onFiles={handleFiles} accept="image/*" multiple label="Drop sprite images here" description="Multiple PNGs to pack into an atlas" />

      {sprites.length > 0 && (
        <>
          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-zinc-700">{sprites.length} sprites</p>
              <button onClick={() => { setSprites([]); setPacked(null) }}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                <Trash2 size={12} /> Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {sprites.map((s) => (
                <img key={s.id} src={s.image.src} alt={s.name}
                  className="w-10 h-10 object-contain bg-zinc-100 rounded border border-zinc-200"
                  style={{ imageRendering: 'pixelated' }} />
              ))}
            </div>
          </div>

          <div className="flex gap-4 flex-wrap items-end">
            <label className="space-y-1">
              <span className="text-xs font-medium text-zinc-600">Padding (px)</span>
              <input type="number" min={0} max={16} value={padding}
                onChange={(e) => { setPadding(Math.max(0, +e.target.value)); setPacked(null) }}
                className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={trim} onChange={(e) => { setTrim(e.target.checked); setPacked(null) }}
                className="accent-blue-600 rounded" />
              <span className="text-xs font-medium text-zinc-600">Trim transparent</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={powerOfTwo} onChange={(e) => { setPowerOfTwo(e.target.checked); setPacked(null) }}
                className="accent-blue-600 rounded" />
              <span className="text-xs font-medium text-zinc-600">Power of 2</span>
            </label>
            <Button onClick={packSprites}>Pack Atlas</Button>
          </div>

          {packed && (
            <PreviewCanvas
              label={`Atlas (${atlasSize.w}x${atlasSize.h})`}
              maxHeight={500}
              minHeight={200}
              actions={<Button onClick={handleExport} size="sm"><Download size={12} /> Export ZIP</Button>}
            >
              <canvas ref={canvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
            </PreviewCanvas>
          )}
        </>
      )}
    </div>
  )
}

function nextPowerOfTwo(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}
