function getPixel(data: Uint8ClampedArray, w: number, x: number, y: number, h: number): number {
  const cx = Math.max(0, Math.min(w - 1, x))
  const cy = Math.max(0, Math.min(h - 1, y))
  const i = (cy * w + cx) * 4
  return (data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]
}

function r(c: number) { return (c >> 24) & 0xff }
function g(c: number) { return (c >> 16) & 0xff }
function b(c: number) { return (c >> 8) & 0xff }
function a(c: number) { return c & 0xff }

function yuv(c: number): [number, number, number] {
  const rr = r(c), gg = g(c), bb = b(c)
  return [
    0.299 * rr + 0.587 * gg + 0.114 * bb,
    -0.169 * rr - 0.331 * gg + 0.5 * bb,
    0.5 * rr - 0.419 * gg - 0.081 * bb,
  ]
}

function colorDist(c1: number, c2: number): number {
  const [y1, u1, v1] = yuv(c1)
  const [y2, u2, v2] = yuv(c2)
  const dy = y1 - y2
  const du = u1 - u2
  const dv = v1 - v2
  return 48 * dy * dy + 7 * du * du + 6 * dv * dv
}

function blend(c1: number, c2: number, w1: number, w2: number): number {
  const total = w1 + w2
  return packColor(
    Math.round((r(c1) * w1 + r(c2) * w2) / total),
    Math.round((g(c1) * w1 + g(c2) * w2) / total),
    Math.round((b(c1) * w1 + b(c2) * w2) / total),
    Math.round((a(c1) * w1 + a(c2) * w2) / total),
  )
}

function packColor(r: number, g: number, b: number, a: number): number {
  return (r << 24) | (g << 16) | (b << 8) | a
}

function setPixelPacked(data: Uint8ClampedArray, w: number, x: number, y: number, c: number) {
  const i = (y * w + x) * 4
  data[i] = r(c)
  data[i + 1] = g(c)
  data[i + 2] = b(c)
  data[i + 3] = a(c)
}

export function xbr2x(src: ImageData): ImageData {
  const sw = src.width
  const sh = src.height
  const dw = sw * 2
  const dh = sh * 2
  const dst = new ImageData(dw, dh)
  const threshold = 400

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const e = getPixel(src.data, sw, x, y, sh)

      const a0 = getPixel(src.data, sw, x - 1, y - 1, sh)
      const b0 = getPixel(src.data, sw, x, y - 1, sh)
      const c0 = getPixel(src.data, sw, x + 1, y - 1, sh)
      const d0 = getPixel(src.data, sw, x - 1, y, sh)
      const f0 = getPixel(src.data, sw, x + 1, y, sh)
      const g0 = getPixel(src.data, sw, x - 1, y + 1, sh)
      const h0 = getPixel(src.data, sw, x, y + 1, sh)
      const i0 = getPixel(src.data, sw, x + 1, y + 1, sh)

      let e0 = e, e1 = e, e2 = e, e3 = e

      if (colorDist(e, f0) < threshold && colorDist(e, h0) < threshold) {
        // similar to right and bottom — keep
      } else {
        if (colorDist(b0, f0) < colorDist(b0, d0) && colorDist(e, a0) > colorDist(e, c0)) {
          e1 = blend(e, f0, 3, 1)
        }
        if (colorDist(d0, h0) < colorDist(d0, b0) && colorDist(e, i0) > colorDist(e, g0)) {
          e2 = blend(e, h0, 3, 1)
        }
        if (colorDist(h0, f0) < colorDist(h0, d0) && colorDist(e, g0) > colorDist(e, i0)) {
          e3 = blend(e, f0, 2, 1)
        }
        if (colorDist(b0, d0) < colorDist(b0, f0) && colorDist(e, c0) > colorDist(e, a0)) {
          e0 = blend(e, d0, 3, 1)
        }
      }

      const dx = x * 2
      const dy = y * 2
      setPixelPacked(dst.data, dw, dx, dy, e0)
      setPixelPacked(dst.data, dw, dx + 1, dy, e1)
      setPixelPacked(dst.data, dw, dx, dy + 1, e2)
      setPixelPacked(dst.data, dw, dx + 1, dy + 1, e3)
    }
  }

  return dst
}

export function xbrScale(src: ImageData, scale: number): ImageData {
  let result = src
  let currentScale = 1
  while (currentScale < scale) {
    result = xbr2x(result)
    currentScale *= 2
  }
  return result
}
