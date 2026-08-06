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
      <div className="mt-2 flex items-center gap-2 text-[12.5px] text-[var(--bilamo-muted)]">
        <span className="tabular-nums">{departTime}</span>
        <ArrowRight className="h-3 w-3 opacity-50" strokeWidth={1.5} />
        <span className="tabular-nums">{arriveTime}</span>
      </div>
    </SearchResult>
  )
}
