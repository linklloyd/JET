import { useState, useRef, useEffect, useCallback } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Slider } from '../../components/ui/Slider'
import { Download, Play, Pause, Loader2, Scissors } from 'lucide-react'
import { downloadBlob, formatFileSize, canvasToBlob } from '../../lib/utils'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

type ViewMode = 'waveform' | 'frequency'

export function AudioWaveformPage() {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('waveform')
  const [waveColor, setWaveColor] = useState('#3b82f6')
  const [bgColor, setBgColor] = useState('#18181b')
  const [trimming, setTrimming] = useState(false)
  const [trimProgress, setTrimProgress] = useState('')
  const [zoom, setZoom] = useState(1)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animRef = useRef<number>(0)
  const ffmpegRef = useRef<FFmpeg | null>(null)

  const handleFiles = async (files: File[]) => {
    const file = files[0]
    setAudioFile(file)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    const url = URL.createObjectURL(file)
    setAudioUrl(url)
    setPlaying(false)
    setCurrentTime(0)

    // Decode audio for waveform
    const arrayBuf = await file.arrayBuffer()
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    try {
      const buffer = await ctx.decodeAudioData(arrayBuf)
      setAudioBuffer(buffer)
      setDuration(buffer.duration)
      setTrimStart(0)
      setTrimEnd(buffer.duration)
    } catch {
      // fallback for formats AudioContext can't decode
    }
  }

  const handleAudioLoaded = () => {
    if (!audioRef.current) return
    const dur = audioRef.current.duration
    if (isFinite(dur)) {
      setDuration(dur)
      if (trimEnd === 0) setTrimEnd(dur)
    }
  }

  // Draw static waveform
  const drawWaveform = useCallback(() => {
    if (!audioBuffer || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const dpr = 1
    const displayWidth = Math.max(800, Math.round(800 * zoom))
    const displayHeight = 200
    canvas.width = displayWidth * dpr
    canvas.height = displayHeight * dpr
    canvas.style.width = `${displayWidth}px`
    canvas.style.height = `${displayHeight}px`

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const data = audioBuffer.getChannelData(0)
    const step = Math.ceil(data.length / displayWidth)
    const amp = displayHeight / 2

    ctx.strokeStyle = waveColor
    ctx.lineWidth = 1

    // Draw waveform
    for (let i = 0; i < displayWidth; i++) {
      let min = 1.0
      let max = -1.0
      const start = Math.floor(i * step)
      for (let j = 0; j < step; j++) {
        const val = data[start + j] || 0
        if (val < min) min = val
        if (val > max) max = val
      }
      ctx.beginPath()
      ctx.moveTo(i, (1 + min) * amp)
      ctx.lineTo(i, (1 + max) * amp)
      ctx.stroke()
    }

    // Draw trim region
    const trimStartX = (trimStart / duration) * displayWidth
    const trimEndX = (trimEnd / duration) * displayWidth

    // Dim outside trim
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, trimStartX, displayHeight)
    ctx.fillRect(trimEndX, 0, displayWidth - trimEndX, displayHeight)

    // Trim handles
    ctx.fillStyle = '#f59e0b'
    ctx.fillRect(trimStartX - 1, 0, 2, displayHeight)
    ctx.fillRect(trimEndX - 1, 0, 2, displayHeight)

    // Playhead
    if (duration > 0) {
      const playX = (currentTime / duration) * displayWidth
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playX, 0)
      ctx.lineTo(playX, displayHeight)
      ctx.stroke()
    }

    // Time labels
    ctx.fillStyle = '#a1a1aa'
    ctx.font = '10px monospace'
    ctx.fillText(formatTime(trimStart), trimStartX + 4, 12)
    ctx.fillText(formatTime(trimEnd), trimEndX + 4, 12)
  }, [audioBuffer, currentTime, duration, trimStart, trimEnd, waveColor, bgColor, zoom])

  // Draw frequency bars (when playing)
  const drawFrequency = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const displayWidth = Math.max(800, Math.round(800 * zoom))
    const displayHeight = 200
    canvas.width = displayWidth
    canvas.height = displayHeight

    const analyser = analyserRef.current
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteFrequencyData(dataArray)

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, displayWidth, displayHeight)

    const barWidth = (displayWidth / bufferLength) * 2.5
    let x = 0
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * displayHeight
      ctx.fillStyle = waveColor
      ctx.fillRect(x, displayHeight - barHeight, barWidth, barHeight)
      x += barWidth + 1
    }
  }, [waveColor, bgColor, zoom])

  // Animation loop for playback tracking
  useEffect(() => {
    const tick = () => {
      if (audioRef.current && playing) {
        setCurrentTime(audioRef.current.currentTime)
      }
      if (viewMode === 'frequency' && playing) {
        drawFrequency()
      } else if (viewMode === 'waveform') {
        drawWaveform()
      }
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [playing, viewMode, drawWaveform, drawFrequency])

  // Connect analyser when playing
  useEffect(() => {
    if (!audioRef.current || !audioCtxRef.current) return
    if (!sourceRef.current) {
      const ctx = audioCtxRef.current
      const source = ctx.createMediaElementSource(audioRef.current)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyser.connect(ctx.destination)
      sourceRef.current = source
      analyserRef.current = analyser
    }
  }, [audioUrl])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume()
    }
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.currentTime = trimStart
      audioRef.current.play()
    }
    setPlaying(!playing)
  }

  // Stop at trim end
  useEffect(() => {
    if (playing && currentTime >= trimEnd && audioRef.current) {
      audioRef.current.pause()
      setPlaying(false)
    }
  }, [currentTime, trimEnd, playing])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !audioRef.current || duration === 0) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = x / rect.width
    const time = ratio * duration
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }

  // Load FFmpeg
  const loadFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current
    const ffmpeg = new FFmpeg()
    ffmpeg.on('progress', ({ progress: p }) => {
      setTrimProgress(`Trimming... ${Math.round(p * 100)}%`)
    })
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm'
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
    })
    ffmpegRef.current = ffmpeg
    return ffmpeg
  }

  const handleTrim = async () => {
    if (!audioFile) return
    setTrimming(true)
    setTrimProgress('Loading FFmpeg...')

    try {
      const ffmpeg = await loadFFmpeg()
      const ext = audioFile.name.split('.').pop() || 'mp3'
      const inputName = `input.${ext}`
      const outputName = `trimmed.${ext}`

      await ffmpeg.writeFile(inputName, await fetchFile(audioFile))

      const startSec = trimStart.toFixed(3)
      const durationSec = (trimEnd - trimStart).toFixed(3)

      await ffmpeg.exec([
        '-i', inputName,
        '-ss', startSec,
        '-t', durationSec,
        '-c', 'copy',
        outputName,
      ])

      const data = await ffmpeg.readFile(outputName)
      const blob = new Blob([data as BlobPart], { type: audioFile.type || 'audio/mpeg' })
      const name = audioFile.name.replace(/(\.[^.]+)$/, `_trimmed$1`)
      downloadBlob(blob, name)

      // Cleanup
      await ffmpeg.deleteFile(inputName)
      await ffmpeg.deleteFile(outputName)
    } catch (err) {
      console.error('Trim failed:', err)
    } finally {
      setTrimming(false)
      setTrimProgress('')
    }
  }

  const handleExportWaveform = async () => {
    if (!canvasRef.current) return
    const blob = await canvasToBlob(canvasRef.current)
    downloadBlob(blob, 'waveform.png')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Audio Waveform</h2>
        <p className="text-sm text-zinc-500 mt-2">Visualize audio files and trim clips</p>
      </div>

      <FileDropzone
        onFiles={handleFiles}
        accept="audio/*"
        label="Drop an audio file here"
        description="MP3, WAV, OGG, FLAC, AAC"
      />

      {audioUrl && (
        <div className="grid grid-cols-[1fr_260px] gap-6">
          <div className="space-y-4">
            {/* Hidden audio element */}
            <audio
              ref={audioRef}
              src={audioUrl}
              onLoadedMetadata={handleAudioLoaded}
              onEnded={() => setPlaying(false)}
              preload="auto"
            />

            {/* View mode tabs */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1 bg-zinc-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('waveform')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'waveform' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                  Waveform
                </button>
                <button
                  onClick={() => setViewMode('frequency')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'frequency' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                  Frequency
                </button>
              </div>
              <div className="flex-1" />
              <span className="text-xs text-zinc-500 font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Waveform canvas */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="overflow-x-auto rounded bg-zinc-900">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className="cursor-crosshair block"
                />
              </div>
            </div>

            {/* Playback controls */}
            <div className="flex items-center gap-3">
              <Button onClick={togglePlay} size="sm">
                {playing ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}
              </Button>
              {audioFile && (
                <span className="text-xs text-zinc-500">
                  {audioFile.name} ({formatFileSize(audioFile.size)})
                </span>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Trim</p>
              <Slider
                label="Start"
                displayValue={formatTime(trimStart)}
                min={0}
                max={duration || 1}
                value={trimStart}
                onChange={(e) => setTrimStart(Math.min(+(e.target as HTMLInputElement).value, trimEnd - 0.1))}
              />
              <Slider
                label="End"
                displayValue={formatTime(trimEnd)}
                min={0}
                max={duration || 1}
                value={trimEnd}
                onChange={(e) => setTrimEnd(Math.max(+(e.target as HTMLInputElement).value, trimStart + 0.1))}
              />
              <p className="text-xs text-zinc-500">
                Selection: {formatTime(trimEnd - trimStart)}
              </p>
              <Button onClick={handleTrim} disabled={trimming} size="sm" className="w-full">
                {trimming ? (
                  <><Loader2 size={14} className="animate-spin" /> {trimProgress}</>
                ) : (
                  <><Scissors size={14} /> Trim & Download</>
                )}
              </Button>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Display</p>
              <Slider
                label="Zoom"
                displayValue={`${zoom}x`}
                min={1}
                max={4}
                value={zoom}
                onChange={(e) => setZoom(+(e.target as HTMLInputElement).value)}
              />
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-600">Wave Color</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={waveColor}
                    onChange={(e) => setWaveColor(e.target.value)}
                    className="w-8 h-8 rounded border border-zinc-300 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-zinc-500">{waveColor}</span>
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-600">Background</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-8 h-8 rounded border border-zinc-300 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-zinc-500">{bgColor}</span>
                </div>
              </label>
            </div>

            <Button onClick={handleExportWaveform} variant="secondary" className="w-full">
              <Download size={14} /> Export Waveform PNG
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`
}
