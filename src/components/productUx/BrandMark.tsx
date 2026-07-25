import { productBrand, productBrandName, type ProductLocale } from '../../lib/productUx'

export type BrandMarkSize = 'sm' | 'md' | 'lg' | 'hero'

const SIZE: Record<BrandMarkSize, { box: string; icon: string; title: string }> = {
  sm: { box: 'h-8 w-8 rounded-lg', icon: 'h-4 w-4', title: 'text-base' },
  md: { box: 'h-10 w-10 rounded-xl', icon: 'h-5 w-5', title: 'text-lg' },
  lg: { box: 'h-12 w-12 rounded-2xl', icon: 'h-6 w-6', title: 'text-2xl' },
  hero: { box: 'h-14 w-14 rounded-2xl sm:h-16 sm:w-16', icon: 'h-7 w-7 sm:h-8 sm:w-8', title: 'text-4xl sm:text-5xl' },
}

export interface BrandMarkProps {
  locale?: ProductLocale
  size?: BrandMarkSize
  /** Show wordmark beside / under the mark */
  withName?: boolean
  /** Invert for dark atmospheric backgrounds */
  inverted?: boolean
  stacked?: boolean
  className?: string
}

export function BrandMark({
  locale = 'ar',
  size = 'md',
  withName = false,
  inverted = false,
  stacked = false,
  className = '',
}: BrandMarkProps) {
  const s = SIZE[size]
  const name = productBrandName(locale)

  return (
    <div
      className={`inline-flex ${stacked ? 'flex-col items-center gap-3' : 'items-center gap-2.5'} ${className}`}
      data-testid="product-brand-mark"
    >
      <span
        className={`inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-primary-500 to-primary-800 text-white shadow-lg shadow-primary-900/25 ${s.box}`}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className={s.icon} fill="currentColor">
          <path d={productBrand.markPath} />
        </svg>
      </span>
      {withName ? (
        <span
          className={`font-bold tracking-tight ${s.title} ${
            inverted ? 'text-white' : 'text-slate-900'
          }`}
        >
          {name}
        </span>
      ) : (
        <span className="sr-only">{name}</span>
      )}
    </div>
  )
}
