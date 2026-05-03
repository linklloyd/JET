import { createBrowserRouter, Navigate, Link, useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { HomePage } from './tools/home/HomePage'

import { PixelUpscalerPage } from './tools/pixel-upscaler/PixelUpscalerPage'
import { SpritesheetCompilerPage } from './tools/spritesheet-compiler/SpritesheetCompilerPage'
import { TilesetGeneratorPage } from './tools/tileset-generator/TilesetGeneratorPage'
import { Spritesheet3DPage } from './tools/spritesheet-3d/Spritesheet3DPage'
import { FormatConverterPage } from './tools/format-converter/FormatConverterPage'
import { MapGeneratorPage } from './tools/map-generator/MapGeneratorPage'
import { ImageToPixelartPage } from './tools/image-to-pixelart/ImageToPixelartPage'
import { SpriteToGifPage } from './tools/sprite-to-gif/SpriteToGifPage'
import { AtlasPackPage } from './tools/atlas-pack/AtlasPackPage'
import { FontPackPage } from './tools/font-pack/FontPackPage'
import { TilePackPage } from './tools/tile-pack/TilePackPage'
import { RecolorPage } from './tools/recolor/RecolorPage'
import { CreditsPage } from './tools/credits/CreditsPage'
import { ImageUpscalerPage } from './tools/image-upscaler/ImageUpscalerPage'
import { ProbabilityPage } from './tools/probability/ProbabilityPage'
import { MatricesPage } from './tools/matrices/MatricesPage'
import { PipelinePage } from './tools/pipeline/PipelinePage'
import { ColorToolsPage } from './tools/color-tools/ColorToolsPage'
import { SpriteAnimatorPage } from './tools/sprite-animator/SpriteAnimatorPage'
import { VideoToGifPage } from './tools/video-to-gif/VideoToGifPage'
import { LevelEditorPage } from './tools/level-editor/LevelEditorPage'
import { AudioWaveformPage } from './tools/audio-waveform/AudioWaveformPage'
import { GlitchLabPage } from './tools/glitch-lab/GlitchLabPage'
import { lazy, Suspense } from 'react'

const EarthboundBGPage = lazy(() => import('./tools/earthbound-bg/EarthboundBGPage').then(m => ({ default: m.EarthboundBGPage })))
import { IntegralsPage } from './tools/integrals/IntegralsPage'
import { LinearRegressionPage } from './tools/regression/LinearRegressionPage'

function ErrorPage() {
  const error = useRouteError()
  const is404 = isRouteErrorResponse(error) && error.status === 404

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="text-center space-y-4 px-6">
        <p className="text-6xl font-bold text-zinc-300">{is404 ? '404' : 'Oops'}</p>
        <h1 className="text-xl font-semibold text-zinc-800">
          {is404 ? 'Page not found' : 'Something went wrong'}
        </h1>
        <p className="text-sm text-zinc-500 max-w-sm mx-auto">
          {is404
            ? "The page you're looking for doesn't exist or has been moved."
            : 'An unexpected error occurred. Try heading back home.'}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors mt-2"
        >
          Back to Home
        </Link>
      </div>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },

      { path: 'format-converter', element: <FormatConverterPage /> },
      { path: 'image-upscaler', element: <ImageUpscalerPage /> },
      { path: 'pixel-upscaler', element: <PixelUpscalerPage /> },
      { path: 'image-to-pixelart', element: <ImageToPixelartPage /> },
      { path: 'color-tools', element: <ColorToolsPage /> },
      { path: 'spritesheet-compiler', element: <SpritesheetCompilerPage /> },
      { path: 'sprite-to-gif', element: <SpriteToGifPage /> },
      { path: 'recolor', element: <RecolorPage /> },
      { path: '3d-spritesheet', element: <Spritesheet3DPage /> },
      { path: 'sprite-animator', element: <SpriteAnimatorPage /> },
      { path: 'atlas-pack', element: <AtlasPackPage /> },
      { path: 'font-pack', element: <FontPackPage /> },
      { path: 'tile-pack', element: <TilePackPage /> },
      { path: 'tileset-generator', element: <TilesetGeneratorPage /> },
      { path: 'map-generator', element: <MapGeneratorPage /> },
      { path: 'level-editor', element: <LevelEditorPage /> },
      { path: 'probability', element: <Navigate to="/probability/binomial" replace /> },
      { path: 'probability/:distType', element: <ProbabilityPage /> },
      { path: 'matrices', element: <Navigate to="/matrices/multiplication" replace /> },
      { path: 'matrices/:opType', element: <MatricesPage /> },
      { path: 'integrals', element: <Navigate to="/integrals/indefinite" replace /> },
      { path: 'integrals/:method', element: <IntegralsPage /> },
      { path: 'regression', element: <LinearRegressionPage /> },
      { path: 'pipeline', element: <PipelinePage /> },
      { path: 'video-to-gif', element: <VideoToGifPage /> },
      { path: 'audio-waveform', element: <AudioWaveformPage /> },
      { path: 'glitch-lab', element: <GlitchLabPage /> },
      { path: 'earthbound-bg', element: <Suspense fallback={<div className="p-8 text-zinc-500">Loading...</div>}><EarthboundBGPage /></Suspense> },
      { path: 'credits', element: <CreditsPage /> },
    ],
  },
])
