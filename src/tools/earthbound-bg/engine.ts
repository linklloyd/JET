/**
 * Animation engine: manages two background layers, composites them
 * with alpha blending, and drives the requestAnimationFrame loop.
 */

import { BackgroundLayer } from './background-layer'

export const SNES_WIDTH = 256
export const SNES_HEIGHT = 224

export interface EngineOptions {
  fps: number
  aspectRatio: number
  frameSkip: number
  alpha: [number, number]
  canvas: HTMLCanvasElement
}

export class Engine {
  layers: [BackgroundLayer, BackgroundLayer]
  fps: number
  aspectRatio: number
  frameSkip: number
  alpha: [number, number]
  canvas: HTMLCanvasElement
  tick: number = 0
  private frameId: number = -1
  private running: boolean = false

  constructor(layers: [BackgroundLayer, BackgroundLayer], opts: EngineOptions) {
    this.layers = layers
    this.fps = opts.fps
    this.aspectRatio = opts.aspectRatio
    this.frameSkip = opts.frameSkip
    this.alpha = opts.alpha
    this.canvas = opts.canvas
  }

  start(): void {
    if (this.running) return
    this.running = true

    // Auto-adjust alpha: if only one layer has a valid entry, make it opaque
    if (this.layers[0].entry >= 0 && this.layers[1].entry < 0) {
      this.alpha = [1, 0]
    }
    if (this.layers[0].entry < 0 && this.layers[1].entry >= 0) {
      this.alpha = [0, 1]
    }

    const context = this.canvas.getContext('2d')!
    context.imageSmoothingEnabled = false
    this.canvas.width = SNES_WIDTH
    this.canvas.height = SNES_HEIGHT
    const image = context.getImageData(0, 0, SNES_WIDTH, SNES_HEIGHT)

    let then = performance.now()
    const fpsInterval = 1000 / this.fps

    const drawFrame = (): void => {
      if (!this.running) return
      this.frameId = requestAnimationFrame(drawFrame)

      const now = performance.now()
      const elapsed = now - then
      if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval)

        let bitmap: Uint8ClampedArray = image.data
        for (let i = 0; i < this.layers.length; ++i) {
          if (this.layers[i].entry < 0) continue
          bitmap = this.layers[i].overlayFrame(
            image.data,
            this.aspectRatio,
            this.tick,
            this.alpha[i],
            i === 0
          ) as Uint8ClampedArray
        }

        this.tick += this.frameSkip
        image.data.set(bitmap)
        context.putImageData(image, 0, 0)
      }
    }

    drawFrame()
  }

  stop(): void {
    this.running = false
    if (this.frameId > 0) {
      cancelAnimationFrame(this.frameId)
      this.frameId = -1
    }
  }

  isRunning(): boolean {
    return this.running
  }

  /** Render a single frame to the canvas and advance the tick */
  renderFrame(): void {
    // Auto-adjust alpha
    if (this.layers[0].entry >= 0 && this.layers[1].entry < 0) {
      this.alpha = [1, 0]
    }
    if (this.layers[0].entry < 0 && this.layers[1].entry >= 0) {
      this.alpha = [0, 1]
    }

    const context = this.canvas.getContext('2d')!
    context.imageSmoothingEnabled = false
    this.canvas.width = SNES_WIDTH
    this.canvas.height = SNES_HEIGHT
    const image = context.getImageData(0, 0, SNES_WIDTH, SNES_HEIGHT)

    let bitmap: Uint8ClampedArray = image.data
    for (let i = 0; i < this.layers.length; ++i) {
      if (this.layers[i].entry < 0) continue
      bitmap = this.layers[i].overlayFrame(
        image.data,
        this.aspectRatio,
        this.tick,
        this.alpha[i],
        i === 0
      ) as Uint8ClampedArray
    }

    this.tick += this.frameSkip
    image.data.set(bitmap)
    context.putImageData(image, 0, 0)
  }

  /** Reset tick counter (useful when changing layers) */
  reset(): void {
    this.tick = 0
  }

  /** Update a single layer at runtime */
  setLayer(index: 0 | 1, entry: number): void {
    this.layers[index] = new BackgroundLayer(entry)
    // Recalculate alpha
    const has0 = this.layers[0].entry >= 0
    const has1 = this.layers[1].entry >= 0
    if (has0 && !has1) {
      this.alpha = [1, 0]
    } else if (!has0 && has1) {
      this.alpha = [0, 1]
    } else if (has0 && has1) {
      this.alpha = [0.5, 0.5]
    }
  }
}
