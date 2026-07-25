import {
  budgetFromBreakdown,
  demoActionConfirmation,
  demoItinerary,
  flightResultFromModel,
  hotelResultFromModel,
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
  const flightViews = flights.slice(0, 3).map((f, i) =>
    flightResultFromModel(
      f,
      locale,
      i === 0 ? 'recommended' : i === 1 ? 'best_value' : 'cheapest',
    ),
  )
  const hotelViews = hotels.slice(0, 2).map((h) => hotelResultFromModel(h, locale))

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
      {budget ? (
        <BudgetBreakdownCard
          budget={budgetFromBreakdown(budget, { totalBudget, locale })}
          locale={locale}
        />
      ) : null}
      {mapLabel && mapEta ? (
        <MapEtaCard locale={locale} label={mapLabel} etaLabel={mapEta} />
      ) : null}
      {showItinerary ? (
        <ItineraryTimeline
          days={demoItinerary(locale)}
          locale={locale}
          onEditViaChat={onEditItinerary}
        />
      ) : null}
      {disruptionRecommendation ? (
        <DisruptionRecoveryCard locale={locale} recommendation={disruptionRecommendation} />
      ) : null}
      {showConfirmation ? (
        <ActionConfirmationCard
          confirmation={demoActionConfirmation(locale)}
          locale={locale}
          onConfirm={onConfirmAction}
        />
      ) : null}
    </div>
  )
}

export default ConversationResults
