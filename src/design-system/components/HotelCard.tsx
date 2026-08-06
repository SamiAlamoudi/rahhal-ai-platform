import { MapPin, Star } from 'lucide-react'
import { SearchResult } from './SearchResult'

export interface HotelCardProps {
  name: string
  area: string
  rating: number
  nightsLabel: string
  priceLabel: string
  highlighted?: boolean
  reason?: string
  onSelect?: () => void
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
  className,
}: HotelCardProps) {
  return (
    <SearchResult
      title={name}
      priceLabel={priceLabel}
      highlighted={highlighted}
      reason={reason}
      onSelect={onSelect}
      className={className}
      meta={nightsLabel}
    >
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-[var(--bilamo-muted)]/90">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" strokeWidth={1.75} />
          {area}
        </span>
        <span className="inline-flex items-center gap-1">
          <Star className="h-3 w-3 text-[var(--bilamo-secondary)]" strokeWidth={1.75} />
          {rating.toFixed(1)}
        </span>
      </div>
    </SearchResult>
  )
}
