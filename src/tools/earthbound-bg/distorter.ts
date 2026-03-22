/**
 * Distorter: applies per-scanline sinusoidal distortion to a bitmap.
 * Three distortion modes:
 *   HORIZONTAL: shifts each scanline left/right
 *   HORIZONTAL_INTERLACED: alternates shift direction per scanline
 *   VERTICAL: remaps Y coordinates with compression
 */

import { HORIZONTAL, HORIZONTAL_INTERLACED, VERTICAL, type DistortionEffect } from './distortion-effect'

const SNES_WIDTH = 256
const SNES_HEIGHT = 224

const { PI, sin, round, floor } = Math

const R = 0
const G = 1
const B = 2
const A = 3

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

export class Distorter {
  bitmap: Int16Array
  effect: DistortionEffect | null = null

  // Precomputed constants
  private C1 = 1 / 512
  private C2 = (8 * PI) / (1024 * 256)
  private C3 = PI / 60

  // Per-frame computed values
  private amplitude = 0
  private frequency = 0
  private compression = 1
  private speed = 0
  private S: (y: number) => number = () => 0

  constructor(bitmap: Int16Array) {
    this.bitmap = bitmap
  }

  setOffsetConstants(ticks: number, effect: DistortionEffect): void {
    const t2 = ticks * 2
    this.amplitude = this.C1 * (effect.amplitude + effect.amplitudeAcceleration * t2)
    this.frequency = this.C2 * (effect.frequency + effect.frequencyAcceleration * t2)
    this.compression = 1 + (effect.compression + effect.compressionAcceleration * t2) / 256
    this.speed = this.C3 * effect.speed * ticks
    this.S = (y: number) => round(this.amplitude * sin(this.frequency * y + this.speed))
  }

  overlayFrame(
    dst: Uint8ClampedArray,
    letterbox: number,
    ticks: number,
    alpha: number,
    erase: boolean
  ): Uint8ClampedArray {
    if (!this.effect) return dst
    return this.computeFrame(dst, this.bitmap, letterbox, ticks, alpha, erase, this.effect)
  }

  getAppliedOffset(y: number, distortionEffect: number): number {
    const s = this.S(y)
    switch (distortionEffect) {
      case HORIZONTAL:
        return s
      case HORIZONTAL_INTERLACED:
        return y % 2 === 0 ? -s : s
      case VERTICAL:
        return mod(floor(s + y * this.compression), 256)
      default:
        return s
    }
  }

  computeFrame(
    destinationBitmap: Uint8ClampedArray,
    sourceBitmap: Int16Array,
    letterbox: number,
    ticks: number,
    alpha: number,
    erase: boolean,
    effect: DistortionEffect
  ): Uint8ClampedArray {
    const distortionEffect = effect.type
    const newBitmap = destinationBitmap
    const oldBitmap = sourceBitmap
    const dstStride = 1024
    const srcStride = 1024

    this.setOffsetConstants(ticks, effect)

    for (let y = 0; y < SNES_HEIGHT; ++y) {
      const offset = this.getAppliedOffset(y, distortionEffect)
      const L = distortionEffect === VERTICAL ? offset : y

      for (let x = 0; x < SNES_WIDTH; ++x) {
        const bPos = x * 4 + y * dstStride

        if (y < letterbox || y > SNES_HEIGHT - letterbox) {
          newBitmap[bPos + R] = 0
          newBitmap[bPos + G] = 0
          newBitmap[bPos + B] = 0
          newBitmap[bPos + A] = 255
          continue
        }

        let dx = x
        if (distortionEffect === HORIZONTAL || distortionEffect === HORIZONTAL_INTERLACED) {
          dx = mod(x + offset, SNES_WIDTH)
        }

        const sPos = dx * 4 + L * srcStride

        if (erase) {
          newBitmap[bPos + R] = alpha * oldBitmap[sPos + R]
          newBitmap[bPos + G] = alpha * oldBitmap[sPos + G]
          newBitmap[bPos + B] = alpha * oldBitmap[sPos + B]
          newBitmap[bPos + A] = 255
        } else {
          newBitmap[bPos + R] += alpha * oldBitmap[sPos + R]
          newBitmap[bPos + G] += alpha * oldBitmap[sPos + G]
          newBitmap[bPos + B] += alpha * oldBitmap[sPos + B]
          newBitmap[bPos + A] = 255
        }
      }
    }

    return newBitmap
  }
}
