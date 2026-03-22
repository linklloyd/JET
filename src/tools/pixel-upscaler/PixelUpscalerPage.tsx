import { useState, useRef, useEffect } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Download, Loader2 } from 'lucide-react'
import { downloadBlob, canvasToBlob, fileToDataURL, loadImage } from '../../lib/utils'
import { nearestNeighbor } from './algorithms/nearestNeighbor'
import { epxScale } from './algorithms/epx'
import { xbrScale } from './algorithms/xbr'

type Algorithm = 'nearest' | 'epx' | 'xbr'

export function PixelUpscalerPage() {
  const [file, setFile] = useState<File | null>(null)
  const [algorithm, setAlgorithm] = useState<Algorithm>('nearest')
  const [scale, setScale] = useState(2)
  const [processing, setProcessing] = useState(false)
  const [srcImage, setSrcImage] = useState<HTMLImageElement | null>(null)
  const srcCanvasRef = useRef<HTMLCanvasElement>(null)
  const dstCanvasRef = useRef<HTMLCanvasElement>(null)

  const handleFiles = async (files: File[]) => {
    const f = files[0]
    setFile(f)
    const url = await fileToDataURL(f)
    const img = await loadImage(url)
    setSrcImage(img)
  }

  useEffect(() => {
    if (!srcImage || !srcCanvasRef.current) return
    const canvas = srcCanvasRef.current
    canvas.width = srcImage.width
    canvas.height = srcImage.height
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(srcImage, 0, 0)
  }, [srcImage])

  const handleUpscale = async () => {
    if (!srcImage || !srcCanvasRef.current || !dstCanvasRef.current) return
    setProcessing(true)

    await new Promise((r) => setTimeout(r, 10))

    const srcCtx = srcCanvasRef.current.getContext('2d')!
    const srcData = srcCtx.getImageData(0, 0, srcImage.width, srcImage.height)

    let result: ImageData
    switch (algorithm) {
      case 'nearest':
        result = nearestNeighbor(srcData, scale)
        break
      case 'epx':
        result = epxScale(srcData, scale)
        break
      case 'xbr':
        result = xbrScale(srcData, scale)
        break
    }

    const dstCanvas = dstCanvasRef.current
    dstCanvas.width = result.width
    dstCanvas.height = result.height
    const dstCtx = dstCanvas.getContext('2d')!
    dstCtx.putImageData(result, 0, 0)
    setProcessing(false)
  }

  const handleDownload = async () => {
    if (!dstCanvasRef.current) return
    const blob = await canvasToBlob(dstCanvasRef.current)
    const baseName = file?.name.replace(/\.[^.]+$/, '') ?? 'upscaled'
    downloadBlob(blob, `${baseName}_${scale}x_${algorithm}.png`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Pixel Art Upscaler</h2>
        <p className="text-sm text-zinc-500 mt-2">Upscale pixel art with smart algorithms</p>
      </div>

      <FileDropzone
        onFiles={handleFiles}
        accept="image/*"
        expanded={!srcImage}
        label="Drop your pixel art here"
        description="PNG recommended for best results"
      />

      {srcImage && (
        <div className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="w-48">
              <Select
                label="Algorithm"
                options={[
                  { value: 'nearest', label: 'Nearest Neighbor' },
                  { value: 'epx', label: 'EPX / Scale2x' },
                  { value: 'xbr', label: 'xBR' },
                ]}
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as Algorithm)}
              />
            </div>
            <div className="w-32">
              <Select
                label="Scale"
                options={[
                  { value: '2', label: '2x' },
                  { value: '4', label: '4x' },
                ]}
                value={String(scale)}
                onChange={(e) => setScale(Number(e.target.value))}
              />
            </div>
            <Button onClick={handleUpscale} disabled={processing}>
              {processing ? (
                <><Loader2 size={16} className="animate-spin" /> Processing...</>
              ) : (
                'Upscale'
              )}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <p className="text-xs font-medium text-zinc-500 mb-2">
                Original ({srcImage.width}x{srcImage.height})
              </p>
              <div className="overflow-auto max-h-80 bg-zinc-100 rounded flex items-center justify-center p-2"
                style={{ imageRendering: 'pixelated' }}>
                <canvas ref={srcCanvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
              </div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-zinc-500">Result</p>
                <Button onClick={handleDownload} size="sm" variant="secondary">
                  <Download size={12} /> Save
                </Button>
              </div>
              <div className="overflow-auto max-h-80 bg-zinc-100 rounded flex items-center justify-center p-2"
                style={{ imageRendering: 'pixelated' }}>
                <canvas ref={dstCanvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
