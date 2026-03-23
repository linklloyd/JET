import { NavLink } from 'react-router-dom'
import {
  FileType,
  ZoomIn,
  Maximize2,
  Grid2X2,
  Palette,
  Grid3X3,
  Film,
  PaintBucket,
  Box,
  Package,
  Type,
  Layers,
  LayoutGrid,
  Map,
  Dice5,
  Table2,
  Workflow,
  Tv,
  Zap,
  Video,
  AudioWaveform,
  Play,
  MapPinned,

  ArrowRight,
  FunctionSquare,
  Captions,
} from 'lucide-react'
import { cn } from '../../lib/utils'

interface ToolCard {
  path: string
  label: string
  description: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
  disabled?: boolean
}

const sections: { title: string; description: string; tools: ToolCard[] }[] = [
  {
    title: 'Math',
    description: 'Probability distributions and matrix operations',
    tools: [
      { path: '/probability/binomial', label: 'Probability', description: 'Binomial, Poisson, Hypergeometric & custom distributions', icon: Dice5, color: 'slate' },
      { path: '/matrices/multiplication', label: 'Matrices', description: 'Multiply, reduce, invert, and solve matrix systems', icon: Table2, color: 'zinc' },
      { path: '/integrals/indefinite', label: 'Integrals', description: 'Step-by-step integration with multiple techniques', icon: FunctionSquare, color: 'violet' },
    ],
  },
  {
    title: 'Media',
    description: 'Convert and download media files',
    tools: [
      { path: '/format-converter', label: 'Format Converter', description: 'Universal file converter — images, video, audio', icon: FileType, color: 'blue' },
      { path: '/video-to-gif', label: 'Video to GIF', description: 'Convert video clips to animated GIFs', icon: Video, color: 'indigo' },
      { path: '/video-subtitler', label: 'Video Subtitler', description: 'Auto-transcribe & style subtitles with Whisper AI', icon: Captions, color: 'violet' },
      { path: '/audio-waveform', label: 'Audio Waveform', description: 'Visualize audio as waveform images', icon: AudioWaveform, color: 'sky' },

    ],
  },
  {
    title: 'Image Tools',
    description: 'Upscale, transform, and analyze images',
    tools: [
      { path: '/image-upscaler', label: 'Image Upscaler', description: 'High-quality photo upscaling inspired by waifu2x', icon: ZoomIn, color: 'purple' },
      { path: '/pixel-upscaler', label: 'Pixel Upscaler', description: 'Smart pixel art upscaling with EPX, xBR & more', icon: Maximize2, color: 'violet' },
      { path: '/image-to-pixelart', label: 'Image to Pixel Art', description: 'Convert any image into pixel art', icon: Grid2X2, color: 'pink' },
      { path: '/color-tools', label: 'Color Tools', description: 'Extract and manage color palettes', icon: Palette, color: 'rose' },
    ],
  },
  {
    title: 'Sprites',
    description: 'Build, split, and animate spritesheets',
    tools: [
      { path: '/spritesheet-compiler', label: 'Sprite Compiler', description: 'Compile frames into sheets or decompile sheets into frames', icon: Grid3X3, color: 'emerald' },
      { path: '/sprite-to-gif', label: 'Sprite to GIF', description: 'Convert spritesheets to animated GIFs', icon: Film, color: 'green' },
      { path: '/recolor', label: 'Sprite Recolor', description: 'Swap colors in sprites with precision', icon: PaintBucket, color: 'teal' },
      { path: '/3d-spritesheet', label: '3D Spritesheet', description: 'Capture 3D models from multiple angles', icon: Box, color: 'cyan' },
      { path: '/sprite-animator', label: 'Sprite Animator', description: 'Preview and fine-tune sprite animations', icon: Play, color: 'emerald' },
    ],
  },
  {
    title: 'Packing',
    description: 'Create optimized asset packs',
    tools: [
      { path: '/atlas-pack', label: 'Atlas Pack', description: 'Pack sprites into texture atlases', icon: Package, color: 'amber' },
      { path: '/font-pack', label: 'Font Pack', description: 'Generate bitmap font sheets', icon: Type, color: 'orange' },
      { path: '/tile-pack', label: 'Tile Pack', description: 'Build optimized tile packs', icon: Layers, color: 'yellow' },
    ],
  },
  {
    title: 'Effects',
    description: 'Visual effects and backgrounds',
    tools: [
      { path: '/glitch-lab', label: 'Glitch Lab', description: 'Glitch, distort, and corrupt images with stacking effects', icon: Zap, color: 'violet' },
      { path: '/earthbound-bg', label: 'EB Backgrounds', description: 'Animated Earthbound battle backgrounds', icon: Tv, color: 'rose' },
    ],
  },
  {
    title: 'World',
    description: 'Generate maps, tilesets, and levels',
    tools: [
      { path: '/tileset-generator', label: 'Tileset Generator', description: 'Arrange tiles into tilesets with metadata', icon: LayoutGrid, color: 'sky' },
      { path: '/map-generator', label: 'Map Generator', description: 'Procedural dungeon & overworld maps', icon: Map, color: 'indigo' },
      { path: '/level-editor', label: 'Level Editor', description: 'Design and edit game levels visually', icon: MapPinned, color: 'blue' },
    ],
  },
  {
    title: 'Automation',
    description: 'Chain tools into pipelines',
    tools: [
      { path: '/pipeline', label: 'Pipeline', description: 'Chain tools together into automated workflows', icon: Workflow, color: 'fuchsia' },
    ],
  },
]

const colorMap: Record<string, { badge: string; border: string }> = {
  blue:    { badge: 'bg-blue-100 text-blue-600 group-hover:bg-blue-200',       border: 'group-hover:border-blue-200' },
  purple:  { badge: 'bg-purple-100 text-purple-600 group-hover:bg-purple-200', border: 'group-hover:border-purple-200' },
  violet:  { badge: 'bg-violet-100 text-violet-600 group-hover:bg-violet-200', border: 'group-hover:border-violet-200' },
  pink:    { badge: 'bg-pink-100 text-pink-600 group-hover:bg-pink-200',       border: 'group-hover:border-pink-200' },
  rose:    { badge: 'bg-rose-100 text-rose-600 group-hover:bg-rose-200',       border: 'group-hover:border-rose-200' },
  emerald: { badge: 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200', border: 'group-hover:border-emerald-200' },
  green:   { badge: 'bg-green-100 text-green-600 group-hover:bg-green-200',    border: 'group-hover:border-green-200' },
  teal:    { badge: 'bg-teal-100 text-teal-600 group-hover:bg-teal-200',       border: 'group-hover:border-teal-200' },
  cyan:    { badge: 'bg-cyan-100 text-cyan-600 group-hover:bg-cyan-200',       border: 'group-hover:border-cyan-200' },
  amber:   { badge: 'bg-amber-100 text-amber-600 group-hover:bg-amber-200',    border: 'group-hover:border-amber-200' },
  orange:  { badge: 'bg-orange-100 text-orange-600 group-hover:bg-orange-200',  border: 'group-hover:border-orange-200' },
  yellow:  { badge: 'bg-yellow-100 text-yellow-600 group-hover:bg-yellow-200',  border: 'group-hover:border-yellow-200' },
  sky:     { badge: 'bg-sky-100 text-sky-600 group-hover:bg-sky-200',           border: 'group-hover:border-sky-200' },
  indigo:  { badge: 'bg-indigo-100 text-indigo-600 group-hover:bg-indigo-200',  border: 'group-hover:border-indigo-200' },
  slate:   { badge: 'bg-slate-100 text-slate-600 group-hover:bg-slate-200',     border: 'group-hover:border-slate-200' },
  zinc:    { badge: 'bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200',        border: 'group-hover:border-zinc-200' },
  fuchsia: { badge: 'bg-fuchsia-100 text-fuchsia-600 group-hover:bg-fuchsia-200', border: 'group-hover:border-fuchsia-200' },
}

export function HomePage() {
  return (
    <div className="space-y-12 pb-16">
      {/* Hero */}
      <div className="text-center py-10">
        <h1 className="text-4xl font-bold text-zinc-900 tracking-tight">
          Just Enough Tools
        </h1>
        <p className="text-lg text-zinc-500 mt-3 max-w-lg mx-auto leading-relaxed">
          Fast, private, browser-based tools for creators and developers.
          <br className="hidden sm:block" />
          No uploads, no signups.
        </p>
      </div>

      {/* Tool sections */}
      {sections.map((section) => (
        <section key={section.title}>
          <div className="mb-5 flex items-baseline gap-3">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              {section.title}
            </h2>
            <div className="flex-1 h-px bg-zinc-100" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {section.tools.map((tool) => {
              const colors = colorMap[tool.color] ?? colorMap.slate

              return (
                <NavLink
                  key={tool.path}
                  to={tool.path}
                  className={cn(
                    'group relative flex items-start gap-4 p-4 rounded-xl border border-zinc-200/80 bg-white',
                    'hover:shadow-md hover:shadow-zinc-100 transition-all duration-200',
                    colors.border,
                    tool.disabled && 'opacity-35 pointer-events-none',
                  )}
                >
                  <div
                    className={cn(
                      'shrink-0 p-2.5 rounded-xl transition-colors duration-200',
                      colors.badge,
                    )}
                  >
                    <tool.icon size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-zinc-800 group-hover:text-zinc-900 truncate">
                        {tool.label}
                      </p>
                      {tool.disabled && (
                        <span className="shrink-0 text-[10px] font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-full">
                          Soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed line-clamp-2">
                      {tool.description}
                    </p>
                  </div>

                  <ArrowRight
                    size={14}
                    className="shrink-0 mt-1 text-zinc-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200"
                  />
                </NavLink>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
