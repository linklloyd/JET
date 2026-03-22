/* ─── Dithering Algorithms ─── */

export type DitheringAlgorithm = 'floyd-steinberg' | 'atkinson' | 'ordered-2x2' | 'ordered-4x4' | 'ordered-8x8' | 'sierra'

export interface PaletteColor {
  r: number
  g: number
  b: number
}

function findClosestColor(r: number, g: number, b: number, palette: PaletteColor[]): PaletteColor {
  let best = palette[0]
  let bestDist = Infinity
  for (const c of palette) {
    const dr = r - c.r
    const dg = g - c.g
    const db = b - c.b
    const dist = dr * dr + dg * dg + db * db
    if (dist < bestDist) {
      bestDist = dist
      best = c
      if (dist === 0) break
    }
  }
  return best
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, v))
}

export function ditherFloydSteinberg(imageData: ImageData, palette: PaletteColor[]): ImageData {
  const w = imageData.width
  const h = imageData.height
  const out = new ImageData(new Uint8ClampedArray(imageData.data), w, h)
  const d = out.data
  const err = new Float32Array(w * h * 3)

  // Copy pixel data to float buffer
  for (let i = 0; i < w * h; i++) {
    err[i * 3] = d[i * 4]
    err[i * 3 + 1] = d[i * 4 + 1]
    err[i * 3 + 2] = d[i * 4 + 2]
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      const r = clamp(Math.round(err[idx * 3]))
      const g = clamp(Math.round(err[idx * 3 + 1]))
      const b = clamp(Math.round(err[idx * 3 + 2]))

      const closest = findClosestColor(r, g, b, palette)
      d[idx * 4] = closest.r
      d[idx * 4 + 1] = closest.g
      d[idx * 4 + 2] = closest.b

      const er = r - closest.r
      const eg = g - closest.g
      const eb = b - closest.b

      const spread = [
        [x + 1, y, 7 / 16],
        [x - 1, y + 1, 3 / 16],
        [x, y + 1, 5 / 16],
        [x + 1, y + 1, 1 / 16],
      ] as const

      for (const [sx, sy, weight] of spread) {
        if (sx >= 0 && sx < w && sy < h) {
          const si = sy * w + sx
          err[si * 3] += er * weight
          err[si * 3 + 1] += eg * weight
          err[si * 3 + 2] += eb * weight
        }
      }
    }
  }
  return out
}

export function ditherAtkinson(imageData: ImageData, palette: PaletteColor[]): ImageData {
  const w = imageData.width
  const h = imageData.height
  const out = new ImageData(new Uint8ClampedArray(imageData.data), w, h)
  const d = out.data
  const err = new Float32Array(w * h * 3)

  for (let i = 0; i < w * h; i++) {
    err[i * 3] = d[i * 4]
    err[i * 3 + 1] = d[i * 4 + 1]
    err[i * 3 + 2] = d[i * 4 + 2]
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      const r = clamp(Math.round(err[idx * 3]))
      const g = clamp(Math.round(err[idx * 3 + 1]))
      const b = clamp(Math.round(err[idx * 3 + 2]))

      const closest = findClosestColor(r, g, b, palette)
      d[idx * 4] = closest.r
      d[idx * 4 + 1] = closest.g
      d[idx * 4 + 2] = closest.b

      const er = r - closest.r
      const eg = g - closest.g
      const eb = b - closest.b

      // Atkinson spreads 6/8 of the error (not all of it)
      const spread = [
        [x + 1, y],
        [x + 2, y],
        [x - 1, y + 1],
        [x, y + 1],
        [x + 1, y + 1],
        [x, y + 2],
      ] as const

      for (const [sx, sy] of spread) {
        if (sx >= 0 && sx < w && sy < h) {
          const si = sy * w + sx
          err[si * 3] += er / 8
          err[si * 3 + 1] += eg / 8
          err[si * 3 + 2] += eb / 8
        }
      }
    }
  }
  return out
}

export function ditherSierra(imageData: ImageData, palette: PaletteColor[]): ImageData {
  const w = imageData.width
  const h = imageData.height
  const out = new ImageData(new Uint8ClampedArray(imageData.data), w, h)
  const d = out.data
  const err = new Float32Array(w * h * 3)

  for (let i = 0; i < w * h; i++) {
    err[i * 3] = d[i * 4]
    err[i * 3 + 1] = d[i * 4 + 1]
    err[i * 3 + 2] = d[i * 4 + 2]
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      const r = clamp(Math.round(err[idx * 3]))
      const g = clamp(Math.round(err[idx * 3 + 1]))
      const b = clamp(Math.round(err[idx * 3 + 2]))

      const closest = findClosestColor(r, g, b, palette)
      d[idx * 4] = closest.r
      d[idx * 4 + 1] = closest.g
      d[idx * 4 + 2] = closest.b

      const er = r - closest.r
      const eg = g - closest.g
      const eb = b - closest.b

      const spread = [
        [x + 1, y, 5 / 32],
        [x + 2, y, 3 / 32],
        [x - 2, y + 1, 2 / 32],
        [x - 1, y + 1, 4 / 32],
        [x, y + 1, 5 / 32],
        [x + 1, y + 1, 4 / 32],
        [x + 2, y + 1, 2 / 32],
        [x - 1, y + 2, 2 / 32],
        [x, y + 2, 3 / 32],
        [x + 1, y + 2, 2 / 32],
      ] as const

      for (const [sx, sy, weight] of spread) {
        if (sx >= 0 && sx < w && sy < h) {
          const si = sy * w + sx
          err[si * 3] += er * weight
          err[si * 3 + 1] += eg * weight
          err[si * 3 + 2] += eb * weight
        }
      }
    }
  }
  return out
}

// Bayer matrices
const BAYER_2X2 = [
  [0, 2],
  [3, 1],
]

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

const BAYER_8X8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
]

function getBayerMatrix(size: 2 | 4 | 8): number[][] {
  if (size === 2) return BAYER_2X2
  if (size === 4) return BAYER_4X4
  return BAYER_8X8
}

export function ditherOrdered(imageData: ImageData, palette: PaletteColor[], matrixSize: 2 | 4 | 8): ImageData {
  const w = imageData.width
  const h = imageData.height
  const out = new ImageData(new Uint8ClampedArray(imageData.data), w, h)
  const d = out.data
  const matrix = getBayerMatrix(matrixSize)
  const n = matrixSize
  const maxVal = n * n

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      const threshold = (matrix[y % n][x % n] / maxVal - 0.5) * 64

      const r = clamp(Math.round(d[idx] + threshold))
      const g = clamp(Math.round(d[idx + 1] + threshold))
      const b = clamp(Math.round(d[idx + 2] + threshold))

      const closest = findClosestColor(r, g, b, palette)
      d[idx] = closest.r
      d[idx + 1] = closest.g
      d[idx + 2] = closest.b
    }
  }
  return out
}

export function applyDithering(imageData: ImageData, algorithm: DitheringAlgorithm, palette: PaletteColor[]): ImageData {
  switch (algorithm) {
    case 'floyd-steinberg': return ditherFloydSteinberg(imageData, palette)
    case 'atkinson': return ditherAtkinson(imageData, palette)
    case 'sierra': return ditherSierra(imageData, palette)
    case 'ordered-2x2': return ditherOrdered(imageData, palette, 2)
    case 'ordered-4x4': return ditherOrdered(imageData, palette, 4)
    case 'ordered-8x8': return ditherOrdered(imageData, palette, 8)
  }
}
