/**
 * Background palette: reads 15-bit BGR SNES palette data.
 * Each color is 2 bytes: 0BBBBBGG GGGRRRRR
 * Stored as 32-bit ARGB integers internally.
 */

import { readBlock, snesToHex } from './rom'

export class BackgroundPalette {
  colors: number[][] | null = null
  bitsPerPixel: number

  constructor(index: number, bitsPerPixel: number) {
    this.bitsPerPixel = bitsPerPixel
    this.read(index)
  }

  read(index: number): void {
    const pointer = readBlock(0xdad9 + index * 4)
    const address = snesToHex(pointer.readInt32())
    const data = readBlock(address)
    this.readPalette(data, this.bitsPerPixel, 1)
  }

  getColors(palette: number): number[] {
    return this.colors![palette]
  }

  getColorMatrix(): number[][] {
    return this.colors!
  }

  readPalette(
    block: { readDoubleShort(): number },
    bitsPerPixel: number,
    count: number
  ): void {
    if (bitsPerPixel !== 2 && bitsPerPixel !== 4) {
      throw new Error('Palette error: Incorrect color depth specified.')
    }
    if (count < 1) {
      throw new Error('Palette error: Must specify positive number of subpalettes.')
    }
    this.colors = new Array(count)
    const power = 2 ** bitsPerPixel
    for (let palette = 0; palette < count; ++palette) {
      this.colors[palette] = new Array(power)
      for (let i = 0; i < power; i++) {
        const clr16 = block.readDoubleShort()
        const b = ((clr16 >> 10) & 31) * 8
        const g = ((clr16 >> 5) & 31) * 8
        const r = (clr16 & 31) * 8
        // ARGB packed integer
        this.colors[palette][i] = (0xff << 24) | (r << 16) | (g << 8) | b
      }
    }
  }
}
