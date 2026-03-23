import { useState, useRef, useCallback, useEffect } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Download, Loader2, X, FileImage, FileVideo, FileAudio, FileText, File } from 'lucide-react'
import { downloadBlob, loadImage, fileToDataURL, canvasToBlob } from '../../lib/utils'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import JSZip from 'jszip'

/* ─────────── Format definitions ─────────── */

interface FormatDef {
  value: string
  label: string
  ext: string
  mime: string
  category: 'image' | 'video' | 'audio' | 'sprite' | 'data'
}

const OUTPUT_FORMATS: FormatDef[] = [
  // Images
  { value: 'png', label: 'PNG', ext: 'png', mime: 'image/png', category: 'image' },
  { value: 'jpg', label: 'JPEG', ext: 'jpg', mime: 'image/jpeg', category: 'image' },
  { value: 'webp', label: 'WebP', ext: 'webp', mime: 'image/webp', category: 'image' },
  { value: 'bmp', label: 'BMP', ext: 'bmp', mime: 'image/bmp', category: 'image' },
  { value: 'gif', label: 'GIF (static)', ext: 'gif', mime: 'image/gif', category: 'image' },
  { value: 'avif', label: 'AVIF', ext: 'avif', mime: 'image/avif', category: 'image' },
  { value: 'ico', label: 'ICO — Favicon (64×64)', ext: 'ico', mime: 'image/x-icon', category: 'image' },
  { value: 'favicon-multi', label: 'Favicon Multi (16+32+48)', ext: 'ico', mime: 'image/x-icon', category: 'image' },
  { value: 'icns', label: 'ICNS — macOS Icon', ext: 'icns', mime: 'image/x-icns', category: 'image' },

  // Video
  { value: 'mp4', label: 'MP4 (H.264)', ext: 'mp4', mime: 'video/mp4', category: 'video' },
  { value: 'webm', label: 'WebM (VP8)', ext: 'webm', mime: 'video/webm', category: 'video' },
  { value: 'avi', label: 'AVI', ext: 'avi', mime: 'video/avi', category: 'video' },
  { value: 'mov', label: 'MOV', ext: 'mov', mime: 'video/quicktime', category: 'video' },

  // Audio
  { value: 'mp3', label: 'MP3', ext: 'mp3', mime: 'audio/mpeg', category: 'audio' },
  { value: 'wav', label: 'WAV', ext: 'wav', mime: 'audio/wav', category: 'audio' },
  { value: 'ogg', label: 'OGG (Vorbis)', ext: 'ogg', mime: 'audio/ogg', category: 'audio' },
  { value: 'flac', label: 'FLAC', ext: 'flac', mime: 'audio/flac', category: 'audio' },
  { value: 'aac', label: 'AAC', ext: 'aac', mime: 'audio/aac', category: 'audio' },

  // Sprite / Data
  { value: 'spritesheet-json', label: 'Spritesheet JSON', ext: 'json', mime: 'application/json', category: 'sprite' },
  { value: 'gif-frames-zip', label: 'GIF → Frames (ZIP)', ext: 'zip', mime: 'application/zip', category: 'sprite' },
  { value: 'frames-to-sheet', label: 'Frames → Spritesheet PNG', ext: 'png', mime: 'image/png', category: 'sprite' },
  { value: 'base64', label: 'Base64 Data URI', ext: 'txt', mime: 'text/plain', category: 'data' },
  { value: 'svg-trace', label: 'SVG (traced outline)', ext: 'svg', mime: 'image/svg+xml', category: 'data' },
]

// Which output categories are allowed for each input type
// video → video + audio (extract audio from video)
// audio → audio only
// image → image + sprite + data
const ALLOWED_CATEGORIES: Record<string, string[]> = {
  image: ['image', 'sprite', 'data'],
  video: ['video', 'audio'],
  audio: ['audio'],
  data: ['data', 'sprite'],
  unknown: ['image', 'video', 'audio', 'sprite', 'data'],
}

const CATEGORY_LABELS: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  sprite: 'Sprite',
  data: 'Data',
}

function getFileCategory(file: File): string {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.name.endsWith('.json')) return 'data'
  return 'unknown'
}

function getFileIcon(category: string) {
  switch (category) {
    case 'image': return FileImage
    case 'video': return FileVideo
    case 'audio': return FileAudio
    case 'data': return FileText
    default: return File
  }
}

/* ─────────── Main Component ─────────── */

export function FormatConverterPage() {
  const [files, setFiles] = useState<File[]>([])
  const [outputFormat, setOutputFormat] = useState('png')
  const [filterCat, setFilterCat] = useState('')
  const [status, setStatus] = useState<'idle' | 'converting' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [resultName, setResultName] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const ffmpegRef = useRef<FFmpeg | null>(null)

  // Sprite-specific settings
  const [sheetCols, setSheetCols] = useState(8)
  const [jsonCols, setJsonCols] = useState(4)
  const [jsonRows, setJsonRows] = useState(4)

  // Determine allowed categories based on input file types
  const inputCategory = files.length > 0 ? getFileCategory(files[0]) : 'unknown'
  const allowedCats = ALLOWED_CATEGORIES[inputCategory] || ALLOWED_CATEGORIES.unknown
  const activeCat = filterCat && allowedCats.includes(filterCat) ? filterCat : allowedCats[0]
  const filteredFormats = OUTPUT_FORMATS.filter((f) => f.category === activeCat)

  const handleFiles = (incoming: File[]) => {
    const newFiles = [...files, ...incoming]
    setFiles(newFiles)
    setStatus('idle')
    setResultBlob(null)
    setPreviewUrl(null)
    setFilterCat('')

    // Auto-select a sensible default output format based on input
    if (files.length === 0 && incoming.length > 0) {
      const cat = getFileCategory(incoming[0])
      const allowed = ALLOWED_CATEGORIES[cat] || ALLOWED_CATEGORIES.unknown
      const firstAllowedCat = allowed[0]
      const defaultFmt = OUTPUT_FORMATS.find((f) => f.category === firstAllowedCat)
      if (defaultFmt) setOutputFormat(defaultFmt.value)
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const clearAll = () => {
    setFiles([])
    setStatus('idle')
    setResultBlob(null)
    setPreviewUrl(null)
    setErrorMsg('')
  }

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current
    const ffmpeg = new FFmpeg()
    ffmpeg.on('progress', ({ progress: p }) => {
      setProgress(`Converting... ${Math.round(p)}%`)
    })
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm'
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
    })
    ffmpegRef.current = ffmpeg
    return ffmpeg
  }, [])

  const convert = async () => {
    if (!files.length) return
    setStatus('converting')
    setErrorMsg('')
    setResultBlob(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)

    try {
      const fmt = OUTPUT_FORMATS.find((f) => f.value === outputFormat)!
      const file = files[0]
      const baseName = file.name.replace(/\.[^.]+$/, '')

      // ─── Image-to-Image via Canvas ───
      if (fmt.category === 'image' && getFileCategory(file) === 'image') {
        setProgress('Converting image...')
        const blob = await convertImageViaCanvas(file, fmt)
        finishWithBlob(blob, `${baseName}.${fmt.ext}`, fmt.mime)
        return
      }

      // ─── Base64 Data URI ───
      if (fmt.value === 'base64') {
        setProgress('Encoding to Base64...')
        const dataUrl = await fileToDataURL(file)
        const blob = new Blob([dataUrl], { type: 'text/plain' })
        finishWithBlob(blob, `${baseName}.txt`, 'text/plain')
        return
      }

      // ─── SVG Trace ───
      if (fmt.value === 'svg-trace' && getFileCategory(file) === 'image') {
        setProgress('Tracing image to SVG...')
        const blob = await traceToSvg(file)
        finishWithBlob(blob, `${baseName}.svg`, 'image/svg+xml')
        return
      }

      // ─── Spritesheet JSON ───
      if (fmt.value === 'spritesheet-json' && getFileCategory(file) === 'image') {
        setProgress('Generating spritesheet JSON...')
        const blob = await generateSpritesheetJson(file, jsonCols, jsonRows, baseName)
        finishWithBlob(blob, `${baseName}.json`, 'application/json')
        return
      }

      // ─── GIF → Frames ZIP ───
      if (fmt.value === 'gif-frames-zip') {
        setProgress('Extracting frames...')
        const blob = await extractGifFramesZip(file)
        finishWithBlob(blob, `${baseName}_frames.zip`, 'application/zip')
        return
      }

      // ─── Frames → Spritesheet PNG ───
      if (fmt.value === 'frames-to-sheet' && files.length > 1) {
        setProgress('Building spritesheet...')
        const blob = await buildSpritesheetFromFrames(files, sheetCols)
        finishWithBlob(blob, 'spritesheet.png', 'image/png')
        return
      }

      // ─── Video/Audio conversions via FFmpeg ───
      if (fmt.category === 'video' || fmt.category === 'audio' ||
          getFileCategory(file) === 'video' || getFileCategory(file) === 'audio') {
        setProgress('Loading FFmpeg...')
        const ffmpeg = await loadFFmpeg()

        const inputExt = file.name.match(/\.[^.]+$/)?.[0] || '.bin'
        const inputName = `input${inputExt}`
        const outputName = `output.${fmt.ext}`

        await ffmpeg.writeFile(inputName, await fetchFile(file))

        const args = buildFFmpegArgs(inputName, outputName, fmt)
        setProgress('Converting...')
        await ffmpeg.exec(args)

        const data = await ffmpeg.readFile(outputName)
        const buffer = data instanceof Uint8Array
          ? data.buffer as ArrayBuffer
          : new TextEncoder().encode(data as string).buffer as ArrayBuffer
        const blob = new Blob([buffer], { type: fmt.mime })
        finishWithBlob(blob, `${baseName}.${fmt.ext}`, fmt.mime)
        return
      }

      throw new Error(`Cannot convert ${file.type || file.name} to ${fmt.label}. Unsupported conversion.`)

    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Conversion failed')
    }
  }

  const finishWithBlob = (blob: Blob, name: string, mime: string) => {
    setResultBlob(blob)
    setResultName(name)
    setStatus('done')
    setProgress('')
    // Generate preview for images
    if (mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/')) {
      setPreviewUrl(URL.createObjectURL(blob))
    }
  }

  const handleDownload = () => {
    if (resultBlob) downloadBlob(resultBlob, resultName)
  }

  const selectedFormat = OUTPUT_FORMATS.find((f) => f.value === outputFormat)
  const isConverting = status === 'converting'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Format Converter</h2>
        <p className="text-sm text-zinc-500 mt-2">Universal file converter — upload anything, pick your output format</p>
      </div>

      {/* File Drop */}
      <FileDropzone
        onFiles={handleFiles}
        accept="image/*,video/*,audio/*,.json,.gif,.webp,.svg,.bmp,.ico,.tiff"
        multiple
        label="Drop any file here"
        description="Images, video, audio, GIFs, JSON, and more"
      />

      {/* File list */}
      {files.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
          <div className="flex items-center justify-between px-4 py-2">
            <p className="text-xs font-medium text-zinc-500">{files.length} file{files.length > 1 ? 's' : ''}</p>
            <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700">Clear all</button>
          </div>
          {files.map((f, i) => {
            const cat = getFileCategory(f)
            const Icon = getFileIcon(cat)
            return (
              <div key={`${f.name}-${i}`} className="flex items-center gap-3 px-4 py-2">
                <Icon size={14} className="text-zinc-400 shrink-0" />
                <span className="text-sm text-zinc-700 truncate flex-1">{f.name}</span>
                <span className="text-[11px] text-zinc-400">{(f.size / 1024).toFixed(1)} KB</span>
                <button onClick={() => removeFile(i)} className="text-zinc-300 hover:text-zinc-600">
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Output format picker */}
      {files.length > 0 && (
        <div className="space-y-3">
          {/* Category filter chips — only show relevant categories for input type */}
          {allowedCats.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {allowedCats.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    activeCat === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                  }`}
                >
                  {CATEGORY_LABELS[cat] || cat}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-4 flex-wrap">
            <div className="w-64">
              <Select
                label="Output Format"
                options={filteredFormats.map((f) => ({ value: f.value, label: `${f.label} (.${f.ext})` }))}
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
              />
            </div>

            {/* Spritesheet JSON settings */}
            {outputFormat === 'spritesheet-json' && (
              <div className="flex gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-600">Cols</span>
                  <input type="number" min={1} max={64} value={jsonCols}
                    onChange={(e) => setJsonCols(Math.max(1, +e.target.value))}
                    className="w-16 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-zinc-600">Rows</span>
                  <input type="number" min={1} max={64} value={jsonRows}
                    onChange={(e) => setJsonRows(Math.max(1, +e.target.value))}
                    className="w-16 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm" />
                </label>
              </div>
            )}

            {/* Frames → Spritesheet settings */}
            {outputFormat === 'frames-to-sheet' && (
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-600">Columns</span>
                <input type="number" min={1} max={64} value={sheetCols}
                  onChange={(e) => setSheetCols(Math.max(1, +e.target.value))}
                  className="w-16 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm" />
              </label>
            )}

            <Button onClick={convert} disabled={isConverting}>
              {isConverting ? (
                <><Loader2 size={16} className="animate-spin" /> {progress || 'Converting...'}</>
              ) : (
                <><Download size={16} /> Convert</>
              )}
            </Button>
          </div>

          {selectedFormat && (
            <p className="text-[11px] text-zinc-400">
              Output: <strong>{selectedFormat.label}</strong> ({selectedFormat.mime})
            </p>
          )}
        </div>
      )}

      {/* Result */}
      {status === 'done' && resultBlob && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">Conversion complete!</p>
              <p className="text-xs text-green-600">{resultName} — {(resultBlob.size / 1024).toFixed(1)} KB</p>
            </div>
            <Button onClick={handleDownload} size="sm">
              <Download size={14} /> Download
            </Button>
          </div>

          {/* Preview */}
          {previewUrl && resultBlob.type.startsWith('image/') && (
            <div className="bg-white rounded border border-green-100 p-2 max-h-64 overflow-auto">
              <img src={previewUrl} alt="Output preview" className="max-w-full" style={{ imageRendering: resultBlob.type === 'image/svg+xml' ? 'auto' : 'pixelated' }} />
            </div>
          )}
          {previewUrl && resultBlob.type.startsWith('audio/') && (
            <audio src={previewUrl} controls className="w-full" />
          )}
          {previewUrl && resultBlob.type.startsWith('video/') && (
            <video src={previewUrl} controls className="max-w-full max-h-64 rounded" />
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700 whitespace-pre-line">{errorMsg}</p>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Conversion helpers
   ═══════════════════════════════════════════════════════ */

async function convertImageViaCanvas(file: File, fmt: FormatDef): Promise<Blob> {
  const url = await fileToDataURL(file)
  const img = await loadImage(url)

  // Favicon multi: generate ICO with 16, 32, 48px sizes
  if (fmt.value === 'favicon-multi') {
    return buildIco(img, [16, 32, 48])
  }

  // ICO single: 64×64
  if (fmt.value === 'ico') {
    return buildIco(img, [64])
  }

  // ICNS: macOS icon with multiple sizes (16, 32, 128, 256, 512)
  if (fmt.value === 'icns') {
    return buildIcns(img)
  }

  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  // For JPEG, fill white background (no alpha)
  if (fmt.value === 'jpg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(img, 0, 0)

  const quality = fmt.value === 'jpg' ? 0.92 : fmt.value === 'webp' ? 0.9 : undefined
  const mimeMap: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp',
    bmp: 'image/bmp', gif: 'image/gif', avif: 'image/avif',
  }
  const exportMime = mimeMap[fmt.value] || fmt.mime
  return canvasToBlob(canvas, exportMime, quality)
}

/** Build an ICO file from an image at the given sizes */
async function buildIco(img: HTMLImageElement, sizes: number[]): Promise<Blob> {
  const pngBuffers: ArrayBuffer[] = []
  for (const size of sizes) {
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, size, size)
    const blob = await canvasToBlob(c, 'image/png')
    pngBuffers.push(await blob.arrayBuffer())
  }

  // ICO header: 6 bytes + 16 bytes per image + image data
  const headerSize = 6 + sizes.length * 16
  let totalSize = headerSize
  for (const buf of pngBuffers) totalSize += buf.byteLength

  const ico = new ArrayBuffer(totalSize)
  const view = new DataView(ico)

  // ICONDIR header
  view.setUint16(0, 0, true) // reserved
  view.setUint16(2, 1, true) // type: 1 = ICO
  view.setUint16(4, sizes.length, true) // image count

  let dataOffset = headerSize
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i]
    const pngSize = pngBuffers[i].byteLength
    const entryOffset = 6 + i * 16

    view.setUint8(entryOffset, size < 256 ? size : 0) // width
    view.setUint8(entryOffset + 1, size < 256 ? size : 0) // height
    view.setUint8(entryOffset + 2, 0) // color palette
    view.setUint8(entryOffset + 3, 0) // reserved
    view.setUint16(entryOffset + 4, 1, true) // color planes
    view.setUint16(entryOffset + 6, 32, true) // bits per pixel
    view.setUint32(entryOffset + 8, pngSize, true) // image size
    view.setUint32(entryOffset + 12, dataOffset, true) // data offset

    new Uint8Array(ico, dataOffset, pngSize).set(new Uint8Array(pngBuffers[i]))
    dataOffset += pngSize
  }

  return new Blob([ico], { type: 'image/x-icon' })
}

/** Build an ICNS file (macOS icon) with multiple sizes */
async function buildIcns(img: HTMLImageElement): Promise<Blob> {
  // ICNS type codes mapped to sizes
  const iconTypes: [string, number][] = [
    ['icp4', 16],
    ['icp5', 32],
    ['icp6', 64],
    ['ic07', 128],
    ['ic08', 256],
    ['ic09', 512],
  ]

  const entries: { type: string; data: Uint8Array }[] = []

  for (const [type, size] of iconTypes) {
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, size, size)
    const blob = await canvasToBlob(c, 'image/png')
    const data = new Uint8Array(await blob.arrayBuffer())
    entries.push({ type, data })
  }

  // Calculate total size: 8 (header) + sum of (8 + data.length) per entry
  let totalSize = 8
  for (const e of entries) totalSize += 8 + e.data.length

  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // ICNS magic: 'icns'
  view.setUint8(0, 0x69) // i
  view.setUint8(1, 0x63) // c
  view.setUint8(2, 0x6E) // n
  view.setUint8(3, 0x73) // s
  view.setUint32(4, totalSize) // file length (big-endian)

  let offset = 8
  for (const entry of entries) {
    // Type code (4 ASCII chars)
    for (let i = 0; i < 4; i++) {
      view.setUint8(offset + i, entry.type.charCodeAt(i))
    }
    // Entry length (type + length + data)
    view.setUint32(offset + 4, 8 + entry.data.length) // big-endian
    bytes.set(entry.data, offset + 8)
    offset += 8 + entry.data.length
  }

  return new Blob([buffer], { type: 'image/x-icns' })
}

async function traceToSvg(file: File): Promise<Blob> {
  const url = await fileToDataURL(file)
  const img = await loadImage(url)

  // Simple threshold-based SVG trace
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 256 / Math.max(img.width, img.height))
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)

  // Generate pixel-based SVG
  let rects = ''
  const w = canvas.width
  const h = canvas.height
  const px = img.width / w

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      const r = data.data[idx], g = data.data[idx + 1], b = data.data[idx + 2], a = data.data[idx + 3]
      if (a > 128) {
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
        rects += `<rect x="${x * px}" y="${y * px}" width="${px}" height="${px}" fill="${hex}"/>`
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${img.width} ${img.height}" width="${img.width}" height="${img.height}">${rects}</svg>`
  return new Blob([svg], { type: 'image/svg+xml' })
}

async function generateSpritesheetJson(file: File, cols: number, rows: number, baseName: string): Promise<Blob> {
  const url = await fileToDataURL(file)
  const img = await loadImage(url)
  const frameW = Math.floor(img.width / cols)
  const frameH = Math.floor(img.height / rows)

  const frames: Record<string, object> = {}
  let idx = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      frames[`${baseName}_${idx}`] = {
        frame: { x: c * frameW, y: r * frameH, w: frameW, h: frameH },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: frameW, h: frameH },
        sourceSize: { w: frameW, h: frameH },
      }
      idx++
    }
  }

  const json = {
    frames,
    meta: {
      app: 'JET — Just Enough Tools',
      image: `${baseName}.png`,
      format: 'RGBA8888',
      size: { w: img.width, h: img.height },
      scale: '1',
    },
  }
  return new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
}

async function extractGifFramesZip(file: File): Promise<Blob> {
  const zip = new JSZip()
  const url = URL.createObjectURL(file)

  try {
    if ('ImageDecoder' in window) {
      const response = await fetch(url)
      const decoder = new (window as any).ImageDecoder({ data: response.body, type: 'image/gif' })
      await decoder.completed
      const frameCount = decoder.tracks.selectedTrack.frameCount

      for (let i = 0; i < frameCount; i++) {
        const { image } = await decoder.decode({ frameIndex: i })
        const c = document.createElement('canvas')
        c.width = image.displayWidth
        c.height = image.displayHeight
        c.getContext('2d')!.drawImage(image, 0, 0)
        image.close()
        const data64 = c.toDataURL('image/png').split(',')[1]
        zip.file(`frame_${String(i).padStart(3, '0')}.png`, data64, { base64: true })
      }
      decoder.close()
    } else {
      // Fallback: single frame
      const img = await loadImage(url)
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      c.getContext('2d')!.drawImage(img, 0, 0)
      const data64 = c.toDataURL('image/png').split(',')[1]
      zip.file('frame_000.png', data64, { base64: true })
    }
  } finally {
    URL.revokeObjectURL(url)
  }

  return zip.generateAsync({ type: 'blob' })
}

async function buildSpritesheetFromFrames(files: File[], cols: number): Promise<Blob> {
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name))
  const images: HTMLImageElement[] = []

  for (const f of sorted) {
    if (!f.type.startsWith('image/')) continue
    const url = await fileToDataURL(f)
    images.push(await loadImage(url))
  }

  if (!images.length) throw new Error('No image files found')

  const maxW = Math.max(...images.map((i) => i.width))
  const maxH = Math.max(...images.map((i) => i.height))
  const effectiveCols = Math.min(cols, images.length)
  const rows = Math.ceil(images.length / effectiveCols)

  const canvas = document.createElement('canvas')
  canvas.width = effectiveCols * maxW
  canvas.height = rows * maxH
  const ctx = canvas.getContext('2d')!

  images.forEach((img, i) => {
    const c = i % effectiveCols
    const r = Math.floor(i / effectiveCols)
    ctx.drawImage(img, c * maxW, r * maxH)
  })

  return canvasToBlob(canvas)
}

function buildFFmpegArgs(input: string, output: string, fmt: FormatDef): string[] {
  switch (fmt.value) {
    case 'mp3':
      return ['-i', input, '-vn', '-ab', '192k', '-ar', '44100', output]
    case 'wav':
      return ['-i', input, '-vn', '-acodec', 'pcm_s16le', output]
    case 'ogg':
      return ['-i', input, '-vn', '-acodec', 'libvorbis', '-q:a', '5', output]
    case 'flac':
      return ['-i', input, '-vn', '-acodec', 'flac', output]
    case 'aac':
      return ['-i', input, '-vn', '-acodec', 'aac', '-b:a', '192k', output]
    case 'mp4':
      return ['-i', input, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', output]
    case 'webm':
      return ['-i', input, '-c:v', 'libvpx', '-crf', '30', '-b:v', '0', '-c:a', 'libvorbis', output]
    case 'avi':
      return ['-i', input, '-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'mp3', output]
    case 'mov':
      return ['-i', input, '-c:v', 'libx264', '-c:a', 'aac', '-f', 'mov', output]
    default:
      return ['-i', input, output]
  }
}
