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
      subtitle={`${area} · ${rating.toFixed(1)}`}
      meta={nightsLabel}
    />
  )
}
