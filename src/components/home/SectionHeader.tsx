import type { ReactNode } from 'react'

export interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}

export function SectionHeader({ title, subtitle, action, className = '' }: SectionHeaderProps) {
  return (
    <div className={`mb-3 flex items-end justify-between gap-3 ${className}`}>
      <div>
        <h2 className="text-base font-bold text-slate-900 sm:text-lg">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}
