import { useMemo } from 'react'
import type { ChatMessage } from '../../../lib/chat/chatTypes'
import {
  buildTravelCards,
  extractConversationUiMeta,
  type FlightCardModel,
  type HotelCardModel,
} from '../../../lib/chat/conversationExperienceUi'
import type { ProductLocale } from '../../../lib/productUx'
import { ConversationResults } from '../results/ConversationResults'

export interface NewExperienceResultsBridgeProps {
  message: ChatMessage
  locale?: ProductLocale
  isStreaming?: boolean
  onEditItinerary?: (patchText: string) => void
  onSmartAction?: (commandHint: string) => void
}

/**
 * Lazy-friendly bridge from chat messages → Sprint A conversational results.
 * Conversation-first: only structured offers after the traveler is understood.
 */
export function NewExperienceResultsBridge({
  message,
  locale = 'ar',
  isStreaming = false,
  onEditItinerary,
  onSmartAction,
}: NewExperienceResultsBridgeProps) {
  const seed =
    (typeof message.providerMeta?.userSeed === 'string' && message.providerMeta.userSeed)
    || message.content
    || ''

  const view = useMemo(() => {
    const meta = extractConversationUiMeta(message.providerMeta)
    const fromStructured = meta.structured
      ? buildTravelCards(meta.structured, { locale })
      : []
    const flights = fromStructured.filter((c): c is FlightCardModel => c.kind === 'flight')
    const hotels = fromStructured.filter((c): c is HotelCardModel => c.kind === 'hotel')

    const lower = seed.toLowerCase()
    const wantsPlan = /خط[ةه]|itinerary|خطة|أوافق|accept|اقبل/.test(seed)
    const wantsDisruption = /تعطيل|تأخير|delay|disrupt|إلغاء رحلة/.test(seed)
    const wantsConfirm = /احجز|أكد|book|confirm|ادفع/.test(seed)

    const hasStructuredOffers = flights.length > 0 || hotels.length > 0
      || Boolean(meta.structured?.dailyItinerary?.length)

    return {
      flights,
      hotels,
      destinations: [] as { id: string; name: string; reason: string }[],
      showItinerary: hasStructuredOffers && (
        wantsPlan || Boolean(meta.structured?.dailyItinerary?.length)
      ),
      showConfirmation: hasStructuredOffers && wantsConfirm,
      disruptionRecommendation: hasStructuredOffers && wantsDisruption
        ? locale === 'ar'
          ? 'أنقل حجوزاتك إلى الرحلة التالية المتاحة مع الحفاظ على الفندق نفسه.'
          : 'Move bookings to the next available flight while keeping the same hotel.'
        : null,
      mapLabel: hasStructuredOffers && /خريطة|map|eta|وصول/i.test(lower)
        ? locale === 'ar'
          ? 'المطار → الفندق'
          : 'Airport → hotel'
        : null,
      mapEta: hasStructuredOffers && /خريطة|map|eta|وصول/i.test(lower)
        ? locale === 'ar'
          ? '٣٥ دقيقة'
          : '35 min'
        : null,
    }
  }, [locale, message.providerMeta, seed])

  if (isStreaming && !message.content) return null
  if (
    view.flights.length === 0
    && view.hotels.length === 0
    && !view.showItinerary
    && !view.showConfirmation
    && !view.disruptionRecommendation
    && !view.mapLabel
  ) {
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
