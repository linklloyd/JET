import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Slider } from '../../components/ui/Slider'
import { Download, RefreshCw } from 'lucide-react'
import { downloadBlob, canvasToBlob } from '../../lib/utils'
import { seedRng, perlinNoise, generatePermTable } from '../../lib/noise'

type MapType = 'dungeon' | 'overworld'
type ExportFormat = 'image' | 'json-godot' | 'json-unity' | 'tmx' | 'csv'

interface MapConfig {
  type: MapType
  width: number
  height: number
  tileSize: number
  seed: number
  roomCount: number // dungeon
  roomMinSize: number
  roomMaxSize: number
  noiseScale: number // overworld
  waterLevel: number
  treeLevel: number
}

const TILE_COLORS: Record<string, Record<number, string>> = {
  dungeon: {
    0: '#1a1a2e', // wall
    1: '#e2d9c2', // floor
    2: '#8b7355', // corridor
    3: '#4a6741', // door
  },
  overworld: {
    0: '#2563eb', // deep water
    1: '#60a5fa', // shallow water
    2: '#f5deb3', // sand
    3: '#4ade80', // grass
    4: '#22c55e', // forest
    5: '#6b7280', // mountain
    6: '#f5f5f4', // snow
  },
}

const TILE_NAMES: Record<string, Record<number, string>> = {
  dungeon: { 0: 'wall', 1: 'floor', 2: 'corridor', 3: 'door' },
  overworld: { 0: 'deep_water', 1: 'shallow_water', 2: 'sand', 3: 'grass', 4: 'forest', 5: 'mountain', 6: 'snow' },
}

export function MapGeneratorPage() {
  const [config, setConfig] = useState<MapConfig>({
    type: 'dungeon',
    width: 64,
    height: 64,
    tileSize: 8,
    seed: Math.floor(Math.random() * 999999),
    roomCount: 12,
    roomMinSize: 4,
    roomMaxSize: 10,
    noiseScale: 40,
    waterLevel: 35,
    treeLevel: 55,
  })
  const [mapData, setMapData] = useState<number[][] | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const generate = useCallback(() => {
    const data = config.type === 'dungeon' ? generateDungeon(config) : generateOverworld(config)
    setMapData(data)
  }, [config])

  // Generate on first mount
  const hasGenerated = useRef(false)
  useEffect(() => {
    if (!hasGenerated.current) {
      hasGenerated.current = true
      generate()
    }
  }, [generate])

  useEffect(() => {
    if (!mapData || !canvasRef.current) return
    const canvas = canvasRef.current
    const { tileSize, type } = config
    const rows = mapData.length
    const cols = mapData[0]?.length ?? 0
    canvas.width = cols * tileSize
    canvas.height = rows * tileSize
    const ctx = canvas.getContext('2d')!
    const colors = TILE_COLORS[type]

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const tile = mapData[y]?.[x] ?? 0
        ctx.fillStyle = colors[tile] || '#000'
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize)
      }
    }
  }, [mapData, config])

  const handleExportImage = async () => {
    if (!canvasRef.current) return
    const blob = await canvasToBlob(canvasRef.current)
    downloadBlob(blob, `${config.type}_map.png`)
  }

  const handleExportTmx = () => {
    if (!mapData) return
    const names = TILE_NAMES[config.type]
    const tileTypes = Object.keys(names).map(Number)
    const rows = mapData.length
    const cols = mapData[0]?.length ?? 0

    // Build CSV data (tile IDs +1 because Tiled uses 0 as empty)
    const csvData = mapData.map((row) => row.map((t) => t + 1).join(',')).join(',\n')

    const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${cols}" height="${rows}" tilewidth="${config.tileSize}" tileheight="${config.tileSize}" infinite="0">
 <tileset firstgid="1" name="tiles" tilewidth="${config.tileSize}" tileheight="${config.tileSize}" tilecount="${tileTypes.length}">
${tileTypes.map((id) => `  <tile id="${id}"><properties><property name="name" value="${names[id]}"/></properties></tile>`).join('\n')}
 </tileset>
 <layer id="1" name="ground" width="${cols}" height="${rows}">
  <data encoding="csv">
${csvData}
  </data>
 </layer>
</map>`
    const blob = new Blob([tmx], { type: 'application/xml' })
    downloadBlob(blob, `${config.type}_map.tmx`)
  }

  const handleExportCsv = () => {
    if (!mapData) return
    const csv = mapData.map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    downloadBlob(blob, `${config.type}_map.csv`)
  }

  const handleExportJson = (format: ExportFormat) => {
    if (!mapData) return
    const names = TILE_NAMES[config.type]

    if (format === 'json-godot') {
      const godot = {
        type: config.type,
        width: config.width,
        height: config.height,
        tile_size: config.tileSize,
        seed: config.seed,
        tile_map: mapData,
        tile_names: names,
        layers: [{
          name: 'ground',
          data: mapData.flat(),
          width: config.width,
          height: config.height,
        }],
      }
      const blob = new Blob([JSON.stringify(godot, null, 2)], { type: 'application/json' })
      downloadBlob(blob, `${config.type}_map_godot.json`)
    } else {
      const unity = {
        type: config.type,
        gridSize: { x: config.width, y: config.height },
        cellSize: config.tileSize,
        seed: config.seed,
        tileNames: names,
        layers: [{
          name: 'Ground',
          tiles: mapData.flatMap((row, y) =>
            row.map((tile, x) => ({ x, y, tileId: tile, tileName: names[tile] }))
              .filter((t) => t.tileId !== 0)
          ),
        }],
      }
      const blob = new Blob([JSON.stringify(unity, null, 2)], { type: 'application/json' })
      downloadBlob(blob, `${config.type}_map_unity.json`)
    }
  }

  const update = <K extends keyof MapConfig>(key: K, value: MapConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Procedural Map Generator</h2>
        <p className="text-sm text-zinc-500 mt-2">Generate dungeon and overworld maps for your game</p>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-6">
        {/* Preview */}
        <div className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-zinc-500">
                Map Preview ({config.width}x{config.height})
              </p>
              <div className="flex gap-2">
                <Button onClick={handleExportImage} size="sm" variant="secondary">
                  <Download size={12} /> PNG
                </Button>
                <Button onClick={() => handleExportJson('json-godot')} size="sm" variant="secondary">
                  Godot JSON
                </Button>
                <Button onClick={() => handleExportJson('json-unity')} size="sm" variant="secondary">
                  Unity JSON
                </Button>
                <Button onClick={handleExportTmx} size="sm" variant="secondary">
                  TMX (Tiled)
                </Button>
                <Button onClick={handleExportCsv} size="sm" variant="secondary">
                  CSV
                </Button>
              </div>
            </div>
            <div className="overflow-auto max-h-[500px] bg-zinc-900 rounded">
              <canvas ref={canvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            {Object.entries(TILE_COLORS[config.type]).map(([id, color]) => (
              <div key={id} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded border border-zinc-300" style={{ backgroundColor: color }} />
                <span className="text-xs text-zinc-600">{TILE_NAMES[config.type][+id]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
            <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Map Settings</p>

            <Select
              label="Map Type"
              options={[
                { value: 'dungeon', label: 'Dungeon' },
                { value: 'overworld', label: 'Overworld' },
              ]}
              value={config.type}
              onChange={(e) => update('type', e.target.value as MapType)}
            />

            <Slider label="Width" displayValue={String(config.width)}
              min={16} max={128} value={config.width}
              onChange={(e) => update('width', +(e.target as HTMLInputElement).value)} />

            <Slider label="Height" displayValue={String(config.height)}
              min={16} max={128} value={config.height}
              onChange={(e) => update('height', +(e.target as HTMLInputElement).value)} />

            <Slider label="Tile Size (px)" displayValue={`${config.tileSize}px`}
              min={2} max={16} value={config.tileSize}
              onChange={(e) => update('tileSize', +(e.target as HTMLInputElement).value)} />

            <label className="space-y-1">
              <span className="text-xs font-medium text-zinc-600">Seed</span>
              <input type="number" value={config.seed}
                onChange={(e) => update('seed', +e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm" />
            </label>
          </div>

          {config.type === 'dungeon' && (
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Dungeon</p>
              <Slider label="Room Count" displayValue={String(config.roomCount)}
                min={3} max={30} value={config.roomCount}
                onChange={(e) => update('roomCount', +(e.target as HTMLInputElement).value)} />
              <Slider label="Min Room Size" displayValue={String(config.roomMinSize)}
                min={3} max={12} value={config.roomMinSize}
                onChange={(e) => update('roomMinSize', +(e.target as HTMLInputElement).value)} />
              <Slider label="Max Room Size" displayValue={String(config.roomMaxSize)}
                min={4} max={20} value={config.roomMaxSize}
                onChange={(e) => update('roomMaxSize', +(e.target as HTMLInputElement).value)} />
            </div>
          )}

          {config.type === 'overworld' && (
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Overworld</p>
              <Slider label="Noise Scale" displayValue={String(config.noiseScale)}
                min={10} max={100} value={config.noiseScale}
                onChange={(e) => update('noiseScale', +(e.target as HTMLInputElement).value)} />
              <Slider label="Water Level" displayValue={`${config.waterLevel}%`}
                min={0} max={80} value={config.waterLevel}
                onChange={(e) => update('waterLevel', +(e.target as HTMLInputElement).value)} />
              <Slider label="Tree Density" displayValue={`${config.treeLevel}%`}
                min={0} max={90} value={config.treeLevel}
                onChange={(e) => update('treeLevel', +(e.target as HTMLInputElement).value)} />
            </div>
          )}

          <Button onClick={() => { update('seed', Math.floor(Math.random() * 999999)); setTimeout(generate, 0) }}
            className="w-full" variant="secondary">
            <RefreshCw size={14} /> Randomize
          </Button>

          <Button onClick={generate} className="w-full">
            Generate Map
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ─── Dungeon Generation (BSP + corridors) ─── */
interface Room { x: number; y: number; w: number; h: number }

function generateDungeon(config: MapConfig): number[][] {
  const { width, height, seed, roomCount, roomMinSize, roomMaxSize } = config
  const rng = seedRng(seed)
  const map: number[][] = Array.from({ length: height }, () => Array(width).fill(0))

  const rooms: Room[] = []

  for (let attempt = 0; attempt < roomCount * 10 && rooms.length < roomCount; attempt++) {
    const w = roomMinSize + Math.floor(rng() * (roomMaxSize - roomMinSize + 1))
    const h = roomMinSize + Math.floor(rng() * (roomMaxSize - roomMinSize + 1))
    const x = 1 + Math.floor(rng() * (width - w - 2))
    const y = 1 + Math.floor(rng() * (height - h - 2))

    const room = { x, y, w, h }
    const overlap = rooms.some((r) =>
      x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y
    )

    if (!overlap) {
      rooms.push(room)
      for (let dy = y; dy < y + h; dy++) {
        for (let dx = x; dx < x + w; dx++) {
          map[dy][dx] = 1 // floor
        }
      }
    }
  }

  // Connect rooms with corridors
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1]
    const b = rooms[i]
    const ax = Math.floor(a.x + a.w / 2)
    const ay = Math.floor(a.y + a.h / 2)
    const bx = Math.floor(b.x + b.w / 2)
    const by = Math.floor(b.y + b.h / 2)

    if (rng() > 0.5) {
      carveH(map, ax, bx, ay, width)
      carveV(map, ay, by, bx, height)
    } else {
      carveV(map, ay, by, ax, height)
      carveH(map, ax, bx, by, width)
    }
  }

  return map
}

function carveH(map: number[][], x1: number, x2: number, y: number, w: number) {
  const start = Math.min(x1, x2)
  const end = Math.max(x1, x2)
  for (let x = start; x <= end; x++) {
    if (x >= 0 && x < w && y >= 0 && y < map.length) {
      if (map[y][x] === 0) map[y][x] = 2 // corridor
    }
  }
}

function carveV(map: number[][], y1: number, y2: number, x: number, h: number) {
  const start = Math.min(y1, y2)
  const end = Math.max(y1, y2)
  for (let y = start; y <= end; y++) {
    if (x >= 0 && x < map[0].length && y >= 0 && y < h) {
      if (map[y][x] === 0) map[y][x] = 2
    }
  }
}

/* ─── Overworld Generation (Perlin-like noise) ─── */
function generateOverworld(config: MapConfig): number[][] {
  const { width, height, seed, noiseScale, waterLevel, treeLevel } = config
  const rng = seedRng(seed)
  const map: number[][] = Array.from({ length: height }, () => Array(width).fill(3))

  const perm = generatePermTable(rng)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / noiseScale
      const ny = y / noiseScale
      const n1 = perlinNoise(nx, ny, perm)
      const n2 = perlinNoise(nx * 2, ny * 2, perm) * 0.5
      const n3 = perlinNoise(nx * 4, ny * 4, perm) * 0.25
      const noise = ((n1 + n2 + n3) + 1) / 2 * 100

      if (noise < waterLevel * 0.6) map[y][x] = 0        // deep water
      else if (noise < waterLevel) map[y][x] = 1           // shallow water
      else if (noise < waterLevel + 5) map[y][x] = 2       // sand
      else if (noise < treeLevel) map[y][x] = 3            // grass
      else if (noise < treeLevel + 15) map[y][x] = 4       // forest
      else if (noise < 85) map[y][x] = 5                   // mountain
      else map[y][x] = 6                                    // snow
    }
  }

  return map
}
