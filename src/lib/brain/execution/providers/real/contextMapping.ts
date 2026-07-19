/**
 * Sprint 26 — map ProviderSearchContext → AggregationQuery for Phase W adapters.
 */

import type { AggregationQuery } from '../../../../agent/aggregation/types'
import type { ProviderSearchContext } from '../../types'

export function contextToAggregationQuery(
  domain: 'flights' | 'hotels',
  ctx: ProviderSearchContext,
): AggregationQuery {
  const m = ctx.task.metadata
  const durationDays =
    ctx.tripPlan.travelDates.durationDays ??
    (m.startDate && m.endDate
      ? Math.max(
          1,
          Math.round(
            (Date.parse(m.endDate) - Date.parse(m.startDate)) / 86_400_000,
          ),
        )
      : 5)

  return {
    domain,
    locale: ctx.tripPlan.locale === 'en' ? 'en' : 'ar',
    signal: ctx.signal,
    input: {
      destination: m.destination ?? ctx.tripPlan.destination ?? 'Dubai',
      departureCity: m.departureCity ?? ctx.tripPlan.departureCity ?? 'Riyadh',
      departureDate: m.startDate ?? ctx.tripPlan.travelDates.startDate ?? null,
      returnDate: m.endDate ?? ctx.tripPlan.travelDates.endDate ?? null,
      durationDays,
      adults: m.adults ?? ctx.tripPlan.adults ?? 1,
      children: m.children ?? ctx.tripPlan.children ?? 0,
      infants: m.infants ?? ctx.tripPlan.infants ?? 0,
      preferredCabin: m.cabinClass ?? ctx.tripPlan.cabinClass ?? 'economy',
      preferredAirlines: m.preferredAirlines ?? ctx.tripPlan.airlinePreferences ?? [],
      preferredHotels: m.preferredHotels ?? ctx.tripPlan.hotelPreferences ?? [],
      budgetAmount: m.budgetAmount ?? ctx.tripPlan.budget.amount ?? null,
      budgetCurrency: m.currency ?? ctx.tripPlan.budget.currency ?? 'SAR',
    },
  }
}
