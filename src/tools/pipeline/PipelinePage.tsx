import { useState, useCallback, useEffect, useRef } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import {
  Play, Plus, X, Download, Loader2, ChevronRight, Save, FolderOpen,
  Trash2, ArrowDown, CheckCircle2, AlertCircle, Grid3X3, Film,
  PaintBucket, FileType, ZoomIn, Maximize2, Box, Droplets, SwatchBook,
  ArrowRight,
} from 'lucide-react'
import { downloadBlob } from '../../lib/utils'
import { PRESET_PIPELINES } from './presets'
import { TOOL_DEFS, getCompatibleSteps, getDefaultConfig } from './tool-registry'
import { executePipeline } from './pipeline-engine'
import type { PipelineStep, ToolStepType, SavedPipeline } from './types'
import JSZip from 'jszip'

const STORAGE_KEY = 'jet-pipelines'

const STEP_ICONS: Record<string, typeof Grid3X3> = {
  '3d-spritesheet': Box,
  decompile: Grid3X3,
  compile: Grid3X3,
  'sprite-to-gif': Film,
  'image-to-pixelart': Grid3X3,
  'pixel-upscale': Maximize2,
  'image-upscale': ZoomIn,
  recolor: PaintBucket,
  'format-convert': FileType,
  dither: Droplets,
  'palette-swap': SwatchBook,
}

function loadSavedPipelines(): SavedPipeline[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function savePipelines(pipelines: SavedPipeline[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pipelines))
}

export function PipelinePage() {
  const [view, setView] = useState<'presets' | 'builder'>('presets')
  const [steps, setSteps] = useState<PipelineStep[]>([])
  const [inputFile, setInputFile] = useState<File | null>(null)
  const [running, setRunning] = useState(false)
  const [finalResult, setFinalResult] = useState<Blob | Blob[] | null>(null)
  const [finalPreviewUrl, setFinalPreviewUrl] = useState<string | null>(null)
  const [savedPipelines, setSavedPipelines] = useState<SavedPipeline[]>(loadSavedPipelines)
  const [saveName, setSaveName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const previewUrlsRef = useRef<string[]>([])

  // Cleanup preview URLs
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      if (finalPreviewUrl) URL.revokeObjectURL(finalPreviewUrl)
    }
  }, [])

  const loadPreset = (presetId: string) => {
    const preset = PRESET_PIPELINES.find((p) => p.id === presetId)
    if (!preset) return
    setSteps(
      preset.steps.map((s) => ({
        id: crypto.randomUUID(),
        type: s.type,
        config: { ...getDefaultConfig(s.type), ...s.config },
        status: 'idle' as const,
      }))
    )
    setFinalResult(null)
    setFinalPreviewUrl(null)
    setView('builder')
  }

  const loadSaved = (name: string) => {
    const saved = savedPipelines.find((p) => p.name === name)
    if (!saved) return
    setSteps(
      saved.steps.map((s) => ({
        id: crypto.randomUUID(),
        type: s.type,
        config: { ...getDefaultConfig(s.type), ...s.config },
        status: 'idle' as const,
      }))
    )
    setFinalResult(null)
    setFinalPreviewUrl(null)
    setView('builder')
  }

  const handleSave = () => {
    if (!saveName.trim() || steps.length === 0) return
    const newPipeline: SavedPipeline = {
      name: saveName.trim(),
      steps: steps.map((s) => ({ type: s.type, config: s.config })),
    }
    const updated = [...savedPipelines.filter((p) => p.name !== newPipeline.name), newPipeline]
    setSavedPipelines(updated)
    savePipelines(updated)
    setShowSaveInput(false)
    setSaveName('')
  }

  const deleteSaved = (name: string) => {
    const updated = savedPipelines.filter((p) => p.name !== name)
    setSavedPipelines(updated)
    savePipelines(updated)
  }

  const addStep = (type: ToolStepType) => {
    setSteps((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type,
        config: getDefaultConfig(type),
        status: 'idle',
      },
    ])
  }

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id))
  }

  const updateStepConfig = (id: string, key: string, value: unknown) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, config: { ...s.config, [key]: value } } : s))
    )
  }

  const getLastOutputType = () => {
    if (steps.length === 0) return 'blob' as const
    return TOOL_DEFS[steps[steps.length - 1].type].outputType
  }

  const handleRun = useCallback(async () => {
    if (!inputFile || steps.length === 0) return
    setRunning(true)
    setFinalResult(null)
    if (finalPreviewUrl) URL.revokeObjectURL(finalPreviewUrl)
    setFinalPreviewUrl(null)

    // Reset all step statuses
    setSteps((prev) => prev.map((s) => ({ ...s, status: 'idle' as const, error: undefined, previewUrl: undefined })))

    // Clean old preview URLs
    previewUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    previewUrlsRef.current = []

    // For 3D spritesheet as first step, we don't need a file input — the model file is in the step config
    const is3DFirst = steps[0]?.type === '3d-spritesheet'
    const inputBlob = is3DFirst
      ? new Blob([]) // dummy blob, the 3D function reads config.modelFile
      : new Blob([await inputFile!.arrayBuffer()], { type: inputFile!.type })

    await executePipeline(
      steps,
      inputBlob,
      (index) => {
        setSteps((prev) =>
          prev.map((s, i) => (i === index ? { ...s, status: 'running' } : s))
        )
      },
      (index, result) => {
        // Generate preview for single blob results
        let previewUrl: string | undefined
        if (result instanceof Blob) {
          previewUrl = URL.createObjectURL(result)
          previewUrlsRef.current.push(previewUrl)
        }
        setSteps((prev) =>
          prev.map((s, i) =>
            i === index ? { ...s, status: 'done', result, previewUrl } : s
          )
        )

        // If this is the last step, set final result
        if (index === steps.length - 1) {
          setFinalResult(result)
          if (result instanceof Blob) {
            const url = URL.createObjectURL(result)
            setFinalPreviewUrl(url)
          }
        }
      },
      (index, error) => {
        setSteps((prev) =>
          prev.map((s, i) => (i === index ? { ...s, status: 'error', error } : s))
        )
      }
    )

    setRunning(false)
  }, [inputFile, steps, finalPreviewUrl])

  const handleDownload = async () => {
    if (!finalResult) return
    if (finalResult instanceof Blob) {
      const ext = finalResult.type.includes('gif') ? 'gif' : finalResult.type.includes('jpeg') ? 'jpg' : finalResult.type.includes('webp') ? 'webp' : 'png'
      downloadBlob(finalResult, `pipeline_output.${ext}`)
    } else if (Array.isArray(finalResult)) {
      const zip = new JSZip()
      for (let i = 0; i < finalResult.length; i++) {
        const buf = await finalResult[i].arrayBuffer()
        zip.file(`frame_${String(i).padStart(3, '0')}.png`, buf)
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, 'pipeline_output.zip')
    }
  }

  const handleInputFiles = (files: File[]) => {
    setInputFile(files[0])
    setFinalResult(null)
    setFinalPreviewUrl(null)
    setSteps((prev) => prev.map((s) => ({ ...s, status: 'idle' as const, error: undefined, previewUrl: undefined })))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Pipeline</h2>
        <p className="text-sm text-zinc-500 mt-2">Chain tools together into automated workflows</p>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('presets')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'presets' ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Presets
        </button>
        <button
          onClick={() => setView('builder')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'builder' ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Builder
        </button>
      </div>

      {view === 'presets' && (
        <div className="space-y-4">
          {/* Preset cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PRESET_PIPELINES.map((preset) => (
              <button
                key={preset.id}
                onClick={() => loadPreset(preset.id)}
                className="bg-white border border-zinc-200 rounded-lg p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all group"
              >
                <p className="text-sm font-medium text-zinc-800 group-hover:text-blue-700">{preset.name}</p>
                <p className="text-xs text-zinc-500 mt-1">{preset.description}</p>
                <div className="flex items-center gap-1 mt-2">
                  {preset.steps.map((s, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-[10px] font-medium text-zinc-600">
                        {TOOL_DEFS[s.type]?.label || s.type}
                      </span>
                      {i < preset.steps.length - 1 && <ChevronRight size={10} className="text-zinc-300" />}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>

          {/* Saved pipelines */}
          {savedPipelines.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Saved Pipelines</p>
              <div className="space-y-1">
                {savedPipelines.map((sp) => (
                  <div key={sp.name} className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-3 py-2">
                    <button onClick={() => loadSaved(sp.name)} className="text-sm text-zinc-700 hover:text-blue-600 flex-1 text-left">
                      {sp.name} <span className="text-zinc-400 text-xs">({sp.steps.length} steps)</span>
                    </button>
                    <button onClick={() => deleteSaved(sp.name)} className="text-zinc-300 hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'builder' && (
        <div className="space-y-4">
          {/* Input file */}
          <FileDropzone
            onFiles={handleInputFiles}
            accept="image/*"
            label="Drop your input file here"
            description="The starting image for the pipeline"
          />

          {inputFile && (
            <div className="bg-white border border-zinc-200 rounded-lg px-4 py-2 flex items-center justify-between">
              <p className="text-sm text-zinc-700">{inputFile.name} <span className="text-xs text-zinc-400">({(inputFile.size / 1024).toFixed(1)} KB)</span></p>
              <button onClick={() => { setInputFile(null); setFinalResult(null) }} className="text-zinc-300 hover:text-zinc-600">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Steps */}
          {steps.length > 0 && (
            <div className="space-y-2">
              {steps.map((step, index) => {
                const def = TOOL_DEFS[step.type]
                const Icon = STEP_ICONS[step.type] || FileType
                return (
                  <div key={step.id}>
                    {index > 0 && (
                      <div className="flex justify-center py-1">
                        <ArrowDown size={14} className="text-zinc-300" />
                      </div>
                    )}
                    <div className={`bg-white border rounded-lg p-4 transition-colors ${
                      step.status === 'running' ? 'border-blue-400 shadow-sm' :
                      step.status === 'done' ? 'border-green-300' :
                      step.status === 'error' ? 'border-red-300' :
                      'border-zinc-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded bg-zinc-100 text-[10px] font-bold text-zinc-500">
                            {index + 1}
                          </span>
                          <Icon size={14} className="text-zinc-500" />
                          <p className="text-sm font-medium text-zinc-700">{def.label}</p>
                          {step.status === 'running' && <Loader2 size={13} className="animate-spin text-blue-500" />}
                          {step.status === 'done' && <CheckCircle2 size={13} className="text-green-500" />}
                          {step.status === 'error' && <AlertCircle size={13} className="text-red-500" />}
                        </div>
                        <button onClick={() => removeStep(step.id)} className="text-zinc-300 hover:text-red-500">
                          <X size={14} />
                        </button>
                      </div>

                      {/* Config fields */}
                      <div className="flex flex-wrap gap-3">
                        {def.configFields.map((field) => (
                          <label key={field.key} className="space-y-0.5">
                            <span className="text-[11px] font-medium text-zinc-500">{field.label}</span>
                            {field.type === 'number' && (
                              <input
                                type="number"
                                min={field.min} max={field.max} step={field.step}
                                value={step.config[field.key] as number ?? field.default}
                                onChange={(e) => updateStepConfig(step.id, field.key, Number(e.target.value))}
                                className="w-20 rounded-lg border border-zinc-200 px-2 py-1 text-sm"
                                disabled={running}
                              />
                            )}
                            {field.type === 'select' && (
                              <select
                                value={step.config[field.key] as string ?? field.default}
                                onChange={(e) => updateStepConfig(step.id, field.key, e.target.value)}
                                className="rounded-lg border border-zinc-200 px-2 py-1 text-sm"
                                disabled={running}
                              >
                                {field.options?.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            )}
                            {field.type === 'checkbox' && (
                              <input
                                type="checkbox"
                                checked={step.config[field.key] as boolean ?? field.default}
                                onChange={(e) => updateStepConfig(step.id, field.key, e.target.checked)}
                                className="rounded border-zinc-300 accent-blue-600"
                                disabled={running}
                              />
                            )}
                            {field.type === 'file' && (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="file"
                                  accept={field.key === 'modelFile' ? '.fbx,.glb,.gltf' : 'image/*'}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0] ?? null
                                    updateStepConfig(step.id, field.key, f)
                                  }}
                                  className="text-[11px] text-zinc-600 file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[11px] file:bg-zinc-100 file:text-zinc-600 file:cursor-pointer"
                                  disabled={running}
                                />
                                {step.config[field.key] && (
                                  <span className="text-[10px] text-green-600">✓</span>
                                )}
                              </div>
                            )}
                            {field.type === 'color' && (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={step.config[field.key] as string ?? field.default}
                                  onChange={(e) => updateStepConfig(step.id, field.key, e.target.value)}
                                  className="w-7 h-7 rounded border border-zinc-300 cursor-pointer"
                                  disabled={running}
                                />
                                <span className="text-[10px] font-mono text-zinc-500">{step.config[field.key] as string ?? field.default}</span>
                              </div>
                            )}
                            {field.type === 'color-mappings' && (
                              <ColorMappingsField
                                mappings={(step.config[field.key] as { from: string; to: string }[]) ?? []}
                                onChange={(mappings) => updateStepConfig(step.id, field.key, mappings)}
                                disabled={running}
                              />
                            )}
                          </label>
                        ))}
                      </div>

                      {/* Step preview */}
                      {step.previewUrl && (
                        <div className="mt-2 bg-zinc-50 rounded p-1 max-h-20 overflow-hidden">
                          <img src={step.previewUrl} alt="" className="max-h-16 mx-auto" style={{ imageRendering: 'pixelated' }} />
                        </div>
                      )}

                      {step.error && (
                        <p className="text-xs text-red-600 mt-1">{step.error}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add step */}
          <AddStepButton
            outputType={getLastOutputType()}
            onAdd={addStep}
            disabled={running}
            isFirst={steps.length === 0}
          />

          {/* Actions */}
          {steps.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={handleRun} disabled={running || (!inputFile && steps[0]?.type !== '3d-spritesheet')}>
                {running ? (
                  <><Loader2 size={16} className="animate-spin" /> Running...</>
                ) : (
                  <><Play size={16} /> Run Pipeline</>
                )}
              </Button>

              {!showSaveInput ? (
                <Button variant="secondary" size="sm" onClick={() => setShowSaveInput(true)}>
                  <Save size={14} /> Save
                </Button>
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Pipeline name"
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-sm w-40"
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    autoFocus
                  />
                  <Button size="sm" onClick={handleSave} disabled={!saveName.trim()}>Save</Button>
                  <button onClick={() => { setShowSaveInput(false); setSaveName('') }} className="text-zinc-400 hover:text-zinc-600">
                    <X size={14} />
                  </button>
                </div>
              )}

              <Button variant="secondary" size="sm" onClick={() => { setSteps([]); setFinalResult(null) }}>
                <Trash2 size={14} /> Clear
              </Button>
            </div>
          )}

          {/* Final result */}
          {finalResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Pipeline complete!</p>
                  <p className="text-xs text-green-600">
                    {finalResult instanceof Blob
                      ? `${(finalResult.size / 1024).toFixed(1)} KB`
                      : `${(finalResult as Blob[]).length} files`}
                  </p>
                </div>
                <Button onClick={handleDownload} size="sm">
                  <Download size={14} /> Download
                </Button>
              </div>
              {finalPreviewUrl && finalResult instanceof Blob && finalResult.type.startsWith('image/') && (
                <div className="bg-white rounded border border-green-100 p-2 max-h-64 overflow-auto">
                  <img src={finalPreviewUrl} alt="Output" className="max-w-full" style={{ imageRendering: 'pixelated' }} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AddStepButton({ outputType, onAdd, disabled, isFirst }: { outputType: string; onAdd: (type: ToolStepType) => void; disabled: boolean; isFirst?: boolean }) {
  const [open, setOpen] = useState(false)

  // Get steps compatible with both the output type AND blob (since batch mode handles blob[] → blob mapping)
  const compatible = getCompatibleSteps(outputType as any, isFirst)
  // Also include blob-type steps when output is blob[] (they'll run in batch mode)
  const batchCompatible = outputType === 'blob[]'
    ? getCompatibleSteps('blob').filter((t) => !compatible.includes(t))
    : []

  const allOptions = [...compatible, ...batchCompatible]

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full border-2 border-dashed border-zinc-200 rounded-lg py-2.5 text-sm text-zinc-400 hover:text-zinc-600 hover:border-zinc-300 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        <Plus size={14} /> Add Step
      </button>
    )
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-500">Choose a tool to add:</p>
        <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-600">
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {allOptions.map((type) => {
          const def = TOOL_DEFS[type]
          const Icon = STEP_ICONS[type] || FileType
          const isBatch = batchCompatible.includes(type)
          return (
            <button
              key={type}
              onClick={() => { onAdd(type); setOpen(false) }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-blue-50 hover:text-blue-700 transition-colors text-sm text-zinc-600"
            >
              <Icon size={13} />
              <span>
                {def.label}
                {isBatch && <span className="text-[10px] text-zinc-400 ml-1">(batch)</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ColorMappingsField({
  mappings,
  onChange,
  disabled,
}: {
  mappings: { from: string; to: string }[]
  onChange: (mappings: { from: string; to: string }[]) => void
  disabled: boolean
}) {
  const addMapping = () => {
    onChange([...mappings, { from: '#ff0000', to: '#0000ff' }])
  }

  const removeMapping = (idx: number) => {
    onChange(mappings.filter((_, i) => i !== idx))
  }

  const updateMapping = (idx: number, key: 'from' | 'to', value: string) => {
    const next = [...mappings]
    next[idx] = { ...next[idx], [key]: value }
    onChange(next)
  }

  return (
    <div className="space-y-1.5 w-full">
      {mappings.map((m, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            type="color"
            value={m.from}
            onChange={(e) => updateMapping(i, 'from', e.target.value)}
            className="w-6 h-6 rounded border border-zinc-300 cursor-pointer"
            disabled={disabled}
          />
          <ArrowRight size={10} className="text-zinc-400 shrink-0" />
          <input
            type="color"
            value={m.to}
            onChange={(e) => updateMapping(i, 'to', e.target.value)}
            className="w-6 h-6 rounded border border-zinc-300 cursor-pointer"
            disabled={disabled}
          />
          <button
            onClick={() => removeMapping(i)}
            className="text-zinc-400 hover:text-red-500"
            disabled={disabled}
          >
            <X size={10} />
          </button>
        </div>
      ))}
      <button
        onClick={addMapping}
        className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-medium"
        disabled={disabled}
      >
        <Plus size={10} /> Add Mapping
      </button>
    </div>
  )
}
