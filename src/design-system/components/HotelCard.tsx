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
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--bilamo-muted)]">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {area}
        </span>
        <span className="inline-flex items-center gap-1">
          <Star className="h-3.5 w-3.5 text-[var(--bilamo-secondary)]" />
          {rating.toFixed(1)}
        </span>
      </div>
    </SearchResult>
  )
}
