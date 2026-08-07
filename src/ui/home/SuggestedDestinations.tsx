/**
 * Sprint 121 — Suggested destinations chips (from production memory data).
 */

import { EmptyState } from '../loading'
import { spacing } from '../tokens'
import { HomeSection } from './HomeSection'
import { homeChipStyle, homeColors } from './homeTheme'

export interface SuggestedDestinationsProps {
  destinations: string[]
  onSelect: (destination: string) => void
  emptyTitle?: string
  index?: number
}

export function SuggestedDestinations({
  destinations,
  onSelect,
  emptyTitle = 'لا توجد وجهات مقترحة بعد',
  index,
}: SuggestedDestinationsProps) {
  return (
    <HomeSection
      sectionId="suggested_destinations"
      title="وجهات مقترحة لك"
      description="مبنية على تفضيلاتك وسجل سفرك."
      index={index}
    >
      {!destinations.length ? (
        <EmptyState
          title={emptyTitle}
          description="بعد بضع محادثات أو رحلات سيقترح بيلامو وجهات مناسبة."
        />
      ) : (
        <div
          role="list"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: spacing.sm,
          }}
        >
          {destinations.map((destination) => (
            <button
              key={destination}
              type="button"
              role="listitem"
              onClick={() => onSelect(destination)}
              aria-label={`خطط رحلة إلى ${destination}`}
              style={homeChipStyle()}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = homeColors.brand
                e.currentTarget.style.color = '#ffffff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = homeColors.brandSoft
                e.currentTarget.style.color = homeColors.fg
              }}
            >
              {destination}
            </button>
          ))}
        </div>
      )}
    </HomeSection>
  )
}
