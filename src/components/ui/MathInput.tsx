import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp, Keyboard } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { MathfieldElement } from 'mathlive'

// Import MathLive (registers <math-field> custom element)
import 'mathlive'

// ---------------------------------------------------------------------------
// Symbol keyboard definitions (Symbolab-style categories)
// ---------------------------------------------------------------------------

interface KBSymbol {
  display: string  // What shows on the button (can be LaTeX rendered or text)
  latex: string    // LaTeX command to insert into mathfield
}

interface KBCategory {
  label: string
  symbols: KBSymbol[]
}

const KEYBOARD_CATEGORIES: KBCategory[] = [
  {
    label: 'Basic',
    symbols: [
      { display: '□²', latex: '#0^{2}' },
      { display: 'x□', latex: 'x^{#0}' },
      { display: '√□', latex: '\\sqrt{#0}' },
      { display: 'ⁿ√□', latex: '\\sqrt[#0]{#0}' },
      { display: '□/□', latex: '\\frac{#0}{#0}' },
      { display: 'logₙ', latex: '\\log_{#0}' },
      { display: 'π', latex: '\\pi' },
      { display: 'θ', latex: '\\theta' },
      { display: '∞', latex: '\\infty' },
      { display: '∫', latex: '\\int' },
      { display: 'd/dx', latex: '\\frac{d}{dx}' },
      { display: 'eˣ', latex: 'e^{#0}' },
    ],
  },
  {
    label: 'Trig',
    symbols: [
      { display: 'sin', latex: '\\sin(#0)' },
      { display: 'cos', latex: '\\cos(#0)' },
      { display: 'tan', latex: '\\tan(#0)' },
      { display: 'cot', latex: '\\cot(#0)' },
      { display: 'sec', latex: '\\sec(#0)' },
      { display: 'csc', latex: '\\csc(#0)' },
      { display: 'sin⁻¹', latex: '\\arcsin(#0)' },
      { display: 'cos⁻¹', latex: '\\arccos(#0)' },
      { display: 'tan⁻¹', latex: '\\arctan(#0)' },
    ],
  },
  {
    label: 'αβγ',
    symbols: [
      { display: 'α', latex: '\\alpha' },
      { display: 'β', latex: '\\beta' },
      { display: 'γ', latex: '\\gamma' },
      { display: 'δ', latex: '\\delta' },
      { display: 'ε', latex: '\\epsilon' },
      { display: 'λ', latex: '\\lambda' },
      { display: 'μ', latex: '\\mu' },
      { display: 'σ', latex: '\\sigma' },
      { display: 'ω', latex: '\\omega' },
      { display: 'φ', latex: '\\phi' },
    ],
  },
  {
    label: '≥ ÷ →',
    symbols: [
      { display: '≥', latex: '\\geq' },
      { display: '≤', latex: '\\leq' },
      { display: '≠', latex: '\\neq' },
      { display: '±', latex: '\\pm' },
      { display: '·', latex: '\\cdot' },
      { display: '÷', latex: '\\div' },
      { display: '|□|', latex: '\\lvert #0 \\rvert' },
      { display: '(□)', latex: '(#0)' },
    ],
  },
  {
    label: '∑ ∫ ∏',
    symbols: [
      { display: '∫ₐᵇ', latex: '\\int_{#0}^{#0}' },
      { display: '∑', latex: '\\sum_{#0}^{#0}' },
      { display: '∏', latex: '\\prod_{#0}^{#0}' },
      { display: 'lim', latex: '\\lim_{#0}' },
      { display: 'ln', latex: '\\ln(#0)' },
      { display: 'log', latex: '\\log(#0)' },
    ],
  },
]

// ---------------------------------------------------------------------------
// MathInput component
// ---------------------------------------------------------------------------

interface MathInputProps {
  value: string
  onChange: (latex: string) => void
  placeholder?: string
  label?: string
}

export function MathInput({
  value,
  onChange,
  placeholder = 'Enter expression...',
  label,
}: MathInputProps) {
  const [keyboardOpen, setKeyboardOpen] = useState(true)
  const [activeCategory, setActiveCategory] = useState(0)
  const mathfieldRef = useRef<MathfieldElement | null>(null)

  // Set up mathfield event listener
  useEffect(() => {
    const mf = mathfieldRef.current
    if (!mf) return

    // Configure mathfield
    mf.smartFence = true
    mf.smartSuperscript = true
    // Disable MathLive's built-in virtual keyboard — we provide our own
    mf.mathVirtualKeyboardPolicy = 'manual'

    const handleInput = () => {
      const latex = mf.value
      onChange(latex)
    }

    mf.addEventListener('input', handleInput)
    return () => mf.removeEventListener('input', handleInput)
  }, [onChange])

  // Sync external value changes
  useEffect(() => {
    const mf = mathfieldRef.current
    if (mf && mf.value !== value) {
      mf.value = value
    }
  }, [value])

  const insertLatex = useCallback((latex: string) => {
    const mf = mathfieldRef.current
    if (!mf) return

    // If latex contains #0 placeholders, use insert which handles them
    if (latex.includes('#0')) {
      mf.executeCommand(['insert', latex, { focus: true }])
    } else {
      mf.executeCommand(['insert', latex, { focus: true }])
    }

    // Update parent state
    requestAnimationFrame(() => {
      onChange(mf.value)
    })
  }, [onChange])

  const category = KEYBOARD_CATEGORIES[activeCategory]

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-xs font-medium text-zinc-600">{label}</label>
      )}

      {/* MathLive math field */}
      <div className="relative">
        <div className="mathlive-container rounded-lg border border-zinc-200 bg-white overflow-hidden focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-colors">
          {/* @ts-expect-error - MathLive web component */}
          <math-field
            ref={mathfieldRef}
            placeholder={placeholder}
            style={{
              width: '100%',
              minHeight: '48px',
              padding: '8px 40px 8px 12px',
              fontSize: '20px',
              border: 'none',
              outline: 'none',
              background: 'transparent',
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => setKeyboardOpen(!keyboardOpen)}
          className={cn(
            'absolute top-3 right-2 p-1.5 rounded transition-colors z-10',
            keyboardOpen
              ? 'text-blue-600 bg-blue-50'
              : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100',
          )}
          title="Toggle symbol keyboard"
        >
          <Keyboard size={16} />
        </button>
      </div>

      {/* Symbol keyboard */}
      {keyboardOpen && (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          {/* Category tabs */}
          <div className="flex border-b border-zinc-100 overflow-x-auto">
            {KEYBOARD_CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => setActiveCategory(i)}
                className={cn(
                  'px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors shrink-0',
                  activeCategory === i
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700',
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Symbol grid */}
          <div className="p-2">
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1">
              {category.symbols.map((sym, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => insertLatex(sym.latex)}
                  className="px-1.5 py-2 text-sm rounded border border-zinc-200 bg-zinc-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors text-center font-serif min-h-[36px] flex items-center justify-center"
                  title={sym.latex}
                >
                  {sym.display}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CollapsibleSection (reused by IntegralsPage for steps)
// ---------------------------------------------------------------------------

export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 transition-colors"
      >
        <p className="text-xs font-bold text-zinc-700 uppercase tracking-wide">{title}</p>
        {open ? <ChevronUp size={14} className="text-zinc-400" /> : <ChevronDown size={14} className="text-zinc-400" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  )
}
