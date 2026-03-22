import type { PipelineStep, ToolStepType } from './types'
import { TOOL_DEFS } from './tool-registry'
import {
  decompileSpritesheet,
  compileSpritesheet,
  spriteToGif,
  imageToPixelArt,
  pixelUpscale,
  imageUpscale,
  recolorImage,
  convertFormat,
  capture3DSpritesheet,
  ditherImage,
  paletteSwapImage,
} from '../../lib/tool-functions'

type ToolFn = (input: Blob | Blob[], config: Record<string, unknown>) => Promise<Blob | Blob[]>

const TOOL_FN_MAP: Record<ToolStepType, ToolFn> = {
  '3d-spritesheet': capture3DSpritesheet as unknown as ToolFn,
  decompile: decompileSpritesheet as ToolFn,
  compile: compileSpritesheet as ToolFn,
  'sprite-to-gif': spriteToGif as ToolFn,
  'image-to-pixelart': imageToPixelArt as ToolFn,
  'pixel-upscale': pixelUpscale as ToolFn,
  'image-upscale': imageUpscale as ToolFn,
  recolor: recolorImage as ToolFn,
  'format-convert': convertFormat as ToolFn,
  dither: ditherImage as ToolFn,
  'palette-swap': paletteSwapImage as ToolFn,
}

export async function executePipeline(
  steps: PipelineStep[],
  initialInput: Blob | Blob[],
  onStepStart: (index: number) => void,
  onStepComplete: (index: number, result: Blob | Blob[]) => void,
  onStepError: (index: number, error: string) => void,
): Promise<void> {
  let currentInput: Blob | Blob[] = initialInput

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const def = TOOL_DEFS[step.type]
    const fn = TOOL_FN_MAP[step.type]

    onStepStart(i)

    try {
      let adaptedInput: Blob | Blob[] = currentInput

      // Handle type adaptation between steps
      if (def.inputType === 'blob' && Array.isArray(currentInput)) {
        // Function expects a single blob but we have an array — batch map
        const results: Blob[] = []
        for (const blob of currentInput) {
          const result = await fn(blob, step.config)
          if (Array.isArray(result)) {
            results.push(...result)
          } else {
            results.push(result)
          }
        }
        const output: Blob | Blob[] = def.outputType === 'blob[]' ? results : results[0]
        onStepComplete(i, output)
        currentInput = output
        continue
      } else if (def.inputType === 'blob[]' && !Array.isArray(currentInput)) {
        // Function expects an array but we have a single blob — wrap
        adaptedInput = [currentInput]
      }

      const result = await fn(adaptedInput, step.config)
      onStepComplete(i, result)
      currentInput = result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      onStepError(i, message)
      return
    }
  }
}
