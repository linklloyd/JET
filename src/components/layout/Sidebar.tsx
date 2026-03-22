import { useState, useEffect, useCallback, useRef } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import {
  Music,
  Maximize2,
  ZoomIn,
  Grid3X3,
  LayoutGrid,
  Box,
  FileType,
  Map,
  Palette,
  Grid2X2,
  Film,
  Package,
  Type,
  Layers,
  PaintBucket,
  Info,
  Dice5,
  Table2,
  BarChart3,
  Sigma,
  Shuffle,
  SlidersHorizontal,
  X,
  ArrowDownNarrowWide,
  FlipHorizontal,
  Hash,
  Grid3x3 as GridIcon,
  Variable,
  Workflow,
  Tv,
  Play,
  Video,
  MapPinned,
  Zap,
  AudioWaveform,
  ChevronRight,
  GripVertical,
  Eye,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { HistoryPanel } from '../ui/HistoryPanel'

interface SubEntry {
  path: string
  label: string
  icon: React.ComponentType<{ size?: number }>
}

interface ToolEntry {
  path: string
  label: string
  icon: React.ComponentType<{ size?: number }>
  disabled?: boolean
  subtabs?: SubEntry[]
}

interface Section {
  title: string
  tools: ToolEntry[]
}

const defaultSections: Section[] = [
  {
    title: 'Media',
    tools: [
      { path: '/social-converter', label: 'Social Converter', icon: Music, disabled: true },
      { path: '/format-converter', label: 'Format Converter', icon: FileType },
      { path: '/video-to-gif', label: 'Video to GIF', icon: Video },
      { path: '/audio-waveform', label: 'Audio Waveform', icon: AudioWaveform },
    ],
  },
  {
    title: 'Image Tools',
    tools: [
      { path: '/image-upscaler', label: 'Image Upscaler', icon: ZoomIn },
      { path: '/pixel-upscaler', label: 'Pixel Upscaler', icon: Maximize2 },
      { path: '/image-to-pixelart', label: 'Image to Pixel Art', icon: Grid2X2 },
      { path: '/color-tools', label: 'Color Tools', icon: Palette },
    ],
  },
  {
    title: 'Sprites',
    tools: [
      { path: '/spritesheet-compiler', label: 'Sprite Compiler', icon: Grid3X3 },
      { path: '/sprite-to-gif', label: 'Sprite to GIF', icon: Film },
      { path: '/recolor', label: 'Sprite Recolor', icon: PaintBucket },
      { path: '/3d-spritesheet', label: '3D Spritesheet', icon: Box },
      { path: '/sprite-animator', label: 'Sprite Animator', icon: Play },
    ],
  },
  {
    title: 'Packing',
    tools: [
      { path: '/atlas-pack', label: 'Atlas Pack', icon: Package },
      { path: '/font-pack', label: 'Font Pack', icon: Type },
      { path: '/tile-pack', label: 'Tile Pack', icon: Layers },
    ],
  },
  {
    title: 'World',
    tools: [
      { path: '/tileset-generator', label: 'Tileset Generator', icon: LayoutGrid },
      { path: '/map-generator', label: 'Map Generator', icon: Map },
      { path: '/level-editor', label: 'Level Editor', icon: MapPinned },
    ],
  },
  {
    title: 'Math',
    tools: [
      {
        path: '/probability',
        label: 'Probability',
        icon: Dice5,
        subtabs: [
          { path: '/probability/binomial', label: 'Binomial', icon: BarChart3 },
          { path: '/probability/poisson', label: 'Poisson', icon: Sigma },
          { path: '/probability/hypergeometric', label: 'Hypergeometric', icon: Shuffle },
          { path: '/probability/custom', label: 'Custom', icon: SlidersHorizontal },
        ],
      },
      {
        path: '/matrices',
        label: 'Matrices',
        icon: Table2,
        subtabs: [
          { path: '/matrices/multiplication', label: 'Multiplication', icon: X },
          { path: '/matrices/echelon', label: 'Echelon', icon: ArrowDownNarrowWide },
          { path: '/matrices/inverse', label: 'Inverse', icon: FlipHorizontal },
          { path: '/matrices/determinant', label: 'Determinant', icon: Hash },
          { path: '/matrices/cofactors', label: 'Cofactors', icon: GridIcon },
          { path: '/matrices/systems', label: 'Systems', icon: Variable },
          { path: '/matrices/visualizer', label: 'Visualizer', icon: Eye },
        ],
      },
    ],
  },
  {
    title: 'Automation',
    tools: [
      { path: '/pipeline', label: 'Pipeline', icon: Workflow },
    ],
  },
  {
    title: 'Effects',
    tools: [
      { path: '/glitch-lab', label: 'Glitch Lab', icon: Zap },
      { path: '/earthbound-bg', label: 'EB Backgrounds', icon: Tv },
    ],
  },
]

const LS_COLLAPSED_KEY = 'jet-sidebar-collapsed'
const LS_ORDER_KEY = 'jet-sidebar-order'

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_COLLAPSED_KEY)
    if (raw) return new Set(JSON.parse(raw))
  } catch { /* ignore */ }
  return new Set()
}

function saveCollapsed(set: Set<string>) {
  localStorage.setItem(LS_COLLAPSED_KEY, JSON.stringify([...set]))
}

function loadOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(LS_ORDER_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

function saveOrder(order: string[]) {
  localStorage.setItem(LS_ORDER_KEY, JSON.stringify(order))
}

function getOrderedSections(sections: Section[], savedOrder: string[] | null): Section[] {
  if (!savedOrder) return sections
  const map = new (globalThis.Map)<string, Section>(sections.map((s) => [s.title, s]))
  const ordered: Section[] = []
  for (const title of savedOrder) {
    const s = map.get(title)
    if (s) {
      ordered.push(s)
      map.delete(title)
    }
  }
  for (const s of map.values()) ordered.push(s)
  return ordered
}

function findActiveSectionTitle(sections: Section[], pathname: string): string | null {
  for (const section of sections) {
    for (const tool of section.tools) {
      if (pathname.startsWith(tool.path)) return section.title
    }
  }
  return null
}

export function Sidebar() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed)
  const [sectionOrder, setSectionOrder] = useState<string[] | null>(loadOrder)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const dragCounterRef = useRef(0)

  const sections = getOrderedSections(defaultSections, sectionOrder)

  // Auto-expand category containing active tool
  useEffect(() => {
    const activeTitle = findActiveSectionTitle(sections, location.pathname)
    if (activeTitle && collapsed.has(activeTitle)) {
      setCollapsed((prev) => {
        const next = new Set(prev)
        next.delete(activeTitle)
        saveCollapsed(next)
        return next
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const toggleSection = useCallback((title: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      saveCollapsed(next)
      return next
    })
  }, [])

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
    setDraggedIdx(idx)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverIdx(idx)
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    dragCounterRef.current++
    setOverIdx(idx)
  }, [])

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setOverIdx(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, dropIdx: number) => {
    e.preventDefault()
    dragCounterRef.current = 0
    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (isNaN(fromIdx) || fromIdx === dropIdx) {
      setDraggedIdx(null)
      setOverIdx(null)
      return
    }

    const newSections = [...sections]
    const [moved] = newSections.splice(fromIdx, 1)
    newSections.splice(dropIdx, 0, moved)
    const newOrder = newSections.map((s) => s.title)
    setSectionOrder(newOrder)
    saveOrder(newOrder)
    setDraggedIdx(null)
    setOverIdx(null)
  }, [sections])

  const handleDragEnd = useCallback(() => {
    dragCounterRef.current = 0
    setDraggedIdx(null)
    setOverIdx(null)
  }, [])

  return (
    <aside className="w-60 border-r border-zinc-200 bg-white flex flex-col h-screen sticky top-0">
      <Link to="/" className="p-4 border-b border-zinc-200 flex justify-center hover:bg-zinc-50 transition-colors">
        <img src="/favicon.png" alt="JET - Just Enough Tools" className="h-10" />
      </Link>
      <nav className="flex-1 px-2 pt-4 pb-2 overflow-y-auto">
        {sections.map((section, sIdx) => {
          const isCollapsed = collapsed.has(section.title)
          const isDragging = draggedIdx === sIdx
          const isOver = overIdx === sIdx && draggedIdx !== null && draggedIdx !== sIdx

          return (
            <div
              key={section.title}
              className={cn(
                'mb-1 rounded-lg transition-all duration-150',
                isDragging && 'opacity-40',
                isOver && 'ring-2 ring-blue-400 ring-offset-1',
              )}
              onDragOver={(e) => handleDragOver(e, sIdx)}
              onDragEnter={(e) => handleDragEnter(e, sIdx)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, sIdx)}
            >
              <button
                draggable
                onDragStart={(e) => handleDragStart(e, sIdx)}
                onDragEnd={handleDragEnd}
                onClick={() => toggleSection(section.title)}
                className="flex items-center w-full px-2 py-1.5 rounded-md group cursor-pointer select-none hover:bg-zinc-100 transition-colors"
              >
                <GripVertical
                  size={12}
                  className="text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mr-1 cursor-grab active:cursor-grabbing"
                />
                <ChevronRight
                  size={12}
                  className={cn(
                    'text-zinc-400 shrink-0 mr-1.5 transition-transform duration-200',
                    !isCollapsed && 'rotate-90',
                  )}
                />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  {section.title}
                </span>
              </button>

              <div
                className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                style={{ gridTemplateRows: isCollapsed ? '0fr' : '1fr' }}
              >
                <div className="overflow-hidden">
                  <div className="space-y-0.5 pt-0.5 pb-1">
                    {section.tools.map(({ path, label, icon: Icon, disabled, subtabs }) => {
                      const isParentActive = location.pathname.startsWith(path)

                      if (disabled) {
                        return (
                          <span
                            key={path}
                            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-zinc-300 cursor-not-allowed select-none"
                            title="Coming soon"
                          >
                            <Icon size={15} />
                            {label}
                          </span>
                        )
                      }

                      if (subtabs) {
                        return (
                          <div key={path}>
                            <NavLink
                              to={subtabs[0].path}
                              className={() =>
                                cn(
                                  'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors',
                                  isParentActive
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                                )
                              }
                            >
                              <Icon size={15} />
                              {label}
                            </NavLink>
                            {isParentActive && (
                              <div className="ml-5 mt-0.5 space-y-0.5 border-l border-zinc-200 pl-2">
                                {subtabs.map(({ path: subPath, label: subLabel, icon: SubIcon }) => (
                                  <NavLink
                                    key={subPath}
                                    to={subPath}
                                    className={({ isActive }) =>
                                      cn(
                                        'flex items-center gap-2 px-2.5 py-1 rounded-md text-[12px] transition-colors',
                                        isActive
                                          ? 'text-blue-700 font-medium bg-blue-50/60'
                                          : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700',
                                      )
                                    }
                                  >
                                    <SubIcon size={13} />
                                    {subLabel}
                                  </NavLink>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      }

                      return (
                        <NavLink
                          key={path}
                          to={path}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors',
                              isActive
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                            )
                          }
                        >
                          <Icon size={15} />
                          {label}
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </nav>
      <HistoryPanel />
      <div className="p-2 border-t border-zinc-200">
        <NavLink
          to="/credits"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors',
              isActive
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
            )
          }
        >
          <Info size={15} />
          Credits
        </NavLink>
      </div>
    </aside>
  )
}
