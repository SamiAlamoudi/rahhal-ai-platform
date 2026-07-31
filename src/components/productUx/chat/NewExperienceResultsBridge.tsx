import { useMemo } from 'react'
import type { ChatMessage } from '../../../lib/chat/chatTypes'
import {
  buildTravelCards,
  extractConversationUiMeta,
  type FlightCardModel,
  type HotelCardModel,
} from '../../../lib/chat/conversationExperienceUi'
import {
  destinationMatches,
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
      if (!flights.length) {
        // Never invent price 0 — only map provider-backed flights with real totals.
        flights = (plan.flights || [])
          .filter((f) => f.fromProvider && f.estimatedCost != null && f.estimatedCost > 0 && f.airline)
          .slice(0, 6)
          .map((f, i) => ({
            kind: 'flight' as const,
            id: f.id || `plan-flight-${i}`,
            airline: f.airline!,
            logoLabel: f.airline!.slice(0, 2).toUpperCase(),
            departure: locale === 'ar' ? 'مغادرة' : 'DEP',
            arrival: locale === 'ar' ? 'وصول' : 'ARR',
            durationLabel: f.durationMinutes != null
              ? (locale === 'ar'
                ? `${Math.floor(f.durationMinutes / 60)}س ${f.durationMinutes % 60}د`
                : `${Math.floor(f.durationMinutes / 60)}h ${f.durationMinutes % 60}m`)
              : '—',
            stops: f.stops ?? 0,
            baggage: locale === 'ar' ? 'حقيبة مقصورة' : 'Cabin bag',
            refundPolicy: locale === 'ar' ? 'حسب الأجرة' : 'Per fare',
            changePolicy: locale === 'ar' ? 'تغيير برسوم' : 'Changes may apply',
            fareFamily: locale === 'ar' ? 'اقتصادية' : 'Economy',
            price: f.estimatedCost as number,
            currency: f.currency || 'SAR',
            loyaltyPoints: 0,
          }))
      }
      if (!hotels.length) {
        hotels = (plan.accommodations || [])
          .filter((h) => h.fromProvider && h.estimatedNightly != null && h.estimatedNightly > 0 && h.name)
          .slice(0, 3)
          .map((h, i) => ({
            kind: 'hotel' as const,
            id: `plan-hotel-${i}`,
            name: h.name.replace(/\bMock\s*Hotel\b/gi, 'City Hotel'),
            photos: [],
            mapQuery: h.name,
            stars: 4,
            rating: 8,
            reviewsLabel: h.area || '',
            roomTypes: [],
            breakfast: '',
            cancellationPolicy: '',
            refundPolicy: '',
            loyaltyRewards: '',
            price: h.estimatedNightly as number,
            currency: h.currency || 'SAR',
            area: h.area || '',
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
