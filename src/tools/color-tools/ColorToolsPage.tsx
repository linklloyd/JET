import { useState } from 'react'
import { ColorExtractorContent } from '../color-extractor/ColorExtractorPage'
import { DitheringContent } from '../dithering/DitheringPage'
import { PaletteEditorContent } from '../palette-editor/PaletteEditorPage'

type Tab = 'extractor' | 'dithering' | 'palette'

const TABS: { value: Tab; label: string }[] = [
  { value: 'extractor', label: 'Extractor' },
  { value: 'dithering', label: 'Dithering' },
  { value: 'palette', label: 'Palette' },
]

export function ColorToolsPage() {
  const [tab, setTab] = useState<Tab>('extractor')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Color Tools</h2>
        <p className="text-sm text-zinc-500 mt-2">Extract palettes, apply dithering, and create or swap colors</p>
      </div>

      <div className="flex gap-1 bg-zinc-100 rounded-lg p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.value
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'extractor' && <ColorExtractorContent />}
      {tab === 'dithering' && <DitheringContent />}
      {tab === 'palette' && <PaletteEditorContent />}
    </div>
  )
}
