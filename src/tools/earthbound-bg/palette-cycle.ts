/**
 * Palette cycling: animates palette colors by rotating subsets.
 * Supports 3 cycling types:
 *   1: Single range rotation
 *   2: Dual range rotation
 *   3: Ping-pong (bounce) rotation
 */

import type { BattleBackground } from './battle-background'
import type { BackgroundPalette } from './background-palette'

export class PaletteCycle {
  type: number
  start1: number
  end1: number
  start2: number
  end2: number
  speed: number
  cycleCountdown: number
  cycleCount: number
  originalColors: number[][]
  nowColors: number[][]

  constructor(background: BattleBackground, palette: BackgroundPalette) {
    this.type = background.paletteCycleType
    this.start1 = background.paletteCycle1Start
    this.end1 = background.paletteCycle1End
    this.start2 = background.paletteCycle2Start
    this.end2 = background.paletteCycle2End
    this.speed = background.paletteCycleSpeed / 2
    this.cycleCountdown = this.speed
    this.cycleCount = 0
    this.originalColors = palette.getColorMatrix()
    this.nowColors = []

    /* Duplicate original colors to simplify cycle math */
    for (let subPaletteNumber = 0; subPaletteNumber < this.originalColors.length; ++subPaletteNumber) {
      this.nowColors[subPaletteNumber] = []
      for (let i = 16; i < 32; ++i) {
        this.originalColors[subPaletteNumber][i] = this.originalColors[subPaletteNumber][i - 16]
        this.nowColors[subPaletteNumber][i - 16] = this.originalColors[subPaletteNumber][i]
      }
    }
  }

  getColors(subPalette: number): number[] {
    return this.nowColors[subPalette]
  }

  cycle(): boolean {
    if (this.speed === 0) {
      return false
    }
    --this.cycleCountdown
    if (this.cycleCountdown <= 0) {
      this.cycleColors()
      ++this.cycleCount
      this.cycleCountdown = this.speed
      return true
    }
    return false
  }

  cycleColors(): void {
    if (this.type === 1 || this.type === 2) {
      const cycleLength = this.end1 - this.start1 + 1
      const cycle1Position = this.cycleCount % cycleLength
      for (let subPaletteNumber = 0; subPaletteNumber < this.originalColors.length; ++subPaletteNumber) {
        for (let i = this.start1; i <= this.end1; ++i) {
          let newColor = i - cycle1Position
          if (newColor < this.start1) {
            newColor += cycleLength
          }
          this.nowColors[subPaletteNumber][i] = this.originalColors[subPaletteNumber][newColor]
        }
      }
    }

    if (this.type === 2) {
      const cycleLength = this.end2 - this.start2 + 1
      const cycle2Position = this.cycleCount % cycleLength
      for (let subPaletteNumber = 0; subPaletteNumber < this.originalColors.length; ++subPaletteNumber) {
        for (let i = this.start2; i <= this.end2; ++i) {
          let newColor = i - cycle2Position
          if (newColor < this.start2) {
            newColor += cycleLength
          }
          this.nowColors[subPaletteNumber][i] = this.originalColors[subPaletteNumber][newColor]
        }
      }
    }

    if (this.type === 3) {
      const cycleLength = this.end1 - this.start1 + 1
      const cycle1Position = this.cycleCount % (cycleLength * 2)
      for (let subPaletteNumber = 0; subPaletteNumber < this.originalColors.length; ++subPaletteNumber) {
        for (let i = this.start1; i <= this.end1; ++i) {
          let newColor = i + cycle1Position
          let difference = 0
          if (newColor > this.end1) {
            difference = newColor - this.end1 - 1
            newColor = this.end1 - difference
            if (newColor < this.start1) {
              difference = this.start1 - newColor - 1
              newColor = this.start1 + difference
            }
          }
          this.nowColors[subPaletteNumber][i] = this.originalColors[subPaletteNumber][newColor]
        }
      }
    }
  }
}
