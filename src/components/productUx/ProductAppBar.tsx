import type { ReactNode } from 'react'
import { BrandMark } from './BrandMark'
import type { ProductLocale } from '../../lib/productUx'

export interface ProductAppBarProps {
  locale?: ProductLocale
  title: string
  subtitle?: string
  onBack?: () => void
  backLabel?: string
  trailing?: ReactNode
  leadingExtra?: ReactNode
  maxWidthClassName?: string
}

export function ProductAppBar({
  locale = 'ar',
  title,
  subtitle,
  onBack,
  backLabel = 'رجوع',
  trailing,
  leadingExtra,
  maxWidthClassName = 'max-w-4xl',
}: ProductAppBarProps) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/75"
      data-testid="product-app-bar"
    >
      <div
        className={`mx-auto flex items-center justify-between gap-3 px-4 py-3 sm:px-6 ${maxWidthClassName}`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label={backLabel}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ) : (
            <BrandMark locale={locale} size="sm" />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
            ) : null}
          </div>
          {leadingExtra}
        </div>
        {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
      </div>
    </header>
  )
}
