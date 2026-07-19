import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-primary-600 text-white shadow-sm shadow-primary-600/25 hover:bg-primary-700 disabled:bg-slate-300',
  secondary:
    'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50',
  ghost: 'text-primary-700 hover:bg-primary-50 disabled:opacity-50',
}

const SIZE: Record<Size, string> = {
  sm: 'rounded-lg px-3 py-1.5 text-xs font-bold',
  md: 'rounded-xl px-4 py-2.5 text-sm font-bold',
  lg: 'rounded-2xl px-6 py-3.5 text-base font-bold',
}

export interface HomeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

export function HomeButton({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: HomeButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
