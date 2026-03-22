import { useState, useRef, useEffect } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Download, Loader2 } from 'lucide-react'
import { fileToDataURL, loadImage, downloadBlob } from '../../lib/utils'
import { PreviewCanvas } from '../../components/ui/PreviewCanvas'
import { applyDithering, type DitheringAlgorithm, type PaletteColor } from './algorithms'
import { PALETTE_PRESETS, hexToRgb } from '../palette-editor/presets'

const ALGORITHMS: { value: DitheringAlgorithm; label: string }[] = [
  { value: 'floyd-steinberg', label: 'Floyd-Steinberg' },
  { value: 'atkinson', label: 'Atkinson' },
  { value: 'sierra', label: 'Sierra' },
  { value: 'ordered-2x2', label: 'Ordered 2x2' },
  { value: 'ordered-4x4', label: 'Ordered 4x4' },
  { value: 'ordered-8x8', label: 'Ordered 8x8' },
]

export function DitheringPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Image Dithering</h2>
        <p className="text-sm text-zinc-500 mt-2">Apply dithering algorithms with palette constraints</p>
      </div>
      <DitheringContent />
    </div>
  )
}

export function DitheringContent() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [algorithm, setAlgorithm] = useState<DitheringAlgorithm>('floyd-steinberg')
  const [presetName, setPresetName] = useState('PICO-8')
  const [processing, setProcessing] = useState(false)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const origCanvasRef = useRef<HTMLCanvasElement>(null)
  const resultCanvasRef = useRef<HTMLCanvasElement>(null)

  const handleFiles = async (files: File[]) => {
    const url = await fileToDataURL(files[0])
    const img = await loadImage(url)
    setImage(img)
    setResultBlob(null)
  }

  // Draw original image
  useEffect(() => {
    if (!image || !origCanvasRef.current) return
    const canvas = origCanvasRef.current
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(image, 0, 0)
  }, [image])

  // Apply dithering whenever settings change
  useEffect(() => {
    if (!image) return
    setProcessing(true)

    // Use requestAnimationFrame to avoid blocking UI
    requestAnimationFrame(() => {
      const preset = PALETTE_PRESETS.find((p) => p.name === presetName)
      if (!preset) return

      const palette: PaletteColor[] = preset.colors.map(hexToRgb)

      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = image.width
      tempCanvas.height = image.height
      const ctx = tempCanvas.getContext('2d')!
      ctx.drawImage(image, 0, 0)
      const srcData = ctx.getImageData(0, 0, image.width, image.height)

      const result = applyDithering(srcData, algorithm, palette)

      if (resultCanvasRef.current) {
        const rCanvas = resultCanvasRef.current
        rCanvas.width = image.width
        rCanvas.height = image.height
        const rCtx = rCanvas.getContext('2d')!
        rCtx.putImageData(result, 0, 0)

        rCanvas.toBlob((blob) => {
          if (blob) setResultBlob(blob)
          setProcessing(false)
        })
      }
    })
  }, [image, algorithm, presetName])

  const handleDownload = () => {
    if (resultBlob) downloadBlob(resultBlob, `dithered_${algorithm}.png`)
  }

  return (
    <div className="space-y-6">
      <FileDropzone onFiles={handleFiles} accept="image/*" label="Drop an image to dither" />

      {image && (
        <div className="grid grid-cols-[1fr_260px] gap-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <PreviewCanvas label="Original" maxHeight={280} minHeight={100}>
                <canvas ref={origCanvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
              </PreviewCanvas>

              <PreviewCanvas
                label="Dithered"
                maxHeight={280}
                minHeight={100}
                actions={processing ? <Loader2 size={14} className="animate-spin text-zinc-400" /> : undefined}
              >
                <canvas ref={resultCanvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
              </PreviewCanvas>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Algorithm</p>
              <Select
                label=""
                options={ALGORITHMS}
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as DitheringAlgorithm)}
              />
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Palette</p>
              <Select
                label=""
                options={PALETTE_PRESETS.map((p) => ({ value: p.name, label: p.name }))}
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {PALETTE_PRESETS.find((p) => p.name === presetName)?.colors.map((c, i) => (
                  <div key={i} className="w-5 h-5 rounded border border-zinc-300" style={{ backgroundColor: c }} title={c} />
                ))}
              </div>
            </div>

            <Button onClick={handleDownload} disabled={!resultBlob || processing} className="w-full">
              <Download size={16} /> Download PNG
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
