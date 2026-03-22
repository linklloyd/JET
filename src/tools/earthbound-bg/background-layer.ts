/**
 * Background layer: ties together graphics, palette, distortion effect,
 * and palette cycling for a single background layer.
 */

import { BackgroundGraphics } from './background-graphics'
import { BackgroundPalette } from './background-palette'
import { DistortionEffect } from './distortion-effect'
import { BattleBackground } from './battle-background'
import { Distorter } from './distorter'
import { PaletteCycle } from './palette-cycle'

const WIDTH = 256
const HEIGHT = 256

export class BackgroundLayer {
  entry: number
  graphics: BackgroundGraphics | null = null
  paletteCycle: PaletteCycle | null = null
  pixels: Int16Array
  distorter: Distorter

  // ROM object cache (replaces the original ROM.getObject pattern)
  private battleBackgrounds: Map<number, BattleBackground> = new Map()
  private bgGraphics: Map<number, BackgroundGraphics> = new Map()
  private bgPalettes: Map<number, BackgroundPalette> = new Map()

  // Palette bit-depth tracking
  private paletteBits: Map<number, number> = new Map()
  private graphicsBits: Map<number, number> = new Map()

  constructor(entry: number) {
    this.entry = entry
    this.pixels = new Int16Array(WIDTH * HEIGHT * 4)
    this.distorter = new Distorter(this.pixels)
    if (entry >= 0) {
      this.loadEntry(entry)
    }
  }

  overlayFrame(
    bitmap: Uint8ClampedArray,
    letterbox: number,
    ticks: number,
    alpha: number,
    erase: boolean
  ): Uint8ClampedArray {
    if (this.paletteCycle !== null) {
      this.paletteCycle.cycle()
      this.graphics!.draw(this.pixels, this.paletteCycle)
    }
    return this.distorter.overlayFrame(bitmap, letterbox, ticks, alpha, erase)
  }

  private getBattleBackground(index: number): BattleBackground {
    if (!this.battleBackgrounds.has(index)) {
      this.battleBackgrounds.set(index, new BattleBackground(index))
    }
    return this.battleBackgrounds.get(index)!
  }

  private getBackgroundGraphics(index: number, bitsPerPixel: number): BackgroundGraphics {
    if (!this.bgGraphics.has(index)) {
      this.bgGraphics.set(index, new BackgroundGraphics(index, bitsPerPixel))
    }
    return this.bgGraphics.get(index)!
  }

  private getBackgroundPalette(index: number, bitsPerPixel: number): BackgroundPalette {
    if (!this.bgPalettes.has(index)) {
      this.bgPalettes.set(index, new BackgroundPalette(index, bitsPerPixel))
    }
    return this.bgPalettes.get(index)!
  }

  loadEntry(index: number): void {
    this.entry = index
    const background = this.getBattleBackground(index)

    // Track bit depth for palette consistency
    this.paletteBits.set(background.paletteIndex, background.bitsPerPixel)
    this.graphicsBits.set(background.graphicsIndex, background.bitsPerPixel)

    // Load graphics
    this.graphics = this.getBackgroundGraphics(background.graphicsIndex, background.bitsPerPixel)

    // Load palette with cycling
    const palette = this.getBackgroundPalette(background.paletteIndex, background.bitsPerPixel)
    this.paletteCycle = new PaletteCycle(background, palette)

    // Load distortion effect
    const animation = background.animation
    const e1 = (animation >> 24) & 0xff
    const e2 = (animation >> 16) & 0xff
    this.distorter.effect = new DistortionEffect(e2 || e1)

    // Draw initial frame
    this.graphics.draw(this.pixels, this.paletteCycle)
  }
}
