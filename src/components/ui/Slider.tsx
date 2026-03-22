import { cn } from '../../lib/utils'
import type { InputHTMLAttributes } from 'react'

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  displayValue?: string
}

export function Slider({ label, displayValue, className, ...props }: SliderProps) {
  return (
    <div className="space-y-1">
      {(label || displayValue) && (
        <div className="flex justify-between text-xs">
          {label && <span className="font-medium text-zinc-600">{label}</span>}
          {displayValue && <span className="text-zinc-500">{displayValue}</span>}
        </div>
      )}
      <input
        type="range"
        className={cn(
          'w-full h-1.5 bg-zinc-200 rounded-full appearance-none cursor-pointer accent-blue-600',
          className
        )}
        {...props}
      />
    </div>
  )
}
