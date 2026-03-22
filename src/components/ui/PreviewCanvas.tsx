import { useState, useRef, type ReactNode } from 'react'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

interface PreviewCanvasProps {
  children: ReactNode
  label?: string
  maxHeight?: number
  minHeight?: number
  actions?: ReactNode
  /** When true, left-click drag pans the canvas. Disable for tools that need click events (e.g. hitbox editor). */
  draggable?: boolean
}

export function PreviewCanvas({
  children,
  label,
  maxHeight = 400,
  minHeight = 120,
  actions,
  draggable = true,
}: PreviewCanvasProps) {
  const [zoom, setZoom] = useState(1)
  const [panning, setPanning] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const zoomIn = () => setZoom((z) => Math.min(z + 0.5, 8))
  const zoomOut = () => setZoom((z) => Math.max(z - 0.5, 0.25))
  const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.25 : 0.25
      setZoom((z) => Math.min(Math.max(z + delta, 0.25), 8))
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Allow panning via: middle-click, alt+click, or left-click when draggable
    if (e.button === 1 || (e.button === 0 && e.altKey) || (e.button === 0 && draggable)) {
      e.preventDefault()
      setPanning(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!panning) return
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }

  const handleMouseUp = () => setPanning(false)

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      {/* Header */}
      {(label || actions) && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100">
          {label && (
            <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">{label}</p>
          )}
          <div className="flex items-center gap-1">
            {actions}
          </div>
        </div>
      )}

      {/* Preview area */}
      <div
        ref={containerRef}
        className="overflow-hidden relative"
        style={{
          maxHeight,
          minHeight,
          backgroundImage: 'repeating-conic-gradient(#e4e4e7 0% 25%, #f4f4f5 0% 50%)',
          backgroundSize: '12px 12px',
          cursor: panning ? 'grabbing' : (draggable || zoom > 1) ? 'grab' : 'default',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="flex items-center justify-center p-2 transition-transform origin-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            minHeight,
          }}
        >
          {children}
        </div>
      </div>

      {/* Zoom toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-t border-zinc-100 bg-zinc-50/50">
        <button onClick={zoomOut} className="p-1 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 transition-colors"
          title="Zoom out"><ZoomOut size={13} /></button>
        <button onClick={resetZoom} className="px-1.5 py-0.5 rounded hover:bg-zinc-200 text-[10px] font-mono text-zinc-500 hover:text-zinc-700 transition-colors min-w-[40px] text-center"
          title="Reset zoom">{Math.round(zoom * 100)}%</button>
        <button onClick={zoomIn} className="p-1 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 transition-colors"
          title="Zoom in"><ZoomIn size={13} /></button>
        <button onClick={resetZoom} className="p-1 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 transition-colors ml-0.5"
          title="Fit to view"><Maximize2 size={13} /></button>
      </div>
    </div>
  )
}
