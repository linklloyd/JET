export function nearestNeighbor(src: ImageData, scale: number): ImageData {
  const w = src.width * scale
  const h = src.height * scale
  const dst = new ImageData(w, h)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.floor(x / scale)
      const sy = Math.floor(y / scale)
      const si = (sy * src.width + sx) * 4
      const di = (y * w + x) * 4
      dst.data[di] = src.data[si]
      dst.data[di + 1] = src.data[si + 1]
      dst.data[di + 2] = src.data[si + 2]
      dst.data[di + 3] = src.data[si + 3]
    }
  }

  return dst
}
