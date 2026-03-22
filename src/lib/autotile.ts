/* ─── Autotile System ─── */

export type AutotileMode = '4dir' | '8dir'
export type EnginePreset = 'godot' | 'unity' | 'simple4dir'

export interface AutotileGroup {
  id: string
  name: string
  mode: AutotileMode
  startIndex: number
  tileCount: number
  bitmaskMap: Record<number, number>
}

export interface AutotilePreset {
  name: string
  engine: EnginePreset
  mode: AutotileMode
  templateCols: number
  templateRows: number
  description: string
}

export const PRESETS: Record<EnginePreset, AutotilePreset> = {
  godot: {
    name: 'Godot 3x3 (47 tiles)',
    engine: 'godot',
    mode: '8dir',
    templateCols: 2,
    templateRows: 3,
    description: 'Upload a 2x3 sub-tile template. Generates 47 autotile variants for Godot 4 terrain.',
  },
  unity: {
    name: 'Unity Rule Tile (47 tiles)',
    engine: 'unity',
    mode: '8dir',
    templateCols: 2,
    templateRows: 3,
    description: 'Upload a 2x3 sub-tile template. Generates 47 autotile variants for Unity Rule Tiles.',
  },
  simple4dir: {
    name: 'Simple 4-dir (16 tiles)',
    engine: 'simple4dir',
    mode: '4dir',
    templateCols: 1,
    templateRows: 1,
    description: 'Upload a single filled tile. Generates 16 cardinal-direction variants.',
  },
}

/* ─── Bitmask Constants ─── */

// 4-dir: cardinal neighbors only
const N4 = 1, E4 = 2, S4 = 4, W4 = 8

// 8-dir: all 8 neighbors
const NW = 1, N8 = 2, NE = 4, W8 = 8, E8 = 16, SW = 32, S8 = 64, SE = 128

/* ─── 256→47 Reduction Table ─── */
// Corner bits only count if both adjacent edges are set.
// This reduces 256 possible 8-bit bitmasks to 47 unique visual variants.

function reduceCorners(mask: number): number {
  let r = mask
  // NW only if N and W
  if (!(r & N8) || !(r & W8)) r &= ~NW
  // NE only if N and E
  if (!(r & N8) || !(r & E8)) r &= ~NE
  // SW only if S and W
  if (!(r & S8) || !(r & W8)) r &= ~SW
  // SE only if S and E
  if (!(r & S8) || !(r & E8)) r &= ~SE
  return r
}

// Build the set of 47 unique reduced bitmask values
const UNIQUE_47: number[] = []
const seen47 = new Set<number>()
for (let i = 0; i < 256; i++) {
  const reduced = reduceCorners(i)
  if (!seen47.has(reduced)) {
    seen47.add(reduced)
    UNIQUE_47.push(reduced)
  }
}
UNIQUE_47.sort((a, b) => a - b)

// Map each of the 47 unique bitmasks to a tile offset (0-46)
const REDUCED_TO_OFFSET: Record<number, number> = {}
UNIQUE_47.forEach((val, idx) => { REDUCED_TO_OFFSET[val] = idx })

// Full 256→offset lookup
const BITMASK_256_TO_OFFSET: number[] = new Array(256)
for (let i = 0; i < 256; i++) {
  BITMASK_256_TO_OFFSET[i] = REDUCED_TO_OFFSET[reduceCorners(i)]
}

/* ─── 4-dir 16-tile mapping ─── */
const BITMASK_16: Record<number, number> = {}
for (let i = 0; i < 16; i++) BITMASK_16[i] = i

/* ─── Bitmask Computation ─── */

export function computeBitmask4(
  grid: (string | null)[][],
  row: number,
  col: number,
  groupId: string,
  w: number,
  h: number
): number {
  let mask = 0
  const match = (r: number, c: number) => r >= 0 && r < h && c >= 0 && c < w && grid[r][c] === groupId
  if (match(row - 1, col)) mask |= N4
  if (match(row, col + 1)) mask |= E4
  if (match(row + 1, col)) mask |= S4
  if (match(row, col - 1)) mask |= W4
  return mask
}

export function computeBitmask8(
  grid: (string | null)[][],
  row: number,
  col: number,
  groupId: string,
  w: number,
  h: number
): number {
  let mask = 0
  const match = (r: number, c: number) => r >= 0 && r < h && c >= 0 && c < w && grid[r][c] === groupId
  if (match(row - 1, col - 1)) mask |= NW
  if (match(row - 1, col)) mask |= N8
  if (match(row - 1, col + 1)) mask |= NE
  if (match(row, col - 1)) mask |= W8
  if (match(row, col + 1)) mask |= E8
  if (match(row + 1, col - 1)) mask |= SW
  if (match(row + 1, col)) mask |= S8
  if (match(row + 1, col + 1)) mask |= SE
  return BITMASK_256_TO_OFFSET[reduceCorners(mask)]
}

/* ─── Template → Tileset Generation ─── */

/**
 * Generate a full autotile tileset from a template image.
 * For 8-dir (47 tiles): template is 2x3 sub-tiles (each sub-tile = tileSize/2).
 * For 4-dir (16 tiles): template is a single filled tile.
 */
export function generateAutotileset(
  templateCanvas: HTMLCanvasElement,
  tileSize: number,
  preset: EnginePreset
): { canvas: HTMLCanvasElement; bitmaskMap: Record<number, number>; tileCount: number } {
  if (preset === 'simple4dir') {
    return generate4Dir(templateCanvas, tileSize)
  }
  return generate8Dir(templateCanvas, tileSize)
}

function generate4Dir(
  template: HTMLCanvasElement,
  tileSize: number
): { canvas: HTMLCanvasElement; bitmaskMap: Record<number, number>; tileCount: number } {
  // Output: 4x4 grid = 16 tiles
  const cols = 4
  const rows = 4
  const canvas = document.createElement('canvas')
  canvas.width = cols * tileSize
  canvas.height = rows * tileSize
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  // For each of the 16 bitmask values, draw the tile with edges masked
  for (let mask = 0; mask < 16; mask++) {
    const col = mask % cols
    const row = Math.floor(mask / cols)
    const x = col * tileSize
    const y = row * tileSize

    // Draw full tile
    ctx.drawImage(template, 0, 0, template.width, template.height, x, y, tileSize, tileSize)

    // Mask edges where there's no neighbor (draw transparent/black strips)
    const edgeW = Math.max(2, Math.round(tileSize * 0.15))
    ctx.fillStyle = 'rgba(0,0,0,0.6)'

    if (!(mask & N4)) ctx.fillRect(x, y, tileSize, edgeW)
    if (!(mask & S4)) ctx.fillRect(x, y + tileSize - edgeW, tileSize, edgeW)
    if (!(mask & W4)) ctx.fillRect(x, y, edgeW, tileSize)
    if (!(mask & E4)) ctx.fillRect(x + tileSize - edgeW, y, edgeW, tileSize)
  }

  return { canvas, bitmaskMap: { ...BITMASK_16 }, tileCount: 16 }
}

function generate8Dir(
  template: HTMLCanvasElement,
  tileSize: number
): { canvas: HTMLCanvasElement; bitmaskMap: Record<number, number>; tileCount: number } {
  // Template is 2x3 sub-tiles, each sub-tile = tileSize/2
  const half = Math.floor(tileSize / 2)
  const tCtx = template.getContext('2d')!

  // Extract 6 sub-tiles from the 2x3 template
  // Layout: [TL_inner, TR_inner] [BL_inner, BR_inner] [TL_outer, TR_outer]
  // Row 0: inner corners (used when tile connects in both directions)
  // Row 1: center/full variants
  // Row 2: outer corners/edges (used when tile is isolated or has partial connections)
  const subTiles: ImageData[] = []
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      subTiles.push(tCtx.getImageData(c * half, r * half, half, half))
    }
  }
  // subTiles: [0]=TL_inner, [1]=TR_inner, [2]=BL_inner, [3]=BR_inner, [4]=TL_outer, [5]=TR_outer

  // Output: arrange 47 tiles in a grid (8 cols)
  const outCols = 8
  const outRows = Math.ceil(47 / outCols)
  const canvas = document.createElement('canvas')
  canvas.width = outCols * tileSize
  canvas.height = outRows * tileSize
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  const bitmaskMap: Record<number, number> = {}

  // For each of the 47 unique bitmask values, compose the tile from 4 quadrants
  UNIQUE_47.forEach((bitmask, tileIdx) => {
    bitmaskMap[tileIdx] = tileIdx
    const col = tileIdx % outCols
    const row = Math.floor(tileIdx / outCols)
    const x = col * tileSize
    const y = row * tileSize

    // Determine which sub-tile to use for each quadrant based on neighbor state
    // TL quadrant: depends on N, W, NW
    const hasN = !!(bitmask & N8)
    const hasE = !!(bitmask & E8)
    const hasS = !!(bitmask & S8)
    const hasW = !!(bitmask & W8)
    const hasNW = !!(bitmask & NW)
    const hasNE = !!(bitmask & NE)
    const hasSW = !!(bitmask & SW)
    const hasSE = !!(bitmask & SE)

    // Pick quadrant sub-tiles
    const tlSub = (hasN && hasW && hasNW) ? subTiles[0] : (hasN && hasW) ? subTiles[4] : (hasN) ? subTiles[2] : (hasW) ? subTiles[1] : subTiles[5]
    const trSub = (hasN && hasE && hasNE) ? subTiles[1] : (hasN && hasE) ? subTiles[5] : (hasN) ? subTiles[3] : (hasE) ? subTiles[0] : subTiles[4]
    const blSub = (hasS && hasW && hasSW) ? subTiles[2] : (hasS && hasW) ? subTiles[4] : (hasS) ? subTiles[0] : (hasW) ? subTiles[3] : subTiles[5]
    const brSub = (hasS && hasE && hasSE) ? subTiles[3] : (hasS && hasE) ? subTiles[5] : (hasS) ? subTiles[1] : (hasE) ? subTiles[2] : subTiles[4]

    // Draw the 4 quadrants
    ctx.putImageData(tlSub, x, y)
    ctx.putImageData(trSub, x + half, y)
    ctx.putImageData(blSub, x, y + half)
    ctx.putImageData(brSub, x + half, y + half)
  })

  // Build the actual bitmask→offset map: reduced bitmask value → tile index
  const finalMap: Record<number, number> = {}
  UNIQUE_47.forEach((_, idx) => { finalMap[idx] = idx })

  return { canvas, bitmaskMap: finalMap, tileCount: 47 }
}

/* ─── Engine Export Functions ─── */

export function exportGodotTres(
  groups: AutotileGroup[],
  tileSize: number,
  atlasPath: string = 'res://tileset.png'
): string {
  const terrains = groups.map((g, gi) => {
    const tilesEntries = Object.entries(g.bitmaskMap).map(([bitmask, offset]) => {
      const tileIdx = g.startIndex + offset
      const outCols = g.mode === '4dir' ? 4 : 8
      const col = tileIdx % outCols
      const row = Math.floor(tileIdx / outCols)
      return `  ${bitmask}:${col}:${row}`
    })
    return `[terrain_${gi}]
name = "${g.name}"
mode = ${g.mode === '4dir' ? 0 : 1}
tiles = [
${tilesEntries.join(',\n')}
]`
  })

  return `[gd_resource type="TileSet" format=3]

[ext_resource type="Texture2D" path="${atlasPath}" id="1"]

[resource]
tile_size = Vector2i(${tileSize}, ${tileSize})

${terrains.join('\n\n')}
`
}

export function exportUnityRuleTileJson(
  groups: AutotileGroup[],
  tileSize: number
): string {
  const data = groups.map((g) => {
    const rules = Object.entries(g.bitmaskMap).map(([bitmask, offset]) => {
      const mask = Number(bitmask)
      // Convert bitmask to Unity neighbor rules array (8 neighbors, clockwise from NW)
      // 0=any, 1=this, 2=notThis
      const neighbors: number[] = []
      if (g.mode === '8dir') {
        const bits = UNIQUE_47[mask] ?? 0
        neighbors.push(
          (bits & NW) ? 1 : 0,
          (bits & N8) ? 1 : 0,
          (bits & NE) ? 1 : 0,
          (bits & W8) ? 1 : 0,
          (bits & E8) ? 1 : 0,
          (bits & SW) ? 1 : 0,
          (bits & S8) ? 1 : 0,
          (bits & SE) ? 1 : 0,
        )
      } else {
        neighbors.push(
          0, (mask & N4) ? 1 : 0, 0,
          (mask & W4) ? 1 : 0, (mask & E4) ? 1 : 0,
          0, (mask & S4) ? 1 : 0, 0,
        )
      }
      return { tileOffset: offset, neighbors }
    })
    return { name: g.name, mode: g.mode, tileSize, startIndex: g.startIndex, rules }
  })
  return JSON.stringify({ autotileGroups: data }, null, 2)
}

export function exportAutotileMetadata(groups: AutotileGroup[]): string {
  return JSON.stringify({ version: 1, autotileGroups: groups }, null, 2)
}

/* ─── Recalculate neighbors after paint ─── */

const NEIGHBOR_OFFSETS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 0], [0, 1],
  [1, -1], [1, 0], [1, 1],
]

export function recalcAutotileRegion(
  tiles: number[][],
  autotileIds: (string | null)[][],
  row: number,
  col: number,
  groups: AutotileGroup[],
  mapW: number,
  mapH: number
): void {
  const groupMap = new Map(groups.map(g => [g.id, g]))

  for (const [dr, dc] of NEIGHBOR_OFFSETS) {
    const nr = row + dr
    const nc = col + dc
    if (nr < 0 || nr >= mapH || nc < 0 || nc >= mapW) continue

    const gId = autotileIds[nr][nc]
    if (!gId) continue

    const group = groupMap.get(gId)
    if (!group) continue

    const bitmask = group.mode === '4dir'
      ? computeBitmask4(autotileIds, nr, nc, gId, mapW, mapH)
      : computeBitmask8(autotileIds, nr, nc, gId, mapW, mapH)

    tiles[nr][nc] = group.startIndex + (group.bitmaskMap[bitmask] ?? 0)
  }
}
