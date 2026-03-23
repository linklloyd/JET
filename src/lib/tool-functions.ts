import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { canvasToBlob } from '../lib/utils'
import { encodeGif } from '../lib/gif-encoder'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function hexToRgbTuple(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)]
}

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}

// ---------------------------------------------------------------------------
// 1. Decompile Spritesheet
// ---------------------------------------------------------------------------

export async function decompileSpritesheet(
  input: Blob,
  config: { cols: number; rows: number; startCol?: number; endCol?: number; startRow?: number; endRow?: number }
): Promise<Blob[]> {
  const img = await blobToImage(input)
  const cellW = Math.floor(img.width / config.cols)
  const cellH = Math.floor(img.height / config.rows)
  const blobs: Blob[] = []

  const startRow = config.startRow ?? 0
  const endRow = (config.endRow ?? -1) < 0 ? config.rows - 1 : config.endRow!
  const startCol = config.startCol ?? 0
  const endCol = (config.endCol ?? -1) < 0 ? config.cols - 1 : config.endCol!

  for (let row = startRow; row <= Math.min(endRow, config.rows - 1); row++) {
    for (let col = startCol; col <= Math.min(endCol, config.cols - 1); col++) {
      const canvas = document.createElement('canvas')
      canvas.width = cellW
      canvas.height = cellH
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, col * cellW, row * cellH, cellW, cellH, 0, 0, cellW, cellH)
      blobs.push(await canvasToBlob(canvas, 'image/png'))
    }
  }

  return blobs
}

// ---------------------------------------------------------------------------
// 2. Compile Spritesheet
// ---------------------------------------------------------------------------

export async function compileSpritesheet(
  inputs: Blob[],
  config: { cols: number; padding?: number }
): Promise<Blob> {
  const images = await Promise.all(inputs.map(blobToImage))
  const padding = config.padding ?? 0
  const cols = config.cols
  const rows = Math.ceil(images.length / cols)

  const cellW = Math.max(...images.map((img) => img.width))
  const cellH = Math.max(...images.map((img) => img.height))

  const canvas = document.createElement('canvas')
  canvas.width = cols * cellW + (cols - 1) * padding
  canvas.height = rows * cellH + (rows - 1) * padding
  const ctx = canvas.getContext('2d')!

  images.forEach((img, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = col * (cellW + padding)
    const y = row * (cellH + padding)
    ctx.drawImage(img, x, y)
  })

  return canvasToBlob(canvas, 'image/png')
}

// ---------------------------------------------------------------------------
// 3. Sprite to GIF
// ---------------------------------------------------------------------------

export async function spriteToGif(
  input: Blob,
  config: { cols: number; rows: number; fps: number; scale?: number; pingPong?: boolean; rowIndex?: number }
): Promise<Blob> {
  const img = await blobToImage(input)
  const cellW = Math.floor(img.width / config.cols)
  const cellH = Math.floor(img.height / config.rows)
  const scale = config.scale ?? 1
  const outW = Math.round(cellW * scale)
  const outH = Math.round(cellH * scale)
  const rowIndex = config.rowIndex ?? -1

  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = cellW
  srcCanvas.height = cellH
  const srcCtx = srcCanvas.getContext('2d')!

  const outCanvas = document.createElement('canvas')
  outCanvas.width = outW
  outCanvas.height = outH
  const outCtx = outCanvas.getContext('2d')!
  outCtx.imageSmoothingEnabled = false

  const frames: ImageData[] = []

  const startRow = rowIndex >= 0 ? rowIndex : 0
  const endRow = rowIndex >= 0 ? rowIndex : config.rows - 1

  for (let row = startRow; row <= endRow; row++) {
    for (let col = 0; col < config.cols; col++) {
      srcCtx.clearRect(0, 0, cellW, cellH)
      srcCtx.drawImage(img, col * cellW, row * cellH, cellW, cellH, 0, 0, cellW, cellH)

      outCtx.clearRect(0, 0, outW, outH)
      outCtx.drawImage(srcCanvas, 0, 0, outW, outH)

      frames.push(outCtx.getImageData(0, 0, outW, outH))
    }
  }

  // Ping pong: append reversed frames (excluding first and last to avoid double)
  if (config.pingPong && frames.length > 2) {
    for (let i = frames.length - 2; i > 0; i--) {
      frames.push(frames[i])
    }
  }

  const delay = Math.round(1000 / config.fps)
  const gifBytes = encodeGif(outW, outH, frames, delay)
  return new Blob([gifBytes as BlobPart], { type: 'image/gif' })
}

// ---------------------------------------------------------------------------
// 4. Image to Pixel Art
// ---------------------------------------------------------------------------

export async function imageToPixelArt(
  input: Blob,
  config: { pixelSize: number; colorCount: number; outline?: boolean; dithering?: boolean }
): Promise<Blob> {
  const img = await blobToImage(input)
  const { pixelSize, colorCount } = config

  const smallW = Math.max(1, Math.round(img.width / pixelSize))
  const smallH = Math.max(1, Math.round(img.height / pixelSize))

  // Downscale
  const smallCanvas = document.createElement('canvas')
  smallCanvas.width = smallW
  smallCanvas.height = smallH
  const smallCtx = smallCanvas.getContext('2d')!
  smallCtx.drawImage(img, 0, 0, smallW, smallH)

  // Quantize colors
  const imageData = smallCtx.getImageData(0, 0, smallW, smallH)
  const data = imageData.data

  // Simple uniform quantization
  const levels = Math.max(2, Math.round(Math.cbrt(colorCount)))
  const step = 255 / (levels - 1)

  if (config.dithering) {
    // Floyd-Steinberg dithering during quantization
    const err = new Float32Array(smallW * smallH * 3)
    for (let i = 0; i < smallW * smallH; i++) {
      err[i * 3] = data[i * 4]
      err[i * 3 + 1] = data[i * 4 + 1]
      err[i * 3 + 2] = data[i * 4 + 2]
    }
    for (let y = 0; y < smallH; y++) {
      for (let x = 0; x < smallW; x++) {
        const idx = y * smallW + x
        const or = Math.max(0, Math.min(255, Math.round(err[idx * 3])))
        const og = Math.max(0, Math.min(255, Math.round(err[idx * 3 + 1])))
        const ob = Math.max(0, Math.min(255, Math.round(err[idx * 3 + 2])))
        const qr = Math.round(Math.round(or / step) * step)
        const qg = Math.round(Math.round(og / step) * step)
        const qb = Math.round(Math.round(ob / step) * step)
        data[idx * 4] = qr; data[idx * 4 + 1] = qg; data[idx * 4 + 2] = qb
        const er = or - qr, eg = og - qg, eb = ob - qb
        const spread = [[x+1,y,7/16],[x-1,y+1,3/16],[x,y+1,5/16],[x+1,y+1,1/16]] as const
        for (const [sx,sy,w] of spread) {
          if (sx >= 0 && sx < smallW && sy < smallH) {
            const si = sy * smallW + sx
            err[si*3] += er*w; err[si*3+1] += eg*w; err[si*3+2] += eb*w
          }
        }
      }
    }
  } else {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.round(Math.round(data[i] / step) * step)
      data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step)
      data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step)
    }
  }

  smallCtx.putImageData(imageData, 0, 0)

  // Upscale with nearest neighbor
  const outCanvas = document.createElement('canvas')
  outCanvas.width = img.width
  outCanvas.height = img.height
  const outCtx = outCanvas.getContext('2d')!
  outCtx.imageSmoothingEnabled = false
  outCtx.drawImage(smallCanvas, 0, 0, img.width, img.height)

  // Draw pixel outlines
  if (config.outline) {
    outCtx.strokeStyle = 'rgba(0,0,0,0.15)'
    outCtx.lineWidth = 1
    for (let x = 0; x <= smallW; x++) {
      outCtx.beginPath()
      outCtx.moveTo(x * pixelSize, 0)
      outCtx.lineTo(x * pixelSize, img.height)
      outCtx.stroke()
    }
    for (let y = 0; y <= smallH; y++) {
      outCtx.beginPath()
      outCtx.moveTo(0, y * pixelSize)
      outCtx.lineTo(img.width, y * pixelSize)
      outCtx.stroke()
    }
  }

  return canvasToBlob(outCanvas, 'image/png')
}

// ---------------------------------------------------------------------------
// 5. Pixel Upscale (nearest-neighbor)
// ---------------------------------------------------------------------------

export async function pixelUpscale(
  input: Blob,
  config: { scale: number; algorithm?: string }
): Promise<Blob> {
  const img = await blobToImage(input)
  const algo = config.algorithm || 'nearest'

  // Get source ImageData
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = img.width
  srcCanvas.height = img.height
  const srcCtx = srcCanvas.getContext('2d')!
  srcCtx.drawImage(img, 0, 0)
  const srcData = srcCtx.getImageData(0, 0, img.width, img.height)

  let resultData: ImageData

  if (algo === 'epx') {
    const { epxScale } = await import('../tools/pixel-upscaler/algorithms/epx')
    resultData = epxScale(srcData, config.scale)
  } else if (algo === 'xbr') {
    const { xbrScale } = await import('../tools/pixel-upscaler/algorithms/xbr')
    resultData = xbrScale(srcData, config.scale)
  } else {
    const { nearestNeighbor } = await import('../tools/pixel-upscaler/algorithms/nearestNeighbor')
    resultData = nearestNeighbor(srcData, config.scale)
  }

  const outCanvas = document.createElement('canvas')
  outCanvas.width = resultData.width
  outCanvas.height = resultData.height
  const outCtx = outCanvas.getContext('2d')!
  outCtx.putImageData(resultData, 0, 0)
  return canvasToBlob(outCanvas, 'image/png')
}

// ---------------------------------------------------------------------------
// 6. Image Upscale (bilinear)
// ---------------------------------------------------------------------------

export async function imageUpscale(
  input: Blob,
  config: { scale: number; method?: string; noise?: string; sharpen?: boolean }
): Promise<Blob> {
  const img = await blobToImage(input)
  const outW = Math.round(img.width * config.scale)
  const outH = Math.round(img.height * config.scale)
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')!

  const method = config.method || 'lanczos'

  if (method === 'lanczos') {
    // Multi-step downscale approach for Lanczos-like quality
    // Step through 2x increments for best quality
    let src: HTMLCanvasElement | HTMLImageElement = img
    let curW = img.width
    let curH = img.height

    while (curW < outW || curH < outH) {
      const nextW = Math.min(curW * 2, outW)
      const nextH = Math.min(curH * 2, outH)
      const stepCanvas = document.createElement('canvas')
      stepCanvas.width = nextW
      stepCanvas.height = nextH
      const stepCtx = stepCanvas.getContext('2d')!
      stepCtx.imageSmoothingEnabled = true
      stepCtx.imageSmoothingQuality = 'high'
      stepCtx.drawImage(src, 0, 0, nextW, nextH)
      src = stepCanvas
      curW = nextW
      curH = nextH
    }
    ctx.drawImage(src, 0, 0, outW, outH)
  } else if (method === 'bicubic') {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, outW, outH)
  } else {
    // bilinear
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'medium'
    ctx.drawImage(img, 0, 0, outW, outH)
  }

  // Noise reduction (simple box blur)
  const noiseLevel = config.noise || 'none'
  if (noiseLevel !== 'none') {
    const radius = noiseLevel === 'low' ? 1 : noiseLevel === 'medium' ? 2 : 3
    const imgData = ctx.getImageData(0, 0, outW, outH)
    const d = imgData.data
    const copy = new Uint8ClampedArray(d)

    for (let y = radius; y < outH - radius; y++) {
      for (let x = radius; x < outW - radius; x++) {
        let r = 0, g = 0, b = 0, count = 0
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const i = ((y + dy) * outW + (x + dx)) * 4
            r += copy[i]; g += copy[i + 1]; b += copy[i + 2]; count++
          }
        }
        const i = (y * outW + x) * 4
        d[i] = r / count; d[i + 1] = g / count; d[i + 2] = b / count
      }
    }
    ctx.putImageData(imgData, 0, 0)
  }

  // Sharpen (unsharp mask)
  if (config.sharpen) {
    const imgData = ctx.getImageData(0, 0, outW, outH)
    const d = imgData.data
    const copy = new Uint8ClampedArray(d)
    const strength = 0.5

    for (let y = 1; y < outH - 1; y++) {
      for (let x = 1; x < outW - 1; x++) {
        const i = (y * outW + x) * 4
        for (let c = 0; c < 3; c++) {
          const center = copy[i + c] * 5
          const neighbors = copy[((y-1)*outW+x)*4+c] + copy[((y+1)*outW+x)*4+c] +
            copy[(y*outW+x-1)*4+c] + copy[(y*outW+x+1)*4+c]
          d[i + c] = Math.max(0, Math.min(255, copy[i + c] + (center - neighbors) * strength))
        }
      }
    }
    ctx.putImageData(imgData, 0, 0)
  }

  return canvasToBlob(canvas, 'image/png')
}

// ---------------------------------------------------------------------------
// 7. Recolor Image
// ---------------------------------------------------------------------------

export async function recolorImage(
  input: Blob,
  config: {
    mappings?: { from: [number, number, number] | string; to: [number, number, number] | string }[]
    tolerance: number
  }
): Promise<Blob> {
  const img = await blobToImage(input)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)

  const mappings = config.mappings || []
  if (mappings.length === 0) return canvasToBlob(canvas, 'image/png')

  // Normalize mappings: support both hex strings and RGB tuples
  const normalized = mappings.map((m) => {
    const from = typeof m.from === 'string' ? hexToRgbTuple(m.from) : m.from
    const to = typeof m.to === 'string' ? hexToRgbTuple(m.to) : m.to
    return { from, to }
  })

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const tol = config.tolerance

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    for (const mapping of normalized) {
      const [fr, fg, fb] = mapping.from
      if (
        Math.abs(r - fr) <= tol &&
        Math.abs(g - fg) <= tol &&
        Math.abs(b - fb) <= tol
      ) {
        data[i] = mapping.to[0]
        data[i + 1] = mapping.to[1]
        data[i + 2] = mapping.to[2]
        break
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvasToBlob(canvas, 'image/png')
}

// ---------------------------------------------------------------------------
// 8. Convert Format
// ---------------------------------------------------------------------------

export async function convertFormat(
  input: Blob,
  config: { format: string; quality?: number }
): Promise<Blob> {
  const img = await blobToImage(input)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)

  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  }

  const mime = mimeMap[config.format.toLowerCase()] ?? 'image/png'
  const quality = (mime === 'image/jpeg' || mime === 'image/webp')
    ? (config.quality ?? 92) / 100
    : undefined
  return canvasToBlob(canvas, mime, quality)
}

// ---------------------------------------------------------------------------
// 9. Dither Image
// ---------------------------------------------------------------------------

export async function ditherImage(
  input: Blob,
  config: { algorithm: string; palette: string }
): Promise<Blob> {
  const algorithms = await import('../tools/dithering/algorithms')
  const presets = await import('../tools/palette-editor/presets')

  const img = await blobToImage(input)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const srcData = ctx.getImageData(0, 0, img.width, img.height)

  const preset = presets.PALETTE_PRESETS.find((p) => p.name === config.palette) || presets.PALETTE_PRESETS[0]
  const paletteColors = preset.colors.map(presets.hexToRgb)

  const result = algorithms.applyDithering(srcData, config.algorithm as Parameters<typeof algorithms.applyDithering>[1], paletteColors)
  ctx.putImageData(result, 0, 0)
  return canvasToBlob(canvas, 'image/png')
}

// ---------------------------------------------------------------------------
// 10. Palette Swap
// ---------------------------------------------------------------------------

export async function paletteSwapImage(
  input: Blob,
  config: { tolerance: number; mappings?: { from: string; to: string }[] }
): Promise<Blob> {
  const { hexToRgb } = await import('../tools/palette-editor/presets')

  const img = await blobToImage(input)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const imgData = ctx.getImageData(0, 0, img.width, img.height)
  const d = imgData.data
  const tol = config.tolerance * config.tolerance

  const parsedMappings = (config.mappings || [])
    .filter((m) => m.from !== m.to)
    .map((m) => ({ from: hexToRgb(m.from), to: hexToRgb(m.to) }))

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue
    for (const { from, to } of parsedMappings) {
      const dr = d[i] - from.r
      const dg = d[i + 1] - from.g
      const db = d[i + 2] - from.b
      if (dr * dr + dg * dg + db * db <= tol) {
        d[i] = to.r
        d[i + 1] = to.g
        d[i + 2] = to.b
        break
      }
    }
  }

  ctx.putImageData(imgData, 0, 0)
  return canvasToBlob(canvas, 'image/png')
}

// ---------------------------------------------------------------------------
// 11. 3D Spritesheet Capture
// ---------------------------------------------------------------------------

const PRESET_ANGLES: Record<string, { angles: number[]; elevation: number; useOrtho: boolean }> = {
  rpg8: { angles: [0, 45, 90, 135, 180, 225, 270, 315], elevation: 55, useOrtho: false },
  rpg4: { angles: [0, 90, 180, 270], elevation: 55, useOrtho: false },
  platformer: { angles: [90, 270], elevation: 0, useOrtho: false },
  isometric: { angles: [45, 135, 225, 315], elevation: 35.264, useOrtho: true },
  custom8: { angles: [0, 45, 90, 135, 180, 225, 270, 315], elevation: 45, useOrtho: false },
  custom4: { angles: [0, 90, 180, 270], elevation: 45, useOrtho: false },
}

export async function capture3DSpritesheet(
  input: Blob | Blob[],
  config: {
    modelFile?: File
    textureFile?: File
    preset?: string
    elevation?: number
    frameCount?: number
    captureSize?: number
    cameraDistance?: number
    bgColor?: string
    animIndex?: number
  }
): Promise<Blob> {
  const modelFile = config.modelFile
  if (!modelFile) throw new Error('No 3D model file provided')

  // Use pipeline input as texture if no manual texture is provided
  // (input blob from a previous step can serve as the texture image)
  const inputBlob = Array.isArray(input) ? input[0] : input
  const hasInputTexture = inputBlob && inputBlob.size > 0

  let presetKey = config.preset || 'rpg8'

  // Resolve saved custom presets (saved:<name>) from localStorage
  let presetDef: { angles: number[]; elevation: number; useOrtho: boolean }
  if (presetKey.startsWith('saved:')) {
    const { loadSavedPresets, ANGLES_4, ANGLES_8 } = await import('../tools/spritesheet-3d/presets')
    const name = presetKey.slice(6)
    const saved = loadSavedPresets().find((p) => p.name === name)
    if (saved) {
      presetDef = {
        angles: saved.directionCount === 4 ? ANGLES_4 : ANGLES_8,
        elevation: saved.elevation,
        useOrtho: false,
      }
    } else {
      presetDef = PRESET_ANGLES.rpg8
    }
  } else {
    presetDef = PRESET_ANGLES[presetKey] || PRESET_ANGLES.rpg8
  }

  // Override elevation for custom presets if provided
  if ((presetKey === 'custom4' || presetKey === 'custom8' || presetKey.startsWith('saved:')) && config.elevation != null) {
    presetDef = { ...presetDef, elevation: config.elevation }
  }
  const frameCount = config.frameCount || 8
  const captureSize = config.captureSize || 128
  const camDist = config.cameraDistance || 3
  const bgColor = config.bgColor || 'transparent'
  const animIndex = config.animIndex || 0

  // Load model
  const modelUrl = URL.createObjectURL(modelFile)
  const ext = modelFile.name.split('.').pop()?.toLowerCase()

  let object: THREE.Object3D
  let clips: THREE.AnimationClip[] = []

  try {
    if (ext === 'fbx') {
      const loader = new FBXLoader()
      const fbx = await loader.loadAsync(modelUrl)
      object = fbx
      clips = fbx.animations || []
    } else {
      const loader = new GLTFLoader()
      const gltf = await loader.loadAsync(modelUrl)
      object = gltf.scene
      clips = gltf.animations || []
    }
  } finally {
    URL.revokeObjectURL(modelUrl)
  }

  // Fix materials
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((mat) => {
        if (!mat) return
        mat.side = THREE.DoubleSide
        if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          const stdMat = mat as THREE.MeshStandardMaterial
          if (!stdMat.map) {
            const lum = stdMat.color.r + stdMat.color.g + stdMat.color.b
            if (lum < 0.1) stdMat.color.set(0x888888)
          }
          stdMat.metalness = Math.min(stdMat.metalness, 0.5)
          stdMat.roughness = Math.max(stdMat.roughness, 0.3)
        }
      })
    }
  })

  // Apply texture — prefer manual textureFile, fall back to pipeline input blob
  const textureSource: Blob | File | null = config.textureFile ?? (hasInputTexture ? inputBlob : null)
  if (textureSource) {
    const texUrl = URL.createObjectURL(textureSource)
    const texture = await new Promise<THREE.Texture>((resolve) => {
      new THREE.TextureLoader().load(texUrl, (tex) => {
        URL.revokeObjectURL(texUrl)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.flipY = ext === 'fbx'
        resolve(tex)
      })
    })
    object.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const mesh = child as THREE.Mesh
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((mat, idx) => {
        if (!mat) return
        const newMat = new THREE.MeshStandardMaterial({
          map: texture,
          side: THREE.DoubleSide,
          metalness: 0.1,
          roughness: 0.7,
        })
        if (Array.isArray(mesh.material)) (mesh.material as THREE.Material[])[idx] = newMat
        else mesh.material = newMat
      })
    })
  }

  // Normalize model
  const box = new THREE.Box3().setFromObject(object)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim === 0) throw new Error('Model is empty (zero size)')

  const targetHeight = 2
  const scaleFactor = targetHeight / maxDim
  const wrapper = new THREE.Group()
  wrapper.add(object)
  object.position.set(-center.x, -center.y + size.y / 2, -center.z)
  wrapper.scale.setScalar(scaleFactor)

  // Scene setup
  const scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight(0xffffff, 1.5))
  const dLight = new THREE.DirectionalLight(0xffffff, 2.0)
  dLight.position.set(5, 10, 7)
  scene.add(dLight)
  const bLight = new THREE.DirectionalLight(0xffffff, 0.8)
  bLight.position.set(-5, 5, -5)
  scene.add(bLight)
  scene.add(wrapper)

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setSize(captureSize, captureSize)
  renderer.setPixelRatio(1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping

  if (bgColor === 'transparent') renderer.setClearColor(0x000000, 0)
  else if (bgColor === 'green') renderer.setClearColor(0x00ff00, 1)
  else renderer.setClearColor(0x0000ff, 1)

  // Camera
  let camera: THREE.Camera
  if (presetDef.useOrtho) {
    camera = new THREE.OrthographicCamera(-camDist / 2, camDist / 2, camDist / 2, -camDist / 2, 0.01, 1000)
  } else {
    camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000)
  }

  // Animation mixer
  let mixer: THREE.AnimationMixer | null = null
  const clip = clips[animIndex] || clips[0]
  if (clip) {
    mixer = new THREE.AnimationMixer(object)
    mixer.clipAction(clip).play()
  }

  // Capture
  const { angles, elevation } = presetDef
  const sheetCanvas = document.createElement('canvas')
  sheetCanvas.width = frameCount * captureSize
  sheetCanvas.height = angles.length * captureSize
  const sheetCtx = sheetCanvas.getContext('2d')!

  for (let angleIdx = 0; angleIdx < angles.length; angleIdx++) {
    const angleRad = (angles[angleIdx] * Math.PI) / 180
    const elevRad = (elevation * Math.PI) / 180

    camera.position.set(
      camDist * Math.sin(angleRad) * Math.cos(elevRad),
      1 + camDist * Math.sin(elevRad),
      camDist * Math.cos(angleRad) * Math.cos(elevRad)
    )
    camera.lookAt(0, 1, 0)

    for (let frame = 0; frame < frameCount; frame++) {
      if (mixer && clip) {
        mixer.setTime((clip.duration * frame) / frameCount)
      }
      renderer.render(scene, camera)
      sheetCtx.drawImage(renderer.domElement, frame * captureSize, angleIdx * captureSize)
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  renderer.dispose()

  return canvasToBlob(sheetCanvas, 'image/png')
}
