/**
 * Sprint 121 — Featured experiences derived from travel history summary.
 * Presentation only — parents pass real history fields; no invented content.
 */

import { UiStack, UiText } from '../common'
import { EmptyState } from '../loading'
import { HomeSection } from './HomeSection'
import { homeCardStyle, homeColors } from './homeTheme'

export interface FeaturedExperienceItem {
  id: string
  label: string
  value: string
}

export interface FeaturedExperiencesProps {
  items: FeaturedExperienceItem[]
  index?: number
}

export function FeaturedExperiences({ items, index }: FeaturedExperiencesProps) {
  return (
    <HomeSection
      sectionId="featured_experiences"
      title="من تجربتك"
      description="ملخص سريع من سجل سفرك الحقيقي."
      index={index}
    >
      {!items.length ? (
        <EmptyState
          title="لا توجد تجارب محفوظة بعد"
          description="سيُبنى هذا القسم من رحلاتك الفعلية."
        />
      ) : (
        <div
          role="list"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              role="listitem"
              style={{
                ...homeCardStyle(),
                boxShadow: 'none',
                background: homeColors.surface,
              }}
            >
              <UiStack gap="xs">
                <UiText size="xs" style={{ color: homeColors.fgMuted }}>
                  {item.label}
                </UiText>
                <UiText size="md" weight="semibold">
                  {item.value}
                </UiText>
              </UiStack>
            </div>
          ))}
        </div>
      )}
    </HomeSection>
  )
}

/** Map travel history fields into featured items — no fabricated values. */
export function featuredItemsFromHistory(history: {
  favoriteCity?: string | null
  mostVisitedCountry?: string | null
  favoriteAirline?: string | null
  favoriteHotelChain?: string | null
  tripCount?: number
  averageTripCost?: number | null
  currency?: string | null
} | null): FeaturedExperienceItem[] {
  if (!history) return []
  const items: FeaturedExperienceItem[] = []
  if (history.favoriteCity) {
    items.push({ id: 'city', label: 'مدينتك المفضلة', value: history.favoriteCity })
  }
  if (history.mostVisitedCountry) {
    items.push({
      id: 'country',
      label: 'أكثر بلد زرته',
      value: history.mostVisitedCountry,
    })
  }
  if (history.favoriteAirline) {
    items.push({ id: 'airline', label: 'شركة الطيران المفضلة', value: history.favoriteAirline })
  }
  if (history.favoriteHotelChain) {
    items.push({
      id: 'hotel',
      label: 'سلسلة الفنادق المفضلة',
      value: history.favoriteHotelChain,
    })
  }
  if (typeof history.tripCount === 'number' && history.tripCount > 0) {
    items.push({ id: 'trips', label: 'عدد الرحلات', value: String(history.tripCount) })
  }
  if (
    typeof history.averageTripCost === 'number'
    && history.averageTripCost > 0
  ) {
    const currency = history.currency || ''
    items.push({
      id: 'avg_cost',
      label: 'متوسط تكلفة الرحلة',
      value: `${history.averageTripCost} ${currency}`.trim(),
    })
  }
  return items
}
