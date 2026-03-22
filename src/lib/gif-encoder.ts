/* ─── Minimal GIF89a Encoder ─── */

export function encodeGif(width: number, height: number, frames: ImageData[], delay: number): Uint8Array {
  const buf: number[] = []

  const globalPalette = buildGlobalPalette(frames)
  const paletteSize = 256
  const paletteBits = 8

  // Header
  writeStr(buf, 'GIF89a')
  writeU16(buf, width)
  writeU16(buf, height)
  buf.push(0xf0 | (paletteBits - 1))
  buf.push(0)
  buf.push(0)

  // Global Color Table
  for (let i = 0; i < paletteSize; i++) {
    buf.push(globalPalette[i * 3] ?? 0)
    buf.push(globalPalette[i * 3 + 1] ?? 0)
    buf.push(globalPalette[i * 3 + 2] ?? 0)
  }

  // Netscape extension for looping
  buf.push(0x21, 0xff, 0x0b)
  writeStr(buf, 'NETSCAPE2.0')
  buf.push(0x03, 0x01)
  writeU16(buf, 0)
  buf.push(0x00)

  // Frames
  for (const frame of frames) {
    buf.push(0x21, 0xf9, 0x04)
    buf.push(0x09)
    writeU16(buf, delay)
    buf.push(findTransparentIndex())
    buf.push(0x00)

    buf.push(0x2c)
    writeU16(buf, 0)
    writeU16(buf, 0)
    writeU16(buf, width)
    writeU16(buf, height)
    buf.push(0x00)

    const indices = quantizeFrame(frame, globalPalette)
    const lzwMinCodeSize = paletteBits
    buf.push(lzwMinCodeSize)
    const compressed = lzwEncode(indices, lzwMinCodeSize)
    let offset = 0
    while (offset < compressed.length) {
      const blockSize = Math.min(255, compressed.length - offset)
      buf.push(blockSize)
      for (let i = 0; i < blockSize; i++) buf.push(compressed[offset + i])
      offset += blockSize
    }
    buf.push(0x00)
  }

  buf.push(0x3b)
  return new Uint8Array(buf)
}

function buildGlobalPalette(frames: ImageData[]): number[] {
  const colorCounts = new Map<number, number>()
  for (const frame of frames) {
    const d = frame.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue
      const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]
      colorCounts.set(key, (colorCounts.get(key) || 0) + 1)
    }
  }

  const sorted = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 255)
  const palette: number[] = []
  for (const [key] of sorted) {
    palette.push((key >> 16) & 0xff)
    palette.push((key >> 8) & 0xff)
    palette.push(key & 0xff)
  }
  while (palette.length < 256 * 3) palette.push(0)
  palette[255 * 3] = 0
  palette[255 * 3 + 1] = 0
  palette[255 * 3 + 2] = 0
  return palette
}

function findTransparentIndex(): number {
  return 255
}

function quantizeFrame(frame: ImageData, palette: number[]): number[] {
  const indices: number[] = []
  const d = frame.data
  const numColors = palette.length / 3

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) {
      indices.push(255)
      continue
    }
    const r = d[i], g = d[i + 1], b = d[i + 2]
    let bestIdx = 0
    let bestDist = Infinity
    for (let c = 0; c < numColors - 1; c++) {
      const dr = r - palette[c * 3]
      const dg = g - palette[c * 3 + 1]
      const db = b - palette[c * 3 + 2]
      const dist = dr * dr + dg * dg + db * db
      if (dist < bestDist) { bestDist = dist; bestIdx = c }
      if (dist === 0) break
    }
    indices.push(bestIdx)
  }
  return indices
}

function lzwEncode(indices: number[], minCodeSize: number): number[] {
  const clearCode = 1 << minCodeSize
  const eoiCode = clearCode + 1
  let codeSize = minCodeSize + 1
  let nextCode = eoiCode + 1
  const maxCode = 4096

  const output: number[] = []
  let bits = 0
  let bitCount = 0

  const emit = (code: number) => {
    bits |= code << bitCount
    bitCount += codeSize
    while (bitCount >= 8) {
      output.push(bits & 0xff)
      bits >>= 8
      bitCount -= 8
    }
  }

  let table = new Map<string, number>()
  const resetTable = () => {
    table = new Map()
    for (let i = 0; i < clearCode; i++) table.set(String(i), i)
    nextCode = eoiCode + 1
    codeSize = minCodeSize + 1
  }

  emit(clearCode)
  resetTable()

  if (indices.length === 0) { emit(eoiCode); if (bitCount > 0) output.push(bits & 0xff); return output }

  let current = String(indices[0])
  for (let i = 1; i < indices.length; i++) {
    const next = current + ',' + indices[i]
    if (table.has(next)) {
      current = next
    } else {
      emit(table.get(current)!)
      if (nextCode < maxCode) {
        table.set(next, nextCode++)
        if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++
      } else {
        emit(clearCode)
        resetTable()
      }
      current = String(indices[i])
    }
  }
  emit(table.get(current)!)
  emit(eoiCode)
  if (bitCount > 0) output.push(bits & 0xff)
  return output
}

function writeU16(buf: number[], val: number) {
  buf.push(val & 0xff, (val >> 8) & 0xff)
}

function writeStr(buf: number[], str: string) {
  for (let i = 0; i < str.length; i++) buf.push(str.charCodeAt(i))
}
