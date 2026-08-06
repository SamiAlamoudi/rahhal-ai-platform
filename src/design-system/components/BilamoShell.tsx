import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface BilamoShellProps {
  children: ReactNode
  className?: string
  /** Show fixed atmospheric gradient behind content */
  atmosphere?: boolean
}

/** Full-bleed page shell for Bilamo surfaces. */
export function BilamoShell({ children, className, atmosphere = true }: BilamoShellProps) {
  return (
    <div className={cn('bilamo-root relative', className)} data-bilamo-shell>
      {atmosphere ? <div className="bilamo-atmosphere" aria-hidden /> : null}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
