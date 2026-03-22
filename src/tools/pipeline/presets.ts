import type { PresetPipeline } from './types'

export const PRESET_PIPELINES: PresetPipeline[] = [
  {
    id: '3d-to-gif',
    name: '3D Model → Spritesheet → GIF',
    description: 'Load a 3D model, capture a spritesheet, then convert to animated GIF',
    icon: 'box',
    steps: [
      { type: '3d-spritesheet', config: { preset: 'rpg8', frameCount: 8, captureSize: 128, cameraDistance: 3 } },
      { type: 'sprite-to-gif', config: { cols: 8, rows: 8, fps: 12, scale: 1 } },
    ],
  },
  {
    id: '3d-to-decompile',
    name: '3D Model → Spritesheet → Frames',
    description: 'Capture a 3D model from multiple angles and split into individual frames',
    icon: 'box',
    steps: [
      { type: '3d-spritesheet', config: { preset: 'rpg4', frameCount: 8, captureSize: 128, cameraDistance: 3 } },
      { type: 'decompile', config: { cols: 8, rows: 4 } },
    ],
  },
  {
    id: 'pixel-art-upscale',
    name: 'Image → Pixel Art → Upscale',
    description: 'Convert any image to pixel art, then upscale it cleanly',
    icon: 'grid',
    steps: [
      { type: 'image-to-pixelart', config: { pixelSize: 8, colorCount: 16 } },
      { type: 'pixel-upscale', config: { scale: 4 } },
    ],
  },
  {
    id: 'spritesheet-to-gif',
    name: 'Spritesheet → GIF',
    description: 'Split a spritesheet and convert it directly to an animated GIF',
    icon: 'film',
    steps: [
      { type: 'sprite-to-gif', config: { cols: 4, rows: 1, fps: 12, scale: 1 } },
    ],
  },
  {
    id: 'sprite-recolor',
    name: 'Sprite Recolor Pipeline',
    description: 'Decompile a spritesheet, recolor each frame, then recompile',
    icon: 'paintBucket',
    steps: [
      { type: 'decompile', config: { cols: 4, rows: 4 } },
      { type: 'recolor', config: { tolerance: 30 } },
      { type: 'compile', config: { cols: 4, padding: 0 } },
    ],
  },
  {
    id: 'batch-format-convert',
    name: 'Decompile → Convert Format',
    description: 'Split a spritesheet into frames and convert each to a different format',
    icon: 'fileType',
    steps: [
      { type: 'decompile', config: { cols: 4, rows: 4 } },
      { type: 'format-convert', config: { format: 'webp' } },
    ],
  },
  {
    id: 'upscale-and-convert',
    name: 'Upscale → Convert',
    description: 'Upscale an image then convert to a specific format',
    icon: 'zoomIn',
    steps: [
      { type: 'image-upscale', config: { scale: 2 } },
      { type: 'format-convert', config: { format: 'webp' } },
    ],
  },
]
