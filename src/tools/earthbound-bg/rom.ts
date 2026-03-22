/**
 * ROM data reader and decompression routines.
 * Ported from Earthbound-Battle-Backgrounds-JS (MIT License).
 * Original: https://github.com/gjtorikian/Earthbound-Battle-Backgrounds-JS
 */

const MINIMUM_INDEX = 0
const MAXIMUM_INDEX = 326

const UNCOMPRESSED_BLOCK = 0
const RUN_LENGTH_ENCODED_BYTE = 1
const RUN_LENGTH_ENCODED_SHORT = 2
const INCREMENTAL_SEQUENCE = 3
const REPEAT_PREVIOUS_DATA = 4
const REVERSE_BITS = 5
const UNKNOWN_1 = 6
const UNKNOWN_2 = 7

function generateReversedBytes(): Int16Array {
  const reversedBytes = new Int16Array(256)
  for (let i = 0; i < reversedBytes.length; ++i) {
    const binary = i.toString(2).padStart(8, '0')
    const reversed = [...binary].reverse().join('')
    reversedBytes[i] = Number.parseInt(reversed, 2)
  }
  return reversedBytes
}

const REVERSED_BYTES = generateReversedBytes()

/** Global ROM data buffer - set when ROM is loaded */
let data: Uint8Array = new Uint8Array(0)

export function getRomData(): Uint8Array {
  return data
}

export function setRomData(d: Uint8Array): void {
  data = d
}

/**
 * Convert SNES address to file offset in the truncated ROM data.
 * The truncated data file starts at offset 0xA0000 in the original ROM,
 * so we subtract 0xA0200 (with the 0x200 header).
 */
export function snesToHex(address: number, header = true): number {
  let newAddress = address
  if (newAddress >= 0x400000 && newAddress < 0x600000) {
    newAddress -= 0x0
  } else if (newAddress >= 0xC00000 && newAddress < 0x1000000) {
    newAddress -= 0xC00000
  } else {
    throw new Error(`SNES address out of range: ${newAddress}`)
  }
  if (header) {
    newAddress += 0x200
  }
  return newAddress - 0xA0200
}

export function hexToSnes(address: number, header = true): number {
  let newAddress = address
  if (header) {
    newAddress -= 0x200
  }
  if (newAddress >= 0 && newAddress < 0x400000) {
    return newAddress + 0xC00000
  } else if (newAddress >= 0x400000 && newAddress < 0x600000) {
    return newAddress
  } else {
    throw new Error(`File offset out of range: ${newAddress}`)
  }
}

/** Block: a seekable reader into the ROM data */
export class Block {
  address: number
  pointer: number

  constructor(location: number) {
    this.address = location
    this.pointer = location
  }

  decompress(): Int16Array {
    const size = getCompressedSize(this.pointer, data)
    if (size < 1) {
      throw new Error(`Invalid compressed data: ${size}`)
    }
    let blockOutput = new Int16Array(size)
    const result = decompress(this.pointer, data, blockOutput, 0)
    if (result === null) {
      throw new Error('Computed and actual decompressed sizes do not match.')
    }
    return result
  }

  /** Read a single byte and advance the pointer */
  readInt16(): number {
    return data[this.pointer++]
  }

  /** Read a 32-bit LE integer (4 bytes) */
  readInt32(): number {
    return (
      this.readInt16() +
      (this.readInt16() << 8) +
      (this.readInt16() << 16) +
      (this.readInt16() << 24)
    )
  }

  /** Read a 16-bit LE value as signed Int16 */
  readDoubleShort(): number {
    const fakeShort = new Int16Array([this.readInt16() + (this.readInt16() << 8)])
    return fakeShort[0]
  }
}

export function readBlock(location: number): Block {
  return new Block(location)
}

/**
 * SNES-style decompression routine.
 * Supports 8 command types for decompressing battle background data.
 */
export function decompress(
  start: number,
  romData: Uint8Array,
  output: Int16Array,
  _read: number
): Int16Array | null {
  const maxLength = output.length
  let pos = start
  let bpos = 0
  let bpos2 = 0
  let tmp: number

  while (romData[pos] !== 0xff) {
    if (pos >= romData.length) {
      return null
    }

    let commandType = romData[pos] >> 5
    let len = (romData[pos] & 0x1f) + 1

    if (commandType === 7) {
      commandType = (romData[pos] & 0x1c) >> 2
      len = ((romData[pos] & 3) << 8) + romData[pos + 1] + 1
      ++pos
    }

    if (bpos + len > maxLength || bpos + len < 0) {
      return null
    }

    ++pos

    if (commandType >= 4) {
      bpos2 = (romData[pos] << 8) + romData[pos + 1]
      if (bpos2 >= maxLength || bpos2 < 0) {
        return null
      }
      pos += 2
    }

    switch (commandType) {
      case UNCOMPRESSED_BLOCK:
        while (len-- !== 0) {
          output[bpos++] = romData[pos++]
        }
        break
      case RUN_LENGTH_ENCODED_BYTE:
        while (len-- !== 0) {
          output[bpos++] = romData[pos]
        }
        ++pos
        break
      case RUN_LENGTH_ENCODED_SHORT:
        if (bpos + 2 * len > maxLength || bpos < 0) {
          return null
        }
        while (len-- !== 0) {
          output[bpos++] = romData[pos]
          output[bpos++] = romData[pos + 1]
        }
        pos += 2
        break
      case INCREMENTAL_SEQUENCE:
        tmp = romData[pos++]
        while (len-- !== 0) {
          output[bpos++] = tmp++
        }
        break
      case REPEAT_PREVIOUS_DATA:
        if (bpos2 + len > maxLength || bpos2 < 0) {
          return null
        }
        for (let i = 0; i < len; ++i) {
          output[bpos++] = output[bpos2 + i]
        }
        break
      case REVERSE_BITS:
        if (bpos2 + len > maxLength || bpos2 < 0) {
          return null
        }
        while (len-- !== 0) {
          output[bpos++] = REVERSED_BYTES[output[bpos2++] & 0xff]
        }
        break
      case UNKNOWN_1:
        if (bpos2 - len + 1 < 0) {
          return null
        }
        while (len-- !== 0) {
          output[bpos++] = output[bpos2--]
        }
        break
      default:
      case UNKNOWN_2:
        return null
    }
  }

  return output
}

export function getCompressedSize(start: number, romData: Uint8Array): number {
  let bpos = 0
  let pos = start
  let bpos2 = 0

  while (romData[pos] !== 0xff) {
    if (pos >= romData.length) {
      return -8
    }

    let commandType = romData[pos] >> 5
    let length = (romData[pos] & 0x1f) + 1

    if (commandType === 7) {
      commandType = (romData[pos] & 0x1c) >> 2
      length = ((romData[pos] & 3) << 8) + romData[pos + 1] + 1
      ++pos
    }

    if (bpos + length < 0) {
      return -1
    }

    pos++

    if (commandType >= 4) {
      bpos2 = (romData[pos] << 8) + romData[pos + 1]
      if (bpos2 < 0) {
        return -2
      }
      pos += 2
    }

    switch (commandType) {
      case UNCOMPRESSED_BLOCK:
        bpos += length
        pos += length
        break
      case RUN_LENGTH_ENCODED_BYTE:
        bpos += length
        ++pos
        break
      case RUN_LENGTH_ENCODED_SHORT:
        if (bpos < 0) {
          return -3
        }
        bpos += 2 * length
        pos += 2
        break
      case INCREMENTAL_SEQUENCE:
        bpos += length
        ++pos
        break
      case REPEAT_PREVIOUS_DATA:
        if (bpos2 < 0) {
          return -4
        }
        bpos += length
        break
      case REVERSE_BITS:
        if (bpos2 < 0) {
          return -5
        }
        bpos += length
        break
      case UNKNOWN_1:
        if (bpos2 - length + 1 < 0) {
          return -6
        }
        bpos += length
        break
      default:
      case UNKNOWN_2:
        return -7
    }
  }

  return bpos
}

export { MINIMUM_INDEX, MAXIMUM_INDEX }
