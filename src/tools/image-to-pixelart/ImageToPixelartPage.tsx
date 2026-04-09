import { useState, useRef, useEffect, useCallback } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Slider } from '../../components/ui/Slider'
import { Select } from '../../components/ui/Select'
import { Download, Loader2, Copy, Eye, EyeOff } from 'lucide-react'
import { fileToDataURL, loadImage, downloadBlob, canvasToBlob } from '../../lib/utils'
import { decodeGifFrames, type GifFrame } from '../../lib/gif-decoder'
import { encodeGif } from '../../lib/gif-encoder'
import { cn } from '../../lib/utils'
import { PALETTE_PRESETS } from '../palette-editor/presets'
import { runPixelPipeline, DEFAULT_OPTIONS, type PipelineOptions, type DitherMode, type ScaleAlgorithm, type CollisionMode, type CollisionData } from './pixel-pipeline'

type PageTab = 'basic' | 'advanced'

export function ImageToPixelartPage() {
  const [tab, setTab] = useState<PageTab>('basic')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Image to Pixel Art</h2>
        <p className="text-sm text-zinc-500 mt-2">
          {tab === 'basic'
            ? 'Convert any image into pixel art with adjustable resolution and colors'
            : 'Advanced PixelOver-inspired pipeline with CIELab matching, dithering, scaling, and edge detection'}
        </p>
      </div>

      {/* Tab toggle */}
      <div className="flex rounded-lg border border-zinc-200 overflow-hidden w-fit">
        <button
          onClick={() => setTab('basic')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors',
            tab === 'basic' ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'
          )}
        >
          Basic
        </button>
        <button
          onClick={() => setTab('advanced')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors',
            tab === 'advanced' ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'
          )}
        >
          Advanced
        </button>
      </div>

      {tab === 'basic' ? <BasicPixelart /> : <AdvancedPixelart />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Advanced Pipeline Tab
// ═══════════════════════════════════════════════════════════════════════════

function AdvancedPixelart() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [opts, setOpts] = useState<PipelineOptions>({ ...DEFAULT_OPTIONS })
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [smallUrl, setSmallUrl] = useState<string | null>(null)
  const [collision, setCollision] = useState<CollisionData | null>(null)
  const [showCollision, setShowCollision] = useState(false)
  const [copied, setCopied] = useState(false)

  // GIF state
  const [isGif, setIsGif] = useState(false)
  const [gifFrames, setGifFrames] = useState<GifFrame[]>([])
  const [sourceGifUrl, setSourceGifUrl] = useState<string | null>(null)
  const [resultGifUrl, setResultGifUrl] = useState<string | null>(null)
  const [resultGifBlob, setResultGifBlob] = useState<Blob | null>(null)
  const [processingGif, setProcessingGif] = useState(false)

  const update = (partial: Partial<PipelineOptions>) => setOpts(prev => ({ ...prev, ...partial }))

  const handleFiles = async (files: File[]) => {
    const file = files[0]
    const isGifFile = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')
    setIsGif(isGifFile)
    setResultGifUrl(null)
    setResultGifBlob(null)

    if (isGifFile) {
      setSourceGifUrl(URL.createObjectURL(file))
      const buf = await file.arrayBuffer()
      const { frames, width, height } = decodeGifFrames(new Uint8Array(buf))
      setGifFrames(frames)
      // Show first frame as image for static preview
      if (frames.length > 0) {
        const c = document.createElement('canvas')
        c.width = width; c.height = height
        c.getContext('2d')!.putImageData(frames[0].imageData, 0, 0)
        const img = new Image()
        img.src = c.toDataURL()
        await new Promise<void>(r => { img.onload = () => r() })
        setImage(img)
      }
    } else {
      setGifFrames([])
      setSourceGifUrl(null)
      const url = await fileToDataURL(file)
      const img = await loadImage(url)
      setImage(img)
    }

    setResultUrl(null)
    setSmallUrl(null)
    setCollision(null)
  }

  /** Process a single ImageData through the pipeline */
  const processFrame = useCallback((source: ImageData): { scaled: ImageData; small: ImageData; collision?: CollisionData } => {
    return runPixelPipeline(source, opts)
  }, [opts])

  // Run pipeline on static image (or first GIF frame) for live preview
  const runPipeline = useCallback(() => {
    if (!image) return

    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = image.width; srcCanvas.height = image.height
    const srcCtx = srcCanvas.getContext('2d')!
    srcCtx.drawImage(image, 0, 0)
    const source = srcCtx.getImageData(0, 0, image.width, image.height)

    const result = processFrame(source)

    // Render scaled result
    const outCanvas = document.createElement('canvas')
    outCanvas.width = result.scaled.width; outCanvas.height = result.scaled.height
    const outCtx = outCanvas.getContext('2d')!
    outCtx.putImageData(result.scaled, 0, 0)

    // Draw collision overlay
    if (showCollision && result.collision) {
      const factor = result.scaled.width / result.small.width
      outCtx.strokeStyle = '#ff0044'
      outCtx.lineWidth = 2
      if (result.collision.type === 'bbox' && result.collision.width! > 0) {
        outCtx.strokeRect(
          result.collision.x! * factor, result.collision.y! * factor,
          result.collision.width! * factor, result.collision.height! * factor
        )
      } else if (result.collision.type === 'polygon' && result.collision.points!.length > 2) {
        outCtx.beginPath()
        const pts = result.collision.points!
        outCtx.moveTo(pts[0][0] * factor, pts[0][1] * factor)
        for (let i = 1; i < pts.length; i++) outCtx.lineTo(pts[i][0] * factor, pts[i][1] * factor)
        outCtx.closePath()
        outCtx.stroke()
      }
    }

    if (resultUrl) URL.revokeObjectURL(resultUrl)
    if (smallUrl) URL.revokeObjectURL(smallUrl)

    outCanvas.toBlob(blob => { if (blob) setResultUrl(URL.createObjectURL(blob)) })

    const smallCanvas = document.createElement('canvas')
    smallCanvas.width = result.small.width; smallCanvas.height = result.small.height
    smallCanvas.getContext('2d')!.putImageData(result.small, 0, 0)
    smallCanvas.toBlob(blob => { if (blob) setSmallUrl(URL.createObjectURL(blob)) })

    setCollision(result.collision ?? null)
  }, [image, processFrame, showCollision])

  useEffect(() => { runPipeline() }, [runPipeline])

  // Process all GIF frames and encode as a new GIF
  const handleGenerateGif = async () => {
    if (gifFrames.length === 0) return
    setProcessingGif(true)

    const processed: ImageData[] = []
    let avgDelay = 10, totalDelay = 0

    for (const frame of gifFrames) {
      const result = processFrame(frame.imageData)
      processed.push(result.scaled)
      totalDelay += frame.delay
    }
    avgDelay = Math.round(totalDelay / gifFrames.length)

    const outW = processed[0].width
    const outH = processed[0].height
    const gifData = encodeGif(outW, outH, processed, avgDelay)
    const blob = new Blob([gifData.buffer as ArrayBuffer], { type: 'image/gif' })

    if (resultGifUrl) URL.revokeObjectURL(resultGifUrl)
    setResultGifBlob(blob)
    setResultGifUrl(URL.createObjectURL(blob))
    setProcessingGif(false)
  }

  const handleDownload = async () => {
    if (isGif && resultGifBlob) {
      downloadBlob(resultGifBlob, `pixelart_advanced_${opts.pixelSize}px.gif`)
      return
    }
    if (!image) return
    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = image.width; srcCanvas.height = image.height
    srcCanvas.getContext('2d')!.drawImage(image, 0, 0)
    const source = srcCanvas.getContext('2d')!.getImageData(0, 0, image.width, image.height)
    const result = processFrame(source)
    const outCanvas = document.createElement('canvas')
    outCanvas.width = result.scaled.width; outCanvas.height = result.scaled.height
    outCanvas.getContext('2d')!.putImageData(result.scaled, 0, 0)
    const blob = await canvasToBlob(outCanvas)
    downloadBlob(blob, `pixelart_advanced_${opts.pixelSize}px.png`)
  }

  const handleDownloadSmall = async () => {
    if (!image) return
    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = image.width; srcCanvas.height = image.height
    srcCanvas.getContext('2d')!.drawImage(image, 0, 0)
    const source = srcCanvas.getContext('2d')!.getImageData(0, 0, image.width, image.height)
    const result = processFrame(source)
    const outCanvas = document.createElement('canvas')
    outCanvas.width = result.small.width; outCanvas.height = result.small.height
    outCanvas.getContext('2d')!.putImageData(result.small, 0, 0)
    const blob = await canvasToBlob(outCanvas)
    downloadBlob(blob, `pixelart_${result.small.width}x${result.small.height}.png`)
  }

  const handleCopyCollision = () => {
    if (!collision) return
    navigator.clipboard.writeText(JSON.stringify(collision, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <FileDropzone onFiles={handleFiles} accept="image/*,.gif" label="Drop an image or GIF to pixelate" description="Supports PNG, JPG, and animated GIF files" />

      {image && (
        <div className="grid grid-cols-[1fr_280px] gap-5">
          {/* Preview */}
          <div className="space-y-4">
            {isGif && (
              <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                Animated GIF detected — {gifFrames.length} frames. Preview shows first frame; generate to process all.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-zinc-200 rounded-lg p-3">
                <p className="text-xs font-medium text-zinc-500 mb-2">Original ({image.width}×{image.height})</p>
                <div className="overflow-auto max-h-72 rounded" style={{
                  backgroundImage: 'repeating-conic-gradient(#e4e4e7 0% 25%, #f4f4f5 0% 50%)',
                  backgroundSize: '12px 12px',
                }}>
                  {isGif && sourceGifUrl ? (
                    <img src={sourceGifUrl} alt="Original GIF" className="max-w-full" />
                  ) : (
                    <img src={image.src} alt="Original" className="max-w-full" />
                  )}
                </div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-lg p-3">
                <p className="text-xs font-medium text-zinc-500 mb-2">
                  Pixel Art ({Math.ceil(image.width / opts.pixelSize)}×{Math.ceil(image.height / opts.pixelSize)})
                </p>
                <div className="overflow-auto max-h-72 rounded" style={{
                  backgroundImage: 'repeating-conic-gradient(#e4e4e7 0% 25%, #f4f4f5 0% 50%)',
                  backgroundSize: '12px 12px',
                  imageRendering: 'pixelated',
                }}>
                  {isGif && resultGifUrl ? (
                    <img src={resultGifUrl} alt="Pixel art GIF" className="max-w-full" style={{ imageRendering: 'pixelated' }} />
                  ) : resultUrl ? (
                    <img src={resultUrl} alt="Result" className="max-w-full" style={{ imageRendering: 'pixelated' }} />
                  ) : (
                    <div className="flex items-center justify-center h-32 text-zinc-400 text-xs">Processing...</div>
                  )}
                </div>
              </div>
            </div>

            {isGif ? (
              <div className="flex gap-2">
                <Button onClick={handleGenerateGif} disabled={processingGif} className="flex-1">
                  {processingGif ? (
                    <><Loader2 size={14} className="animate-spin" /> Processing {gifFrames.length} frames...</>
                  ) : (
                    `Generate Pixel Art GIF (${gifFrames.length} frames)`
                  )}
                </Button>
                {resultGifBlob && (
                  <Button onClick={handleDownload} size="sm" variant="secondary">
                    <Download size={14} /> Download GIF
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleDownload} size="sm" className="flex-1">
                  <Download size={14} /> Download (upscaled)
                </Button>
                <Button onClick={handleDownloadSmall} size="sm" variant="secondary" className="flex-1">
                  <Download size={14} /> Download (1:1 pixel)
                </Button>
              </div>
            )}
          </div>

          {/* Pipeline Controls */}
          <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
            {/* Downscale */}
            <div className="border border-zinc-200 rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Downscale</p>
              <Slider label="Pixel Size" displayValue={`${opts.pixelSize}px`}
                min={2} max={32} value={opts.pixelSize}
                onChange={e => update({ pixelSize: +(e.target as HTMLInputElement).value })} />
            </div>

            {/* Color Grading */}
            <div className="border border-zinc-200 rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Color Grading</p>
              <Slider label="Brightness" displayValue={String(opts.brightness)}
                min={-100} max={100} value={opts.brightness}
                onChange={e => update({ brightness: +(e.target as HTMLInputElement).value })} />
              <Slider label="Contrast" displayValue={String(opts.contrast)}
                min={-100} max={100} value={opts.contrast}
                onChange={e => update({ contrast: +(e.target as HTMLInputElement).value })} />
              <Slider label="Saturation" displayValue={String(opts.saturation)}
                min={-100} max={100} value={opts.saturation}
                onChange={e => update({ saturation: +(e.target as HTMLInputElement).value })} />
            </div>

            {/* Palette */}
            <div className="border border-zinc-200 rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Palette</p>
              <Select label="Mode" options={[
                { value: 'auto', label: 'Auto (Median Cut)' },
                { value: 'preset', label: 'Preset Palette' },
              ]} value={opts.paletteMode} onChange={e => update({ paletteMode: e.target.value as 'auto' | 'preset' })} />

              {opts.paletteMode === 'preset' && (
                <Select label="Preset" options={PALETTE_PRESETS.map(p => ({
                  value: p.name, label: `${p.name} (${p.colors.length})`,
                }))} value={PALETTE_PRESETS[0].name} onChange={e => {
                  const preset = PALETTE_PRESETS.find(p => p.name === e.target.value)
                  if (preset) update({ paletteColors: preset.colors })
                }} />
              )}

              {opts.paletteMode === 'auto' && (
                <Slider label="Colors" displayValue={String(opts.colorCount)}
                  min={2} max={64} value={opts.colorCount}
                  onChange={e => update({ colorCount: +(e.target as HTMLInputElement).value })} />
              )}

              <Select label="Distance" options={[
                { value: 'cielab', label: 'CIELab (perceptual)' },
                { value: 'rgb', label: 'RGB (euclidean)' },
              ]} value={opts.colorMetric} onChange={e => update({ colorMetric: e.target.value as 'rgb' | 'cielab' })} />
            </div>

            {/* Dithering */}
            <div className="border border-zinc-200 rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Dithering</p>
              <Select label="Type" options={[
                { value: 'none', label: 'None' },
                { value: 'floyd-steinberg', label: 'Floyd-Steinberg' },
                { value: 'bayer2', label: 'Bayer 2×2' },
                { value: 'bayer4', label: 'Bayer 4×4' },
                { value: 'bayer8', label: 'Bayer 8×8' },
              ]} value={opts.ditherMode} onChange={e => update({ ditherMode: e.target.value as DitherMode })} />
              {opts.ditherMode.startsWith('bayer') && (
                <Slider label="Strength" displayValue={opts.ditherStrength.toFixed(1)}
                  min={0} max={1} step={0.1} value={opts.ditherStrength}
                  onChange={e => update({ ditherStrength: +(e.target as HTMLInputElement).value })} />
              )}
            </div>

            {/* Edges & Outlines */}
            <div className="border border-zinc-200 rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Edges & Outlines</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={opts.outline} onChange={e => update({ outline: e.target.checked })}
                  className="accent-blue-600 rounded" />
                <span className="text-xs font-medium text-zinc-600">Outline</span>
              </label>
              {opts.outline && (
                <div className="flex gap-2 items-center pl-5">
                  <input type="color" value={opts.outlineColor} onChange={e => update({ outlineColor: e.target.value })}
                    className="w-6 h-6 rounded border border-zinc-200 cursor-pointer" />
                  <div className="flex rounded border border-zinc-200 overflow-hidden">
                    {([1, 2] as const).map(w => (
                      <button key={w} onClick={() => update({ outlineWidth: w })}
                        className={cn('px-2 py-0.5 text-[10px] font-medium',
                          opts.outlineWidth === w ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-500'
                        )}>{w}px</button>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={opts.inline} onChange={e => update({ inline: e.target.checked })}
                  className="accent-blue-600 rounded" />
                <span className="text-xs font-medium text-zinc-600">Inline edges</span>
              </label>
              {opts.inline && (
                <div className="pl-5 space-y-1">
                  <Slider label="Threshold" displayValue={opts.inlineThreshold.toFixed(1)}
                    min={0.05} max={1} step={0.05} value={opts.inlineThreshold}
                    onChange={e => update({ inlineThreshold: +(e.target as HTMLInputElement).value })} />
                  <Slider label="Opacity" displayValue={opts.inlineOpacity.toFixed(1)}
                    min={0.1} max={1} step={0.1} value={opts.inlineOpacity}
                    onChange={e => update({ inlineOpacity: +(e.target as HTMLInputElement).value })} />
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={opts.collision} onChange={e => update({ collision: e.target.checked })}
                  className="accent-blue-600 rounded" />
                <span className="text-xs font-medium text-zinc-600">Collision border</span>
              </label>
              {opts.collision && (
                <div className="pl-5 space-y-1.5">
                  <Select label="Mode" options={[
                    { value: 'bbox', label: 'Bounding Box' },
                    { value: 'silhouette', label: 'Pixel Silhouette' },
                  ]} value={opts.collisionMode} onChange={e => update({ collisionMode: e.target.value as CollisionMode })} />
                  <div className="flex gap-1.5">
                    <button onClick={() => setShowCollision(!showCollision)}
                      className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-700 font-medium">
                      {showCollision ? <EyeOff size={10} /> : <Eye size={10} />}
                      {showCollision ? 'Hide' : 'Show'} overlay
                    </button>
                    {collision && (
                      <button onClick={handleCopyCollision}
                        className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 font-medium">
                        <Copy size={10} /> {copied ? 'Copied!' : 'Copy JSON'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Scaling */}
            <div className="border border-zinc-200 rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Pixel Scaling</p>
              <Select label="Algorithm" options={[
                { value: 'nearest', label: 'Nearest Neighbor' },
                { value: 'epx', label: 'Scale2x / EPX' },
                { value: 'mmpx', label: 'MMPX (luma-based)' },
                { value: 'cleanEdge', label: 'Clean Edge' },
              ]} value={opts.scaleAlgorithm} onChange={e => update({ scaleAlgorithm: e.target.value as ScaleAlgorithm })} />
            </div>

            {/* Polish */}
            <div className="border border-zinc-200 rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Polish</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={opts.edgePolish} onChange={e => update({ edgePolish: e.target.checked })}
                  className="accent-blue-600 rounded" />
                <span className="text-xs font-medium text-zinc-600">Edge polish (smooth staircases)</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Basic Tab (original)
// ═══════════════════════════════════════════════════════════════════════════

function BasicPixelart() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [pixelSize, setPixelSize] = useState(8)
  const [colorCount, setColorCount] = useState(16)
  const [outline, setOutline] = useState(false)
  const [dithering, setDithering] = useState(false)
  const [isGif, setIsGif] = useState(false)
  const [gifFrames, setGifFrames] = useState<GifFrame[]>([])
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [resultGifUrl, setResultGifUrl] = useState<string | null>(null)
  const [resultGifBlob, setResultGifBlob] = useState<Blob | null>(null)
  const [processingGif, setProcessingGif] = useState(false)
  const srcCanvasRef = useRef<HTMLCanvasElement>(null)
  const dstCanvasRef = useRef<HTMLCanvasElement>(null)

  const handleFiles = async (files: File[]) => {
    const file = files[0]
    setSourceFile(file)
    const isGifFile = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')
    setIsGif(isGifFile)
    setResultGifUrl(null)
    setResultGifBlob(null)

    if (isGifFile) {
      const buf = await file.arrayBuffer()
      const { frames, width, height } = decodeGifFrames(new Uint8Array(buf))
      setGifFrames(frames)
      // Show first frame as image for preview
      if (frames.length > 0) {
        const c = document.createElement('canvas')
        c.width = width
        c.height = height
        c.getContext('2d')!.putImageData(frames[0].imageData, 0, 0)
        const img = new Image()
        img.src = c.toDataURL()
        await new Promise<void>((r) => { img.onload = () => r() })
        setImage(img)
      }
    } else {
      setGifFrames([])
      const url = await fileToDataURL(file)
      const img = await loadImage(url)
      setImage(img)
    }
  }

  useEffect(() => {
    if (!image || !srcCanvasRef.current) return
    const c = srcCanvasRef.current
    c.width = image.width
    c.height = image.height
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(image, 0, 0)
  }, [image])

  const pixelate = useCallback(() => {
    if (!image || !dstCanvasRef.current) return

    const targetW = Math.ceil(image.width / pixelSize)
    const targetH = Math.ceil(image.height / pixelSize)

    // Step 1: Downscale
    const smallCanvas = document.createElement('canvas')
    smallCanvas.width = targetW
    smallCanvas.height = targetH
    const smallCtx = smallCanvas.getContext('2d')!
    smallCtx.imageSmoothingEnabled = true
    smallCtx.imageSmoothingQuality = 'medium'
    smallCtx.drawImage(image, 0, 0, targetW, targetH)

    // Step 2: Reduce colors
    const imgData = smallCtx.getImageData(0, 0, targetW, targetH)
    const reduced = reduceColors(imgData, colorCount, dithering)
    smallCtx.putImageData(reduced, 0, 0)

    // Step 3: Upscale with nearest neighbor
    const outputW = targetW * pixelSize
    const outputH = targetH * pixelSize
    const dst = dstCanvasRef.current
    dst.width = outputW
    dst.height = outputH
    const dstCtx = dst.getContext('2d')!
    dstCtx.imageSmoothingEnabled = false
    dstCtx.drawImage(smallCanvas, 0, 0, outputW, outputH)

    // Step 4: Optional outline
    if (outline) {
      drawOutlines(dstCtx, reduced, pixelSize, outputW, outputH)
    }
  }, [image, pixelSize, colorCount, outline, dithering])

  useEffect(() => { pixelate() }, [pixelate])

  /** Pixelate an ImageData (for GIF frame processing) */
  const pixelateImageData = (srcData: ImageData): ImageData => {
    const targetW = Math.ceil(srcData.width / pixelSize)
    const targetH = Math.ceil(srcData.height / pixelSize)

    // Draw the ImageData onto a canvas so we can downscale it
    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = srcData.width
    srcCanvas.height = srcData.height
    srcCanvas.getContext('2d')!.putImageData(srcData, 0, 0)

    // Downscale
    const smallCanvas = document.createElement('canvas')
    smallCanvas.width = targetW
    smallCanvas.height = targetH
    const smallCtx = smallCanvas.getContext('2d')!
    smallCtx.imageSmoothingEnabled = true
    smallCtx.imageSmoothingQuality = 'medium'
    smallCtx.drawImage(srcCanvas, 0, 0, targetW, targetH)

    // Reduce colors
    const imgData = smallCtx.getImageData(0, 0, targetW, targetH)
    const reduced = reduceColors(imgData, colorCount, dithering)
    smallCtx.putImageData(reduced, 0, 0)

    // Upscale with nearest neighbor
    const outputW = targetW * pixelSize
    const outputH = targetH * pixelSize
    const outCanvas = document.createElement('canvas')
    outCanvas.width = outputW
    outCanvas.height = outputH
    const outCtx = outCanvas.getContext('2d')!
    outCtx.imageSmoothingEnabled = false
    outCtx.drawImage(smallCanvas, 0, 0, outputW, outputH)

    if (outline) {
      drawOutlines(outCtx, reduced, pixelSize, outputW, outputH)
    }

    return outCtx.getImageData(0, 0, outputW, outputH)
  }

  const handleGenerateGif = async () => {
    if (!isGif || gifFrames.length === 0) return
    setProcessingGif(true)

    // Process each frame
    const processedFrames: ImageData[] = []
    let avgDelay = 10
    let totalDelay = 0

    for (const frame of gifFrames) {
      processedFrames.push(pixelateImageData(frame.imageData))
      totalDelay += frame.delay
    }
    avgDelay = Math.round(totalDelay / gifFrames.length)

    const outW = processedFrames[0].width
    const outH = processedFrames[0].height

    const gifData = encodeGif(outW, outH, processedFrames, avgDelay)
    const blob = new Blob([gifData.buffer as ArrayBuffer], { type: 'image/gif' })

    if (resultGifUrl) URL.revokeObjectURL(resultGifUrl)
    setResultGifBlob(blob)
    setResultGifUrl(URL.createObjectURL(blob))
    setProcessingGif(false)
  }

  const handleDownload = async () => {
    if (isGif && resultGifBlob) {
      downloadBlob(resultGifBlob, `pixelart_${pixelSize}px.gif`)
      return
    }
    if (!dstCanvasRef.current) return
    const blob = await canvasToBlob(dstCanvasRef.current)
    const baseName = 'pixelart'
    downloadBlob(blob, `${baseName}_${pixelSize}px.png`)
  }

  const handleDownloadSmall = async () => {
    if (!image) return
    const targetW = Math.ceil(image.width / pixelSize)
    const targetH = Math.ceil(image.height / pixelSize)
    const small = document.createElement('canvas')
    small.width = targetW
    small.height = targetH
    const ctx = small.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(image, 0, 0, targetW, targetH)
    const imgData = ctx.getImageData(0, 0, targetW, targetH)
    const reduced = reduceColors(imgData, colorCount, dithering)
    ctx.putImageData(reduced, 0, 0)
    const blob = await canvasToBlob(small)
    downloadBlob(blob, `pixelart_${targetW}x${targetH}.png`)
  }

  return (
    <>
      <FileDropzone onFiles={handleFiles} accept="image/*,.gif" label="Drop an image or GIF to pixelate" description="Supports PNG, JPG, and animated GIF files" />

      {image && (
        <div className="grid grid-cols-[1fr_260px] gap-6">
          <div className="space-y-4">
            {isGif && (
              <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                🎞️ Animated GIF detected — {gifFrames.length} frames will be pixelated
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-zinc-200 rounded-lg p-3">
                <p className="text-xs font-medium text-zinc-500 mb-2">Original ({image.width}x{image.height})</p>
                <div className="overflow-auto max-h-64 bg-zinc-100 rounded p-1">
                  {isGif && sourceFile ? (
                    <img src={URL.createObjectURL(sourceFile)} alt="GIF preview" className="max-w-full" style={{ imageRendering: 'pixelated' }} />
                  ) : (
                    <canvas ref={srcCanvasRef} className="max-w-full" />
                  )}
                </div>
              </div>
              <div className="bg-white border border-zinc-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-zinc-500">
                    Pixel Art ({Math.ceil(image.width / pixelSize)}x{Math.ceil(image.height / pixelSize)})
                  </p>
                </div>
                <div className="overflow-auto max-h-64 bg-zinc-100 rounded p-1" style={{ imageRendering: 'pixelated' }}>
                  {isGif && resultGifUrl ? (
                    <img src={resultGifUrl} alt="Pixel art GIF" className="max-w-full" style={{ imageRendering: 'pixelated' }} />
                  ) : (
                    <canvas ref={dstCanvasRef} className="max-w-full" style={{ imageRendering: 'pixelated' }} />
                  )}
                </div>
              </div>
            </div>

            {isGif ? (
              <div className="flex gap-2">
                <Button onClick={handleGenerateGif} disabled={processingGif} className="flex-1">
                  {processingGif ? <><Loader2 size={14} className="animate-spin" /> Processing {gifFrames.length} frames...</> : `Generate Pixel Art GIF (${gifFrames.length} frames)`}
                </Button>
                {resultGifBlob && (
                  <Button onClick={handleDownload} size="sm" variant="secondary">
                    <Download size={14} /> Download GIF
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleDownload} size="sm" className="flex-1">
                  <Download size={14} /> Download (upscaled)
                </Button>
                <Button onClick={handleDownloadSmall} size="sm" variant="secondary" className="flex-1">
                  <Download size={14} /> Download (1:1 pixel)
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-4">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Settings</p>

              <Slider
                label="Pixel Size"
                displayValue={`${pixelSize}px`}
                min={2}
                max={32}
                value={pixelSize}
                onChange={(e) => setPixelSize(+(e.target as HTMLInputElement).value)}
              />

              <Slider
                label="Color Count"
                displayValue={String(colorCount)}
                min={2}
                max={64}
                value={colorCount}
                onChange={(e) => setColorCount(+(e.target as HTMLInputElement).value)}
              />

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={outline} onChange={(e) => setOutline(e.target.checked)}
                  className="accent-blue-600 rounded" />
                <span className="text-xs font-medium text-zinc-600">Pixel outlines</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dithering} onChange={(e) => setDithering(e.target.checked)}
                  className="accent-blue-600 rounded" />
                <span className="text-xs font-medium text-zinc-600">Floyd-Steinberg dithering</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function reduceColors(imgData: ImageData, maxColors: number, dither: boolean): ImageData {
  const data = new Uint8ClampedArray(imgData.data)
  const w = imgData.width
  const h = imgData.height

  // Build palette using median cut
  const pixels: [number, number, number][] = []
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    pixels.push([data[i], data[i + 1], data[i + 2]])
  }

  const palette = medianCut(pixels, maxColors)

  // Map pixels to nearest palette color (with optional dithering)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (data[i + 3] < 128) continue

      const r = data[i], g = data[i + 1], b = data[i + 2]
      const nearest = findNearest(palette, r, g, b)

      if (dither) {
        const errR = r - nearest[0]
        const errG = g - nearest[1]
        const errB = b - nearest[2]
        distributeError(data, w, h, x, y, errR, errG, errB)
      }

      data[i] = nearest[0]
      data[i + 1] = nearest[1]
      data[i + 2] = nearest[2]
    }
  }

  return new ImageData(data, w, h)
}

function medianCut(pixels: [number, number, number][], maxColors: number): [number, number, number][] {
  if (pixels.length === 0) return [[0, 0, 0]]

  // Sample pixels if too many to avoid performance issues
  let sampled = pixels
  if (pixels.length > 10000) {
    const step = Math.ceil(pixels.length / 10000)
    sampled = []
    for (let i = 0; i < pixels.length; i += step) {
      sampled.push(pixels[i])
    }
  }

  type Bucket = [number, number, number][]
  let buckets: Bucket[] = [sampled]

  while (buckets.length < maxColors) {
    let maxRange = -1
    let maxIdx = 0
    let splitChannel = 0

    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i]
      if (b.length < 2) continue
      for (let ch = 0; ch < 3; ch++) {
        let lo = 255, hi = 0
        for (const p of b) {
          if (p[ch] < lo) lo = p[ch]
          if (p[ch] > hi) hi = p[ch]
        }
        const range = hi - lo
        if (range > maxRange) {
          maxRange = range
          maxIdx = i
          splitChannel = ch
        }
      }
    }

    if (maxRange <= 0) break

    const bucket = buckets[maxIdx]
    bucket.sort((a, b) => a[splitChannel] - b[splitChannel])
    const mid = Math.floor(bucket.length / 2)
    buckets.splice(maxIdx, 1, bucket.slice(0, mid), bucket.slice(mid))
  }

  return buckets.map((b) => {
    let r = 0, g = 0, bl = 0
    for (const p of b) { r += p[0]; g += p[1]; bl += p[2] }
    return [Math.round(r / b.length), Math.round(g / b.length), Math.round(bl / b.length)] as [number, number, number]
  })
}

function findNearest(palette: [number, number, number][], r: number, g: number, b: number): [number, number, number] {
  let minDist = Infinity
  let best = palette[0]
  for (const c of palette) {
    const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2
    if (d < minDist) { minDist = d; best = c }
  }
  return best
}

function distributeError(data: Uint8ClampedArray, w: number, h: number, x: number, y: number, errR: number, errG: number, errB: number) {
  const diffuse = [
    [x + 1, y, 7 / 16],
    [x - 1, y + 1, 3 / 16],
    [x, y + 1, 5 / 16],
    [x + 1, y + 1, 1 / 16],
  ] as const

  for (const [dx, dy, factor] of diffuse) {
    if (dx < 0 || dx >= w || dy >= h) continue
    const i = (dy * w + dx) * 4
    data[i] = Math.min(255, Math.max(0, data[i] + errR * factor))
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + errG * factor))
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + errB * factor))
  }
}

function drawOutlines(ctx: CanvasRenderingContext2D, imgData: ImageData, pixelSize: number, _w: number, _h: number) {
  const data = imgData.data
  const iw = imgData.width
  const ih = imgData.height

  ctx.strokeStyle = 'rgba(0,0,0,0.15)'
  ctx.lineWidth = 1

  for (let y = 0; y < ih; y++) {
    for (let x = 0; x < iw; x++) {
      const i = (y * iw + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2]

      // Check right neighbor
      if (x < iw - 1) {
        const j = (y * iw + x + 1) * 4
        if (data[j] !== r || data[j + 1] !== g || data[j + 2] !== b) {
          ctx.beginPath()
          ctx.moveTo((x + 1) * pixelSize, y * pixelSize)
          ctx.lineTo((x + 1) * pixelSize, (y + 1) * pixelSize)
          ctx.stroke()
        }
      }
      // Check bottom neighbor
      if (y < ih - 1) {
        const j = ((y + 1) * iw + x) * 4
        if (data[j] !== r || data[j + 1] !== g || data[j + 2] !== b) {
          ctx.beginPath()
          ctx.moveTo(x * pixelSize, (y + 1) * pixelSize)
          ctx.lineTo((x + 1) * pixelSize, (y + 1) * pixelSize)
          ctx.stroke()
        }
      }
    }
  }
}
