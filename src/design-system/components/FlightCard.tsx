import { ArrowRight } from 'lucide-react'
import { SearchResult } from './SearchResult'
import { cn } from '../lib/cn'

export interface FlightCardProps {
  airline: string
  origin: string
  destination: string
  departTime: string
  arriveTime: string
  duration: string
  stopsLabel: string
  priceLabel: string
  highlighted?: boolean
  reason?: string
  /** Quiet role label: Best overall / Lowest price / Fastest */
  kindLabel?: string | null
  /** Bilamo Score 0–100 */
  score?: number | null
  baggageSummary?: string | null
  onSelect?: () => void
  onCompare?: () => void
  onViewDetails?: () => void
  /** Traveler has chosen this option. */
  selected?: boolean
  /** Action labels locale — defaults to English. */
  locale?: 'ar' | 'en'
  className?: string
}

export function FlightCard({
  airline,
  origin,
  destination,
  departTime,
  arriveTime,
  duration,
  stopsLabel,
  priceLabel,
  highlighted,
  reason,
  kindLabel,
  score,
  baggageSummary,
  onSelect,
  onCompare,
  onViewDetails,
  selected = false,
  locale = 'en',
  className,
}: FlightCardProps) {
  const labels = locale === 'ar'
    ? { select: 'اختيار', compare: 'مقارنة', details: 'التفاصيل', selected: 'تم الاختيار' }
    : { select: 'Select', compare: 'Compare', details: 'View details', selected: 'Selected' }
  const metaParts = [
    duration,
    stopsLabel,
    baggageSummary ? `Bag ${baggageSummary}` : null,
    score != null && (highlighted || selected) ? `Score ${score}` : null,
  ].filter(Boolean)

  const showActions = Boolean(onSelect || onCompare || onViewDetails)

  return (
    <div className={cn('space-y-0.5', className)}>
      <SearchResult
        title={kindLabel && (highlighted || selected) ? kindLabel : `${origin} → ${destination}`}
        subtitle={
          kindLabel && (highlighted || selected)
            ? `${airline} · ${origin} → ${destination}`
            : airline
        }
        priceLabel={priceLabel}
        highlighted={highlighted && !selected}
        selected={selected}
        reason={reason}
        interactive={false}
        meta={metaParts.join(' · ')}
      >
        <div className="mt-2 flex items-center gap-2 text-[12.5px] text-[var(--bilamo-muted)]">
          <span className="tabular-nums">{departTime}</span>
          <ArrowRight className="h-3 w-3 opacity-50" strokeWidth={1.5} aria-hidden />
          <span className="tabular-nums">{arriveTime}</span>
        </div>
      </SearchResult>
      {showActions ? (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pb-2"
          role="group"
          aria-label={`${airline} flight actions`}
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
          {onCompare ? (
            <button
              type="button"
              onClick={onCompare}
              className="text-[12px] tracking-[-0.01em] text-[var(--bilamo-muted)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bilamo-secondary)]"
            >
              {labels.compare}
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
