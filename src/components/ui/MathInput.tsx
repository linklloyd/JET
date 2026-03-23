import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/utils'
import { MathfieldElement, convertLatexToMarkup } from 'mathlive'

// Configure MathLive to find fonts in the public directory
MathfieldElement.fontsDirectory = '/fonts/'

// ---------------------------------------------------------------------------
// Symbol keyboard definitions (Symbolab-style categories)
// ---------------------------------------------------------------------------

interface KBSymbol {
  display: string
  latex: string
}

interface KBCategory {
  label: string
  symbols: KBSymbol[]
}

const KEYBOARD_CATEGORIES: KBCategory[] = [
  {
    label: 'Basic',
    symbols: [
      { display: '□/□', latex: '\\frac{#0}{#0}' },
      { display: '□²', latex: '^{2}' },
      { display: 'x□', latex: 'x^{#0}' },
      { display: '√□', latex: '\\sqrt{#0}' },
      { display: 'ⁿ√□', latex: '\\sqrt[#0]{#0}' },
      { display: 'eˣ', latex: 'e^{#0}' },
      { display: 'ln', latex: '\\ln(#0)' },
      { display: 'log', latex: '\\log(#0)' },
      { display: 'logₙ', latex: '\\log_{#0}' },
      { display: '|□|', latex: '\\lvert #0 \\rvert' },
      { display: '(□)', latex: '(#0)' },
      { display: '±', latex: '\\pm' },
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
]

// ---------------------------------------------------------------------------
// MathInput component (with live rendering + always-open keyboard)
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
  const [activeCategory, setActiveCategory] = useState(0)
  const mathfieldRef = useRef<MathfieldElement | null>(null)

  // Set up mathfield event listener
  useEffect(() => {
    const mf = mathfieldRef.current
    if (!mf) return

    mf.smartFence = true
    mf.smartSuperscript = true
    mf.mathVirtualKeyboardPolicy = 'manual'
    mf.menuItems = []  // disable the ≡ menu button

    // On mobile/touch devices, prevent the native keyboard from covering our custom keyboard
    // by setting the math-field to read-only mode for the underlying input
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      requestAnimationFrame(() => {
        const shadow = mf.shadowRoot
        if (shadow) {
          // Prevent native keyboard from showing on focus
          const textarea = shadow.querySelector('textarea')
          if (textarea) {
            textarea.setAttribute('inputmode', 'none')
            textarea.setAttribute('readonly', 'readonly')
          }
        }
      })
    }

    // Hide built-in virtual keyboard toggle and menu from shadow DOM
    requestAnimationFrame(() => {
      const shadow = mf.shadowRoot
      if (shadow) {
        const style = document.createElement('style')
        style.textContent = `.ML__virtual-keyboard-toggle, .ML__menu-toggle { display: none !important; }`
        shadow.appendChild(style)
      }
    })

    const handleInput = () => {
      onChange(mf.value)
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
    mf.executeCommand(['insert', latex, { focus: true }])
    requestAnimationFrame(() => onChange(mf.value))
  }, [onChange])

  const category = KEYBOARD_CATEGORIES[activeCategory]

  return (
    <div className="space-y-0">
      {label && (
        <label className="text-xs font-medium text-zinc-600 block mb-2">{label}</label>
      )}

      {/* MathLive input field */}
      <div className="rounded-t-lg border border-zinc-200 bg-white overflow-hidden focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-colors">
        {/* @ts-expect-error - MathLive web component */}
        <math-field
          ref={mathfieldRef}
          placeholder={placeholder}
          style={{
            width: '100%',
            minHeight: '56px',
            padding: '12px 16px',
            fontSize: '22px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
          }}
        />
      </div>

      {/* Always-visible symbol keyboard (attached below input) */}
      <div className="bg-zinc-50 border border-t-0 border-zinc-200 rounded-b-lg overflow-hidden">
        {/* Category tabs */}
        <div className="flex border-b border-zinc-200 overflow-x-auto bg-white">
          {KEYBOARD_CATEGORIES.map((cat, i) => (
            <button
              key={cat.label}
              type="button"
              onClick={() => setActiveCategory(i)}
              className={cn(
                'px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors shrink-0',
                activeCategory === i
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Symbol grid */}
        <div className="p-2.5">
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5">
            {category.symbols.map((sym, i) => (
              <button
                key={i}
                type="button"
                onClick={() => insertLatex(sym.latex)}
                className="px-2 py-2.5 text-sm rounded-md border border-zinc-200 bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors text-center font-serif min-h-[40px] flex items-center justify-center shadow-sm"
                title={sym.latex}
              >
                {sym.display}
              </button>
            ))}
          </div>

          {/* Number/variable row for mobile (no native keyboard) */}
          <div className="grid grid-cols-8 sm:grid-cols-12 gap-1 mt-2 lg:hidden">
            {['1','2','3','4','5','6','7','8','9','0','x','y'].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => insertLatex(key)}
                className="py-2 text-sm rounded-md border border-zinc-100 bg-white hover:bg-zinc-100 transition-colors text-center font-mono"
              >
                {key}
              </button>
            ))}
            {['+','-','·','=','(',')','←'].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === '←') {
                    mathfieldRef.current?.executeCommand('deleteBackward')
                    requestAnimationFrame(() => onChange(mathfieldRef.current?.value || ''))
                  } else if (key === '·') {
                    insertLatex('\\cdot')
                  } else {
                    insertLatex(key)
                  }
                }}
                className="py-2 text-sm rounded-md border border-zinc-100 bg-white hover:bg-zinc-100 transition-colors text-center font-mono"
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MathDisplay — render LaTeX as static formatted math
// ---------------------------------------------------------------------------

export function MathDisplay({ latex, className }: { latex: string; className?: string }) {
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!containerRef.current || !latex) return

    // Check if this looks like math or plain text
    const hasMathChars = /[\\^_{}]|[0-9]+[a-z]|[+\-*/=<>]|\bsin\b|\bcos\b|\btan\b|\bln\b|\blog\b|\bsqrt\b|∫|√|π|∞|\bfrac\b/.test(latex)

    if (hasMathChars) {
      try {
        containerRef.current.innerHTML = convertLatexToMarkup(latex)
      } catch {
        containerRef.current.textContent = latex
      }
    } else {
      // Plain text — render as-is with text styling
      containerRef.current.textContent = latex
    }
  }, [latex])

  return <span ref={containerRef} className={cn('mathlive-display', className)} />
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
