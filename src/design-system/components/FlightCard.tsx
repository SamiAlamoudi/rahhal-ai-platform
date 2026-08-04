import { ArrowRight } from 'lucide-react'
import { SearchResult } from './SearchResult'

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
  onSelect?: () => void
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
  onSelect,
  className,
}: FlightCardProps) {
  return (
    <SearchResult
      title={`${origin} → ${destination}`}
      subtitle={airline}
      priceLabel={priceLabel}
      highlighted={highlighted}
      reason={reason}
      onSelect={onSelect}
      className={className}
      meta={`${duration} · ${stopsLabel}`}
    >
      <div className="mt-3 flex items-center gap-3 text-sm text-[var(--bilamo-text)]">
        <span className="font-medium tabular-nums">{departTime}</span>
        <ArrowRight className="h-3.5 w-3.5 text-[var(--bilamo-muted)]" />
        <span className="font-medium tabular-nums">{arriveTime}</span>
      </div>
    </SearchResult>
  )
}
