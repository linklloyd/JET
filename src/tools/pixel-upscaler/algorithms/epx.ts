function getPixel(data: Uint8ClampedArray, w: number, x: number, y: number, h: number): [number, number, number, number] {
  if (x < 0 || x >= w || y < 0 || y >= h) return [0, 0, 0, 0]
  const i = (y * w + x) * 4
  return [data[i], data[i + 1], data[i + 2], data[i + 3]]
}

function eq(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]
}

function setPixel(data: Uint8ClampedArray, w: number, x: number, y: number, c: [number, number, number, number]) {
  const i = (y * w + x) * 4
  data[i] = c[0]
  data[i + 1] = c[1]
  data[i + 2] = c[2]
  data[i + 3] = c[3]
}

export function epxScale2x(src: ImageData): ImageData {
  const sw = src.width
  const sh = src.height
  const dw = sw * 2
  const dh = sh * 2
  const dst = new ImageData(dw, dh)

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const P = getPixel(src.data, sw, x, y, sh)
      const A = getPixel(src.data, sw, x, y - 1, sh)
      const B = getPixel(src.data, sw, x + 1, y, sh)
      const C = getPixel(src.data, sw, x - 1, y, sh)
      const D = getPixel(src.data, sw, x, y + 1, sh)

      let p1 = P, p2 = P, p3 = P, p4 = P

      if (eq(C, A) && !eq(C, D) && !eq(A, B)) p1 = A
      if (eq(A, B) && !eq(A, C) && !eq(B, D)) p2 = B
      if (eq(D, C) && !eq(D, B) && !eq(C, A)) p3 = C
      if (eq(B, D) && !eq(B, A) && !eq(D, C)) p4 = D

      const dx = x * 2
      const dy = y * 2
      setPixel(dst.data, dw, dx, dy, p1)
      setPixel(dst.data, dw, dx + 1, dy, p2)
      setPixel(dst.data, dw, dx, dy + 1, p3)
      setPixel(dst.data, dw, dx + 1, dy + 1, p4)
    }
  }

  return dst
}

export function epxScale(src: ImageData, scale: number): ImageData {
  let result = src
  let currentScale = 1
  while (currentScale < scale) {
    result = epxScale2x(result)
    currentScale *= 2
  }
  return result
}
