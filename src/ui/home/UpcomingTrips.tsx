/**
 * Sprint 121 — Upcoming trips section.
 */

import { UiStack, UiText } from '../common'
import { EmptyState } from '../loading'
import { HomeSection } from './HomeSection'
import { homeCardStyle, homeColors, homeMotion } from './homeTheme'
import type { HomeTripItem } from './RecentTripsCard'

export interface UpcomingTripsProps {
  trips: HomeTripItem[]
  onSelect: (id: string) => void
  emptyTitle?: string
  index?: number
}

export function UpcomingTrips({
  trips,
  onSelect,
  emptyTitle = 'لا توجد رحلات قادمة',
  index,
}: UpcomingTripsProps) {
  return (
    <HomeSection
      sectionId="upcoming_trips"
      title="الرحلات القادمة"
      description="ما هو قادم في جدول سفرك."
      index={index}
    >
      {!trips.length ? (
        <EmptyState title={emptyTitle} description="عندما تؤكد رحلة ستظهر هنا." />
      ) : (
        <UiStack gap="sm" role="list">
          {trips.map((trip) => (
            <button
              key={trip.id}
              type="button"
              role="listitem"
              onClick={() => onSelect(trip.id)}
              aria-label={`فتح الرحلة القادمة ${trip.title}`}
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
                  {trip.status}
                  {trip.totalLabel ? ` · ${trip.totalLabel}` : ''}
                </UiText>
              </UiStack>
            </button>
          ))}
        </UiStack>
      )}
    </HomeSection>
  )
}
