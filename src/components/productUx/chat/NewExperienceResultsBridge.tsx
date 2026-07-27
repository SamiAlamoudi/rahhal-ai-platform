import { useMemo } from 'react'
import type { ChatMessage } from '../../../lib/chat/chatTypes'
import {
  buildTravelCards,
  extractConversationUiMeta,
  type FlightCardModel,
  type HotelCardModel,
} from '../../../lib/chat/conversationExperienceUi'
import {
  buildResultCardsFromTripPlan,
  destinationMatches,
  resultCardMeta,
  resultCardSubtitle,
  resultCardTitle,
} from '../../../lib/premiumExperience'
import type { ProductLocale } from '../../../lib/productUx'
import { ConversationResults } from '../results/ConversationResults'
import { tripPlanFromMeta } from '../../../lib/agent/memory'

export interface NewExperienceResultsBridgeProps {
  message: ChatMessage
  locale?: ProductLocale
  isStreaming?: boolean
  onEditItinerary?: (patchText: string) => void
  onSmartAction?: (commandHint: string) => void
}

/**
 * Conversation-first results bridge.
 * Cards only after the reply finishes, and only from this turn's trip plan / structured meta.
 * No demo Riyadh→Dubai seeds.
 */
export function NewExperienceResultsBridge({
  message,
  locale = 'ar',
  isStreaming = false,
  onEditItinerary,
  onSmartAction,
}: NewExperienceResultsBridgeProps) {
  const view = useMemo(() => {
    if (isStreaming || message.status === 'streaming') {
      return {
        flights: [] as FlightCardModel[],
        hotels: [] as HotelCardModel[],
        destinations: [] as Array<{ id: string; name: string; reason: string }>,
        showItinerary: false,
        showConfirmation: false,
        disruptionRecommendation: null as string | null,
        mapLabel: null as string | null,
        mapEta: null as string | null,
      }
    }

    const meta = extractConversationUiMeta(message.providerMeta)
    const memory = message.providerMeta?.memory as
      | { requirements?: { destination?: string | null; destinations?: string[] } }
      | undefined
    const destinationHint =
      memory?.requirements?.destination
      || memory?.requirements?.destinations?.[0]
      || null

    const fromStructured = meta.structured
      ? buildTravelCards(meta.structured, { locale })
      : []
    let flights = fromStructured.filter((c): c is FlightCardModel => c.kind === 'flight')
    let hotels = fromStructured.filter((c): c is HotelCardModel => c.kind === 'hotel')

    const plan = tripPlanFromMeta(message.providerMeta)
    if ((!flights.length || !hotels.length) && plan) {
      const fromPlan = buildResultCardsFromTripPlan(plan, {
        destinationHint: destinationHint || plan.destinations?.[0],
        limit: 6,
      })
      if (!flights.length) {
        flights = fromPlan
          .filter((c) => c.kind === 'flight')
          .map((c, i) => ({
            kind: 'flight' as const,
            id: c.id || `plan-flight-${i}`,
            airline: resultCardTitle(c, locale),
            logoLabel: resultCardTitle(c, locale).slice(0, 2).toUpperCase(),
            departure: locale === 'ar' ? 'مغادرة' : 'DEP',
            arrival: locale === 'ar' ? 'وصول' : 'ARR',
            durationLabel: resultCardMeta(c, locale) || '—',
            stops: 0,
            baggage: locale === 'ar' ? 'حقيبة مقصورة' : 'Cabin bag',
            refundPolicy: locale === 'ar' ? 'حسب الأجرة' : 'Per fare',
            changePolicy: locale === 'ar' ? 'تغيير برسوم' : 'Changes may apply',
            fareFamily: locale === 'ar' ? 'اقتصادية' : 'Economy',
            price: 0,
            currency: 'SAR',
            loyaltyPoints: 0,
          }))
      }
      if (!hotels.length) {
        hotels = fromPlan
          .filter((c) => c.kind === 'hotel')
          .map((c, i) => ({
            kind: 'hotel' as const,
            id: c.id || `plan-hotel-${i}`,
            name: resultCardTitle(c, locale),
            photos: [],
            mapQuery: resultCardTitle(c, locale),
            stars: 4,
            rating: 8,
            reviewsLabel: resultCardSubtitle(c, locale),
            roomTypes: [],
            breakfast: '',
            cancellationPolicy: '',
            refundPolicy: '',
            loyaltyRewards: '',
            price: 0,
            currency: 'SAR',
            area: resultCardMeta(c, locale) || resultCardSubtitle(c, locale),
          }))
      }
    }

    if (destinationHint) {
      const dropUnrelated = (blob: string) => {
        // If traveler asked for Morocco, drop obvious Dubai/Riyadh demo leftovers.
        if (destinationMatches(destinationHint, 'morocco')) {
          return !/dxb|dubai|دبي|ruh →|riyadh →|الرياض →/i.test(blob)
        }
        return destinationMatches(blob, destinationHint) || destinationMatches(destinationHint, blob)
      }
      flights = flights.filter((f) => dropUnrelated(`${f.airline} ${f.arrival} ${f.departure} ${f.id}`))
      hotels = hotels.filter((h) => dropUnrelated(`${h.name} ${h.area} ${h.id}`))
    }

    const destinations =
      destinationHint
        ? [
            {
              id: 'dest-live',
              name: destinationHint,
              reason:
                locale === 'ar'
                  ? 'من هذه المحادثة فقط'
                  : 'From this conversation only',
            },
          ]
        : []

    return {
      flights,
      hotels,
      destinations,
      showItinerary: Boolean(meta.structured?.dailyItinerary?.length || plan?.dailyItinerary?.length),
      showConfirmation: false,
      disruptionRecommendation: null as string | null,
      mapLabel: null as string | null,
      mapEta: null as string | null,
    }
  }, [isStreaming, locale, message.providerMeta, message.status])

  if (isStreaming || message.status === 'streaming') return null
  if (!view.flights.length && !view.hotels.length && !view.destinations.length && !view.showItinerary) {
    return null
  }

  return (
    <ConversationResults
      locale={locale}
      flights={view.flights}
      hotels={view.hotels}
      destinations={view.destinations}
      showItinerary={view.showItinerary}
      showConfirmation={view.showConfirmation}
      disruptionRecommendation={view.disruptionRecommendation}
      mapLabel={view.mapLabel}
      mapEta={view.mapEta}
      onEditItinerary={
        onEditItinerary
          ? () => onEditItinerary(locale === 'ar' ? 'عدّل اليوم الثاني' : 'Adjust day 2')
          : undefined
      }
      onSelectFlight={(id) => onSmartAction?.(`select flight ${id}`)}
      onSelectHotel={(id) => onSmartAction?.(`select hotel ${id}`)}
      onConfirmAction={() =>
        onSmartAction?.(locale === 'ar' ? 'أؤكد المعاينة فقط' : 'confirm preview only')
      }
    />
  )
}

export default NewExperienceResultsBridge
