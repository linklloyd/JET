import { useState, useRef, useEffect } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Slider } from '../../components/ui/Slider'
import { Select } from '../../components/ui/Select'
import { Download, Plus, Trash2, Copy, ArrowRight } from 'lucide-react'
import { fileToDataURL, loadImage, downloadBlob } from '../../lib/utils'
import { PreviewCanvas } from '../../components/ui/PreviewCanvas'
import { PALETTE_PRESETS, hexToRgb, rgbToHex, type PalettePreset } from './presets'

type Mode = 'editor' | 'swapper'

interface ColorMapping {
  from: string
  to: string
}

export function PaletteEditorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Palette Editor</h2>
        <p className="text-sm text-zinc-500 mt-2">Create palettes or swap colors in images</p>
      </div>
      <PaletteEditorContent />
    </div>
  )
}

export function PaletteEditorContent() {
  const [mode, setMode] = useState<Mode>('editor')

  // Editor state
  const [paletteName, setPaletteName] = useState('My Palette')
  const [colors, setColors] = useState<string[]>(['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff'])
  const [newColor, setNewColor] = useState('#888888')

  // Swapper state
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [, setExtractedColors] = useState<string[]>([])
  const [mappings, setMappings] = useState<ColorMapping[]>([])
  const [tolerance, setTolerance] = useState(30)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const origCanvasRef = useRef<HTMLCanvasElement>(null)
  const resultCanvasRef = useRef<HTMLCanvasElement>(null)

  const addColor = () => {
    if (!colors.includes(newColor)) {
      setColors([...colors, newColor])
    }
  }

  const removeColor = (idx: number) => {
    setColors(colors.filter((_, i) => i !== idx))
  }

  const loadPreset = (preset: PalettePreset) => {
    setPaletteName(preset.name)
    setColors([...preset.colors])
  }

  const exportGpl = () => {
    let gpl = `GIMP Palette\nName: ${paletteName}\nColumns: ${Math.min(colors.length, 8)}\n#\n`
    colors.forEach((hex) => {
      const { r, g, b } = hexToRgb(hex)
      gpl += `${r.toString().padStart(3)} ${g.toString().padStart(3)} ${b.toString().padStart(3)}\t${hex}\n`
    })
    downloadBlob(new Blob([gpl], { type: 'text/plain' }), `${paletteName}.gpl`)
  }

  const exportHex = () => {
    const text = colors.join('\n')
    downloadBlob(new Blob([text], { type: 'text/plain' }), `${paletteName}.hex`)
  }

  const exportPng = () => {
    const swatchSize = 32
    const cols = Math.min(colors.length, 8)
    const rows = Math.ceil(colors.length / cols)
    const canvas = document.createElement('canvas')
    canvas.width = cols * swatchSize
    canvas.height = rows * swatchSize
    const ctx = canvas.getContext('2d')!
    colors.forEach((hex, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      ctx.fillStyle = hex
      ctx.fillRect(col * swatchSize, row * swatchSize, swatchSize, swatchSize)
    })
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${paletteName}.png`)
    })
  }

  const copyAll = () => {
    navigator.clipboard.writeText(colors.join(', '))
  }

  // Swapper: handle file
  const handleSwapperFiles = async (files: File[]) => {
    const url = await fileToDataURL(files[0])
    const img = await loadImage(url)
    setImage(img)
    setResultBlob(null)

    // Extract palette
    const canvas = document.createElement('canvas')
    const maxDim = 256
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data

    const colorMap = new Map<string, number>()
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue
      const r = Math.round(data[i] / 8) * 8
      const g = Math.round(data[i + 1] / 8) * 8
      const b = Math.round(data[i + 2] / 8) * 8
      const key = rgbToHex(r, g, b)
      colorMap.set(key, (colorMap.get(key) || 0) + 1)
    }

    const sorted = [...colorMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([hex]) => hex)
    setExtractedColors(sorted)
    setMappings(sorted.map((c) => ({ from: c, to: c })))
  }

  // Draw original
  useEffect(() => {
    if (!image || !origCanvasRef.current) return
    const canvas = origCanvasRef.current
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(image, 0, 0)
  }, [image])

  const applySwap = () => {
    if (!image || !resultCanvasRef.current) return
    const canvas = resultCanvasRef.current
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(image, 0, 0)
    const imgData = ctx.getImageData(0, 0, image.width, image.height)
    const d = imgData.data
    const tol = tolerance * tolerance

    const activeMappings = mappings.filter((m) => m.from !== m.to)
    const parsedMappings = activeMappings.map((m) => ({
      from: hexToRgb(m.from),
      to: hexToRgb(m.to),
    }))

    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue
      for (const { from, to } of parsedMappings) {
        const dr = d[i] - from.r
        const dg = d[i + 1] - from.g
        const db = d[i + 2] - from.b
        if (dr * dr + dg * dg + db * db <= tol) {
          d[i] = to.r
          d[i + 1] = to.g
          d[i + 2] = to.b
          break
        }
      }
    }

    ctx.putImageData(imgData, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) setResultBlob(blob)
    })
  }

  const handleDownloadSwap = () => {
    if (resultBlob) downloadBlob(resultBlob, 'swapped.png')
  }

  return (
    <div className="space-y-6">
      {/* Mode tabs */}
      <div className="flex gap-1 bg-zinc-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setMode('editor')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'editor' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          Editor
        </button>
        <button
          onClick={() => setMode('swapper')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'swapper' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          Swapper
        </button>
      </div>

      {mode === 'editor' && (
        <div className="grid grid-cols-[1fr_260px] gap-6">
          <div className="space-y-4">
            {/* Palette display */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <input
                  value={paletteName}
                  onChange={(e) => setPaletteName(e.target.value)}
                  className="text-sm font-semibold text-zinc-800 border-b border-transparent hover:border-zinc-300 focus:border-blue-500 focus:outline-none px-1 py-0.5"
                />
                <span className="text-xs text-zinc-400">{colors.length} colors</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {colors.map((hex, i) => (
                  <div key={i} className="group relative">
                    <div
                      className="w-10 h-10 rounded-lg border border-zinc-300 cursor-pointer"
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                    <button
                      onClick={() => removeColor(i)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] hidden group-hover:flex items-center justify-center"
                    >
                      <Trash2 size={8} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add color */}
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-8 h-8 rounded border border-zinc-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-mono"
                />
                <Button size="sm" onClick={addColor}>
                  <Plus size={14} /> Add
                </Button>
              </div>
            </div>

            {/* Export */}
            <div className="flex gap-2">
              <Button onClick={exportPng} size="sm" variant="secondary"><Download size={12} /> PNG</Button>
              <Button onClick={exportGpl} size="sm" variant="secondary"><Download size={12} /> GPL</Button>
              <Button onClick={exportHex} size="sm" variant="secondary"><Download size={12} /> HEX</Button>
              <Button onClick={copyAll} size="sm" variant="secondary"><Copy size={12} /> Copy All</Button>
            </div>
          </div>

          {/* Presets sidebar */}
          <div className="space-y-4">
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Presets</p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {PALETTE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => loadPreset(preset)}
                    className="w-full text-left px-2 py-2 rounded-lg hover:bg-zinc-50 transition-colors"
                  >
                    <p className="text-xs font-medium text-zinc-700 mb-1">{preset.name}</p>
                    <div className="flex flex-wrap gap-0.5">
                      {preset.colors.slice(0, 16).map((c, i) => (
                        <div key={i} className="w-4 h-4 rounded-sm border border-zinc-200" style={{ backgroundColor: c }} />
                      ))}
                      {preset.colors.length > 16 && (
                        <span className="text-[10px] text-zinc-400 self-center ml-1">+{preset.colors.length - 16}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === 'swapper' && (
        <>
          <FileDropzone onFiles={handleSwapperFiles} accept="image/*" label="Drop an image to swap colors" />

          {image && (
            <div className="grid grid-cols-[1fr_300px] gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <PreviewCanvas label="Original" maxHeight={260} minHeight={100}>
                    <canvas ref={origCanvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
                  </PreviewCanvas>
                  <PreviewCanvas label="Swapped" maxHeight={260} minHeight={100}>
                    <canvas ref={resultCanvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
                  </PreviewCanvas>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Color Mappings</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {mappings.map((m, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded border border-zinc-300" style={{ backgroundColor: m.from }} />
                        <ArrowRight size={12} className="text-zinc-400 shrink-0" />
                        <input
                          type="color"
                          value={m.to}
                          onChange={(e) => {
                            const next = [...mappings]
                            next[i] = { ...next[i], to: e.target.value }
                            setMappings(next)
                          }}
                          className="w-6 h-6 rounded border border-zinc-300 cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-zinc-500 flex-1">{m.from}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
                  <Slider
                    label="Tolerance"
                    displayValue={String(tolerance)}
                    min={0} max={100} value={tolerance}
                    onChange={(e) => setTolerance(+(e.target as HTMLInputElement).value)}
                  />
                </div>

                <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Load Preset Target</p>
                  <Select
                    label=""
                    options={PALETTE_PRESETS.map((p) => ({ value: p.name, label: p.name }))}
                    value=""
                    onChange={(e) => {
                      const preset = PALETTE_PRESETS.find((p) => p.name === e.target.value)
                      if (!preset) return
                      const next = mappings.map((m, i) => ({
                        ...m,
                        to: preset.colors[i % preset.colors.length],
                      }))
                      setMappings(next)
                    }}
                  />
                </div>

                <Button onClick={applySwap} className="w-full">Apply Swap</Button>
                <Button onClick={handleDownloadSwap} disabled={!resultBlob} variant="secondary" className="w-full">
                  <Download size={16} /> Download
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
