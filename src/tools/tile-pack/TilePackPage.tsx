import { useState, useRef } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Download } from 'lucide-react'
import { fileToDataURL, loadImage, downloadBlob, canvasToBlob } from '../../lib/utils'
import JSZip from 'jszip'

export function TilePackPage() {
  const [tileset, setTileset] = useState<HTMLImageElement | null>(null)
  const [mapJson, setMapJson] = useState<any>(null)
  const [tileW, setTileW] = useState(16)
  const [tileH, setTileH] = useState(16)
  const [padding, setPadding] = useState(1)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [usedCount, setUsedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [packed, setPacked] = useState(false)

  const handleTilesetFiles = async (files: File[]) => {
    for (const f of files) {
      if (f.name.endsWith('.json') || f.name.endsWith('.tmj')) {
        const text = await f.text()
        setMapJson(JSON.parse(text))
      } else if (f.type.startsWith('image/')) {
        const url = await fileToDataURL(f)
        const img = await loadImage(url)
        setTileset(img)
      }
    }
  }

  const packTiles = () => {
    if (!tileset) return

    const srcCols = Math.floor(tileset.width / tileW)
    const srcRows = Math.floor(tileset.height / tileH)
    const total = srcCols * srcRows
    setTotalCount(total)

    // Find used tile IDs from map JSON if available
    let usedIds: Set<number>
    if (mapJson?.layers) {
      usedIds = new Set<number>()
      for (const layer of mapJson.layers) {
        if (layer.data) {
          for (const id of layer.data) {
            if (id > 0) usedIds.add(id - 1) // Tiled uses 1-based IDs
          }
        }
      }
    } else {
      // No map — include all tiles but deduplicate identical ones
      usedIds = new Set(Array.from({ length: total }, (_, i) => i))
    }

    // Deduplicate by pixel content
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = tileW
    tempCanvas.height = tileH
    const tempCtx = tempCanvas.getContext('2d')!

    const uniqueTiles: { id: number; hash: string }[] = []
    const seenHashes = new Set<string>()

    for (const id of usedIds) {
      const col = id % srcCols
      const row = Math.floor(id / srcCols)
      if (row >= srcRows) continue

      tempCtx.clearRect(0, 0, tileW, tileH)
      tempCtx.drawImage(tileset, col * tileW, row * tileH, tileW, tileH, 0, 0, tileW, tileH)
      const data = tempCtx.getImageData(0, 0, tileW, tileH).data

      // Check if fully transparent
      let hasContent = false
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) { hasContent = true; break }
      }
      if (!hasContent) continue

      // Simple hash
      let hash = ''
      for (let i = 0; i < data.length; i += 16) {
        hash += String.fromCharCode(data[i] ^ data[i + 1])
      }

      if (!seenHashes.has(hash)) {
        seenHashes.add(hash)
        uniqueTiles.push({ id, hash })
      }
    }

    setUsedCount(uniqueTiles.length)

    // Pack into optimized tileset
    const outCols = Math.ceil(Math.sqrt(uniqueTiles.length))
    const outRows = Math.ceil(uniqueTiles.length / outCols)
    const outW = outCols * (tileW + padding) - padding
    const outH = outRows * (tileH + padding) - padding

    if (!canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, outW, outH)

    uniqueTiles.forEach((tile, i) => {
      const srcCol = tile.id % srcCols
      const srcRow = Math.floor(tile.id / srcCols)
      const dstCol = i % outCols
      const dstRow = Math.floor(i / outCols)
      ctx.drawImage(
        tileset,
        srcCol * tileW, srcRow * tileH, tileW, tileH,
        dstCol * (tileW + padding), dstRow * (tileH + padding), tileW, tileH
      )
    })

    setPacked(true)
  }

  const handleExport = async () => {
    if (!canvasRef.current) return
    const zip = new JSZip()

    const blob = await canvasToBlob(canvasRef.current)
    zip.file('tileset_packed.png', blob)

    // Generate tileset metadata
    const meta = {
      tileWidth: tileW,
      tileHeight: tileH,
      padding,
      image: 'tileset_packed.png',
      imageWidth: canvasRef.current.width,
      imageHeight: canvasRef.current.height,
      tileCount: usedCount,
      columns: Math.ceil(Math.sqrt(usedCount)),
    }
    zip.file('tileset_packed.json', JSON.stringify(meta, null, 2))

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(zipBlob, 'tile_pack.zip')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Tile Pack</h2>
        <p className="text-sm text-zinc-500 mt-2">Optimize tilesets by removing unused/duplicate tiles. Optionally load a Tiled map JSON to keep only used tiles.</p>
      </div>

      <FileDropzone onFiles={handleTilesetFiles} accept="image/*,.json,.tmj" multiple
        label="Drop tileset image (and optionally a Tiled map JSON)"
        description="PNG tileset + optional .json/.tmj map file" />

      {tileset && (
        <div className="space-y-4">
          <div className="flex gap-4 flex-wrap items-end">
            <label className="space-y-1">
              <span className="text-xs font-medium text-zinc-600">Tile Width</span>
              <input type="number" min={1} value={tileW} onChange={(e) => setTileW(Math.max(1, +e.target.value))}
                className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-zinc-600">Tile Height</span>
              <input type="number" min={1} value={tileH} onChange={(e) => setTileH(Math.max(1, +e.target.value))}
                className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-zinc-600">Padding</span>
              <input type="number" min={0} max={8} value={padding} onChange={(e) => setPadding(Math.max(0, +e.target.value))}
                className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
            </label>
            <Button onClick={packTiles}>Pack Tiles</Button>
          </div>

          <p className="text-xs text-zinc-500">
            Source: {Math.floor(tileset.width / tileW) * Math.floor(tileset.height / tileH)} tiles ({tileset.width}x{tileset.height})
            {mapJson && ' | Map loaded'}
          </p>

          {packed && (
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-zinc-500">
                  Packed: {usedCount} unique tiles (from {totalCount})
                </p>
                <Button onClick={handleExport} size="sm"><Download size={12} /> Export ZIP</Button>
              </div>
              <div className="overflow-auto max-h-64 bg-zinc-100 rounded p-2"
                style={{ backgroundImage: 'repeating-conic-gradient(#d4d4d8 0% 25%, transparent 0% 50%)', backgroundSize: '12px 12px' }}>
                <canvas ref={canvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
