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
  Waves,
  Tv,
  Zap,
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
    title: 'Media',
    description: 'Convert and download media files',
    tools: [
      { path: '/format-converter', label: 'Format Converter', description: 'Universal file converter — images, video, audio', icon: FileType, color: 'blue' },
    ],
  },
  {
    title: 'Image Tools',
    description: 'Upscale, transform, and analyze images',
    tools: [
      { path: '/image-upscaler', label: 'Image Upscaler', description: 'High-quality photo upscaling inspired by waifu2x', icon: ZoomIn, color: 'purple' },
      { path: '/pixel-upscaler', label: 'Pixel Upscaler', description: 'Smart pixel art upscaling with EPX, xBR & more', icon: Maximize2, color: 'violet' },
      { path: '/image-to-pixelart', label: 'Image to Pixel Art', description: 'Convert any image into pixel art', icon: Grid2X2, color: 'pink' },
      { path: '/color-extractor', label: 'Color Extractor', description: 'Extract color palettes from images', icon: Palette, color: 'rose' },
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
    title: 'World',
    description: 'Generate maps and tilesets',
    tools: [
      { path: '/tileset-generator', label: 'Tileset Generator', description: 'Arrange tiles into tilesets with metadata', icon: LayoutGrid, color: 'sky' },
      { path: '/map-generator', label: 'Map Generator', description: 'Procedural dungeon & overworld maps', icon: Map, color: 'indigo' },
      { path: '/noise-generator', label: 'Noise Generator', description: 'Perlin, Simplex, Voronoi & procedural textures', icon: Waves, color: 'cyan' },
    ],
  },
  {
    title: 'Math',
    description: 'Probability distributions and matrix operations',
    tools: [
      { path: '/probability/binomial', label: 'Probability', description: 'Binomial, Poisson, Hypergeometric & custom distributions', icon: Dice5, color: 'slate' },
      { path: '/matrices/multiplication', label: 'Matrices', description: 'Multiply, reduce, invert, and solve matrix systems', icon: Table2, color: 'zinc' },
    ],
  },
  {
    title: 'Automation',
    description: 'Chain tools into pipelines',
    tools: [
      { path: '/pipeline', label: 'Pipeline', description: 'Chain tools together into automated workflows', icon: Workflow, color: 'fuchsia' },
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
]

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
  purple: 'bg-purple-50 text-purple-600 group-hover:bg-purple-100',
  violet: 'bg-violet-50 text-violet-600 group-hover:bg-violet-100',
  pink: 'bg-pink-50 text-pink-600 group-hover:bg-pink-100',
  rose: 'bg-rose-50 text-rose-600 group-hover:bg-rose-100',
  emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100',
  green: 'bg-green-50 text-green-600 group-hover:bg-green-100',
  teal: 'bg-teal-50 text-teal-600 group-hover:bg-teal-100',
  cyan: 'bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100',
  amber: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100',
  orange: 'bg-orange-50 text-orange-600 group-hover:bg-orange-100',
  yellow: 'bg-yellow-50 text-yellow-600 group-hover:bg-yellow-100',
  sky: 'bg-sky-50 text-sky-600 group-hover:bg-sky-100',
  indigo: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100',
  slate: 'bg-slate-100 text-slate-600 group-hover:bg-slate-200',
  zinc: 'bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200',
  fuchsia: 'bg-fuchsia-50 text-fuchsia-600 group-hover:bg-fuchsia-100',
}

export function HomePage() {
  return (
    <div className="space-y-10 pb-12">
      {/* Hero */}
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold text-zinc-900 tracking-tight">
          Just Enough Tools
        </h1>
        <p className="text-lg text-zinc-500 mt-2 max-w-lg mx-auto">
          Fast, private, browser-based tools for creators and developers. No uploads, no signups.
        </p>
      </div>

      {/* Tool sections */}
      {sections.map((section) => (
        <div key={section.title}>
          <div className="mb-4">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{section.title}</h2>
            <p className="text-xs text-zinc-400 mt-0.5">{section.description}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.tools.map((tool) => (
              <NavLink
                key={tool.path}
                to={tool.path}
                className={cn(
                  'group flex items-start gap-3 p-5 rounded-xl border border-zinc-200 bg-white',
                  'hover:border-zinc-300 hover:shadow-sm transition-all duration-200',
                  tool.disabled && 'opacity-40 pointer-events-none'
                )}
              >
                <div className={cn('p-2 rounded-lg transition-colors duration-200', colorMap[tool.color])}>
                  <tool.icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-800 group-hover:text-zinc-900">{tool.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{tool.description}</p>
                </div>
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
