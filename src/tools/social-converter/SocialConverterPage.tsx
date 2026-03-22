import { useState, useRef, useCallback } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { Download, Loader2, Link, Upload, Settings, AlertTriangle, ExternalLink } from 'lucide-react'
import { formatFileSize, downloadBlob } from '../../lib/utils'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { getCobaltToken, clearTokenCache } from './cobaltAuth'

type OutputFormat = 'mp3' | 'mp4'
type InputMode = 'file' | 'url'

const DEFAULT_INSTANCES = [
  'https://cobalt-api.meowing.de',
  'https://cobalt-backend.canine.tools',
  'https://capi.3kh0.net',
  'https://kityune.imput.net',
  'https://blossom.imput.net',
]

const STORAGE_KEY = 'jet-cobalt-instance'

function getSavedInstance(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

async function cobaltFetch(instanceUrl: string, body: object, token?: string | null): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-target-url': instanceUrl,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const response = await fetch('/cobalt-proxy', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    // If we got HTML back, the proxy didn't intercept
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      throw new Error('Proxy not intercepting requests. Please restart the dev server.')
    }
    throw new Error('Invalid response from Cobalt API')
  }
}

async function cobaltDownload(mediaUrl: string): Promise<Blob> {
  const response = await fetch('/cobalt-download', {
    method: 'GET',
    headers: { 'x-target-url': mediaUrl },
  })
  if (!response.ok) throw new Error('Failed to download media file')
  return response.blob()
}

export function SocialConverterPage() {
  const [inputMode, setInputMode] = useState<InputMode>('url')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState<OutputFormat>('mp3')
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'idle' | 'loading' | 'fetching' | 'converting' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [statusDetail, setStatusDetail] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [customInstance, setCustomInstance] = useState(getSavedInstance)
  const ffmpegRef = useRef<FFmpeg | null>(null)
  const resultRef = useRef<Blob | null>(null)
  const [resultFileName, setResultFileName] = useState('')

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current
    const ffmpeg = new FFmpeg()
    ffmpeg.on('progress', ({ progress: p }) => {
      setProgress(Math.round(p * 100))
    })
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    ffmpegRef.current = ffmpeg
    return ffmpeg
  }, [])

  const handleFiles = (files: File[]) => {
    setFile(files[0])
    setStatus('idle')
    setProgress(0)
    resultRef.current = null
  }

  const tryInstance = async (
    instanceUrl: string,
    mediaUrl: string,
    outputFormat: OutputFormat
  ): Promise<{ url: string } | null> => {
    try {
      // First try without auth
      let data = await cobaltFetch(instanceUrl, {
        url: mediaUrl,
        downloadMode: outputFormat === 'mp3' ? 'audio' : 'auto',
        audioFormat: 'mp3',
      })

      // If auth is required, get a token and retry
      if (data.status === 'error' && (data.error?.code?.includes('jwt') || data.error?.code?.includes('auth'))) {
        setStatusDetail(`Authenticating with ${new URL(instanceUrl).hostname}...`)
        const token = await getCobaltToken(instanceUrl)
        if (!token) return null

        data = await cobaltFetch(
          instanceUrl,
          {
            url: mediaUrl,
            downloadMode: outputFormat === 'mp3' ? 'audio' : 'auto',
            audioFormat: 'mp3',
          },
          token
        )
      }

      if (data.status === 'tunnel' || data.status === 'redirect') {
        return { url: data.url }
      }

      if (data.status === 'picker' && data.picker?.[0]?.url) {
        return { url: data.picker[0].url }
      }

      if (data.status === 'error') {
        const code = data.error?.code || ''
        // Auth/turnstile errors — skip to next instance
        if (code.includes('jwt') || code.includes('auth') || code.includes('token') || code.includes('turnstile')) {
          return null
        }
        // Content error — stop trying
        throw new Error(code || 'This URL is not supported or the content is unavailable.')
      }

      return null
    } catch (err) {
      if (err instanceof Error) {
        // Re-throw content/known errors and Turnstile errors
        if (err.message.includes('Turnstile') || err.message.includes('domain-locked') || err.message.includes('Self-host')) {
          throw err
        }
        if (
          !err.message.includes('fetch') &&
          !err.message.includes('network') &&
          !err.message.includes('Failed') &&
          !err.message.includes('proxy') &&
          !err.message.includes('Proxy')
        ) {
          throw err
        }
      }
      return null
    }
  }

  const handleUrlDownload = async () => {
    if (!url.trim()) return
    try {
      setStatus('fetching')
      setErrorMsg('')
      setStatusDetail('')
      clearTokenCache()

      const instances = customInstance.trim()
        ? [customInstance.trim(), ...DEFAULT_INSTANCES.filter((i) => i !== customInstance.trim())]
        : DEFAULT_INSTANCES

      let downloadUrl: string | null = null
      let lastError = ''

      for (let i = 0; i < instances.length; i++) {
        const instance = instances[i]
        setStatusDetail(`Trying ${new URL(instance).hostname}... (${i + 1}/${instances.length})`)
        try {
          const result = await tryInstance(instance, url.trim(), format)
          if (result) {
            downloadUrl = result.url
            break
          }
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Download failed'
          // If it's a Turnstile/domain error, it'll be the same for all instances
          if (lastError.includes('Turnstile') || lastError.includes('domain-locked')) {
            break
          }
          // Content errors should also stop
          if (!lastError.includes('auth') && !lastError.includes('jwt')) {
            break
          }
        }
      }

      if (!downloadUrl) {
        throw new Error(
          lastError ||
            'All download instances failed.\n\n' +
            'Public Cobalt instances require Turnstile verification that is domain-locked and cannot work from third-party sites.\n\n' +
            'Options:\n' +
            '• Download the video manually and use the "Upload File" option to convert it\n' +
            '• Self-host a Cobalt instance without Turnstile and set its URL in settings\n' +
            '• Use cobalt.tools directly to download, then upload the file here for conversion'
        )
      }

      setStatusDetail('Downloading media...')
      setStatus('loading')
      const blob = await cobaltDownload(downloadUrl)
      resultRef.current = blob
      setResultFileName(`download.${format === 'mp3' ? 'mp3' : 'mp4'}`)
      setStatus('done')
      setProgress(100)
      setStatusDetail('')
    } catch (err) {
      setStatus('error')
      setStatusDetail('')
      const msg = err instanceof Error ? err.message : 'Download failed'
      setErrorMsg(msg)
    }
  }

  const handleConvert = async () => {
    if (!file) return
    try {
      setStatus('loading')
      setErrorMsg('')
      setStatusDetail('Loading FFmpeg...')
      const ffmpeg = await loadFFmpeg()

      setStatus('converting')
      setStatusDetail('')
      setProgress(0)

      const inputName = 'input' + getExtension(file.name)
      const outputName = `output.${format}`

      await ffmpeg.writeFile(inputName, await fetchFile(file))

      const args =
        format === 'mp3'
          ? ['-i', inputName, '-vn', '-ab', '192k', '-ar', '44100', outputName]
          : ['-i', inputName, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', outputName]

      await ffmpeg.exec(args)

      const data = await ffmpeg.readFile(outputName)
      const mimeType = format === 'mp3' ? 'audio/mpeg' : 'video/mp4'
      const buffer =
        data instanceof Uint8Array
          ? (data.buffer as ArrayBuffer)
          : (new TextEncoder().encode(data as string).buffer as ArrayBuffer)
      resultRef.current = new Blob([buffer], { type: mimeType })
      const baseName = file.name.replace(/\.[^.]+$/, '')
      setResultFileName(`${baseName}.${format}`)
      setStatus('done')
      setProgress(100)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Conversion failed')
    }
  }

  const handleDownload = () => {
    if (!resultRef.current) return
    downloadBlob(resultRef.current, resultFileName || `download.${format}`)
  }

  const saveInstance = (value: string) => {
    setCustomInstance(value)
    try {
      if (value.trim()) {
        localStorage.setItem(STORAGE_KEY, value.trim())
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      /* ignore */
    }
  }

  const isProcessing = status === 'loading' || status === 'converting' || status === 'fetching'

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Social Converter</h2>
          <p className="text-sm text-zinc-500 mt-2">Download and convert media from URLs or files to MP3/MP4</p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Turnstile notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3 items-start">
        <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-800 space-y-1">
          <p className="font-medium">URL downloads require a Cobalt instance</p>
          <p>
            Public Cobalt instances use Turnstile verification that is domain-locked. For URL downloads to work, you need to either{' '}
            <a href="https://github.com/imputnet/cobalt" target="_blank" rel="noopener" className="underline font-medium">
              self-host Cobalt
            </a>{' '}
            (without Turnstile) and set the URL in settings, or download the video manually from{' '}
            <a href="https://cobalt.tools" target="_blank" rel="noopener" className="underline font-medium">
              cobalt.tools
            </a>{' '}
            and use the file upload option.
          </p>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 space-y-3">
          <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Cobalt Instance</p>
          <p className="text-xs text-zinc-500">
            Set a self-hosted Cobalt instance URL (without Turnstile enabled) for direct URL downloads.
          </p>
          <input
            type="url"
            value={customInstance}
            onChange={(e) => saveInstance(e.target.value)}
            placeholder="https://your-cobalt-instance.com"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
          <div className="flex items-center gap-3 text-[11px] text-zinc-400">
            <a
              href="https://github.com/imputnet/cobalt"
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1 hover:text-zinc-600"
            >
              <ExternalLink size={10} /> Deploy your own Cobalt
            </a>
            <span>•</span>
            <a
              href="https://instances.cobalt.best"
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1 hover:text-zinc-600"
            >
              <ExternalLink size={10} /> Community instances
            </a>
          </div>
        </div>
      )}

      {/* Input Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setInputMode('url')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            inputMode === 'url' ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          <Link size={14} /> From URL
        </button>
        <button
          onClick={() => setInputMode('file')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            inputMode === 'file' ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          <Upload size={14} /> Upload File
        </button>
      </div>

      {/* URL Input */}
      {inputMode === 'url' && (
        <div className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-zinc-600 block mb-1">Paste video/audio URL</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or Instagram/TikTok URL"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && url.trim() && !isProcessing) handleUrlDownload()
                }}
              />
            </label>
            <p className="text-[11px] text-zinc-400">
              Supports: YouTube, Instagram, TikTok, Twitter/X, Reddit, SoundCloud, and more
            </p>
          </div>

          <div className="flex items-end gap-4">
            <div className="w-40">
              <Select
                label="Output Format"
                options={[
                  { value: 'mp3', label: 'MP3 (Audio)' },
                  { value: 'mp4', label: 'MP4 (Video)' },
                ]}
                value={format}
                onChange={(e) => setFormat(e.target.value as OutputFormat)}
              />
            </div>
            <Button onClick={handleUrlDownload} disabled={!url.trim() || isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Processing...
                </>
              ) : (
                <>
                  <Download size={16} /> Download & Convert
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* File Upload */}
      {inputMode === 'file' && (
        <div className="space-y-4">
          <FileDropzone
            onFiles={handleFiles}
            accept="video/*,audio/*"
            label="Drop your media file here"
            description="Supports video and audio formats"
          />

          {file && (
            <>
              <div className="bg-white border border-zinc-200 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-700">{file.name}</p>
                  <p className="text-xs text-zinc-500">{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={() => {
                    setFile(null)
                    setStatus('idle')
                    resultRef.current = null
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-700"
                >
                  Remove
                </button>
              </div>

              <div className="flex items-end gap-4">
                <div className="w-40">
                  <Select
                    label="Output Format"
                    options={[
                      { value: 'mp3', label: 'MP3 (Audio)' },
                      { value: 'mp4', label: 'MP4 (Video)' },
                    ]}
                    value={format}
                    onChange={(e) => setFormat(e.target.value as OutputFormat)}
                  />
                </div>
                <Button onClick={handleConvert} disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Converting...
                    </>
                  ) : (
                    'Convert'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Progress */}
      {(status === 'loading' || status === 'converting') && (
        <div className="space-y-2">
          <ProgressBar value={status === 'loading' ? 0 : progress} />
          <p className="text-xs text-zinc-500">
            {status === 'loading'
              ? statusDetail || 'Downloading media...'
              : `Converting... ${progress}%`}
          </p>
        </div>
      )}

      {status === 'fetching' && (
        <div className="space-y-2">
          <ProgressBar value={30} />
          <p className="text-xs text-zinc-500">{statusDetail || 'Fetching media from URL...'}</p>
        </div>
      )}

      {/* Result */}
      {status === 'done' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-green-700">
            {inputMode === 'url' ? 'Download complete!' : 'Conversion complete!'}
          </p>
          <Button onClick={handleDownload} size="sm">
            <Download size={14} /> Download
          </Button>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
          <p className="text-sm text-red-700 whitespace-pre-line">{errorMsg}</p>
          {inputMode === 'url' && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setInputMode('file')}>
                <Upload size={14} /> Switch to File Upload
              </Button>
              <a
                href="https://cobalt.tools"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                <ExternalLink size={12} /> Open cobalt.tools
              </a>
            </div>
          )}
        </div>
      )}

      {/* Hidden turnstile container */}
      <div id="turnstile-container" />
    </div>
  )
}

function getExtension(filename: string): string {
  const match = filename.match(/\.[^.]+$/)
  return match ? match[0] : ''
}
