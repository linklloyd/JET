/**
 * Distortion effect parameters.
 * Each effect is 17 bytes of data controlling the sinusoidal distortion.
 */

import { readBlock } from './rom'

export const HORIZONTAL = 1
export const HORIZONTAL_INTERLACED = 2
export const VERTICAL = 3

function asInt16(value: number): number {
  return new Int16Array([value])[0]
}

export class DistortionEffect {
  data: Uint8Array

  constructor(index = 0) {
    this.data = new Uint8Array(17)
    this.read(index)
  }

  static sanitize(type: number): number {
    if (type !== HORIZONTAL && type !== VERTICAL) {
      return HORIZONTAL_INTERLACED
    }
    return type
  }

  get type(): number {
    return DistortionEffect.sanitize(this.data[2])
  }

  get frequency(): number {
    return asInt16(this.data[3] + (this.data[4] << 8))
  }

  get amplitude(): number {
    return asInt16(this.data[5] + (this.data[6] << 8))
  }

  get compression(): number {
    return asInt16(this.data[8] + (this.data[9] << 8))
  }

  get frequencyAcceleration(): number {
    return asInt16(this.data[10] + (this.data[11] << 8))
  }

  get amplitudeAcceleration(): number {
    return asInt16(this.data[12] + (this.data[13] << 8))
  }

  get speed(): number {
    return asInt16(this.data[14])
  }

  get compressionAcceleration(): number {
    return asInt16(this.data[15] + (this.data[16] << 8))
  }

  read(index: number): void {
    const main = readBlock(0xf708 + index * 17)
    for (let i = 0; i < 17; ++i) {
      this.data[i] = main.readInt16()
    }
  }
}
