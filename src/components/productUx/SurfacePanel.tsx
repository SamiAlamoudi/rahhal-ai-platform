import type { ReactNode } from 'react'

export interface SurfacePanelProps {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'form'
  elevated?: boolean
}

/** Interaction surface — used only where the user acts (forms, composers). */
export function SurfacePanel({
  children,
  className = '',
  as: Tag = 'div',
  elevated = true,
}: SurfacePanelProps) {
  return (
    <Tag
      data-testid="product-surface-panel"
      className={`rounded-[1.35rem] border border-white/70 bg-white/95 backdrop-blur-xl ${
        elevated ? 'shadow-2xl shadow-slate-950/10' : 'shadow-sm shadow-slate-900/5'
      } ${className}`}
    >
      {children}
    </Tag>
  )
}
