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
      <div className="mt-2.5 flex items-center gap-2.5 text-[13.5px] text-[var(--bilamo-text)]/85">
        <span className="tabular-nums tracking-[-0.01em]">{departTime}</span>
        <ArrowRight className="h-3 w-3 text-[var(--bilamo-muted)]/70" strokeWidth={1.75} />
        <span className="tabular-nums tracking-[-0.01em]">{arriveTime}</span>
      </div>
    </SearchResult>
  )
}
