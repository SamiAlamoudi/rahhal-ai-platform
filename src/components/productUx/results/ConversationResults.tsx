import {
  budgetFromBreakdown,
  demoActionConfirmation,
  demoItinerary,
  flightResultFromModel,
  hotelResultFromModel,
  type ActiveTripContext,
  type ProductLocale,
} from '../../../lib/productUx'
import type { FlightCardModel, HotelCardModel } from '../../../lib/chat/conversationExperienceUi'
import type { CostBreakdown } from '../../../lib/agent/integrationBudgetPricing/types'
import { FlightResultCard } from './FlightResultCard'
import { HotelResultCard } from './HotelResultCard'
import { DestinationResultCard } from './DestinationResultCard'
import { BudgetBreakdownCard } from './BudgetBreakdownCard'
import { ItineraryTimeline } from './ItineraryTimeline'
import { ActionConfirmationCard } from './ActionConfirmationCard'
import { DisruptionRecoveryCard } from './DisruptionRecoveryCard'
import { MapEtaCard } from './MapEtaCard'

export interface ConversationResultsProps {
  locale?: ProductLocale
  trip?: ActiveTripContext | null
  clarification?: string | null
  flights?: FlightCardModel[]
  hotels?: HotelCardModel[]
  destinations?: { id: string; name: string; reason: string }[]
  budget?: CostBreakdown | null
  totalBudget?: number | null
  showItinerary?: boolean
  showConfirmation?: boolean
  disruptionRecommendation?: string | null
  mapLabel?: string | null
  mapEta?: string | null
  onSelectFlight?: (id: string) => void
  onSelectHotel?: (id: string) => void
  onConfirmAction?: () => void
  onEditItinerary?: () => void
}

/**
 * Progressive conversational results — concise first, details on expand.
 * Presentation only; reuses existing normalized models.
 */
export function ConversationResults({
  locale = 'ar',
  trip = null,
  clarification = null,
  flights = [],
  hotels = [],
  destinations = [],
  budget = null,
  totalBudget = null,
  showItinerary = false,
  showConfirmation = false,
  disruptionRecommendation = null,
  mapLabel = null,
  mapEta = null,
  onSelectFlight,
  onSelectHotel,
  onConfirmAction,
  onEditItinerary,
}: ConversationResultsProps) {
  if (clarification) {
    return (
      <div
        className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        data-testid="trip-city-clarification"
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        role="status"
      >
        {clarification}
      </div>
    )
  }

  const flightViews = flights.slice(0, 3).map((f, i) =>
    flightResultFromModel(
      f,
      locale,
      i === 0 ? 'recommended' : i === 1 ? 'best_value' : 'cheapest',
    ),
  )
  const hotelViews = hotels.slice(0, 2).map((h) => hotelResultFromModel(h, locale))
  const resolvedBudget =
    budget
    ?? (trip?.budgetSar != null
      ? ({
          currency: 'SAR',
          estimatedTotal: Math.round(trip.budgetSar * 0.84),
          flights: Math.round(trip.budgetSar * 0.35),
          hotels: Math.round(trip.budgetSar * 0.3),
          transportation: Math.round(trip.budgetSar * 0.08),
          meals: Math.round(trip.budgetSar * 0.1),
          activities: Math.round(trip.budgetSar * 0.07),
          reserveHeld: Math.round(trip.budgetSar * 0.1),
          withinBudget: true,
          overBy: 0,
        } as CostBreakdown)
      : null)

  return (
    <div className="mt-3 space-y-3" data-testid="conversation-results" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {destinations.map((d) => (
        <DestinationResultCard key={d.id} destination={d} locale={locale} />
      ))}
      {flightViews.map((f) => (
        <FlightResultCard key={f.id} flight={f} locale={locale} onSelect={onSelectFlight} />
      ))}
      {hotelViews.map((h) => (
        <HotelResultCard key={h.id} hotel={h} locale={locale} onSelect={onSelectHotel} />
      ))}
      {resolvedBudget ? (
        <BudgetBreakdownCard
          budget={budgetFromBreakdown(resolvedBudget, {
            totalBudget: totalBudget ?? trip?.budgetSar ?? null,
            locale,
          })}
          locale={locale}
        />
      ) : null}
      {mapLabel && mapEta ? (
        <MapEtaCard locale={locale} label={mapLabel} etaLabel={mapEta} />
      ) : null}
      {showItinerary ? (
        <ItineraryTimeline
          days={demoItinerary(locale, trip)}
          locale={locale}
          onEditViaChat={onEditItinerary}
        />
      ) : null}
      {disruptionRecommendation ? (
        <DisruptionRecoveryCard locale={locale} recommendation={disruptionRecommendation} />
      ) : null}
      {showConfirmation ? (
        <ActionConfirmationCard
          confirmation={demoActionConfirmation(locale, trip)}
          locale={locale}
          onConfirm={onConfirmAction}
        />
      ) : null}
    </div>
  )
}

export default ConversationResults
