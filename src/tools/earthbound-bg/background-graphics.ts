/**
 * Background graphics: loads and decodes SNES 4bpp/2bpp tile data,
 * then draws tiles into a pixel buffer using arrangement data.
 */

import { readBlock, snesToHex } from './rom'

/** Palette-like interface that both BackgroundPalette and PaletteCycle share */
interface PaletteProvider {
  getColors(subPalette: number): number[]
}

export class ROMGraphics {
  bitsPerPixel: number
  gfxData: Int16Array | null = null
  tiles: number[][][] = []

  constructor(bitsPerPixel: number) {
    this.bitsPerPixel = bitsPerPixel
  }

  buildTiles(): void {
    if (!this.gfxData) return
    const n = this.gfxData.length / (8 * this.bitsPerPixel)
    this.tiles = []
    for (let i = 0; i < n; ++i) {
      this.tiles.push(new Array(8))
      const o = i * 8 * this.bitsPerPixel
      for (let x = 0; x < 8; ++x) {
        this.tiles[i][x] = new Array(8)
        for (let y = 0; y < 8; ++y) {
          let c = 0
          for (let bp = 0; bp < this.bitsPerPixel; ++bp) {
            const halfBp = Math.floor(bp / 2)
            const gfx = this.gfxData[o + y * 2 + (halfBp * 16 + (bp & 1))]
            c += ((gfx & (1 << (7 - x))) >> (7 - x)) << bp
          }
          this.tiles[i][x][y] = c
        }
      }
    }
  }

  draw(bmp: Int16Array, palette: PaletteProvider, arrayData: Int16Array): Int16Array {
    const stride = 1024
    for (let i = 0; i < 32; ++i) {
      for (let j = 0; j < 32; ++j) {
        const n = j * 32 + i
        const b1 = arrayData[n * 2]
        const b2 = arrayData[n * 2 + 1] << 8
        const block = b1 + b2
        const tile = block & 0x3ff
        const verticalFlip = (block & 0x8000) !== 0
        const horizontalFlip = (block & 0x4000) !== 0
        const subPalette = (block >> 10) & 7
        this.drawTile(bmp, stride, i * 8, j * 8, palette, tile, subPalette, verticalFlip, horizontalFlip)
      }
    }
    return bmp
  }

  drawTile(
    pixels: Int16Array,
    stride: number,
    x: number,
    y: number,
    palette: PaletteProvider,
    tile: number,
    subPalette: number,
    verticalFlip: boolean,
    horizontalFlip: boolean
  ): void {
    const subPaletteArray = palette.getColors(subPalette)
    for (let i = 0; i < 8; ++i) {
      const px = horizontalFlip ? x + 7 - i : x + i
      for (let j = 0; j < 8; ++j) {
        const rgbArray = subPaletteArray[this.tiles[tile][i][j]]
        const py = verticalFlip ? y + 7 - j : y + j
        const pos = 4 * px + stride * py
        pixels[pos + 0] = (rgbArray >> 16) & 0xff
        pixels[pos + 1] = (rgbArray >> 8) & 0xff
        pixels[pos + 2] = rgbArray & 0xff
      }
    }
  }

  loadGraphics(block: { decompress(): Int16Array }): void {
    this.gfxData = block.decompress()
    this.buildTiles()
  }
}

export class BackgroundGraphics {
  arrayData: Int16Array | null = null
  romGraphics: ROMGraphics

  constructor(index: number, bitsPerPixel: number) {
    this.romGraphics = new ROMGraphics(bitsPerPixel)
    this.read(index)
  }

  read(index: number): void {
    /* Graphics pointer table entry */
    const graphicsPointerBlock = readBlock(0xd7a1 + index * 4)
    /* Read graphics */
    this.romGraphics.loadGraphics(readBlock(snesToHex(graphicsPointerBlock.readInt32())))
    /* Arrangement pointer table entry */
    const arrayPointerBlock = readBlock(0xd93d + index * 4)
    const arrayPointer = snesToHex(arrayPointerBlock.readInt32())
    /* Read and decompress arrangement */
    const arrayBlock = readBlock(arrayPointer)
    this.arrayData = arrayBlock.decompress()
  }

  draw(bitmap: Int16Array, palette: PaletteProvider): Int16Array {
    return this.romGraphics.draw(bitmap, palette, this.arrayData!)
  }
}
