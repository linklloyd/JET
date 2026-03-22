import { useState, useRef, useEffect, useCallback } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Download, Trash2 } from 'lucide-react'
import { fileToDataURL, loadImage, downloadBlob, canvasToBlob } from '../../lib/utils'
import { PRESETS, generateAutotileset, exportAutotileMetadata, exportGodotTres, exportUnityRuleTileJson, type EnginePreset, type AutotileGroup } from '../../lib/autotile'

interface TileEntry {
  id: string
  image: HTMLImageElement
  name: string
}

export function TilesetGeneratorPage() {
  const [mode, setMode] = useState<'manual' | 'autotile'>('manual')

  // Manual mode state
  const [tiles, setTiles] = useState<TileEntry[]>([])
  const [tileSize, setTileSize] = useState(32)
  const [cols, setCols] = useState(8)
  const [padding, setPadding] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Autotile mode state
  const [preset, setPreset] = useState<EnginePreset>('godot')
  const [templateImage, setTemplateImage] = useState<HTMLImageElement | null>(null)
  const [autoTileSize, setAutoTileSize] = useState(32)
  const [autotileResult, setAutotileResult] = useState<{
    canvas: HTMLCanvasElement
    bitmaskMap: Record<number, number>
    tileCount: number
  } | null>(null)
  const templateCanvasRef = useRef<HTMLCanvasElement>(null)
  const autotileCanvasRef = useRef<HTMLCanvasElement>(null)

  const handleFiles = async (files: File[]) => {
    const entries: TileEntry[] = []
    for (const f of files) {
      const url = await fileToDataURL(f)
      const img = await loadImage(url)
      entries.push({ id: crypto.randomUUID(), image: img, name: f.name })
    }
    setTiles((prev) => [...prev, ...entries])
  }

  const removeTile = (id: string) => {
    setTiles((prev) => prev.filter((t) => t.id !== id))
  }

  const drawTileset = useCallback(() => {
    if (!tiles.length || !canvasRef.current) return
    const canvas = canvasRef.current
    const effectiveCols = Math.min(cols, tiles.length)
    const rows = Math.ceil(tiles.length / effectiveCols)

    canvas.width = effectiveCols * (tileSize + padding) - padding
    canvas.height = rows * (tileSize + padding) - padding
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    tiles.forEach((tile, i) => {
      const c = i % effectiveCols
      const r = Math.floor(i / effectiveCols)
      const x = c * (tileSize + padding)
      const y = r * (tileSize + padding)
      ctx.drawImage(tile.image, 0, 0, tile.image.width, tile.image.height, x, y, tileSize, tileSize)
    })
  }, [tiles, cols, tileSize, padding])

  useEffect(() => { drawTileset() }, [drawTileset])

  const handleDownload = async () => {
    if (!canvasRef.current) return
    const blob = await canvasToBlob(canvasRef.current)
    downloadBlob(blob, 'tileset.png')
  }

  const handleDownloadJSON = () => {
    const effectiveCols = Math.min(cols, tiles.length)
    const meta = {
      tileSize,
      columns: effectiveCols,
      rows: Math.ceil(tiles.length / effectiveCols),
      padding,
      tiles: tiles.map((t, i) => ({
        index: i,
        name: t.name,
        col: i % effectiveCols,
        row: Math.floor(i / effectiveCols),
      })),
    }
    const blob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' })
    downloadBlob(blob, 'tileset.json')
  }

  // ── Autotile handlers ──

  const handleTemplateFile = async (files: File[]) => {
    if (!files.length) return
    const url = await fileToDataURL(files[0])
    const img = await loadImage(url)
    setTemplateImage(img)
    setAutotileResult(null)
  }

  useEffect(() => {
    if (!templateImage || !templateCanvasRef.current) return
    const canvas = templateCanvasRef.current
    canvas.width = templateImage.width
    canvas.height = templateImage.height
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(templateImage, 0, 0)
  }, [templateImage])

  useEffect(() => {
    if (!autotileResult || !autotileCanvasRef.current) return
    const display = autotileCanvasRef.current
    const src = autotileResult.canvas
    display.width = src.width
    display.height = src.height
    const ctx = display.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, display.width, display.height)
    ctx.drawImage(src, 0, 0)
  }, [autotileResult])

  const handleGenerateAutotile = () => {
    if (!templateImage) return
    // Draw template onto an offscreen canvas for generateAutotileset
    const tmpCanvas = document.createElement('canvas')
    tmpCanvas.width = templateImage.width
    tmpCanvas.height = templateImage.height
    const tmpCtx = tmpCanvas.getContext('2d')!
    tmpCtx.imageSmoothingEnabled = false
    tmpCtx.drawImage(templateImage, 0, 0)

    const result = generateAutotileset(tmpCanvas, autoTileSize, preset)
    setAutotileResult(result)
  }

  const handleDownloadAutotilePNG = async () => {
    if (!autotileResult) return
    const blob = await canvasToBlob(autotileResult.canvas)
    downloadBlob(blob, `autotileset-${preset}.png`)
  }

  const handleDownloadAutotileMeta = () => {
    if (!autotileResult) return
    const group: AutotileGroup = {
      id: preset,
      name: PRESETS[preset].name,
      mode: PRESETS[preset].mode,
      startIndex: 0,
      tileCount: autotileResult.tileCount,
      bitmaskMap: autotileResult.bitmaskMap,
    }
    const json = exportAutotileMetadata([group])
    const blob = new Blob([json], { type: 'application/json' })
    downloadBlob(blob, `autotile-metadata-${preset}.json`)
  }

  const handleExportGodotTres = () => {
    if (!autotileResult) return
    const group: AutotileGroup = {
      id: 'godot',
      name: PRESETS.godot.name,
      mode: PRESETS.godot.mode,
      startIndex: 0,
      tileCount: autotileResult.tileCount,
      bitmaskMap: autotileResult.bitmaskMap,
    }
    const tres = exportGodotTres([group], autoTileSize)
    const blob = new Blob([tres], { type: 'text/plain' })
    downloadBlob(blob, 'tileset.tres')
  }

  const handleExportUnityJson = () => {
    if (!autotileResult) return
    const group: AutotileGroup = {
      id: 'unity',
      name: PRESETS.unity.name,
      mode: PRESETS.unity.mode,
      startIndex: 0,
      tileCount: autotileResult.tileCount,
      bitmaskMap: autotileResult.bitmaskMap,
    }
    const json = exportUnityRuleTileJson([group], autoTileSize)
    const blob = new Blob([json], { type: 'application/json' })
    downloadBlob(blob, `unity-ruletile-${preset}.json`)
  }

  const currentPreset = PRESETS[preset]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Tileset Generator</h2>
        <p className="text-sm text-zinc-500 mt-2">Arrange tile images into a tileset with metadata</p>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('manual')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'manual' ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Manual
        </button>
        <button
          onClick={() => setMode('autotile')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'autotile' ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Autotile
        </button>
      </div>

      {/* ── Manual Mode ── */}
      {mode === 'manual' && (
        <>
          <FileDropzone
            onFiles={handleFiles}
            accept="image/*"
            multiple
            label="Drop tile images here"
            description="Select multiple tile images to arrange into a tileset"
          />

          {tiles.length > 0 && (
            <>
              <div className="bg-white border border-zinc-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-zinc-700">{tiles.length} tiles loaded</p>
                  <button
                    onClick={() => setTiles([])}
                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {tiles.map((t) => (
                    <div key={t.id} className="relative group">
                      <img
                        src={t.image.src}
                        alt={t.name}
                        className="w-10 h-10 object-contain bg-zinc-100 rounded border border-zinc-200"
                        style={{ imageRendering: 'pixelated' }}
                      />
                      <button
                        onClick={() => removeTile(t.id)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] hidden group-hover:flex items-center justify-center"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 flex-wrap">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-600">Tile Size (px)</span>
                  <input
                    type="number" min={8} max={256} value={tileSize}
                    onChange={(e) => setTileSize(Math.max(8, Number(e.target.value)))}
                    className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-600">Columns</span>
                  <input
                    type="number" min={1} max={64} value={cols}
                    onChange={(e) => setCols(Math.max(1, Number(e.target.value)))}
                    className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-600">Padding (px)</span>
                  <input
                    type="number" min={0} max={32} value={padding}
                    onChange={(e) => setPadding(Math.max(0, Number(e.target.value)))}
                    className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                  />
                </label>
              </div>

              <div className="bg-white border border-zinc-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-zinc-500">Tileset Preview</p>
                  <div className="flex gap-2">
                    <Button onClick={handleDownloadJSON} size="sm" variant="secondary">
                      JSON Meta
                    </Button>
                    <Button onClick={handleDownload} size="sm">
                      <Download size={12} /> Download PNG
                    </Button>
                  </div>
                </div>
                <div className="overflow-auto max-h-96 bg-zinc-100 rounded p-2 flex items-center justify-center"
                  style={{ backgroundImage: 'repeating-conic-gradient(#d4d4d8 0% 25%, transparent 0% 50%)', backgroundSize: '16px 16px' }}>
                  <canvas ref={canvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Autotile Mode ── */}
      {mode === 'autotile' && (
        <>
          {/* Preset Selector */}
          <Select
            label="Engine Preset"
            value={preset}
            onChange={(e) => {
              setPreset(e.target.value as EnginePreset)
              setAutotileResult(null)
            }}
            options={Object.entries(PRESETS).map(([key, p]) => ({
              value: key,
              label: p.name,
            }))}
          />

          {/* Description */}
          <p className="text-sm text-zinc-500">{currentPreset.description}</p>

          {/* Template Guide */}
          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <p className="text-xs font-medium text-zinc-600 mb-2">Template Layout Guide</p>
            {preset === 'simple4dir' ? (
              <p className="text-sm text-zinc-500">Upload a single filled tile</p>
            ) : (
              <div className="inline-block border border-zinc-300 rounded overflow-hidden">
                <table className="text-xs text-zinc-600 border-collapse">
                  <tbody>
                    <tr>
                      <td className="border border-zinc-300 px-3 py-2 bg-zinc-50">Inner TL</td>
                      <td className="border border-zinc-300 px-3 py-2 bg-zinc-50">Inner TR</td>
                    </tr>
                    <tr>
                      <td className="border border-zinc-300 px-3 py-2 bg-zinc-50">Inner BL</td>
                      <td className="border border-zinc-300 px-3 py-2 bg-zinc-50">Inner BR</td>
                    </tr>
                    <tr>
                      <td className="border border-zinc-300 px-3 py-2 bg-zinc-50">Outer TL</td>
                      <td className="border border-zinc-300 px-3 py-2 bg-zinc-50">Outer TR</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Template Upload */}
          <FileDropzone
            onFiles={handleTemplateFile}
            accept="image/*"
            label="Drop template image here"
            description={preset === 'simple4dir'
              ? 'Upload a single filled tile image'
              : 'Upload a 2x3 sub-tile template image'}
          />

          {/* Tile Size Input */}
          <label className="space-y-1 inline-block">
            <span className="text-xs font-medium text-zinc-600">Tile Size (px)</span>
            <input
              type="number" min={8} max={256} value={autoTileSize}
              onChange={(e) => setAutoTileSize(Math.max(8, Math.min(256, Number(e.target.value))))}
              className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm block"
            />
          </label>

          {/* Template Preview */}
          {templateImage && (
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <p className="text-xs font-medium text-zinc-500 mb-2">Template Preview</p>
              <div className="inline-block bg-zinc-100 rounded p-2">
                <canvas
                  ref={templateCanvasRef}
                  className="max-w-full"
                  style={{ imageRendering: 'pixelated', maxHeight: '192px' }}
                />
              </div>
            </div>
          )}

          {/* Generate Button */}
          <Button onClick={handleGenerateAutotile} disabled={!templateImage}>
            Generate Autotileset
          </Button>

          {/* Output Preview */}
          {autotileResult && (
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-zinc-500">
                  Generated Tileset ({autotileResult.tileCount} tiles)
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={handleDownloadAutotileMeta} size="sm" variant="secondary">
                    Download Metadata JSON
                  </Button>
                  {preset === 'godot' && (
                    <Button onClick={handleExportGodotTres} size="sm" variant="secondary">
                      Export Godot .tres
                    </Button>
                  )}
                  {preset === 'unity' && (
                    <Button onClick={handleExportUnityJson} size="sm" variant="secondary">
                      Export Unity JSON
                    </Button>
                  )}
                  <Button onClick={handleDownloadAutotilePNG} size="sm">
                    <Download size={12} /> Download PNG
                  </Button>
                </div>
              </div>
              <div
                className="overflow-auto max-h-96 bg-zinc-100 rounded p-2 flex items-center justify-center"
                style={{
                  backgroundImage: 'repeating-conic-gradient(#d4d4d8 0% 25%, transparent 0% 50%)',
                  backgroundSize: '16px 16px',
                }}
              >
                <canvas ref={autotileCanvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
