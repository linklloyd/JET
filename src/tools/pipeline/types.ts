export type ToolStepType =
  | '3d-spritesheet' | 'decompile' | 'compile' | 'sprite-to-gif'
  | 'image-to-pixelart' | 'pixel-upscale' | 'image-upscale'
  | 'recolor' | 'format-convert' | 'dither' | 'palette-swap'

export type DataType = 'blob' | 'blob[]' | 'file'

export interface ConfigField {
  key: string
  label: string
  type: 'number' | 'select' | 'checkbox' | 'file' | 'color' | 'color-mappings'
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  step?: number
  default: unknown
}

export interface ToolStepDef {
  type: ToolStepType
  label: string
  inputType: DataType
  outputType: DataType
  configFields: ConfigField[]
}

export interface PipelineStep {
  id: string
  type: ToolStepType
  config: Record<string, unknown>
  status: 'idle' | 'running' | 'done' | 'error'
  result?: Blob | Blob[]
  error?: string
  previewUrl?: string
}

export interface SavedPipeline {
  name: string
  steps: { type: ToolStepType; config: Record<string, unknown> }[]
}

export interface PresetPipeline {
  id: string
  name: string
  description: string
  icon: string  // lucide icon name hint
  steps: { type: ToolStepType; config: Record<string, unknown> }[]
}
