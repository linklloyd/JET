export interface HistoryEntry {
  id: string
  fileName: string
  toolName: string
  toolPath: string
  timestamp: number
  thumbnail: string // small data URL (64x64 JPEG)
}

const STORAGE_KEY = 'jet-history'
const MAX_ENTRIES = 20

// Session-scoped blob store for re-download
const blobStore = new Map<string, Blob>()

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  window.dispatchEvent(new Event('jet-history-update'))
}

export function addHistory(
  entry: Omit<HistoryEntry, 'id' | 'timestamp'>,
  resultBlob?: Blob
): string {
  const id = crypto.randomUUID()
  const newEntry: HistoryEntry = { ...entry, id, timestamp: Date.now() }
  const entries = getHistory()
  entries.unshift(newEntry)
  if (entries.length > MAX_ENTRIES) {
    const removed = entries.splice(MAX_ENTRIES)
    removed.forEach((e) => blobStore.delete(e.id))
  }
  saveHistory(entries)
  if (resultBlob) blobStore.set(id, resultBlob)
  return id
}

export function getResultBlob(id: string): Blob | undefined {
  return blobStore.get(id)
}

export function clearHistory() {
  blobStore.clear()
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event('jet-history-update'))
}

export function removeEntry(id: string) {
  const entries = getHistory().filter((e) => e.id !== id)
  blobStore.delete(id)
  saveHistory(entries)
}

/** Generate a tiny thumbnail data URL from a canvas or blob */
export async function makeThumbnail(source: HTMLCanvasElement | Blob): Promise<string> {
  const img = new Image()
  const url = source instanceof Blob ? URL.createObjectURL(source) : source.toDataURL()

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = url
  })

  if (source instanceof Blob) URL.revokeObjectURL(url)

  const maxDim = 64
  const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.5)
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
