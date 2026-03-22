import { useState, useRef } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Copy } from 'lucide-react'
import { fileToDataURL, loadImage, downloadBlob } from '../../lib/utils'
import { PreviewCanvas } from '../../components/ui/PreviewCanvas'

interface ColorInfo {
  hex: string
  rgb: [number, number, number]
  count: number
  percent: number
}

export function ColorExtractorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Color Extractor</h2>
        <p className="text-sm text-zinc-500 mt-2">Extract color palettes from images. Click on the image to pick colors.</p>
      </div>
      <ColorExtractorContent />
    </div>
  )
}

export function ColorExtractorContent() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [palette, setPalette] = useState<ColorInfo[]>([])
  const [paletteSize, setPaletteSize] = useState(16)
  const [pickedColor, setPickedColor] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFiles = async (files: File[]) => {
    const url = await fileToDataURL(files[0])
    const img = await loadImage(url)
    setImage(img)
    extractPalette(img, paletteSize)
  }

  const extractPalette = (img: HTMLImageElement, size: number) => {
    const canvas = document.createElement('canvas')
    const maxDim = 256
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data

    // Count colors using median cut approximation
    const colorMap = new Map<string, number>()
    const totalPixels = canvas.width * canvas.height

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue // skip transparent
      // Quantize to reduce color space
      const r = Math.round(data[i] / 8) * 8
      const g = Math.round(data[i + 1] / 8) * 8
      const b = Math.round(data[i + 2] / 8) * 8
      const key = `${r},${g},${b}`
      colorMap.set(key, (colorMap.get(key) || 0) + 1)
    }

    // Sort by frequency
    const sorted = [...colorMap.entries()]
      .sort((a, b) => b[1] - a[1])

    // Merge similar colors
    const merged: ColorInfo[] = []
    const used = new Set<number>()

    for (let i = 0; i < sorted.length && merged.length < size; i++) {
      if (used.has(i)) continue
      const [key, count] = sorted[i]
      const [r, g, b] = key.split(',').map(Number)

      let totalR = r * count
      let totalG = g * count
      let totalB = b * count
      let totalCount = count

      for (let j = i + 1; j < sorted.length; j++) {
        if (used.has(j)) continue
        const [key2, count2] = sorted[j]
        const [r2, g2, b2] = key2.split(',').map(Number)
        const dist = Math.sqrt((r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2)
        if (dist < 30) {
          totalR += r2 * count2
          totalG += g2 * count2
          totalB += b2 * count2
          totalCount += count2
          used.add(j)
        }
      }

      const avgR = Math.round(totalR / totalCount)
      const avgG = Math.round(totalG / totalCount)
      const avgB = Math.round(totalB / totalCount)

      merged.push({
        hex: rgbToHex(avgR, avgG, avgB),
        rgb: [avgR, avgG, avgB],
        count: totalCount,
        percent: Math.round((totalCount / totalPixels) * 100 * 10) / 10,
      })
      used.add(i)
    }

    setPalette(merged)
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    const x = Math.floor((e.clientX - rect.left) * scaleX)
    const y = Math.floor((e.clientY - rect.top) * scaleY)
    const ctx = canvasRef.current.getContext('2d')!
    const pixel = ctx.getImageData(x, y, 1, 1).data
    setPickedColor(rgbToHex(pixel[0], pixel[1], pixel[2]))
  }

  const drawCanvas = () => {
    if (!image || !canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(image, 0, 0)
  }

  // Draw when image changes
  if (image && canvasRef.current && canvasRef.current.width !== image.width) {
    drawCanvas()
  }

  const copyColor = (hex: string) => {
    navigator.clipboard.writeText(hex)
    setCopied(hex)
    setTimeout(() => setCopied(null), 1500)
  }

  const handleExportPalette = () => {
    // Export as GPL (GIMP palette)
    let gpl = `GIMP Palette\nName: Extracted Palette\nColumns: ${Math.min(palette.length, 8)}\n#\n`
    palette.forEach((c) => {
      gpl += `${c.rgb[0].toString().padStart(3)} ${c.rgb[1].toString().padStart(3)} ${c.rgb[2].toString().padStart(3)}\t${c.hex}\n`
    })
    downloadBlob(new Blob([gpl], { type: 'text/plain' }), 'palette.gpl')
  }

  const handleExportPng = () => {
    const swatchSize = 32
    const cols = Math.min(palette.length, 8)
    const rows = Math.ceil(palette.length / cols)
    const canvas = document.createElement('canvas')
    canvas.width = cols * swatchSize
    canvas.height = rows * swatchSize
    const ctx = canvas.getContext('2d')!
    palette.forEach((c, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      ctx.fillStyle = c.hex
      ctx.fillRect(col * swatchSize, row * swatchSize, swatchSize, swatchSize)
    })
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, 'palette.png')
    })
  }

  const handleSizeChange = (newSize: number) => {
    setPaletteSize(newSize)
    if (image) extractPalette(image, newSize)
  }

  return (
    <div className="space-y-6">
      <FileDropzone onFiles={handleFiles} accept="image/*" label="Drop an image to extract colors" />

      {image && (
        <div className="grid grid-cols-[1fr_280px] gap-6">
          <div className="space-y-4">
            <PreviewCanvas label="Click to pick a color" maxHeight={320} minHeight={120}>
              <canvas ref={canvasRef} onClick={handleCanvasClick}
                className="max-w-full cursor-crosshair" style={{ imageRendering: 'pixelated' }} />
            </PreviewCanvas>

            {pickedColor && (
              <div className="bg-white border border-zinc-200 rounded-lg p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg border border-zinc-300" style={{ backgroundColor: pickedColor }} />
                <div>
                  <p className="text-sm font-mono font-medium text-zinc-800">{pickedColor}</p>
                  <p className="text-xs text-zinc-500">Picked color</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => copyColor(pickedColor)}>
                  <Copy size={12} /> {copied === pickedColor ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Palette</p>
                <select
                  value={paletteSize}
                  onChange={(e) => handleSizeChange(+e.target.value)}
                  className="text-xs border border-zinc-200 rounded px-2 py-1"
                >
                  <option value={8}>8 colors</option>
                  <option value={16}>16 colors</option>
                  <option value={32}>32 colors</option>
                  <option value={64}>64 colors</option>
                </select>
              </div>

              <div className="space-y-1 max-h-80 overflow-y-auto">
                {palette.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => copyColor(c.hex)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-50 transition-colors group"
                  >
                    <div className="w-6 h-6 rounded border border-zinc-300 shrink-0" style={{ backgroundColor: c.hex }} />
                    <span className="text-xs font-mono text-zinc-700 flex-1 text-left">{c.hex}</span>
                    <span className="text-[10px] text-zinc-400">{c.percent}%</span>
                    <Copy size={10} className="text-zinc-300 group-hover:text-zinc-500" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleExportPng} size="sm" variant="secondary" className="flex-1">PNG</Button>
              <Button onClick={handleExportPalette} size="sm" variant="secondary" className="flex-1">GPL</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => Math.min(255, Math.max(0, c)).toString(16).padStart(2, '0')).join('')
}
