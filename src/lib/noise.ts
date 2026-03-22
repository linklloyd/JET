/**
 * Shared noise utilities for procedural generation.
 */

/** Seeded pseudo-random number generator (LCG). */
export function seedRng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

/** Quintic fade curve for smooth interpolation. */
export function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/** Linear interpolation between a and b. */
export function lerp(t: number, a: number, b: number): number {
  return a + t * (b - a)
}

/** Gradient function for Perlin noise. */
export function grad(hash: number, x: number, y: number): number {
  const h = hash & 3
  return h === 0 ? x + y : h === 1 ? -x + y : h === 2 ? x - y : -x - y
}

/** Generate a 512-element permutation table from a seeded RNG. */
export function generatePermTable(rng: () => number): number[] {
  const perm = Array.from({ length: 512 }, (_, i) => i % 256)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  for (let i = 0; i < 256; i++) perm[256 + i] = perm[i]
  return perm
}

/** Classic Perlin noise (2D). Returns value in range [-1, 1]. */
export function perlinNoise(x: number, y: number, perm: number[]): number {
  const X = Math.floor(x) & 255
  const Y = Math.floor(y) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)
  const u = fade(xf)
  const v = fade(yf)
  const aa = perm[perm[X] + Y]
  const ab = perm[perm[X] + Y + 1]
  const ba = perm[perm[X + 1] + Y]
  const bb = perm[perm[X + 1] + Y + 1]
  return lerp(
    v,
    lerp(u, grad(aa, xf, yf), grad(ba, xf - 1, yf)),
    lerp(u, grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1)),
  )
}

/**
 * Simplex noise (2D). Returns value in range approximately [-1, 1].
 * Based on the simplex noise algorithm with skewing to triangular grid.
 */
export function simplexNoise(x: number, y: number, perm: number[]): number {
  const F2 = 0.5 * (Math.sqrt(3) - 1)
  const G2 = (3 - Math.sqrt(3)) / 6

  const s = (x + y) * F2
  const i = Math.floor(x + s)
  const j = Math.floor(y + s)
  const t = (i + j) * G2

  const X0 = i - t
  const Y0 = j - t
  const x0 = x - X0
  const y0 = y - Y0

  let i1: number, j1: number
  if (x0 > y0) {
    i1 = 1
    j1 = 0
  } else {
    i1 = 0
    j1 = 1
  }

  const x1 = x0 - i1 + G2
  const y1 = y0 - j1 + G2
  const x2 = x0 - 1 + 2 * G2
  const y2 = y0 - 1 + 2 * G2

  const ii = i & 255
  const jj = j & 255

  const gi0 = perm[ii + perm[jj]] % 12
  const gi1 = perm[ii + i1 + perm[jj + j1]] % 12
  const gi2 = perm[ii + 1 + perm[jj + 1]] % 12

  const grad3 = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, 1], [1, -1], [-1, -1],
  ]

  let n0 = 0, n1 = 0, n2 = 0

  let t0 = 0.5 - x0 * x0 - y0 * y0
  if (t0 >= 0) {
    t0 *= t0
    n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0)
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1
  if (t1 >= 0) {
    t1 *= t1
    n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1)
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2
  if (t2 >= 0) {
    t2 *= t2
    n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2)
  }

  return 70 * (n0 + n1 + n2)
}

/** Voronoi / Worley / cellular noise (2D). Returns value in range [0, 1]. */
export function voronoiNoise(
  x: number,
  y: number,
  points: { x: number; y: number }[],
): number {
  let minDist = Infinity
  for (const p of points) {
    const dx = x - p.x
    const dy = y - p.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < minDist) minDist = dist
  }
  return Math.min(minDist, 1)
}

/** Checkerboard pattern. Returns 0 or 1. */
export function checkerboard(x: number, y: number, scale: number): number {
  const cx = Math.floor(x / scale)
  const cy = Math.floor(y / scale)
  return (cx + cy) % 2 === 0 ? 0 : 1
}

/** Gradient noise (linear or radial). Returns value in range [0, 1]. */
export function gradientNoise(
  x: number,
  y: number,
  width: number,
  height: number,
  type: 'linear' | 'radial',
): number {
  if (type === 'linear') {
    return x / (width - 1 || 1)
  }
  // radial
  const cx = width / 2
  const cy = height / 2
  const maxDist = Math.sqrt(cx * cx + cy * cy)
  const dx = x - cx
  const dy = y - cy
  const dist = Math.sqrt(dx * dx + dy * dy)
  return Math.min(dist / maxDist, 1)
}
