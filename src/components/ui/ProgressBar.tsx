import { cn } from '../../lib/utils'

interface ProgressBarProps {
  value: number
  className?: string
}

export function ProgressBar({ value, className }: ProgressBarProps) {
  return (
    <div className={cn('w-full bg-zinc-200 rounded-full h-2 overflow-hidden', className)}>
      <div
        className="bg-blue-600 h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
