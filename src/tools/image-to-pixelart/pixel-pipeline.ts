/* ─── PixelOver-Inspired Pixel Art Pipeline ─── */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ColorMetric = 'rgb' | 'cielab'
export type DitherMode = 'none' | 'floyd-steinberg' | 'bayer2' | 'bayer4' | 'bayer8'
export type ScaleAlgorithm = 'nearest' | 'cleanEdge' | 'epx' | 'mmpx'
export type CollisionMode = 'bbox' | 'silhouette'

export interface PipelineOptions {
  // Downscale
  pixelSize: number

  // Color grading
  brightness: number   // -100 to 100
  contrast: number     // -100 to 100
  saturation: number   // -100 to 100

  // Palette
  paletteMode: 'auto' | 'preset'
  paletteColors?: string[]  // hex colors for preset mode
  colorCount: number        // for auto mode
  colorMetric: ColorMetric

  // Dithering
  ditherMode: DitherMode
  ditherStrength: number    // 0.0 to 1.0

  // Edges
  outline: boolean
  outlineColor: string     // hex
  outlineWidth: 1 | 2
  inline: boolean
  inlineThreshold: number  // 0.0 to 1.0
  inlineOpacity: number    // 0.0 to 1.0

  // Collision
  collision: boolean
  collisionMode: CollisionMode

  // Scaling
  scaleAlgorithm: ScaleAlgorithm

  // Polish
  edgePolish: boolean
}

export interface CollisionData {
  type: 'bbox' | 'polygon'
  x?: number
  y?: number
  width?: number
  height?: number
  points?: [number, number][]
}

export const DEFAULT_OPTIONS: PipelineOptions = {
  pixelSize: 8,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  paletteMode: 'auto',
  colorCount: 16,
  colorMetric: 'cielab',
  ditherMode: 'none',
  ditherStrength: 1.0,
  outline: false,
  outlineColor: '#000000',
  outlineWidth: 1,
  inline: false,
  inlineThreshold: 0.3,
  inlineOpacity: 0.4,
  collision: false,
  collisionMode: 'bbox',
  scaleAlgorithm: 'nearest',
  edgePolish: false,
}

// ---------------------------------------------------------------------------
// CIELab Color Space
// ---------------------------------------------------------------------------

function srgbToLinear(c: number): number {
  c /= 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b)
  return [
    (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / 0.95047,
    (0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb) / 1.00000,
    (0.0193339 * lr + 0.0116000 * lg + 0.9503041 * lb) / 1.08883,
  ]
}

function xyzToLabF(t: number): number {
  return t > 0.008856 ? t ** (1 / 3) : (7.787 * t) + 16 / 116
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const [x, y, z] = rgbToXyz(r, g, b)
  const fx = xyzToLabF(x), fy = xyzToLabF(y), fz = xyzToLabF(z)
  return [
    116 * fy - 16,
    500 * (fx - fy),
    200 * (fy - fz),
  ]
}

export function labDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

function rgbDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

// ---------------------------------------------------------------------------
// Color Grading
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v] }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hue2rgb(p, q, h + 1/3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1/3) * 255),
  ]
}

export function applyColorGrading(imgData: ImageData, brightness: number, contrast: number, saturation: number): ImageData {
  if (brightness === 0 && contrast === 0 && saturation === 0) return imgData
  const data = new Uint8ClampedArray(imgData.data)
  const bFactor = brightness / 100
  const cFactor = (contrast + 100) / 100
  const sFactor = saturation / 100

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    let r = data[i], g = data[i + 1], b = data[i + 2]

    // Brightness
    r = clamp(r + bFactor * 255, 0, 255)
    g = clamp(g + bFactor * 255, 0, 255)
    b = clamp(b + bFactor * 255, 0, 255)

    // Contrast
    r = clamp((r - 128) * cFactor + 128, 0, 255)
    g = clamp((g - 128) * cFactor + 128, 0, 255)
    b = clamp((b - 128) * cFactor + 128, 0, 255)

    // Saturation
    if (sFactor !== 0) {
      const [h, s, l] = rgbToHsl(r, g, b)
      const newS = clamp(s + sFactor, 0, 1)
      const [nr, ng, nb] = hslToRgb(h, newS, l)
      r = nr; g = ng; b = nb
    }

    data[i] = r; data[i + 1] = g; data[i + 2] = b
  }
  return new ImageData(data, imgData.width, imgData.height)
}

// ---------------------------------------------------------------------------
// Palette Generation (Median Cut)
// ---------------------------------------------------------------------------

function medianCut(pixels: [number, number, number][], maxColors: number): [number, number, number][] {
  if (pixels.length === 0) return [[0, 0, 0]]
  let sampled = pixels
  if (pixels.length > 10000) {
    const step = Math.ceil(pixels.length / 10000)
    sampled = []
    for (let i = 0; i < pixels.length; i += step) sampled.push(pixels[i])
  }

  type Bucket = [number, number, number][]
  let buckets: Bucket[] = [sampled]

  while (buckets.length < maxColors) {
    let maxRange = -1, maxIdx = 0, splitCh = 0
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i]
      if (b.length < 2) continue
      for (let ch = 0; ch < 3; ch++) {
        let lo = 255, hi = 0
        for (const p of b) { if (p[ch] < lo) lo = p[ch]; if (p[ch] > hi) hi = p[ch] }
        if (hi - lo > maxRange) { maxRange = hi - lo; maxIdx = i; splitCh = ch }
      }
    }
    if (maxRange <= 0) break
    const bucket = buckets[maxIdx]
    bucket.sort((a, b) => a[splitCh] - b[splitCh])
    const mid = Math.floor(bucket.length / 2)
    buckets.splice(maxIdx, 1, bucket.slice(0, mid), bucket.slice(mid))
  }

  return buckets.map(b => {
    let r = 0, g = 0, bl = 0
    for (const p of b) { r += p[0]; g += p[1]; bl += p[2] }
    return [Math.round(r / b.length), Math.round(g / b.length), Math.round(bl / b.length)] as [number, number, number]
  })
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

// ---------------------------------------------------------------------------
// Palette Indexation
// ---------------------------------------------------------------------------

interface PaletteMatch {
  primary: [number, number, number]
  secondary: [number, number, number]
  primaryDist: number
  secondaryDist: number
}

function findNearestTwo(
  palette: [number, number, number][],
  labPalette: [number, number, number][],
  r: number, g: number, b: number,
  metric: ColorMetric
): PaletteMatch {
  let best = 0, secondBest = 0
  let bestDist = Infinity, secondDist = Infinity

  if (metric === 'cielab') {
    const lab = rgbToLab(r, g, b)
    for (let i = 0; i < palette.length; i++) {
      const d = labDistance(lab, labPalette[i])
      if (d < bestDist) { secondDist = bestDist; secondBest = best; bestDist = d; best = i }
      else if (d < secondDist) { secondDist = d; secondBest = i }
    }
  } else {
    for (let i = 0; i < palette.length; i++) {
      const d = rgbDistance(r, g, b, palette[i][0], palette[i][1], palette[i][2])
      if (d < bestDist) { secondDist = bestDist; secondBest = best; bestDist = d; best = i }
      else if (d < secondDist) { secondDist = d; secondBest = i }
    }
  }

  return {
    primary: palette[best],
    secondary: palette[secondBest === best ? (best + 1) % palette.length : secondBest],
    primaryDist: bestDist,
    secondaryDist: secondDist,
  }
}

// ---------------------------------------------------------------------------
// Dithering
// ---------------------------------------------------------------------------

const BAYER_2 = [[0, 2], [3, 1]]
const BAYER_4 = [
  [0, 8, 2, 10], [12, 4, 14, 6],
  [3, 11, 1, 9], [15, 7, 13, 5],
]
const BAYER_8 = (() => {
  const m: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0))
  const b4 = BAYER_4
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      m[y][x] = b4[y % 4][x % 4] * 4 + b4[Math.floor(y / 4) * 2 + (x >= 4 ? 1 : 0)][y < 4 ? x % 4 : x % 4]
    }
  }
  // Proper 8x8 Bayer: use the recursive formula
  const base = BAYER_4
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const by = y % 4, bx = x % 4
      const qy = Math.floor(y / 4), qx = Math.floor(x / 4)
      const quadrant = qy * 2 + qx
      m[y][x] = 4 * base[by][bx] + [0, 2, 3, 1][quadrant]
    }
  }
  return m
})()

function getBayerMatrix(size: 2 | 4 | 8): { matrix: number[][]; max: number } {
  if (size === 2) return { matrix: BAYER_2, max: 4 }
  if (size === 4) return { matrix: BAYER_4, max: 16 }
  return { matrix: BAYER_8, max: 64 }
}

export function applyOrderedDither(
  imgData: ImageData,
  palette: [number, number, number][],
  labPalette: [number, number, number][],
  bayerSize: 2 | 4 | 8,
  strength: number,
  metric: ColorMetric,
): ImageData {
  const data = new Uint8ClampedArray(imgData.data)
  const { width: w, height: h } = imgData
  const { matrix, max } = getBayerMatrix(bayerSize)
  const size = bayerSize

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (data[i + 3] < 128) continue

      const match = findNearestTwo(palette, labPalette, data[i], data[i + 1], data[i + 2], metric)
      const threshold = (matrix[y % size][x % size] + 0.5) / max
      const totalDist = match.primaryDist + match.secondaryDist
      const ratio = totalDist > 0 ? match.primaryDist / totalDist : 0

      const chosen = (ratio * strength > threshold) ? match.secondary : match.primary
      data[i] = chosen[0]; data[i + 1] = chosen[1]; data[i + 2] = chosen[2]
    }
  }
  return new ImageData(data, w, h)
}

export function applyFloydSteinberg(
  imgData: ImageData,
  palette: [number, number, number][],
  labPalette: [number, number, number][],
  metric: ColorMetric,
): ImageData {
  const data = new Uint8ClampedArray(imgData.data)
  const { width: w, height: h } = imgData

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (data[i + 3] < 128) continue

      const r = data[i], g = data[i + 1], b = data[i + 2]
      const match = findNearestTwo(palette, labPalette, r, g, b, metric)
      const c = match.primary

      const errR = r - c[0], errG = g - c[1], errB = b - c[2]
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]

      const diffuse: [number, number, number][] = [
        [x + 1, y, 7 / 16], [x - 1, y + 1, 3 / 16],
        [x, y + 1, 5 / 16], [x + 1, y + 1, 1 / 16],
      ]
      for (const [dx, dy, f] of diffuse) {
        if (dx < 0 || dx >= w || dy >= h) continue
        const j = (dy * w + dx) * 4
        data[j] = clamp(data[j] + errR * f, 0, 255)
        data[j + 1] = clamp(data[j + 1] + errG * f, 0, 255)
        data[j + 2] = clamp(data[j + 2] + errB * f, 0, 255)
      }
    }
  }
  return new ImageData(data, w, h)
}

function applyNoPaletteDither(
  imgData: ImageData,
  palette: [number, number, number][],
  labPalette: [number, number, number][],
  metric: ColorMetric,
): ImageData {
  const data = new Uint8ClampedArray(imgData.data)
  const { width: w, height: h } = imgData
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (data[i + 3] < 128) continue
      const match = findNearestTwo(palette, labPalette, data[i], data[i + 1], data[i + 2], metric)
      data[i] = match.primary[0]; data[i + 1] = match.primary[1]; data[i + 2] = match.primary[2]
    }
  }
  return new ImageData(data, w, h)
}

// ---------------------------------------------------------------------------
// Edge Detection
// ---------------------------------------------------------------------------

export function detectOutlineEdges(imgData: ImageData, width: 1 | 2): Uint8Array {
  const { width: w, height: h, data } = imgData
  const edges = new Uint8Array(w * h)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (data[i + 3] < 128) continue // transparent pixel

      // Check neighbors for transparency → silhouette edge
      const r = width === 2 ? 2 : 1
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx, ny = y + dy
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) { edges[y * w + x] = 1; break }
          const j = (ny * w + nx) * 4
          if (data[j + 3] < 128) { edges[y * w + x] = 1; break }
        }
        if (edges[y * w + x]) break
      }
    }
  }
  return edges
}

export function detectInlineEdges(imgData: ImageData, threshold: number): Uint8Array {
  const { width: w, height: h, data } = imgData
  const edges = new Uint8Array(w * h)
  const t2 = (threshold * 255) ** 2 * 3 // threshold squared in RGB space

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (data[i + 3] < 128) continue

      const r = data[i], g = data[i + 1], b = data[i + 2]
      // Check 4-connected neighbors for color discontinuity
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
        const j = (ny * w + nx) * 4
        if (data[j + 3] < 128) continue // skip transparent neighbors (that's outline territory)
        const dist = (r - data[j]) ** 2 + (g - data[j + 1]) ** 2 + (b - data[j + 2]) ** 2
        if (dist > t2) { edges[y * w + x] = 1; break }
      }
    }
  }
  return edges
}

// ---------------------------------------------------------------------------
// Pixel Scaling Algorithms
// ---------------------------------------------------------------------------

function getPixel(data: Uint8ClampedArray, w: number, h: number, x: number, y: number): [number, number, number, number] {
  if (x < 0 || x >= w || y < 0 || y >= h) return [0, 0, 0, 0]
  const i = (y * w + x) * 4
  return [data[i], data[i + 1], data[i + 2], data[i + 3]]
}

function setPixel(data: Uint8ClampedArray, w: number, x: number, y: number, c: [number, number, number, number]) {
  const i = (y * w + x) * 4
  data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = c[3]
}

function pixelsEqual(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]
}

function luma(c: [number, number, number, number]): number {
  return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
}

export function scaleNearestNeighbor(imgData: ImageData, factor: number): ImageData {
  const { width: w, height: h, data: src } = imgData
  const nw = w * factor, nh = h * factor
  const dst = new Uint8ClampedArray(nw * nh * 4)
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const sx = Math.floor(x / factor), sy = Math.floor(y / factor)
      const si = (sy * w + sx) * 4, di = (y * nw + x) * 4
      dst[di] = src[si]; dst[di + 1] = src[si + 1]; dst[di + 2] = src[si + 2]; dst[di + 3] = src[si + 3]
    }
  }
  return new ImageData(dst, nw, nh)
}

/** Scale2x / EPX — classic edge-aware 2× scaler */
export function scaleEPX(imgData: ImageData): ImageData {
  const { width: w, height: h, data: src } = imgData
  const nw = w * 2, nh = h * 2
  const dst = new Uint8ClampedArray(nw * nh * 4)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const P = getPixel(src, w, h, x, y)
      const A = getPixel(src, w, h, x, y - 1)
      const B = getPixel(src, w, h, x + 1, y)
      const C = getPixel(src, w, h, x - 1, y)
      const D = getPixel(src, w, h, x, y + 1)

      let p0 = P, p1 = P, p2 = P, p3 = P
      if (!pixelsEqual(C, B) && !pixelsEqual(A, D)) {
        if (pixelsEqual(C, A)) p0 = C
        if (pixelsEqual(A, B)) p1 = B
        if (pixelsEqual(C, D)) p2 = C
        if (pixelsEqual(D, B)) p3 = D
      }

      setPixel(dst, nw, x * 2, y * 2, p0)
      setPixel(dst, nw, x * 2 + 1, y * 2, p1)
      setPixel(dst, nw, x * 2, y * 2 + 1, p2)
      setPixel(dst, nw, x * 2 + 1, y * 2 + 1, p3)
    }
  }
  return new ImageData(dst, nw, nh)
}

/** MMPX — Morgan McGuire's luma-based 2× scaler */
export function scaleMmpx(imgData: ImageData): ImageData {
  const { width: w, height: h, data: src } = imgData
  const nw = w * 2, nh = h * 2
  const dst = new Uint8ClampedArray(nw * nh * 4)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const P = getPixel(src, w, h, x, y)
      const A = getPixel(src, w, h, x, y - 1)
      const B = getPixel(src, w, h, x + 1, y)
      const C = getPixel(src, w, h, x - 1, y)
      const D = getPixel(src, w, h, x, y + 1)

      const lA = luma(A), lB = luma(B), lC = luma(C), lD = luma(D)

      let p0 = P, p1 = P, p2 = P, p3 = P

      if (!pixelsEqual(C, B) && !pixelsEqual(A, D)) {
        // Use luma to decide diagonal preference
        const acDiff = Math.abs(lA - lC)
        const abDiff = Math.abs(lA - lB)
        const cdDiff = Math.abs(lC - lD)
        const bdDiff = Math.abs(lB - lD)

        if (pixelsEqual(A, C) || (acDiff < abDiff && acDiff < cdDiff)) p0 = A[3] > P[3] ? P : A
        if (pixelsEqual(A, B) || (abDiff < acDiff && abDiff < bdDiff)) p1 = A[3] > P[3] ? P : B
        if (pixelsEqual(C, D) || (cdDiff < acDiff && cdDiff < bdDiff)) p2 = C[3] > P[3] ? P : C
        if (pixelsEqual(D, B) || (bdDiff < abDiff && bdDiff < cdDiff)) p3 = D[3] > P[3] ? P : D
      }

      setPixel(dst, nw, x * 2, y * 2, p0)
      setPixel(dst, nw, x * 2 + 1, y * 2, p1)
      setPixel(dst, nw, x * 2, y * 2 + 1, p2)
      setPixel(dst, nw, x * 2 + 1, y * 2 + 1, p3)
    }
  }
  return new ImageData(dst, nw, nh)
}

/** cleanEdge-inspired scaler — detects diagonal slopes for clean pixel lines */
export function scaleCleanEdge(imgData: ImageData, factor: number): ImageData {
  if (factor <= 1) return imgData
  // For factor=2, use EPX as base then apply slope detection
  // For higher factors, use nearest neighbor then polish
  if (factor === 2) {
    return scaleEPX(imgData)
  }

  // For larger factors: EPX to 2×, then nearest neighbor to target
  const epx = scaleEPX(imgData)
  const remaining = Math.ceil(factor / 2)
  if (remaining <= 1) return epx
  return scaleNearestNeighbor(epx, remaining)
}

// ---------------------------------------------------------------------------
// Edge Polish
// ---------------------------------------------------------------------------

export function polishEdges(imgData: ImageData): ImageData {
  const { width: w, height: h } = imgData
  const data = new Uint8ClampedArray(imgData.data)

  // Scan for single-pixel staircase bumps and smooth them
  // A bump is a pixel that differs from both its horizontal neighbors AND both its vertical neighbors
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4
      if (data[i + 3] < 128) continue

      const c = [data[i], data[i + 1], data[i + 2]] as const
      const left = [(y * w + x - 1) * 4, data[(y * w + x - 1) * 4], data[(y * w + x - 1) * 4 + 1], data[(y * w + x - 1) * 4 + 2]] as const
      const right = [(y * w + x + 1) * 4, data[(y * w + x + 1) * 4], data[(y * w + x + 1) * 4 + 1], data[(y * w + x + 1) * 4 + 2]] as const
      const up = [((y - 1) * w + x) * 4, data[((y - 1) * w + x) * 4], data[((y - 1) * w + x) * 4 + 1], data[((y - 1) * w + x) * 4 + 2]] as const
      const down = [((y + 1) * w + x) * 4, data[((y + 1) * w + x) * 4], data[((y + 1) * w + x) * 4 + 1], data[((y + 1) * w + x) * 4 + 2]] as const

      // If left==right and they differ from center, and up==down and they differ from center,
      // this is an isolated bump — blend with the majority
      const hMatch = left[1] === right[1] && left[2] === right[2] && left[3] === right[3]
      const vMatch = up[1] === down[1] && up[2] === down[2] && up[3] === down[3]
      const hDiff = left[1] !== c[0] || left[2] !== c[1] || left[3] !== c[2]
      const vDiff = up[1] !== c[0] || up[2] !== c[1] || up[3] !== c[2]

      if (hMatch && vMatch && hDiff && vDiff) {
        // Replace with horizontal neighbor (more common in pixel art)
        data[i] = left[1]; data[i + 1] = left[2]; data[i + 2] = left[3]
      }
    }
  }
  return new ImageData(data, w, h)
}

// ---------------------------------------------------------------------------
// Collision Detection
// ---------------------------------------------------------------------------

export function computeBBox(imgData: ImageData): CollisionData {
  const { width: w, height: h, data } = imgData
  let minX = w, minY = h, maxX = 0, maxY = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] >= 128) {
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
      }
    }
  }
  if (minX > maxX) return { type: 'bbox', x: 0, y: 0, width: 0, height: 0 }
  return { type: 'bbox', x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

export function computeSilhouette(imgData: ImageData): CollisionData {
  const { width: w, height: h, data } = imgData
  // March around the outside of non-transparent pixels
  const points: [number, number][] = []

  // Simple contour: scan top-to-bottom, collect leftmost and rightmost opaque pixels per row
  const leftEdge: number[] = []
  const rightEdge: number[] = []

  for (let y = 0; y < h; y++) {
    let left = -1, right = -1
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] >= 128) {
        if (left === -1) left = x
        right = x
      }
    }
    leftEdge.push(left)
    rightEdge.push(right)
  }

  // Build polygon: go down the left edge, then up the right edge
  for (let y = 0; y < h; y++) {
    if (leftEdge[y] >= 0) points.push([leftEdge[y], y])
  }
  for (let y = h - 1; y >= 0; y--) {
    if (rightEdge[y] >= 0) points.push([rightEdge[y] + 1, y])
  }

  // Simplify: remove collinear points
  const simplified: [number, number][] = []
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length]
    const curr = points[i]
    const next = points[(i + 1) % points.length]
    const dx1 = curr[0] - prev[0], dy1 = curr[1] - prev[1]
    const dx2 = next[0] - curr[0], dy2 = next[1] - curr[1]
    if (dx1 * dy2 !== dy1 * dx2) simplified.push(curr)
  }

  return { type: 'polygon', points: simplified.length > 0 ? simplified : points }
}

// ---------------------------------------------------------------------------
// Full Pipeline
// ---------------------------------------------------------------------------

export interface PipelineResult {
  /** The small (1:1 pixel) result before scaling */
  small: ImageData
  /** The upscaled result with edges and polish */
  scaled: ImageData
  /** Edge maps (outline and inline) at 1:1 resolution */
  outlineEdges?: Uint8Array
  inlineEdges?: Uint8Array
  /** Collision data if requested */
  collision?: CollisionData
}

export function runPixelPipeline(
  source: ImageData,
  opts: PipelineOptions,
): PipelineResult {
  const { pixelSize } = opts

  // 1. Downscale
  const smallW = Math.max(1, Math.ceil(source.width / pixelSize))
  const smallH = Math.max(1, Math.ceil(source.height / pixelSize))
  const smallCanvas = document.createElement('canvas')
  smallCanvas.width = smallW; smallCanvas.height = smallH
  const smallCtx = smallCanvas.getContext('2d')!
  smallCtx.imageSmoothingEnabled = true
  smallCtx.imageSmoothingQuality = 'medium'
  // Put source onto a temp canvas first
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = source.width; srcCanvas.height = source.height
  srcCanvas.getContext('2d')!.putImageData(source, 0, 0)
  smallCtx.drawImage(srcCanvas, 0, 0, smallW, smallH)
  let current = smallCtx.getImageData(0, 0, smallW, smallH)

  // 2. Color grading
  current = applyColorGrading(current, opts.brightness, opts.contrast, opts.saturation)

  // 3. Build palette
  let palette: [number, number, number][]
  if (opts.paletteMode === 'preset' && opts.paletteColors && opts.paletteColors.length > 0) {
    palette = opts.paletteColors.map(hexToRgb)
  } else {
    const pixels: [number, number, number][] = []
    for (let i = 0; i < current.data.length; i += 4) {
      if (current.data[i + 3] < 128) continue
      pixels.push([current.data[i], current.data[i + 1], current.data[i + 2]])
    }
    palette = medianCut(pixels, opts.colorCount)
  }
  // Pre-compute CIELab values for palette
  const labPalette = palette.map(c => rgbToLab(c[0], c[1], c[2]))

  // 4. Palette indexation + dithering
  if (opts.ditherMode === 'floyd-steinberg') {
    current = applyFloydSteinberg(current, palette, labPalette, opts.colorMetric)
  } else if (opts.ditherMode.startsWith('bayer')) {
    const size = parseInt(opts.ditherMode.replace('bayer', '')) as 2 | 4 | 8
    current = applyOrderedDither(current, palette, labPalette, size, opts.ditherStrength, opts.colorMetric)
  } else {
    current = applyNoPaletteDither(current, palette, labPalette, opts.colorMetric)
  }

  const small = new ImageData(new Uint8ClampedArray(current.data), current.width, current.height)

  // 5. Edge detection (at 1:1 pixel resolution)
  let outlineEdges: Uint8Array | undefined
  let inlineEdges: Uint8Array | undefined
  if (opts.outline) outlineEdges = detectOutlineEdges(current, opts.outlineWidth)
  if (opts.inline) inlineEdges = detectInlineEdges(current, opts.inlineThreshold)

  // 6. Edge polish (before scaling)
  if (opts.edgePolish) current = polishEdges(current)

  // 7. Pixel scaling
  let scaled: ImageData
  switch (opts.scaleAlgorithm) {
    case 'epx': {
      // EPX is always 2×, then nearest to target
      let result = scaleEPX(current)
      const remaining = Math.ceil(pixelSize / 2)
      if (remaining > 1) result = scaleNearestNeighbor(result, remaining)
      scaled = result
      break
    }
    case 'mmpx': {
      let result = scaleMmpx(current)
      const remaining = Math.ceil(pixelSize / 2)
      if (remaining > 1) result = scaleNearestNeighbor(result, remaining)
      scaled = result
      break
    }
    case 'cleanEdge':
      scaled = scaleCleanEdge(current, pixelSize)
      break
    case 'nearest':
    default:
      scaled = scaleNearestNeighbor(current, pixelSize)
  }

  // 8. Composite edges onto scaled image
  if (outlineEdges || inlineEdges) {
    const d = scaled.data
    const sw = scaled.width
    const oc = hexToRgb(opts.outlineColor)
    const factor = scaled.width / small.width

    for (let sy = 0; sy < small.height; sy++) {
      for (let sx = 0; sx < small.width; sx++) {
        const si = sy * small.width + sx

        if (outlineEdges && outlineEdges[si]) {
          for (let py = 0; py < factor; py++) {
            for (let px = 0; px < factor; px++) {
              const di = ((sy * factor + py) * sw + (sx * factor + px)) * 4
              d[di] = oc[0]; d[di + 1] = oc[1]; d[di + 2] = oc[2]; d[di + 3] = 255
            }
          }
        } else if (inlineEdges && inlineEdges[si]) {
          const opacity = opts.inlineOpacity
          for (let py = 0; py < factor; py++) {
            for (let px = 0; px < factor; px++) {
              const di = ((sy * factor + py) * sw + (sx * factor + px)) * 4
              // Darken the existing color
              d[di] = Math.round(d[di] * (1 - opacity * 0.5))
              d[di + 1] = Math.round(d[di + 1] * (1 - opacity * 0.5))
              d[di + 2] = Math.round(d[di + 2] * (1 - opacity * 0.5))
            }
          }
        }
      }
    }
  }

  // 9. Collision
  let collision: CollisionData | undefined
  if (opts.collision) {
    collision = opts.collisionMode === 'bbox' ? computeBBox(small) : computeSilhouette(small)
  }

  return { small, scaled, outlineEdges, inlineEdges, collision }
}
