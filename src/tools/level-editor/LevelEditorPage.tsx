import { useState, useRef, useEffect, useCallback } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Slider } from '../../components/ui/Slider'
import { Select } from '../../components/ui/Select'
import { Download, Upload, Plus, Trash2, Eye, EyeOff, Paintbrush, Eraser, PaintBucket, MousePointer, Grid3x3 } from 'lucide-react'
import { fileToDataURL, loadImage, downloadBlob, canvasToBlob } from '../../lib/utils'
import { type AutotileGroup, recalcAutotileRegion } from '../../lib/autotile'

type Tool = 'paint' | 'erase' | 'fill' | 'select' | 'autotile'

interface Layer {
  name: string
  tiles: number[][] // [row][col] = tile index (-1 = empty)
  autotileIds: (string | null)[][] // [row][col] = autotile group id or null
  visible: boolean
}

export function LevelEditorPage() {
  const [tilesetImage, setTilesetImage] = useState<HTMLImageElement | null>(null)
  const [tileSize, setTileSize] = useState(16)
  const [mapWidth, setMapWidth] = useState(20)
  const [mapHeight, setMapHeight] = useState(15)
  const [layers, setLayers] = useState<Layer[]>([])
  const [activeLayer, setActiveLayer] = useState(0)
  const [selectedTile, setSelectedTile] = useState(0)
  const [activeTool, setActiveTool] = useState<Tool>('paint')
  const [painting, setPainting] = useState(false)
  const [zoom, setZoom] = useState(2)
  const [autotileGroups, setAutotileGroups] = useState<AutotileGroup[]>([])
  const [activeAutotileGroup, setActiveAutotileGroup] = useState<string | null>(null)
  const mapCanvasRef = useRef<HTMLCanvasElement>(null)
  const tilesetCanvasRef = useRef<HTMLCanvasElement>(null)
  const autotileInputRef = useRef<HTMLInputElement>(null)

  // Tileset properties
  const tilesetCols = tilesetImage ? Math.floor(tilesetImage.width / tileSize) : 0
  const tilesetRows = tilesetImage ? Math.floor(tilesetImage.height / tileSize) : 0
  const totalTiles = tilesetCols * tilesetRows

  const handleTilesetFiles = async (files: File[]) => {
    const url = await fileToDataURL(files[0])
    const img = await loadImage(url)
    setTilesetImage(img)
    initLayers()
  }

  const initLayers = () => {
    setLayers([
      createLayer('Ground', mapWidth, mapHeight),
      createLayer('Walls', mapWidth, mapHeight),
      createLayer('Objects', mapWidth, mapHeight),
    ])
    setActiveLayer(0)
  }

  const createLayer = (name: string, w: number, h: number): Layer => ({
    name,
    tiles: Array.from({ length: h }, () => Array(w).fill(-1)),
    autotileIds: Array.from({ length: h }, () => Array(w).fill(null)),
    visible: true,
  })

  // Reinit when dimensions change
  useEffect(() => {
    if (!tilesetImage) return
    setLayers((prev) => {
      if (prev.length === 0) return prev
      return prev.map((layer) => {
        const newTiles = Array.from({ length: mapHeight }, (_, r) =>
          Array.from({ length: mapWidth }, (_, c) =>
            layer.tiles[r]?.[c] ?? -1
          )
        )
        const newAutoIds = Array.from({ length: mapHeight }, (_, r) =>
          Array.from({ length: mapWidth }, (_, c) =>
            layer.autotileIds[r]?.[c] ?? null
          )
        )
        return { ...layer, tiles: newTiles, autotileIds: newAutoIds }
      })
    })
  }, [mapWidth, mapHeight, tilesetImage])

  // Draw tileset palette
  useEffect(() => {
    if (!tilesetImage || !tilesetCanvasRef.current) return
    const canvas = tilesetCanvasRef.current
    canvas.width = tilesetImage.width
    canvas.height = tilesetImage.height
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(tilesetImage, 0, 0)

    // Highlight selected tile
    const col = selectedTile % tilesetCols
    const row = Math.floor(selectedTile / tilesetCols)
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.strokeRect(col * tileSize, row * tileSize, tileSize, tileSize)
  }, [tilesetImage, selectedTile, tileSize, tilesetCols])

  // Draw map
  const drawMap = useCallback(() => {
    if (!tilesetImage || !mapCanvasRef.current) return
    const canvas = mapCanvasRef.current
    const pw = mapWidth * tileSize * zoom
    const ph = mapHeight * tileSize * zoom
    canvas.width = pw
    canvas.height = ph
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    // Clear
    ctx.fillStyle = '#e4e4e7'
    ctx.fillRect(0, 0, pw, ph)

    // Draw layers bottom-up
    for (const layer of layers) {
      if (!layer.visible) continue
      for (let r = 0; r < mapHeight; r++) {
        for (let c = 0; c < mapWidth; c++) {
          const tileIdx = layer.tiles[r]?.[c]
          if (tileIdx == null || tileIdx < 0) continue
          const srcCol = tileIdx % tilesetCols
          const srcRow = Math.floor(tileIdx / tilesetCols)
          ctx.drawImage(
            tilesetImage,
            srcCol * tileSize, srcRow * tileSize, tileSize, tileSize,
            c * tileSize * zoom, r * tileSize * zoom, tileSize * zoom, tileSize * zoom
          )
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'
    ctx.lineWidth = 1
    for (let x = 0; x <= mapWidth; x++) {
      ctx.beginPath()
      ctx.moveTo(x * tileSize * zoom, 0)
      ctx.lineTo(x * tileSize * zoom, ph)
      ctx.stroke()
    }
    for (let y = 0; y <= mapHeight; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * tileSize * zoom)
      ctx.lineTo(pw, y * tileSize * zoom)
      ctx.stroke()
    }
  }, [tilesetImage, layers, mapWidth, mapHeight, tileSize, tilesetCols, zoom])

  useEffect(() => { drawMap() }, [drawMap])

  const getMapCell = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mapCanvasRef.current) return null
    const rect = mapCanvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const col = Math.floor(x / (tileSize * zoom))
    const row = Math.floor(y / (tileSize * zoom))
    if (col < 0 || col >= mapWidth || row < 0 || row >= mapHeight) return null
    return { col, row }
  }

  const updateLayer = (patch: Partial<Layer>) => {
    const next = [...layers]
    next[activeLayer] = { ...next[activeLayer], ...patch }
    setLayers(next)
  }

  const paintAutotile = (col: number, row: number) => {
    if (!activeAutotileGroup) return
    const group = autotileGroups.find(g => g.id === activeAutotileGroup)
    if (!group) return

    const layer = layers[activeLayer]
    if (!layer) return

    // Skip if already painted with same group
    if (layer.autotileIds[row][col] === activeAutotileGroup) return

    const newTiles = layer.tiles.map(r => [...r])
    const newAutoIds = layer.autotileIds.map(r => [...r])

    newAutoIds[row][col] = activeAutotileGroup
    recalcAutotileRegion(newTiles, newAutoIds, row, col, autotileGroups, mapWidth, mapHeight)

    updateLayer({ tiles: newTiles, autotileIds: newAutoIds })
  }

  const paintTile = (col: number, row: number) => {
    const layer = layers[activeLayer]
    if (!layer) return

    if (activeTool === 'autotile') {
      paintAutotile(col, row)
    } else if (activeTool === 'paint') {
      if (layer.tiles[row][col] === selectedTile) return
      const next = [...layers]
      const newTiles = next[activeLayer].tiles.map((r) => [...r])
      newTiles[row][col] = selectedTile
      next[activeLayer] = { ...next[activeLayer], tiles: newTiles }
      setLayers(next)
    } else if (activeTool === 'erase') {
      if (layer.tiles[row][col] === -1 && !layer.autotileIds[row][col]) return
      const next = [...layers]
      const newTiles = next[activeLayer].tiles.map((r) => [...r])
      const newAutoIds = next[activeLayer].autotileIds.map((r) => [...r])
      newTiles[row][col] = -1

      if (newAutoIds[row][col]) {
        newAutoIds[row][col] = null
        recalcAutotileRegion(newTiles, newAutoIds, row, col, autotileGroups, mapWidth, mapHeight)
      }

      next[activeLayer] = { ...next[activeLayer], tiles: newTiles, autotileIds: newAutoIds }
      setLayers(next)
    } else if (activeTool === 'fill') {
      floodFill(col, row)
    }
  }

  const floodFill = (startCol: number, startRow: number) => {
    const layer = layers[activeLayer]
    if (!layer) return

    if (activeTool === 'fill' && activeAutotileGroup) {
      // Autotile flood fill
      const group = autotileGroups.find(g => g.id === activeAutotileGroup)
      if (!group) return

      const targetAutoId = layer.autotileIds[startRow][startCol]
      if (targetAutoId === activeAutotileGroup) return

      const targetTile = layer.tiles[startRow][startCol]
      const newTiles = layer.tiles.map((r) => [...r])
      const newAutoIds = layer.autotileIds.map((r) => [...r])
      const stack: [number, number][] = [[startCol, startRow]]
      const visited = new Set<string>()
      const affected: [number, number][] = []

      while (stack.length > 0) {
        const [c, r] = stack.pop()!
        const key = `${c},${r}`
        if (visited.has(key)) continue
        if (c < 0 || c >= mapWidth || r < 0 || r >= mapHeight) continue
        // Match on both tile value and autotile group
        if (newAutoIds[r][c] !== targetAutoId) continue
        if (targetAutoId === null && newTiles[r][c] !== targetTile) continue

        visited.add(key)
        newAutoIds[r][c] = activeAutotileGroup
        affected.push([c, r])
        stack.push([c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1])
      }

      // Batch recalculate all affected cells and their neighbors
      for (const [c, r] of affected) {
        recalcAutotileRegion(newTiles, newAutoIds, r, c, autotileGroups, mapWidth, mapHeight)
      }

      const next = [...layers]
      next[activeLayer] = { ...next[activeLayer], tiles: newTiles, autotileIds: newAutoIds }
      setLayers(next)
      return
    }

    const target = layer.tiles[startRow][startCol]
    if (target === selectedTile) return

    const newTiles = layer.tiles.map((r) => [...r])
    const stack: [number, number][] = [[startCol, startRow]]
    const visited = new Set<string>()

    while (stack.length > 0) {
      const [c, r] = stack.pop()!
      const key = `${c},${r}`
      if (visited.has(key)) continue
      if (c < 0 || c >= mapWidth || r < 0 || r >= mapHeight) continue
      if (newTiles[r][c] !== target) continue

      visited.add(key)
      newTiles[r][c] = selectedTile
      stack.push([c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1])
    }

    const next = [...layers]
    next[activeLayer] = { ...next[activeLayer], tiles: newTiles }
    setLayers(next)
  }

  const handleMapMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cell = getMapCell(e)
    if (!cell) return
    setPainting(true)
    paintTile(cell.col, cell.row)
  }

  const handleMapMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!painting) return
    const cell = getMapCell(e)
    if (!cell) return
    if (activeTool === 'fill') return // don't flood fill on drag
    paintTile(cell.col, cell.row)
  }

  const handleMapMouseUp = () => setPainting(false)

  const handleTilesetClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!tilesetCanvasRef.current) return
    const rect = tilesetCanvasRef.current.getBoundingClientRect()
    const scaleX = tilesetCanvasRef.current.width / rect.width
    const scaleY = tilesetCanvasRef.current.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    const col = Math.floor(x / tileSize)
    const row = Math.floor(y / tileSize)
    const idx = row * tilesetCols + col
    if (idx >= 0 && idx < totalTiles) setSelectedTile(idx)
  }

  const toggleLayerVisibility = (idx: number) => {
    const next = [...layers]
    next[idx] = { ...next[idx], visible: !next[idx].visible }
    setLayers(next)
  }

  const addLayer = () => {
    setLayers([...layers, createLayer(`Layer ${layers.length + 1}`, mapWidth, mapHeight)])
  }

  const removeLayer = (idx: number) => {
    if (layers.length <= 1) return
    const next = layers.filter((_, i) => i !== idx)
    setLayers(next)
    if (activeLayer >= next.length) setActiveLayer(next.length - 1)
  }

  const importAutotileMetadata = async (files: File[]) => {
    const text = await files[0].text()
    try {
      const data = JSON.parse(text)
      if (data.autotileGroups && Array.isArray(data.autotileGroups)) {
        setAutotileGroups(data.autotileGroups)
      }
    } catch { /* ignore */ }
  }

  const exportJson = () => {
    const data = {
      tileSize,
      mapWidth,
      mapHeight,
      autotileGroups,
      layers: layers.map((l) => ({ name: l.name, tiles: l.tiles, autotileIds: l.autotileIds })),
    }
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'level.json')
  }

  const exportPng = async () => {
    if (!tilesetImage || !mapCanvasRef.current) return
    // Render at 1x zoom for clean export
    const canvas = document.createElement('canvas')
    canvas.width = mapWidth * tileSize
    canvas.height = mapHeight * tileSize
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    for (const layer of layers) {
      if (!layer.visible) continue
      for (let r = 0; r < mapHeight; r++) {
        for (let c = 0; c < mapWidth; c++) {
          const tileIdx = layer.tiles[r]?.[c]
          if (tileIdx == null || tileIdx < 0) continue
          const srcCol = tileIdx % tilesetCols
          const srcRow = Math.floor(tileIdx / tilesetCols)
          ctx.drawImage(
            tilesetImage,
            srcCol * tileSize, srcRow * tileSize, tileSize, tileSize,
            c * tileSize, r * tileSize, tileSize, tileSize
          )
        }
      }
    }

    const blob = await canvasToBlob(canvas)
    downloadBlob(blob, 'level.png')
  }

  const importJson = async (files: File[]) => {
    const text = await files[0].text()
    try {
      const data = JSON.parse(text)
      if (data.layers) {
        setLayers(data.layers.map((l: { name: string; tiles: number[][]; autotileIds?: (string | null)[][] }) => ({
          name: l.name,
          tiles: l.tiles,
          autotileIds: l.autotileIds ?? Array.from({ length: l.tiles.length }, () => Array(l.tiles[0]?.length ?? 0).fill(null)),
          visible: true,
        })))
        if (data.mapWidth) setMapWidth(data.mapWidth)
        if (data.mapHeight) setMapHeight(data.mapHeight)
        if (data.tileSize) setTileSize(data.tileSize)
      }
      if (data.autotileGroups && Array.isArray(data.autotileGroups)) {
        setAutotileGroups(data.autotileGroups)
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Level Editor</h2>
        <p className="text-sm text-zinc-500 mt-2">Paint tile-based levels with multiple layers</p>
      </div>

      <FileDropzone onFiles={handleTilesetFiles} accept="image/*" label="Drop a tileset image" description="The image will be sliced into tiles by grid size" />

      {tilesetImage && (
        <div className="grid grid-cols-[1fr_280px] gap-6">
          <div className="space-y-4">
            {/* Map Canvas */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide mb-2">
                Map ({mapWidth}x{mapHeight})
              </p>
              <div className="overflow-auto max-h-[500px] bg-zinc-100 rounded"
                style={{ backgroundImage: 'repeating-conic-gradient(#d4d4d8 0% 25%, transparent 0% 50%)', backgroundSize: '16px 16px' }}>
                <canvas
                  ref={mapCanvasRef}
                  onMouseDown={handleMapMouseDown}
                  onMouseMove={handleMapMouseMove}
                  onMouseUp={handleMapMouseUp}
                  onMouseLeave={handleMapMouseUp}
                  className="cursor-crosshair"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Tileset palette */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-2">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">
                Tiles ({tilesetCols}x{tilesetRows})
              </p>
              <div className="overflow-auto max-h-48 bg-zinc-100 rounded">
                <canvas
                  ref={tilesetCanvasRef}
                  onClick={handleTilesetClick}
                  className="max-w-full cursor-pointer"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
              <p className="text-[10px] text-zinc-400">Selected: tile #{selectedTile}</p>
            </div>

            {/* Tools */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Tool</p>
              <div className="grid grid-cols-4 gap-1">
                {([
                  ['paint', Paintbrush, 'Paint'],
                  ['erase', Eraser, 'Erase'],
                  ['fill', PaintBucket, 'Fill'],
                  ['autotile', Grid3x3, 'Auto'],
                ] as const).map(([tool, Icon, label]) => (
                  <button
                    key={tool}
                    onClick={() => setActiveTool(tool)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-medium border transition-colors ${activeTool === tool ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Map settings */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Map</p>
              <Select label="Tile Size" value={String(tileSize)}
                options={[
                  { value: '8', label: '8px' },
                  { value: '16', label: '16px' },
                  { value: '32', label: '32px' },
                ]}
                onChange={(e) => setTileSize(+e.target.value)} />
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-600">Width (tiles)</span>
                <input type="number" min={1} max={100} value={mapWidth}
                  onChange={(e) => setMapWidth(Math.max(1, +e.target.value))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-600">Height (tiles)</span>
                <input type="number" min={1} max={100} value={mapHeight}
                  onChange={(e) => setMapHeight(Math.max(1, +e.target.value))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
              </label>
              <Slider label="Zoom" displayValue={`${zoom}x`}
                min={1} max={4} value={zoom}
                onChange={(e) => setZoom(+(e.target as HTMLInputElement).value)} />
            </div>

            {/* Layers */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Layers</p>
                <button onClick={addLayer} className="text-zinc-400 hover:text-blue-500"><Plus size={14} /></button>
              </div>
              <div className="space-y-1">
                {layers.map((layer, i) => (
                  <div
                    key={i}
                    onClick={() => setActiveLayer(i)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer ${i === activeLayer ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-zinc-50 text-zinc-600'}`}
                  >
                    <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(i) }}
                      className="text-zinc-400 hover:text-zinc-600">
                      {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <span className="flex-1">{layer.name}</span>
                    {layers.length > 1 && (
                      <button onClick={(e) => { e.stopPropagation(); removeLayer(i) }}
                        className="text-zinc-400 hover:text-red-500"><Trash2 size={10} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Autotile Groups */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Autotile Groups</p>
                <input
                  ref={autotileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files
                    if (files && files.length > 0) {
                      importAutotileMetadata(Array.from(files))
                      e.target.value = ''
                    }
                  }}
                />
                <button onClick={() => autotileInputRef.current?.click()} className="text-zinc-400 hover:text-blue-500">
                  <Upload size={14} />
                </button>
              </div>
              {autotileGroups.length === 0 ? (
                <p className="text-xs text-zinc-400">Import autotile metadata from Tileset Generator</p>
              ) : (
                <div className="space-y-1">
                  {autotileGroups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => { setActiveAutotileGroup(g.id); setActiveTool('autotile') }}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs border transition-colors ${
                        activeAutotileGroup === g.id ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-transparent hover:bg-zinc-50 text-zinc-600'
                      }`}
                    >
                      {g.name} <span className="text-zinc-400">({g.mode})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Export / Import */}
            <div className="flex gap-2">
              <Button onClick={exportJson} size="sm" className="flex-1">
                <Download size={12} /> JSON
              </Button>
              <Button onClick={exportPng} size="sm" variant="secondary" className="flex-1">
                <Download size={12} /> PNG
              </Button>
            </div>

            <div className="border-t border-zinc-200 pt-3">
              <p className="text-xs text-zinc-500 mb-2">Import level JSON:</p>
              <FileDropzone onFiles={importJson} accept=".json" label="Drop level JSON" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
