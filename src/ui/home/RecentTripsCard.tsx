/**
 * Sprint 121 — Recent trips interactive list.
 */

import { UiStack, UiText } from '../common'
import { EmptyState } from '../loading'
import { HomeSection } from './HomeSection'
import { homeCardStyle, homeColors, homeMotion } from './homeTheme'

export interface HomeTripItem {
  id: string
  title: string
  status: string
  totalLabel: string
}

export interface RecentTripsCardProps {
  trips: HomeTripItem[]
  onSelect: (id: string) => void
  emptyTitle?: string
  index?: number
}

export function RecentTripsCard({
  trips,
  onSelect,
  emptyTitle = 'لا توجد رحلات حديثة',
  index,
}: RecentTripsCardProps) {
  return (
    <HomeSection
      sectionId="recent_trips"
      title="الرحلات الأخيرة"
      description="راجع حجوزاتك وتفاصيلها بسرعة."
      index={index}
    >
      {!trips.length ? (
        <EmptyState title={emptyTitle} description="ستظهر هنا رحلاتك بعد أول حجز." />
      ) : (
        <UiStack gap="sm" role="list">
          {trips.map((trip) => (
            <button
              key={trip.id}
              type="button"
              role="listitem"
              onClick={() => onSelect(trip.id)}
              aria-label={`فتح رحلة ${trip.title}`}
              style={{
                ...homeCardStyle({ interactive: true }),
                textAlign: 'start',
                cursor: 'pointer',
                font: 'inherit',
                boxShadow: 'none',
                background: homeColors.surface,
                transition: homeMotion.hover,
              }}
            >
              <UiStack gap="xs">
                <UiText as="span" weight="semibold" size="sm">
                  {trip.title}
                </UiText>
                <UiText as="span" size="xs" style={{ color: homeColors.fgMuted }}>
                  {trip.totalLabel}
                  {trip.status ? ` · ${trip.status}` : ''}
                </UiText>
              </UiStack>
            </button>
          ))}
        </UiStack>
      )}
    </HomeSection>
  )
}
