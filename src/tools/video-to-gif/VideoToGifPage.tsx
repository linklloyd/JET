import { useState, useRef } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Slider } from '../../components/ui/Slider'
import { Download, Loader2 } from 'lucide-react'
import { downloadBlob, formatFileSize } from '../../lib/utils'
import { encodeGif } from '../../lib/gif-encoder'
import { decodeGifFrames } from '../../lib/gif-decoder'
import { PreviewCanvas } from '../../components/ui/PreviewCanvas'

export function VideoToGifPage() {
  const [tab, setTab] = useState<'video-to-gif' | 'gif-to-video'>('video-to-gif')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Video ↔ GIF</h2>
        <p className="text-sm text-zinc-500 mt-2">Convert between video and animated GIF formats</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('video-to-gif')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'video-to-gif' ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Video → GIF
        </button>
        <button
          onClick={() => setTab('gif-to-video')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'gif-to-video' ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          GIF → Video
        </button>
      </div>

      {tab === 'video-to-gif' && <VideoToGifView />}
      {tab === 'gif-to-video' && <GifToVideoView />}
    </div>
  )
}

// =============================================================================
// GIF → Video
// =============================================================================

function GifToVideoView() {
  const [gifFile, setGifFile] = useState<File | null>(null)
  const [gifPreviewUrl, setGifPreviewUrl] = useState<string | null>(null)
  const [fps, setFps] = useState(15)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  const handleFiles = (files: File[]) => {
    const file = files[0]
    setGifFile(file)
    if (gifPreviewUrl) URL.revokeObjectURL(gifPreviewUrl)
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setGifPreviewUrl(URL.createObjectURL(file))
    setVideoBlob(null)
    setVideoUrl(null)
  }

  const handleGenerate = async () => {
    if (!gifFile) return
    setGenerating(true)
    setProgress('Loading GIF...')

    try {
      // Load GIF as image to get dimensions
      const img = new Image()
      const imgUrl = URL.createObjectURL(gifFile)
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load GIF'))
        img.src = imgUrl
      })
      URL.revokeObjectURL(imgUrl)

      const w = img.width
      const h = img.height

      // Decode the GIF into frames
      const buf = await gifFile.arrayBuffer()
      const { frames: decodedFrames } = decodeGifFrames(new Uint8Array(buf))
      const gifFrames = decodedFrames.map((f) => f.imageData)

      if (gifFrames.length === 0) {
        setProgress('No frames found in GIF')
        setGenerating(false)
        return
      }

      setProgress(`Encoding ${gifFrames.length} frames to video...`)

      // Use canvas + MediaRecorder to create WebM video
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!

      const stream = canvas.captureStream(0) // 0 = manual frame capture
      const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void }

      // Try VP9 first, then VP8, then default
      const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      let selectedMime = 'video/webm'
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime
          break
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType: selectedMime, videoBitsPerSecond: 5_000_000 })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

      const recordingDone = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
      })

      recorder.start()

      const frameDuration = 1000 / fps
      for (let i = 0; i < gifFrames.length; i++) {
        ctx.putImageData(gifFrames[i], 0, 0)
        if (track.requestFrame) track.requestFrame()
        setProgress(`Encoding frame ${i + 1}/${gifFrames.length}`)
        await new Promise((r) => setTimeout(r, frameDuration))
      }

      recorder.stop()
      const blob = await recordingDone

      if (videoUrl) URL.revokeObjectURL(videoUrl)
      setVideoBlob(blob)
      setVideoUrl(URL.createObjectURL(blob))
    } catch (err) {
      setProgress(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }

    setGenerating(false)
    setProgress('')
  }

  const handleDownload = () => {
    if (!videoBlob) return
    const name = gifFile ? gifFile.name.replace(/\.gif$/i, '.webm') : 'animation.webm'
    downloadBlob(videoBlob, name)
  }

  return (
    <div className="space-y-4">
      <FileDropzone
        onFiles={handleFiles}
        accept="image/gif,.gif"
        label="Drop a GIF file here"
        description="Animated GIF"
      />

      {gifFile && (
        <div className="grid grid-cols-[1fr_260px] gap-6">
          <div className="space-y-4">
            {/* GIF Preview */}
            {gifPreviewUrl && (
              <PreviewCanvas label="GIF Preview" maxHeight={300} minHeight={100}>
                <img src={gifPreviewUrl} alt="GIF preview" className="max-w-full" />
              </PreviewCanvas>
            )}

            {videoUrl && (
              <div className="bg-white border border-zinc-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Generated Video</p>
                  <div className="flex items-center gap-2">
                    {videoBlob && <span className="text-xs text-zinc-500">{formatFileSize(videoBlob.size)}</span>}
                    <Button onClick={handleDownload} size="sm">
                      <Download size={12} /> Download WebM
                    </Button>
                  </div>
                </div>
                <video src={videoUrl} controls loop className="w-full rounded" />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Settings</p>
              <Slider label="FPS" displayValue={String(fps)}
                min={1} max={60} value={fps}
                onChange={(e) => setFps(+(e.target as HTMLInputElement).value)} />
              <p className="text-xs text-zinc-500">
                {gifFile && `Source: ${formatFileSize(gifFile.size)}`}
              </p>
            </div>

            <Button onClick={handleGenerate} disabled={generating} className="w-full">
              {generating ? (
                <><Loader2 size={16} className="animate-spin" /> {progress || 'Converting...'}</>
              ) : (
                'Convert to Video'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Video → GIF (original component, now a sub-view)
// =============================================================================

function VideoToGifView() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [fps, setFps] = useState(10)
  const [outputWidth, setOutputWidth] = useState(320)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(5)
  const [duration, setDuration] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [gifBlob, setGifBlob] = useState<Blob | null>(null)
  const [gifUrl, setGifUrl] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleFiles = async (files: File[]) => {
    const file = files[0]
    setVideoFile(file)
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    if (gifUrl) URL.revokeObjectURL(gifUrl)
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    setGifBlob(null)
    setGifUrl(null)
  }

  const handleVideoLoaded = () => {
    if (!videoRef.current) return
    const dur = videoRef.current.duration
    setDuration(dur)
    setEndTime(Math.min(5, dur))
    setStartTime(0)
  }

  const handleGenerate = async () => {
    if (!videoRef.current || !videoUrl) return
    setGenerating(true)
    setProgress('Extracting frames...')

    const video = videoRef.current
    const aspectRatio = video.videoHeight / video.videoWidth
    const w = outputWidth
    const h = Math.round(w * aspectRatio)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!

    const frameDuration = 1 / fps
    const clipStart = startTime
    const clipEnd = Math.min(endTime, duration)
    const totalTime = clipEnd - clipStart
    const totalFrames = Math.ceil(totalTime * fps)
    const frames: ImageData[] = []

    // Extract frames by seeking the video
    for (let i = 0; i < totalFrames; i++) {
      const time = clipStart + i * frameDuration
      video.currentTime = time

      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          resolve()
        }
        video.addEventListener('seeked', onSeeked)
      })

      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(video, 0, 0, w, h)
      frames.push(ctx.getImageData(0, 0, w, h))
      setProgress(`Extracting frames... ${i + 1}/${totalFrames}`)
    }

    setProgress('Encoding GIF...')
    const delay = Math.round(100 / fps)

    // Use setTimeout to avoid blocking UI
    await new Promise((resolve) => setTimeout(resolve, 0))

    const gifData = encodeGif(w, h, frames, delay)
    const blob = new Blob([gifData.buffer as ArrayBuffer], { type: 'image/gif' })

    if (gifUrl) URL.revokeObjectURL(gifUrl)
    const url = URL.createObjectURL(blob)
    setGifBlob(blob)
    setGifUrl(url)
    setGenerating(false)
    setProgress('')
  }

  const handleDownload = () => {
    if (!gifBlob) return
    const name = videoFile ? videoFile.name.replace(/\.[^.]+$/, '.gif') : 'video.gif'
    downloadBlob(gifBlob, name)
  }

  return (
    <div className="space-y-4">
      <FileDropzone
        onFiles={handleFiles}
        accept="video/mp4,video/webm,video/quicktime,video/*"
        label="Drop a video file here"
        description="MP4, WebM, MOV"
      />

      {videoUrl && (
        <div className="grid grid-cols-[1fr_260px] gap-6">
          <div className="space-y-4">
            {/* Video Preview */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide mb-2">Video Preview</p>
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                onLoadedMetadata={handleVideoLoaded}
                className="w-full rounded"
              />
              {duration > 0 && (
                <p className="text-xs text-zinc-500 mt-2">
                  Duration: {duration.toFixed(1)}s
                  {videoFile && ` | Size: ${formatFileSize(videoFile.size)}`}
                </p>
              )}
            </div>

            {gifUrl && (
              <PreviewCanvas
                label="Generated GIF"
                maxHeight={300}
                minHeight={100}
                actions={
                  <div className="flex items-center gap-2">
                    {gifBlob && <span className="text-xs text-zinc-500">{formatFileSize(gifBlob.size)}</span>}
                    <Button onClick={handleDownload} size="sm">
                      <Download size={12} /> Download
                    </Button>
                  </div>
                }
              >
                <img src={gifUrl} alt="Generated GIF" className="max-w-full" />
              </PreviewCanvas>
            )}
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Settings</p>
              <Slider label="FPS" displayValue={String(fps)}
                min={1} max={30} value={fps}
                onChange={(e) => setFps(+(e.target as HTMLInputElement).value)} />
              <Slider label="Width" displayValue={`${outputWidth}px`}
                min={80} max={800} value={outputWidth}
                onChange={(e) => setOutputWidth(+(e.target as HTMLInputElement).value)} />
            </div>

            {duration > 0 && (
              <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
                <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Trim</p>
                <Slider label="Start" displayValue={`${startTime.toFixed(1)}s`}
                  min={0} max={duration} value={startTime}
                  onChange={(e) => setStartTime(+(e.target as HTMLInputElement).value)} />
                <Slider label="End" displayValue={`${endTime.toFixed(1)}s`}
                  min={0} max={duration} value={endTime}
                  onChange={(e) => setEndTime(+(e.target as HTMLInputElement).value)} />
                <p className="text-xs text-zinc-500">
                  {Math.max(0, endTime - startTime).toFixed(1)}s clip = ~{Math.ceil(Math.max(0, endTime - startTime) * fps)} frames
                </p>
              </div>
            )}

            <Button onClick={handleGenerate} disabled={generating} className="w-full">
              {generating ? (
                <><Loader2 size={16} className="animate-spin" /> {progress || 'Generating...'}</>
              ) : (
                'Generate GIF'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
