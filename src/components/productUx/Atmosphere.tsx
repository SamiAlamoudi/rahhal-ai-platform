import type { ReactNode } from 'react'
import { productAtmosphere } from '../../lib/productUx'

export interface AtmosphereProps {
  variant?: 'hero' | 'page' | 'auth'
  className?: string
  children?: ReactNode
}

/**
 * Full-bleed atmospheric plane — brand horizon, not a flat fill.
 */
export function Atmosphere({ variant = 'page', className = '', children }: AtmosphereProps) {
  const isDark = variant === 'hero' || variant === 'auth'

  return (
    <div
      className={`relative isolate overflow-hidden ${className}`}
      data-testid="product-atmosphere"
      data-variant={variant}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            variant === 'page' ? productAtmosphere.page : productAtmosphere.hero,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg width=\'64\' height=\'64\' viewBox=\'0 0 64 64\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.045\'%3E%3Cpath d=\'M32 4l1.2 3.2L36.4 8.4l-3.2 1.2L32 12.8l-1.2-3.2L27.6 8.4l3.2-1.2z\'/%3E%3C/g%3E%3C/svg%3E")',
        }}
        aria-hidden
      />
      <div
        className={`product-atmosphere-drift pointer-events-none absolute -start-20 top-8 h-64 w-64 rounded-full blur-3xl ${
          isDark ? 'bg-sky-400/25' : 'bg-primary-400/15'
        }`}
        aria-hidden
      />
      <div
        className={`product-atmosphere-drift product-atmosphere-drift-delayed pointer-events-none absolute -end-16 bottom-0 h-72 w-72 rounded-full blur-3xl ${
          isDark ? 'bg-cyan-300/15' : 'bg-sky-300/20'
        }`}
        aria-hidden
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
