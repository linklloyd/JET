import { useState, useRef, useEffect } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Download } from 'lucide-react'
import { fileToDataURL, loadImage, downloadBlob, canvasToBlob } from '../../lib/utils'
import JSZip from 'jszip'

const DEFAULT_CHARS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'

export function FontPackPage() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [cols, setCols] = useState(16)
  const [rows, setRows] = useState(6)
  const [chars, setChars] = useState(DEFAULT_CHARS)
  const [padding, setPadding] = useState(1)
  const [fontName, setFontName] = useState('pixel_font')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFiles = async (files: File[]) => {
    const url = await fileToDataURL(files[0])
    const img = await loadImage(url)
    setImage(img)
  }

  const charW = image ? Math.floor(image.width / cols) : 0
  const charH = image ? Math.floor(image.height / rows) : 0

  useEffect(() => {
    if (!image || !canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(image, 0, 0)
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 2])
    for (let c = 1; c < cols; c++) {
      ctx.beginPath(); ctx.moveTo(c * charW, 0); ctx.lineTo(c * charW, image.height); ctx.stroke()
    }
    for (let r = 1; r < rows; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * charH); ctx.lineTo(image.width, r * charH); ctx.stroke()
    }
  }, [image, cols, rows, charW, charH])

  const handleExport = async () => {
    if (!image) return
    const zip = new JSZip()

    // Measure each glyph width by scanning for non-transparent pixels
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = image.width
    tempCanvas.height = image.height
    const tempCtx = tempCanvas.getContext('2d')!
    tempCtx.drawImage(image, 0, 0)
    const imgData = tempCtx.getImageData(0, 0, image.width, image.height).data

    // Pack glyphs into atlas with trimmed widths
    const glyphs: { char: string; srcX: number; srcY: number; w: number; h: number; xOffset: number }[] = []

    for (let i = 0; i < chars.length && i < cols * rows; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const sx = col * charW
      const sy = row * charH

      // Find actual glyph width
      let minX = charW, maxX = 0
      for (let y = sy; y < sy + charH; y++) {
        for (let x = sx; x < sx + charW; x++) {
          if (imgData[(y * image.width + x) * 4 + 3] > 0) {
            minX = Math.min(minX, x - sx)
            maxX = Math.max(maxX, x - sx)
          }
        }
      }

      const actualW = maxX >= minX ? maxX - minX + 1 : charW
      const xOff = maxX >= minX ? minX : 0

      glyphs.push({ char: chars[i], srcX: sx + xOff, srcY: sy, w: actualW, h: charH, xOffset: xOff })
    }

    // Build packed atlas
    let atlasX = 0
    let atlasW = 0
    const placements = glyphs.map((g) => {
      const x = atlasX
      atlasX += g.w + padding
      atlasW = atlasX
      return { ...g, atlasX: x, atlasY: 0 }
    })

    const atlasCanvas = document.createElement('canvas')
    atlasCanvas.width = atlasW
    atlasCanvas.height = charH
    const atlasCtx = atlasCanvas.getContext('2d')!

    for (const p of placements) {
      atlasCtx.drawImage(image, p.srcX, p.srcY, p.w, p.h, p.atlasX, 0, p.w, p.h)
    }

    const atlasBlob = await canvasToBlob(atlasCanvas)
    zip.file(`${fontName}.png`, atlasBlob)

    // Generate BMFont descriptor
    let bmfont = `info face="${fontName}" size=${charH} bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=0 aa=1 padding=0,0,0,0 spacing=${padding},0\n`
    bmfont += `common lineHeight=${charH} base=${charH} scaleW=${atlasW} scaleH=${charH} pages=1 packed=0\n`
    bmfont += `page id=0 file="${fontName}.png"\n`
    bmfont += `chars count=${placements.length}\n`

    for (const p of placements) {
      const charId = p.char.charCodeAt(0)
      bmfont += `char id=${charId} x=${p.atlasX} y=${p.atlasY} width=${p.w} height=${p.h} xoffset=${p.xOffset} yoffset=0 xadvance=${p.w + padding} page=0 chnl=0\n`
    }

    zip.file(`${fontName}.fnt`, bmfont)

    // Also export JSON version
    const jsonFont = {
      font: fontName,
      size: charH,
      lineHeight: charH,
      atlas: `${fontName}.png`,
      atlasSize: { w: atlasW, h: charH },
      glyphs: placements.map((p) => ({
        char: p.char,
        id: p.char.charCodeAt(0),
        x: p.atlasX,
        y: p.atlasY,
        width: p.w,
        height: p.h,
        xOffset: p.xOffset,
        xAdvance: p.w + padding,
      })),
    }
    zip.file(`${fontName}.json`, JSON.stringify(jsonFont, null, 2))

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(zipBlob, `${fontName}_pack.zip`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Font Pack</h2>
        <p className="text-sm text-zinc-500 mt-2">Convert a bitmap font grid into a packed atlas with BMFont descriptor</p>
      </div>

      <FileDropzone onFiles={handleFiles} accept="image/*" label="Drop your bitmap font image" description="A grid of character glyphs" />

      {image && (
        <div className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
            <div className="flex gap-4 flex-wrap">
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-600">Columns</span>
                <input type="number" min={1} max={64} value={cols}
                  onChange={(e) => setCols(Math.max(1, +e.target.value))}
                  className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-600">Rows</span>
                <input type="number" min={1} max={64} value={rows}
                  onChange={(e) => setRows(Math.max(1, +e.target.value))}
                  className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-600">Padding</span>
                <input type="number" min={0} max={16} value={padding}
                  onChange={(e) => setPadding(Math.max(0, +e.target.value))}
                  className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-600">Font Name</span>
                <input type="text" value={fontName}
                  onChange={(e) => setFontName(e.target.value || 'font')}
                  className="w-32 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
              </label>
            </div>
            <label className="space-y-1">
              <span className="text-xs font-medium text-zinc-600">Characters (in grid order)</span>
              <input type="text" value={chars} onChange={(e) => setChars(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-mono" />
            </label>
            <p className="text-xs text-zinc-500">{chars.length} chars | {charW}x{charH}px per glyph</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-zinc-500">Font Grid Preview</p>
              <Button onClick={handleExport} size="sm"><Download size={12} /> Export ZIP</Button>
            </div>
            <div className="overflow-auto max-h-64 bg-zinc-100 rounded p-2">
              <canvas ref={canvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
