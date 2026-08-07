import { SearchResult } from './SearchResult'
import { cn } from '../lib/cn'

export interface HotelCardProps {
  name: string
  area: string
  rating: number
  nightsLabel: string
  priceLabel: string
  highlighted?: boolean
  reason?: string
  onSelect?: () => void
  onViewDetails?: () => void
  locale?: 'ar' | 'en'
  className?: string
}

export function HotelCard({
  name,
  area,
  rating,
  nightsLabel,
  priceLabel,
  highlighted,
  reason,
  onSelect,
  onViewDetails,
  locale = 'en',
  className,
}: HotelCardProps) {
  const labels = locale === 'ar'
    ? { select: 'اختيار', details: 'التفاصيل' }
    : { select: 'Select', details: 'View details' }
  const showActions = Boolean(onSelect || onViewDetails)

  return (
    <div className={cn('space-y-0.5', className)}>
      <SearchResult
        title={name}
        priceLabel={priceLabel}
        highlighted={highlighted}
        reason={reason}
        onSelect={onSelect}
        subtitle={`${area} · ${rating.toFixed(1)}`}
        meta={nightsLabel}
      />
      {showActions ? (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pb-2"
          role="group"
          aria-label={`${name} stay actions`}
        >
          {onSelect ? (
            <button
              type="button"
              onClick={onSelect}
              className="text-[12px] tracking-[-0.01em] text-[var(--bilamo-text)]/75 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bilamo-secondary)]"
            >
              {labels.select}
            </button>
          ) : null}
          {onViewDetails ? (
            <button
              type="button"
              onClick={onViewDetails}
              className="text-[12px] tracking-[-0.01em] text-[var(--bilamo-muted)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bilamo-secondary)]"
            >
              {labels.details}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
