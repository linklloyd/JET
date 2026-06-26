import { useState, useCallback, useEffect, useRef } from 'react'
import { Upload, Download, X, Crop } from 'lucide-react'

type ShapeType = 'rectangle' | 'circle'
type AspectPreset = '1:1' | '4:3' | '3:2' | '16:9' | '9:16' | '2:3' | 'custom'

const ASPECT_PRESETS: { label: AspectPreset; w: number; h: number }[] = [
  { label: '1:1', w: 1, h: 1 },
  { label: '4:3', w: 4, h: 3 },
  { label: '3:2', w: 3, h: 2 },
  { label: '16:9', w: 16, h: 9 },
  { label: '9:16', w: 9, h: 16 },
  { label: '2:3', w: 2, h: 3 },
]

const OUTPUT_SIZES: (number | null)[] = [null, 256, 512, 1024, 2048]

interface CropSettings {
  shape: ShapeType
  aspectPreset: AspectPreset
  customW: number
  customH: number
  outputSize: number | null // null = original, -1 = custom
  customOutputSize: number
}

interface StoredFile { id: string; name: string; file: File }

interface CroppedItem {
  id: string
  name: string
  url: string
  originalW: number
  originalH: number
  outW: number
  outH: number
}

function getAspectRatio(s: CropSettings): number {
  if (s.shape === 'circle') return 1
  if (s.aspectPreset === 'custom') return (s.customW || 1) / (s.customH || 1)
  const p = ASPECT_PRESETS.find(p => p.label === s.aspectPreset)!
  return p.w / p.h
}

function applyCrop(img: HTMLImageElement, s: CropSettings): { url: string; outW: number; outH: number } {
  const W = img.naturalWidth, H = img.naturalHeight
  const ratio = getAspectRatio(s)

  let cropW: number, cropH: number
  if (s.shape === 'circle') {
    cropW = cropH = Math.min(W, H)
  } else if (W / H > ratio) {
    cropH = H; cropW = H * ratio
  } else {
    cropW = W; cropH = W / ratio
  }

  const sx = (W - cropW) / 2
  const sy = (H - cropH) / 2

  const outSize = s.outputSize === -1 ? (s.customOutputSize || 512) : s.outputSize
  const outW = outSize ?? Math.round(cropW)
  const outH = s.shape === 'circle' ? outW : (outSize ? Math.round(outSize / ratio) : Math.round(cropH))

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')!

  if (s.shape === 'circle') {
    ctx.beginPath()
    ctx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2)
    ctx.clip()
  }

  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outW, outH)
  return { url: canvas.toDataURL('image/png'), outW, outH }
}

async function loadImg(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); res(img) }
    img.onerror = () => { URL.revokeObjectURL(url); rej() }
    img.src = url
  })
}

function downloadItem(item: CroppedItem) {
  const a = document.createElement('a')
  a.href = item.url
  a.download = item.name.replace(/\.[^.]+$/, '') + '_cropped.png'
  a.click()
}

const CHECKER = {
  backgroundImage: `repeating-conic-gradient(#e4e4e7 0% 25%, #f9f9f9 0% 50%)`,
  backgroundSize: '14px 14px',
}

export function ImageCropPage() {
  const [settings, setSettings] = useState<CropSettings>({
    shape: 'rectangle',
    aspectPreset: '1:1',
    customW: 4,
    customH: 3,
    outputSize: null,
    customOutputSize: 512,
  })
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([])
  const [items, setItems] = useState<CroppedItem[]>([])
  const [processing, setProcessing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef(false)

  const set = <K extends keyof CropSettings>(key: K, value: CropSettings[K]) =>
    setSettings(prev => ({ ...prev, [key]: value }))

  // Re-crop whenever files or settings change
  useEffect(() => {
    if (!storedFiles.length) { setItems([]); return }
    abortRef.current = false
    setProcessing(true)
    ;(async () => {
      const results: CroppedItem[] = []
      for (const sf of storedFiles) {
        if (abortRef.current) break
        try {
          const img = await loadImg(sf.file)
          const { url, outW, outH } = applyCrop(img, settings)
          results.push({
            id: sf.id, name: sf.name, url,
            originalW: img.naturalWidth, originalH: img.naturalHeight,
            outW, outH,
          })
        } catch { /* skip corrupt files */ }
      }
      if (!abortRef.current) {
        setItems(results)
        setProcessing(false)
      }
    })()
    return () => { abortRef.current = true }
  }, [storedFiles, settings])

  const addFiles = useCallback((input: FileList | File[]) => {
    const imgs = Array.from(input).filter(f => f.type.startsWith('image/'))
    if (!imgs.length) return
    setStoredFiles(prev => [
      ...prev,
      ...imgs.map(f => ({ id: crypto.randomUUID(), name: f.name, file: f })),
    ])
  }, [])

  const removeFile = useCallback((id: string) => {
    setStoredFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setStoredFiles([])
    setItems([])
  }, [])

  const downloadAll = () => {
    items.forEach((item, i) => setTimeout(() => downloadItem(item), i * 80))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const showAspect = settings.shape !== 'circle'

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 flex items-center gap-2">
          <Crop size={22} className="text-zinc-400" />
          Image Crop
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">Recorta múltiples imágenes en bulk con forma y proporción configurable</p>
      </div>

      {/* Settings panel */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
        {/* Shape */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium text-zinc-600 w-24 shrink-0">Forma</span>
          <div className="flex gap-2">
            {(['rectangle', 'circle'] as ShapeType[]).map(s => (
              <button
                key={s}
                onClick={() => set('shape', s)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                  settings.shape === s
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                {s === 'rectangle' ? '▭  Rectángulo' : '◯  Círculo'}
              </button>
            ))}
          </div>
        </div>

        {/* Aspect ratio */}
        {showAspect && (
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-zinc-600 w-24 shrink-0">Proporción</span>
            <div className="flex gap-2 flex-wrap items-center">
              {ASPECT_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => set('aspectPreset', p.label)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    settings.aspectPreset === p.label
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => set('aspectPreset', 'custom')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                  settings.aspectPreset === 'custom'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                Personalizado
              </button>
              {settings.aspectPreset === 'custom' && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" min="1" max="99"
                    value={settings.customW}
                    onChange={e => set('customW', Number(e.target.value) || 1)}
                    className="w-14 text-center text-sm border border-zinc-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-zinc-400 font-medium">:</span>
                  <input
                    type="number" min="1" max="99"
                    value={settings.customH}
                    onChange={e => set('customH', Number(e.target.value) || 1)}
                    className="w-14 text-center text-sm border border-zinc-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Output size */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium text-zinc-600 w-24 shrink-0">Tamaño salida</span>
          <div className="flex gap-2 flex-wrap items-center">
            {OUTPUT_SIZES.map(size => (
              <button
                key={size ?? 'orig'}
                onClick={() => set('outputSize', size)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                  settings.outputSize === size
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                {size === null ? 'Original' : `${size}px`}
              </button>
            ))}
            <button
              onClick={() => set('outputSize', -1)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                settings.outputSize === -1
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              Custom
            </button>
            {settings.outputSize === -1 && (
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min="1" max="8192"
                  value={settings.customOutputSize}
                  onChange={e => set('customOutputSize', Number(e.target.value) || 1)}
                  className="w-20 text-center text-sm border border-zinc-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-zinc-500">px</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload + actions row */}
      <div className="flex gap-4 items-start">
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 flex flex-col items-center justify-center gap-2.5 py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            dragging
              ? 'border-blue-400 bg-blue-50/60'
              : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-zinc-100/60'
          }`}
        >
          <Upload size={22} className={dragging ? 'text-blue-500' : 'text-zinc-400'} />
          <p className="text-sm text-zinc-500 font-medium">
            {dragging ? 'Suelta las imágenes aquí' : 'Arrastra imágenes o haz clic para seleccionar'}
          </p>
          <p className="text-xs text-zinc-400">PNG · JPG · WEBP · GIF · múltiples archivos</p>
          <input
            ref={fileInputRef}
            type="file" accept="image/*" multiple className="hidden"
            onChange={e => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {items.length > 0 && (
          <div className="flex flex-col gap-2 shrink-0 min-w-[160px]">
            <button
              onClick={downloadAll}
              disabled={processing}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Download size={15} />
              Descargar todo ({items.length})
            </button>
            <button
              onClick={clearAll}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-600 text-sm font-medium rounded-xl hover:bg-zinc-200 transition-colors"
            >
              <X size={15} />
              Limpiar todo
            </button>
          </div>
        )}
      </div>

      {/* Processing */}
      {processing && (
        <div className="flex items-center gap-2.5 text-sm text-zinc-500">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
          Procesando {storedFiles.length} {storedFiles.length === 1 ? 'imagen' : 'imágenes'}…
        </div>
      )}

      {/* Preview grid */}
      {items.length > 0 && !processing && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map(item => (
            <div key={item.id} className="group bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {/* Image preview */}
              <div
                className="relative w-full overflow-hidden"
                style={{
                  paddingBottom: `${(item.outH / item.outW) * 100}%`,
                  ...CHECKER,
                }}
              >
                <img
                  src={item.url}
                  alt={item.name}
                  className={`absolute inset-0 w-full h-full object-contain ${
                    settings.shape === 'circle' ? 'rounded-full p-1' : ''
                  }`}
                />
              </div>

              {/* Card footer */}
              <div className="p-3">
                <p className="text-xs text-zinc-700 font-medium truncate" title={item.name}>{item.name}</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {item.originalW}×{item.originalH} → {item.outW}×{item.outH}
                </p>
                <div className="flex gap-1.5 mt-2.5">
                  <button
                    onClick={() => downloadItem(item)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[12px] font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Download size={11} />
                    PNG
                  </button>
                  <button
                    onClick={() => removeFile(item.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
