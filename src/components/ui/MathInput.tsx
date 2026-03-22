import { useState, useRef, useCallback } from 'react'
import { Keyboard, ChevronDown, ChevronUp } from 'lucide-react'
import { MATH_SYMBOLS, formatExpression, type SymbolGroup } from '../../lib/math-parser'
import { cn } from '../../lib/utils'

interface MathInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  preview?: boolean
  symbolGroups?: string[] // filter which groups to show
  multiline?: boolean
}

export function MathInput({
  value,
  onChange,
  placeholder = 'Enter expression...',
  label,
  preview = true,
  symbolGroups,
  multiline = false,
}: MathInputProps) {
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  const groups: SymbolGroup[] = symbolGroups
    ? MATH_SYMBOLS.filter((g) => symbolGroups.includes(g.group))
    : MATH_SYMBOLS

  const insertAtCursor = useCallback(
    (text: string) => {
      const el = inputRef.current
      if (!el) {
        onChange(value + text)
        return
      }

      const start = el.selectionStart ?? value.length
      const end = el.selectionEnd ?? value.length
      const before = value.slice(0, start)
      const after = value.slice(end)
      const newValue = before + text + after
      onChange(newValue)

      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        el.focus()
        const newPos = start + text.length
        el.setSelectionRange(newPos, newPos)
      })
    },
    [value, onChange],
  )

  const formatted = value ? formatExpression(value) : ''

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-xs font-medium text-zinc-600">{label}</label>
      )}

      <div className="relative">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 pr-9 text-sm font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
        )}
        <button
          type="button"
          onClick={() => setKeyboardOpen(!keyboardOpen)}
          className={cn(
            'absolute top-2 right-2 p-1 rounded transition-colors',
            keyboardOpen
              ? 'text-blue-600 bg-blue-50'
              : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100',
          )}
          title="Toggle symbol keyboard"
        >
          <Keyboard size={14} />
        </button>
      </div>

      {/* Symbol keyboard */}
      {keyboardOpen && (
        <div className="bg-white border border-zinc-200 rounded-lg p-2.5 space-y-2">
          {groups.map((group) => (
            <div key={group.group}>
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                {group.group}
              </p>
              <div className="flex flex-wrap gap-1">
                {group.symbols.map((sym) => (
                  <button
                    key={sym.insert}
                    type="button"
                    onClick={() => insertAtCursor(sym.insert)}
                    className="px-2 py-1 text-xs font-mono rounded border border-zinc-200 bg-zinc-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors min-w-[28px] text-center"
                    title={sym.insert}
                  >
                    {sym.display}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formatted preview */}
      {preview && formatted && (
        <div className="bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 min-h-[28px]">
          <p className="text-sm font-serif italic text-zinc-700">{formatted}</p>
        </div>
      )}
    </div>
  )
}

/** Collapsible detail section — reused for steps display */
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
