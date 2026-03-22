/**
 * Battle background data structure.
 * Each background entry is 17 bytes at ROM address 0xADEA1 (file offset 0xDCA1).
 */

import { readBlock } from './rom'

const STRUCT_SIZE = 17

/**
 * Background data table layout (17 bytes per entry):
 *  0: Graphics/Arrangement index
 *  1: Palette index
 *  2: Bits per pixel (2 or 4)
 *  3: Palette cycle type
 *  4: Palette cycle #1 start
 *  5: Palette cycle #1 end
 *  6: Palette cycle #2 start
 *  7: Palette cycle #2 end
 *  8: Palette cycle speed
 *  9-12: Movement data
 * 13-16: Effect animation data
 */
export class BattleBackground {
  bbgData: Int16Array

  constructor(index = 0) {
    this.bbgData = new Int16Array(STRUCT_SIZE)
    this.read(index)
  }

  get graphicsIndex(): number {
    return this.bbgData[0]
  }
  get paletteIndex(): number {
    return this.bbgData[1]
  }
  get bitsPerPixel(): number {
    return this.bbgData[2]
  }
  get paletteCycleType(): number {
    return this.bbgData[3]
  }
  get paletteCycle1Start(): number {
    return this.bbgData[4]
  }
  get paletteCycle1End(): number {
    return this.bbgData[5]
  }
  get paletteCycle2Start(): number {
    return this.bbgData[6]
  }
  get paletteCycle2End(): number {
    return this.bbgData[7]
  }
  get paletteCycleSpeed(): number {
    return this.bbgData[8]
  }
  get animation(): number {
    return (
      (this.bbgData[13] << 24) +
      (this.bbgData[14] << 16) +
      (this.bbgData[15] << 8) +
      this.bbgData[16]
    )
  }

  read(index: number): void {
    const main = readBlock(0xdca1 + index * STRUCT_SIZE)
    for (let i = 0; i < STRUCT_SIZE; ++i) {
      this.bbgData[i] = main.readInt16()
    }
  }
}
