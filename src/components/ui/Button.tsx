import { cn } from '../../lib/utils'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        {
          'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800': variant === 'primary',
          'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200': variant === 'secondary',
          'bg-red-600 text-white hover:bg-red-700': variant === 'danger',
          'px-4 py-2 text-xs': size === 'sm',
          'px-5 py-2.5 text-sm': size === 'md',
          'px-7 py-3 text-base': size === 'lg',
        },
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
