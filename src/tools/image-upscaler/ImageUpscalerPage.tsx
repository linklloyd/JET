import { useState, useRef, useEffect, useCallback } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Download, Loader2, Trash2, Package } from 'lucide-react'
import { downloadBlob, canvasToBlob, fileToDataURL, loadImage } from '../../lib/utils'
import { addHistory, makeThumbnail } from '../../lib/history'
import JSZip from 'jszip'

type NoiseReduction = 'none' | 'low' | 'medium' | 'high'
type UpscaleMethod = 'bilinear' | 'bicubic' | 'lanczos'

interface BatchItem {
  id: string
  file: File
  srcImage: HTMLImageElement
  resultBlob: Blob | null
  status: 'pending' | 'processing' | 'done' | 'error'
}

/* ─── Resampling kernels (unchanged) ─── */

function lanczosKernel(x: number, a: number): number {
  if (x === 0) return 1
  if (Math.abs(x) >= a) return 0
  const pix = Math.PI * x
  return (a * Math.sin(pix) * Math.sin(pix / a)) / (pix * pix)
}

function lanczosResample(src: ImageData, dstW: number, dstH: number): ImageData {
  const dst = new ImageData(dstW, dstH)
  const a = 3
  const xRatio = src.width / dstW
  const yRatio = src.height / dstH
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = (x + 0.5) * xRatio - 0.5
      const srcY = (y + 0.5) * yRatio - 0.5
      let r = 0, g = 0, b = 0, alpha = 0, wSum = 0
      for (let sy = Math.floor(srcY) - a + 1; sy <= Math.floor(srcY) + a; sy++) {
        for (let sx = Math.floor(srcX) - a + 1; sx <= Math.floor(srcX) + a; sx++) {
          const cx = Math.min(Math.max(sx, 0), src.width - 1)
          const cy = Math.min(Math.max(sy, 0), src.height - 1)
          const w = lanczosKernel(srcX - sx, a) * lanczosKernel(srcY - sy, a)
          const idx = (cy * src.width + cx) * 4
          r += src.data[idx] * w; g += src.data[idx + 1] * w
          b += src.data[idx + 2] * w; alpha += src.data[idx + 3] * w; wSum += w
        }
      }
      const di = (y * dstW + x) * 4
      dst.data[di] = Math.min(255, Math.max(0, Math.round(r / wSum)))
      dst.data[di + 1] = Math.min(255, Math.max(0, Math.round(g / wSum)))
      dst.data[di + 2] = Math.min(255, Math.max(0, Math.round(b / wSum)))
      dst.data[di + 3] = Math.min(255, Math.max(0, Math.round(alpha / wSum)))
    }
  }
  return dst
}

function bicubicKernel(x: number): number {
  const a = -0.5, abs = Math.abs(x)
  if (abs <= 1) return (a + 2) * abs * abs * abs - (a + 3) * abs * abs + 1
  if (abs < 2) return a * abs * abs * abs - 5 * a * abs * abs + 8 * a * abs - 4 * a
  return 0
}

function bicubicResample(src: ImageData, dstW: number, dstH: number): ImageData {
  const dst = new ImageData(dstW, dstH)
  const xRatio = src.width / dstW, yRatio = src.height / dstH
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = (x + 0.5) * xRatio - 0.5, srcY = (y + 0.5) * yRatio - 0.5
      let r = 0, g = 0, b = 0, alpha = 0, wSum = 0
      for (let sy = Math.floor(srcY) - 1; sy <= Math.floor(srcY) + 2; sy++) {
        for (let sx = Math.floor(srcX) - 1; sx <= Math.floor(srcX) + 2; sx++) {
          const cx = Math.min(Math.max(sx, 0), src.width - 1)
          const cy = Math.min(Math.max(sy, 0), src.height - 1)
          const w = bicubicKernel(srcX - sx) * bicubicKernel(srcY - sy)
          const idx = (cy * src.width + cx) * 4
          r += src.data[idx] * w; g += src.data[idx + 1] * w
          b += src.data[idx + 2] * w; alpha += src.data[idx + 3] * w; wSum += w
        }
      }
      const di = (y * dstW + x) * 4
      dst.data[di] = Math.min(255, Math.max(0, Math.round(r / wSum)))
      dst.data[di + 1] = Math.min(255, Math.max(0, Math.round(g / wSum)))
      dst.data[di + 2] = Math.min(255, Math.max(0, Math.round(b / wSum)))
      dst.data[di + 3] = Math.min(255, Math.max(0, Math.round(alpha / wSum)))
    }
  }
  return dst
}

function bilinearResample(src: ImageData, dstW: number, dstH: number): ImageData {
  const dst = new ImageData(dstW, dstH)
  const xRatio = src.width / dstW, yRatio = src.height / dstH
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = x * xRatio, srcY = y * yRatio
      const x0 = Math.floor(srcX), y0 = Math.floor(srcY)
      const x1 = Math.min(x0 + 1, src.width - 1), y1 = Math.min(y0 + 1, src.height - 1)
      const dx = srcX - x0, dy = srcY - y0
      for (let c = 0; c < 4; c++) {
        const v00 = src.data[(y0 * src.width + x0) * 4 + c]
        const v10 = src.data[(y0 * src.width + x1) * 4 + c]
        const v01 = src.data[(y1 * src.width + x0) * 4 + c]
        const v11 = src.data[(y1 * src.width + x1) * 4 + c]
        dst.data[(y * dstW + x) * 4 + c] = Math.round(
          v00 * (1 - dx) * (1 - dy) + v10 * dx * (1 - dy) + v01 * (1 - dx) * dy + v11 * dx * dy
        )
      }
    }
  }
  return dst
}

function applyDenoise(data: ImageData, strength: number): ImageData {
  if (strength === 0) return data
  const w = data.width, h = data.height
  const out = new ImageData(w, h)
  const radius = strength >= 3 ? 2 : 1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0, wt = 0
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const cx = Math.min(Math.max(x + dx, 0), w - 1)
          const cy = Math.min(Math.max(y + dy, 0), h - 1)
          const gw = Math.exp(-(dx * dx + dy * dy) / (2 * strength * strength))
          const idx = (cy * w + cx) * 4
          r += data.data[idx] * gw; g += data.data[idx + 1] * gw
          b += data.data[idx + 2] * gw; a += data.data[idx + 3] * gw; wt += gw
        }
      }
      const di = (y * w + x) * 4
      out.data[di] = Math.round(r / wt); out.data[di + 1] = Math.round(g / wt)
      out.data[di + 2] = Math.round(b / wt); out.data[di + 3] = Math.round(a / wt)
    }
  }
  return out
}

function applySharpen(data: ImageData, amount: number): ImageData {
  if (amount <= 0) return data
  const w = data.width, h = data.height
  const out = new ImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const di = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        const center = data.data[di + c]
        let neighbors = 0, count = 0
        for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = x + dx, ny = y + dy
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            neighbors += data.data[(ny * w + nx) * 4 + c]; count++
          }
        }
        out.data[di + c] = Math.min(255, Math.max(0, Math.round(center + amount * (center - neighbors / count))))
      }
      out.data[di + 3] = data.data[di + 3]
    }
  }
  return out
}

/* ─── Pure upscale function ─── */

async function upscaleImage(
  img: HTMLImageElement,
  method: UpscaleMethod,
  scale: number,
  noise: NoiseReduction,
  sharpenEnabled: boolean
): Promise<Blob> {
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = img.width
  srcCanvas.height = img.height
  const srcCtx = srcCanvas.getContext('2d')!
  srcCtx.drawImage(img, 0, 0)
  const srcData = srcCtx.getImageData(0, 0, img.width, img.height)

  const dstW = img.width * scale
  const dstH = img.height * scale

  let result: ImageData
  switch (method) {
    case 'bilinear': result = bilinearResample(srcData, dstW, dstH); break
    case 'bicubic': result = bicubicResample(srcData, dstW, dstH); break
    case 'lanczos': result = lanczosResample(srcData, dstW, dstH); break
  }

  const noiseStrength = { none: 0, low: 0.5, medium: 1, high: 2 }[noise]
  if (noiseStrength > 0) result = applyDenoise(result, noiseStrength)
  if (sharpenEnabled) result = applySharpen(result, 0.5)

  const dstCanvas = document.createElement('canvas')
  dstCanvas.width = result.width
  dstCanvas.height = result.height
  dstCanvas.getContext('2d')!.putImageData(result, 0, 0)
  return canvasToBlob(dstCanvas)
}

/* ─── Component ─── */

export function ImageUpscalerPage() {
  const [items, setItems] = useState<BatchItem[]>([])
  const [method, setMethod] = useState<UpscaleMethod>('lanczos')
  const [scale, setScale] = useState(2)
  const [noise, setNoise] = useState<NoiseReduction>('none')
  const [sharpen, setSharpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })

  // Single image preview refs
  const srcCanvasRef = useRef<HTMLCanvasElement>(null)
  const dstCanvasRef = useRef<HTMLCanvasElement>(null)

  const isBatch = items.length > 1
  const singleItem = items.length === 1 ? items[0] : null

  const handleFiles = useCallback(async (files: File[]) => {
    const newItems: BatchItem[] = []
    for (const f of files) {
      const url = await fileToDataURL(f)
      const img = await loadImage(url)
      newItems.push({ id: crypto.randomUUID(), file: f, srcImage: img, resultBlob: null, status: 'pending' })
    }
    setItems((prev) => [...prev, ...newItems])
  }, [])

  // Draw single image source preview
  useEffect(() => {
    if (!singleItem || !srcCanvasRef.current) return
    const canvas = srcCanvasRef.current
    canvas.width = singleItem.srcImage.width
    canvas.height = singleItem.srcImage.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(singleItem.srcImage, 0, 0)
  }, [singleItem])

  const updateItem = (id: string, update: Partial<BatchItem>) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...update } : item))
  }

  const handleUpscale = async () => {
    const pending = items.filter((i) => i.status !== 'done')
    if (!pending.length) return
    setProcessing(true)
    setBatchProgress({ current: 0, total: pending.length })

    for (let i = 0; i < pending.length; i++) {
      const item = pending[i]
      updateItem(item.id, { status: 'processing' })

      await new Promise((r) => setTimeout(r, 10)) // yield for UI

      try {
        const blob = await upscaleImage(item.srcImage, method, scale, noise, sharpen)
        updateItem(item.id, { status: 'done', resultBlob: blob })

        // For single image, draw to preview canvas
        if (!isBatch && dstCanvasRef.current) {
          const img = await loadImage(URL.createObjectURL(blob))
          const canvas = dstCanvasRef.current
          canvas.width = img.width
          canvas.height = img.height
          canvas.getContext('2d')!.drawImage(img, 0, 0)
        }

        // Add to history
        const thumb = await makeThumbnail(blob)
        addHistory({
          fileName: item.file.name.replace(/\.[^.]+$/, '') + `_${scale}x.png`,
          toolName: 'Image Upscaler',
          toolPath: '/image-upscaler',
          thumbnail: thumb,
        }, blob)
      } catch {
        updateItem(item.id, { status: 'error' })
      }

      setBatchProgress({ current: i + 1, total: pending.length })
    }

    setProcessing(false)
  }

  const handleDownloadSingle = async (item: BatchItem) => {
    if (!item.resultBlob) return
    const name = item.file.name.replace(/\.[^.]+$/, '') + `_${scale}x_${method}.png`
    downloadBlob(item.resultBlob, name)
  }

  const handleDownloadAll = async () => {
    const done = items.filter((i) => i.resultBlob)
    if (!done.length) return
    const zip = new JSZip()
    for (const item of done) {
      const name = item.file.name.replace(/\.[^.]+$/, '') + `_${scale}x.png`
      zip.file(name, item.resultBlob!)
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, 'upscaled_images.zip')
  }

  const handleDownloadSingleResult = async () => {
    if (!dstCanvasRef.current) return
    const blob = await canvasToBlob(dstCanvasRef.current)
    const baseName = singleItem?.file.name.replace(/\.[^.]+$/, '') ?? 'upscaled'
    downloadBlob(blob, `${baseName}_${scale}x_${method}.png`)
  }

  const doneCount = items.filter((i) => i.status === 'done').length
  const hasAnyResult = doneCount > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Image Upscaler</h2>
        <p className="text-sm text-zinc-500 mt-2">
          Upscale photos and illustrations with high-quality resampling algorithms.
          Inspired by <a href="https://github.com/nagadomi/waifu2x" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">waifu2x</a>.
        </p>
      </div>

      <FileDropzone
        onFiles={handleFiles}
        accept="image/*"
        multiple
        expanded={items.length === 0}
        label={items.length === 0 ? 'Drop your images here' : 'Drop more images'}
        description="PNG, JPG, WebP — drop multiple for batch processing"
      />

      {items.length > 0 && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-end gap-4 flex-wrap">
            <div className="w-44">
              <Select label="Method" options={[
                { value: 'lanczos', label: 'Lanczos (Best)' },
                { value: 'bicubic', label: 'Bicubic' },
                { value: 'bilinear', label: 'Bilinear' },
              ]} value={method} onChange={(e) => setMethod(e.target.value as UpscaleMethod)} />
            </div>
            <div className="w-28">
              <Select label="Scale" options={[
                { value: '2', label: '2x' },
                { value: '3', label: '3x' },
                { value: '4', label: '4x' },
              ]} value={String(scale)} onChange={(e) => setScale(Number(e.target.value))} />
            </div>
            <div className="w-36">
              <Select label="Noise Reduction" options={[
                { value: 'none', label: 'None' },
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ]} value={noise} onChange={(e) => setNoise(e.target.value as NoiseReduction)} />
            </div>
            <label className="flex items-center gap-2 pb-1 cursor-pointer">
              <input type="checkbox" checked={sharpen} onChange={(e) => setSharpen(e.target.checked)} className="rounded border-zinc-300 accent-blue-600" />
              <span className="text-sm text-zinc-700">Sharpen</span>
            </label>
            <Button onClick={handleUpscale} disabled={processing}>
              {processing ? (
                <><Loader2 size={16} className="animate-spin" /> {batchProgress.current}/{batchProgress.total}</>
              ) : (
                isBatch ? `Upscale All (${items.length})` : 'Upscale'
              )}
            </Button>
            {isBatch && hasAnyResult && (
              <Button onClick={handleDownloadAll} variant="secondary">
                <Package size={14} /> Download ZIP ({doneCount})
              </Button>
            )}
            <button onClick={() => setItems([])} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 pb-1">
              <Trash2 size={12} /> Clear
            </button>
          </div>

          {/* Batch progress bar */}
          {processing && isBatch && (
            <div className="w-full bg-zinc-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              />
            </div>
          )}

          {/* Batch mode: thumbnail grid */}
          {isBatch && (
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <p className="text-xs font-medium text-zinc-500 mb-3">{items.length} images</p>
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                {items.map((item) => (
                  <div key={item.id} className="relative group">
                    <img
                      src={item.srcImage.src}
                      alt={item.file.name}
                      className="w-full aspect-square object-cover bg-zinc-100 rounded-lg border border-zinc-200"
                    />
                    {/* Status overlay */}
                    {item.status === 'processing' && (
                      <div className="absolute inset-0 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <Loader2 size={16} className="animate-spin text-blue-600" />
                      </div>
                    )}
                    {item.status === 'done' && (
                      <div className="absolute inset-0 bg-green-500/10 rounded-lg flex items-center justify-center">
                        <span className="text-green-600 text-xs font-bold">Done</span>
                      </div>
                    )}
                    {item.status === 'error' && (
                      <div className="absolute inset-0 bg-red-500/10 rounded-lg flex items-center justify-center">
                        <span className="text-red-600 text-xs font-bold">Error</span>
                      </div>
                    )}
                    {/* Download button */}
                    {item.resultBlob && (
                      <button
                        onClick={() => handleDownloadSingle(item)}
                        className="absolute bottom-1 right-1 p-1 bg-white/90 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download size={10} />
                      </button>
                    )}
                    <p className="text-[9px] text-zinc-500 mt-1 truncate">{item.file.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Single mode: side-by-side preview */}
          {!isBatch && singleItem && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-zinc-200 rounded-lg p-4">
                <p className="text-xs font-medium text-zinc-500 mb-2">
                  Original ({singleItem.srcImage.width}x{singleItem.srcImage.height})
                </p>
                <div className="overflow-auto max-h-96 bg-zinc-100 rounded flex items-center justify-center p-2">
                  <canvas ref={srcCanvasRef} className="max-w-full" />
                </div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-zinc-500">
                    Result {singleItem.status === 'done' && `(${singleItem.srcImage.width * scale}x${singleItem.srcImage.height * scale})`}
                  </p>
                  {singleItem.status === 'done' && (
                    <Button onClick={handleDownloadSingleResult} size="sm" variant="secondary">
                      <Download size={12} /> Save
                    </Button>
                  )}
                </div>
                <div className="overflow-auto max-h-96 bg-zinc-100 rounded flex items-center justify-center p-2">
                  <canvas ref={dstCanvasRef} className={singleItem.status === 'done' ? 'max-w-full' : 'hidden'} />
                  {singleItem.status !== 'done' && (
                    <p className="text-xs text-zinc-400 py-8">Click Upscale to see result</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
