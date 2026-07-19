import type { ReactNode } from 'react'

export interface HomeCardProps {
  children: ReactNode
  className?: string
  interactive?: boolean
  onClick?: () => void
  'data-testid'?: string
}

export function HomeCard({
  children,
  className = '',
  interactive = false,
  onClick,
  'data-testid': testId,
}: HomeCardProps) {
  const base =
    'rounded-2xl border border-slate-100/80 bg-white/90 text-start shadow-sm shadow-slate-900/[0.03] backdrop-blur-sm'
  if (interactive || onClick) {
    return (
      <button
        type="button"
        data-testid={testId}
        onClick={onClick}
        className={`${base} w-full p-4 text-start transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-100 hover:shadow-md active:scale-[0.99] ${className}`}
      >
        {children}
      </button>
    )
  }
  return (
    <div data-testid={testId} className={`${base} p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  )
}
