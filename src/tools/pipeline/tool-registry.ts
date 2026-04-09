import type { ToolStepType, ToolStepDef, DataType } from './types'

export const TOOL_DEFS: Record<ToolStepType, ToolStepDef> = {
  '3d-spritesheet': {
    type: '3d-spritesheet',
    label: '3D Spritesheet',
    inputType: 'blob',
    outputType: 'blob',
    configFields: [
      { key: 'modelFile', label: 'Model (.fbx/.glb)', type: 'file', default: null },
      { key: 'textureFile', label: 'Texture (optional)', type: 'file', default: null },
      {
        key: 'preset',
        label: 'Preset',
        type: 'select',
        options: [
          { value: 'rpg8', label: 'RPG 8-dir' },
          { value: 'rpg4', label: 'RPG 4-dir' },
          { value: 'platformer', label: 'Platformer' },
          { value: 'isometric', label: 'Isometric' },
          { value: 'custom8', label: 'Custom (8 dirs)' },
          { value: 'custom4', label: 'Custom (4 dirs)' },
        ],
        default: 'rpg8',
      },
      { key: 'elevation', label: 'Elevation°', type: 'number', min: 0, max: 90, step: 1, default: 45 },
      { key: 'frameCount', label: 'Frames', type: 'number', min: 1, max: 32, step: 1, default: 8 },
      { key: 'captureSize', label: 'Size (px)', type: 'number', min: 32, max: 512, step: 32, default: 128 },
      { key: 'cameraDistance', label: 'Cam Dist', type: 'number', min: 1, max: 10, step: 0.5, default: 3 },
      {
        key: 'bgColor',
        label: 'Background',
        type: 'select',
        options: [
          { value: 'transparent', label: 'Transparent' },
          { value: 'green', label: 'Green Screen' },
          { value: 'blue', label: 'Blue Screen' },
        ],
        default: 'transparent',
      },
      { key: 'animIndex', label: 'Animation #', type: 'number', min: 0, max: 10, step: 1, default: 0 },
    ],
  },
  decompile: {
    type: 'decompile',
    label: 'Decompile Spritesheet',
    inputType: 'blob',
    outputType: 'blob[]',
    configFields: [
      { key: 'cols', label: 'Columns', type: 'number', min: 1, max: 64, step: 1, default: 4 },
      { key: 'rows', label: 'Rows', type: 'number', min: 1, max: 64, step: 1, default: 4 },
      { key: 'startCol', label: 'Start Col', type: 'number', min: 0, max: 63, step: 1, default: 0 },
      { key: 'endCol', label: 'End Col (-1=all)', type: 'number', min: -1, max: 63, step: 1, default: -1 },
      { key: 'startRow', label: 'Start Row', type: 'number', min: 0, max: 63, step: 1, default: 0 },
      { key: 'endRow', label: 'End Row (-1=all)', type: 'number', min: -1, max: 63, step: 1, default: -1 },
    ],
  },
  compile: {
    type: 'compile',
    label: 'Compile Spritesheet',
    inputType: 'blob[]',
    outputType: 'blob',
    configFields: [
      { key: 'cols', label: 'Columns', type: 'number', min: 1, max: 64, step: 1, default: 8 },
      { key: 'padding', label: 'Padding', type: 'number', min: 0, max: 32, step: 1, default: 0 },
    ],
  },
  'sprite-to-gif': {
    type: 'sprite-to-gif',
    label: 'Sprite to GIF',
    inputType: 'blob',
    outputType: 'blob',
    configFields: [
      { key: 'cols', label: 'Columns', type: 'number', min: 1, max: 64, step: 1, default: 4 },
      { key: 'rows', label: 'Rows', type: 'number', min: 1, max: 64, step: 1, default: 1 },
      { key: 'fps', label: 'FPS', type: 'number', min: 1, max: 60, step: 1, default: 12 },
      { key: 'scale', label: 'Scale', type: 'number', min: 1, max: 8, step: 1, default: 1 },
      { key: 'pingPong', label: 'Ping Pong', type: 'checkbox', default: false },
      {
        key: 'rowIndex',
        label: 'Row Only (-1=all)',
        type: 'number',
        min: -1, max: 63, step: 1, default: -1,
      },
    ],
  },
  'image-to-pixelart': {
    type: 'image-to-pixelart',
    label: 'Image to Pixel Art',
    inputType: 'blob',
    outputType: 'blob',
    configFields: [
      { key: 'pixelSize', label: 'Pixel Size', type: 'number', min: 2, max: 32, step: 1, default: 8 },
      { key: 'brightness', label: 'Brightness', type: 'number', min: -100, max: 100, step: 5, default: 0 },
      { key: 'contrast', label: 'Contrast', type: 'number', min: -100, max: 100, step: 5, default: 0 },
      { key: 'saturation', label: 'Saturation', type: 'number', min: -100, max: 100, step: 5, default: 0 },
      { key: 'paletteMode', label: 'Palette', type: 'select', options: [
        { value: 'auto', label: 'Auto (Median Cut)' },
        { value: 'preset', label: 'Preset Palette' },
      ], default: 'auto' },
      { key: 'palettePreset', label: 'Preset', type: 'select', options: [
        { value: 'PICO-8', label: 'PICO-8 (16)' },
        { value: 'Game Boy', label: 'Game Boy (4)' },
        { value: 'NES', label: 'NES (64)' },
        { value: 'Endesga 32', label: 'Endesga 32 (32)' },
        { value: 'CGA', label: 'CGA (16)' },
        { value: 'Grayscale', label: 'Grayscale (6)' },
        { value: '1-Bit', label: '1-Bit (2)' },
      ], default: 'PICO-8' },
      { key: 'colorCount', label: 'Color Count', type: 'number', min: 2, max: 64, step: 1, default: 16 },
      { key: 'colorMetric', label: 'Color Distance', type: 'select', options: [
        { value: 'cielab', label: 'CIELab (perceptual)' },
        { value: 'rgb', label: 'RGB (euclidean)' },
      ], default: 'cielab' },
      { key: 'ditherMode', label: 'Dithering', type: 'select', options: [
        { value: 'none', label: 'None' },
        { value: 'floyd-steinberg', label: 'Floyd-Steinberg' },
        { value: 'bayer2', label: 'Bayer 2×2' },
        { value: 'bayer4', label: 'Bayer 4×4' },
        { value: 'bayer8', label: 'Bayer 8×8' },
      ], default: 'none' },
      { key: 'ditherStrength', label: 'Dither Strength', type: 'number', min: 0, max: 1, step: 0.1, default: 1.0 },
      { key: 'outline', label: 'Outline', type: 'checkbox', default: false },
      { key: 'outlineColor', label: 'Outline Color', type: 'color', default: '#000000' },
      { key: 'inline', label: 'Inline Edges', type: 'checkbox', default: false },
      { key: 'inlineThreshold', label: 'Inline Threshold', type: 'number', min: 0.05, max: 1, step: 0.05, default: 0.3 },
      { key: 'scaleAlgorithm', label: 'Scaling', type: 'select', options: [
        { value: 'nearest', label: 'Nearest Neighbor' },
        { value: 'epx', label: 'Scale2x / EPX' },
        { value: 'mmpx', label: 'MMPX' },
        { value: 'cleanEdge', label: 'Clean Edge' },
      ], default: 'nearest' },
      { key: 'edgePolish', label: 'Edge Polish', type: 'checkbox', default: false },
    ],
  },
  'pixel-upscale': {
    type: 'pixel-upscale',
    label: 'Pixel Upscale',
    inputType: 'blob',
    outputType: 'blob',
    configFields: [
      { key: 'scale', label: 'Scale', type: 'number', min: 2, max: 8, step: 1, default: 2 },
      {
        key: 'algorithm',
        label: 'Algorithm',
        type: 'select',
        options: [
          { value: 'nearest', label: 'Nearest Neighbor' },
          { value: 'epx', label: 'EPX / Scale2x' },
          { value: 'xbr', label: 'xBR' },
        ],
        default: 'nearest',
      },
    ],
  },
  'image-upscale': {
    type: 'image-upscale',
    label: 'Image Upscale',
    inputType: 'blob',
    outputType: 'blob',
    configFields: [
      { key: 'scale', label: 'Scale', type: 'number', min: 2, max: 4, step: 1, default: 2 },
      {
        key: 'method',
        label: 'Method',
        type: 'select',
        options: [
          { value: 'lanczos', label: 'Lanczos (Best)' },
          { value: 'bicubic', label: 'Bicubic' },
          { value: 'bilinear', label: 'Bilinear' },
        ],
        default: 'lanczos',
      },
      {
        key: 'noise',
        label: 'Noise Reduction',
        type: 'select',
        options: [
          { value: 'none', label: 'None' },
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
        ],
        default: 'none',
      },
      { key: 'sharpen', label: 'Sharpen', type: 'checkbox', default: false },
    ],
  },
  recolor: {
    type: 'recolor',
    label: 'Recolor',
    inputType: 'blob',
    outputType: 'blob',
    configFields: [
      { key: 'tolerance', label: 'Tolerance', type: 'number', min: 0, max: 100, step: 1, default: 30 },
      { key: 'mappings', label: 'Color Mappings', type: 'color-mappings', default: [] },
    ],
  },
  'format-convert': {
    type: 'format-convert',
    label: 'Format Convert',
    inputType: 'blob',
    outputType: 'blob',
    configFields: [
      {
        key: 'format',
        label: 'Format',
        type: 'select',
        options: [
          { value: 'png', label: 'PNG' },
          { value: 'jpg', label: 'JPG' },
          { value: 'webp', label: 'WebP' },
        ],
        default: 'png',
      },
      { key: 'quality', label: 'Quality %', type: 'number', min: 1, max: 100, step: 1, default: 92 },
    ],
  },
  dither: {
    type: 'dither',
    label: 'Dither',
    inputType: 'blob',
    outputType: 'blob',
    configFields: [
      {
        key: 'algorithm',
        label: 'Algorithm',
        type: 'select',
        options: [
          { value: 'floyd-steinberg', label: 'Floyd-Steinberg' },
          { value: 'atkinson', label: 'Atkinson' },
          { value: 'sierra', label: 'Sierra' },
          { value: 'ordered-2x2', label: 'Ordered 2x2' },
          { value: 'ordered-4x4', label: 'Ordered 4x4' },
          { value: 'ordered-8x8', label: 'Ordered 8x8' },
        ],
        default: 'floyd-steinberg',
      },
      {
        key: 'palette',
        label: 'Palette',
        type: 'select',
        options: [
          { value: 'PICO-8', label: 'PICO-8' },
          { value: 'Game Boy', label: 'Game Boy' },
          { value: 'NES', label: 'NES' },
          { value: 'Endesga 32', label: 'Endesga 32' },
          { value: 'CGA', label: 'CGA' },
          { value: 'Grayscale', label: 'Grayscale' },
          { value: '1-Bit', label: '1-Bit' },
        ],
        default: 'PICO-8',
      },
    ],
  },
  'palette-swap': {
    type: 'palette-swap',
    label: 'Palette Swap',
    inputType: 'blob',
    outputType: 'blob',
    configFields: [
      { key: 'tolerance', label: 'Tolerance', type: 'number', min: 0, max: 100, step: 1, default: 30 },
      { key: 'mappings', label: 'Color Mappings', type: 'color-mappings', default: [] },
    ],
  },
}

export function getCompatibleSteps(outputType: DataType): ToolStepType[] {
  return (Object.keys(TOOL_DEFS) as ToolStepType[]).filter(
    (key) => TOOL_DEFS[key].inputType === outputType,
  )
}

export function getDefaultConfig(type: ToolStepType): Record<string, unknown> {
  const def = TOOL_DEFS[type]
  const config: Record<string, unknown> = {}
  for (const field of def.configFields) {
    config[field.key] = field.default
  }
  return config
}
