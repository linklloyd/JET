/* ─── Minimal GIF89a Decoder ─── */

export interface GifFrame {
  imageData: ImageData
  delay: number
}

/** Decode a GIF file's raw bytes into composited frames */
export function decodeGifFrames(data: Uint8Array): { frames: GifFrame[]; width: number; height: number } {
  const frames: GifFrame[] = []
  let pos = 0

  // Header
  const header = String.fromCharCode(...data.slice(0, 6))
  if (!header.startsWith('GIF')) return { frames, width: 0, height: 0 }
  pos = 6

  // Logical screen descriptor
  const width = data[pos] | (data[pos + 1] << 8)
  const height = data[pos + 2] | (data[pos + 3] << 8)
  const packed = data[pos + 4]
  const hasGCT = (packed & 0x80) !== 0
  const gctSize = hasGCT ? 3 * (1 << ((packed & 0x07) + 1)) : 0
  pos += 7

  // Global color table
  const gct: number[] = []
  if (hasGCT) {
    for (let i = 0; i < gctSize; i++) gct.push(data[pos + i])
    pos += gctSize
  }

  let currentDelay = 10
  let transparentIdx = -1
  let disposalMethod = 0

  // Canvas for compositing
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  let prevImageData: ImageData | null = null

  while (pos < data.length) {
    const block = data[pos++]
    if (block === 0x3b) break // Trailer

    if (block === 0x21) {
      // Extension
      const label = data[pos++]
      if (label === 0xf9) {
        // Graphics Control Extension
        const blockSize = data[pos++]
        const gcPacked = data[pos]
        disposalMethod = (gcPacked >> 2) & 0x07
        const hasTransparent = (gcPacked & 0x01) !== 0
        currentDelay = data[pos + 1] | (data[pos + 2] << 8)
        if (currentDelay === 0) currentDelay = 10
        transparentIdx = hasTransparent ? data[pos + 3] : -1
        pos += blockSize
        pos++ // block terminator
      } else {
        // Skip other extensions
        while (pos < data.length) {
          const size = data[pos++]
          if (size === 0) break
          pos += size
        }
      }
      continue
    }

    if (block === 0x2c) {
      // Image descriptor
      const left = data[pos] | (data[pos + 1] << 8)
      const top = data[pos + 2] | (data[pos + 3] << 8)
      const fWidth = data[pos + 4] | (data[pos + 5] << 8)
      const fHeight = data[pos + 6] | (data[pos + 7] << 8)
      const imgPacked = data[pos + 8]
      const hasLCT = (imgPacked & 0x80) !== 0
      const interlaced = (imgPacked & 0x40) !== 0
      const lctSize = hasLCT ? 3 * (1 << ((imgPacked & 0x07) + 1)) : 0
      pos += 9

      const colorTable = hasLCT ? Array.from(data.slice(pos, pos + lctSize)) : gct
      if (hasLCT) pos += lctSize

      // LZW decode
      const lzwMinCode = data[pos++]
      const compressedData: number[] = []
      while (pos < data.length) {
        const subBlockSize = data[pos++]
        if (subBlockSize === 0) break
        for (let i = 0; i < subBlockSize; i++) compressedData.push(data[pos++])
      }

      const indices = lzwDecode(compressedData, lzwMinCode)

      // Handle disposal before drawing new frame
      if (disposalMethod === 2) {
        ctx.clearRect(left, top, fWidth, fHeight)
      } else if (disposalMethod === 3 && prevImageData) {
        ctx.putImageData(prevImageData, 0, 0)
      }

      if (disposalMethod === 3) {
        prevImageData = ctx.getImageData(0, 0, width, height)
      }

      // Draw frame pixels
      const frameData = ctx.getImageData(left, top, fWidth, fHeight)
      const pixels = frameData.data

      const passStarts = interlaced ? [0, 4, 2, 1] : [0]
      const passSteps = interlaced ? [8, 8, 4, 2] : [1]

      let srcIdx = 0
      for (let pass = 0; pass < passStarts.length; pass++) {
        for (let y = passStarts[pass]; y < fHeight && srcIdx < indices.length; y += passSteps[pass]) {
          for (let x = 0; x < fWidth && srcIdx < indices.length; x++) {
            const colorIdx = indices[srcIdx++]
            if (colorIdx === transparentIdx) continue
            const dstIdx = (y * fWidth + x) * 4
            pixels[dstIdx] = colorTable[colorIdx * 3] ?? 0
            pixels[dstIdx + 1] = colorTable[colorIdx * 3 + 1] ?? 0
            pixels[dstIdx + 2] = colorTable[colorIdx * 3 + 2] ?? 0
            pixels[dstIdx + 3] = 255
          }
        }
      }

      ctx.putImageData(frameData, left, top)
      frames.push({
        imageData: ctx.getImageData(0, 0, width, height),
        delay: currentDelay,
      })

      transparentIdx = -1
      currentDelay = 10
      continue
    }

    // Skip unknown blocks
    if (block !== 0x00) {
      while (pos < data.length) {
        const size = data[pos++]
        if (size === 0) break
        pos += size
      }
    }
  }

  return { frames, width, height }
}

/** LZW decoder for GIF */
function lzwDecode(compressed: number[], minCodeSize: number): number[] {
  const clearCode = 1 << minCodeSize
  const eoiCode = clearCode + 1
  const output: number[] = []

  let codeSize = minCodeSize + 1
  let nextCode = eoiCode + 1
  let table: number[][] = []

  const resetTable = () => {
    table = []
    for (let i = 0; i < clearCode; i++) table[i] = [i]
    table[clearCode] = []
    table[eoiCode] = []
    nextCode = eoiCode + 1
    codeSize = minCodeSize + 1
  }

  let bits = 0
  let bitCount = 0
  let byteIdx = 0

  const readCode = (): number => {
    while (bitCount < codeSize && byteIdx < compressed.length) {
      bits |= compressed[byteIdx++] << bitCount
      bitCount += 8
    }
    const code = bits & ((1 << codeSize) - 1)
    bits >>= codeSize
    bitCount -= codeSize
    return code
  }

  resetTable()
  let code = readCode()
  if (code !== clearCode) resetTable()

  code = readCode()
  if (code === eoiCode || !table[code]) return output
  let prev = table[code]
  output.push(...prev)

  while (byteIdx < compressed.length || bitCount >= codeSize) {
    code = readCode()
    if (code === eoiCode) break
    if (code === clearCode) {
      resetTable()
      code = readCode()
      if (code === eoiCode) break
      if (!table[code]) break
      prev = table[code]
      output.push(...prev)
      continue
    }

    let entry: number[]
    if (table[code]) {
      entry = table[code]
    } else if (code === nextCode) {
      entry = [...prev, prev[0]]
    } else {
      break
    }

    output.push(...entry)
    if (nextCode < 4096) {
      table[nextCode++] = [...prev, entry[0]]
      if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++
    }
    prev = entry
  }

  return output
}
