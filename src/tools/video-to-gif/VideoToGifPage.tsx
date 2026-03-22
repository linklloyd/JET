import { useState, useRef } from 'react'
import { FileDropzone } from '../../components/ui/FileDropzone'
import { Button } from '../../components/ui/Button'
import { Slider } from '../../components/ui/Slider'
import { Download, Loader2 } from 'lucide-react'
import { downloadBlob, formatFileSize } from '../../lib/utils'
import { encodeGif } from '../../lib/gif-encoder'
import { PreviewCanvas } from '../../components/ui/PreviewCanvas'

export function VideoToGifPage() {
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Video to GIF</h2>
        <p className="text-sm text-zinc-500 mt-2">Convert video clips into animated GIFs</p>
      </div>

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
