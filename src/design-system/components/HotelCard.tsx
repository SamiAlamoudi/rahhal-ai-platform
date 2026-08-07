import { SearchResult } from './SearchResult'
import { cn } from '../lib/cn'

export interface HotelCardProps {
  name: string
  area: string
  rating: number
  nightsLabel: string
  priceLabel: string
  highlighted?: boolean
  selected?: boolean
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
  selected = false,
  reason,
  onSelect,
  onViewDetails,
  locale = 'en',
  className,
}: HotelCardProps) {
  const labels = locale === 'ar'
    ? { select: 'اختيار', details: 'التفاصيل', selected: 'تم الاختيار' }
    : { select: 'Select', details: 'View details', selected: 'Selected' }
  const showActions = Boolean(onSelect || onViewDetails)

  return (
    <div className={cn('space-y-0.5', className)}>
      <SearchResult
        title={name}
        priceLabel={priceLabel}
        highlighted={highlighted && !selected}
        selected={selected}
        reason={reason}
        interactive={false}
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
              disabled={selected}
              className="text-[12px] tracking-[-0.01em] text-[var(--bilamo-text)]/75 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bilamo-secondary)] disabled:opacity-60 disabled:no-underline"
            >
              {selected ? labels.selected : labels.select}
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
