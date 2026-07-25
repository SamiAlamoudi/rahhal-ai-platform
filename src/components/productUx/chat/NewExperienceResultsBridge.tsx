import { useMemo } from 'react'
import type { ChatMessage } from '../../../lib/chat/chatTypes'
import {
  buildTravelCards,
  extractConversationUiMeta,
  type FlightCardModel,
  type HotelCardModel,
} from '../../../lib/chat/conversationExperienceUi'
import {
  buildDynamicResultCards,
  inferTravelRouteFromSeed,
  resultCardMeta,
  resultCardSubtitle,
  resultCardTitle,
} from '../../../lib/premiumExperience'
import type { ProductLocale } from '../../../lib/productUx'
import { ConversationResults } from '../results/ConversationResults'

export interface NewExperienceResultsBridgeProps {
  message: ChatMessage
  locale?: ProductLocale
  isStreaming?: boolean
  onEditItinerary?: (patchText: string) => void
  onSmartAction?: (commandHint: string) => void
}

function seedFlights(seed: string, locale: ProductLocale): FlightCardModel[] {
  const route = inferTravelRouteFromSeed(seed)
  const departure =
    locale === 'ar' ? route.originAr : (route.originCode ?? route.originEn)
  const arrival =
    locale === 'ar' ? route.destinationAr : (route.destinationCode ?? route.destinationEn)
  const cards = buildDynamicResultCards(seed, 3)
  return cards
    .filter((c) => c.kind === 'flight')
    .slice(0, 2)
    .map((c, i) => {
      const subtitle = resultCardSubtitle(c, locale)
      const airline = locale === 'ar' ? 'رحلة مقترحة' : 'Suggested flight'
      return {
        kind: 'flight' as const,
        id: c.id || `seed-flight-${i}`,
        airline,
        logoLabel: airline.slice(0, 2).toUpperCase(),
        departure,
        arrival,
        durationLabel: resultCardMeta(c, locale) || '—',
        stops: /مباشر|direct|nonstop/i.test(subtitle) ? 0 : 1,
        baggage: locale === 'ar' ? 'حقيبة مقصورة' : 'Cabin bag',
        refundPolicy: locale === 'ar' ? 'حسب الأجرة' : 'Per fare',
        changePolicy: locale === 'ar' ? 'تغيير برسوم' : 'Changes may apply',
        fareFamily: locale === 'ar' ? 'اقتصادية' : 'Economy',
        price: 1200 + i * 180,
        currency: 'SAR',
        loyaltyPoints: 60,
      }
    })
}

function seedHotels(seed: string, locale: ProductLocale): HotelCardModel[] {
  const route = inferTravelRouteFromSeed(seed)
  const cards = buildDynamicResultCards(seed, 3)
  return cards
    .filter((c) => c.kind === 'hotel')
    .slice(0, 2)
    .map((c, i) => {
      const title = resultCardTitle(c, locale)
      return {
        kind: 'hotel' as const,
        id: c.id || `seed-hotel-${i}`,
        name: title,
        photos: [],
        mapQuery: `${title} ${route.destinationEn}`,
        stars: 4,
        rating: 8.2,
        reviewsLabel: resultCardSubtitle(c, locale),
        roomTypes: [locale === 'ar' ? 'غرفة عائلية' : 'Family room'],
        breakfast: locale === 'ar' ? 'إفطار متاح' : 'Breakfast available',
        cancellationPolicy: locale === 'ar' ? 'إلغاء ضمن الشروط' : 'Cancellation per terms',
        refundPolicy: locale === 'ar' ? 'حسب المورد' : 'Per supplier',
        loyaltyRewards: '',
        price: 450 + i * 90,
        currency: 'SAR',
        area:
          locale === 'ar'
            ? route.destinationAr
            : route.destinationEn,
      }
    })
}

/**
 * Lazy-friendly bridge from chat messages → Sprint A conversational results.
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

    return {
      flights: flights.length ? flights : seedFlights(seed, locale),
      hotels: hotels.length ? hotels : seedHotels(seed, locale),
      destinations: (() => {
        const route = inferTravelRouteFromSeed(seed)
        const mentioned =
          /وجهة|destination|المغرب|morocco|مراكش|أغادير|tokyo|دبي|dubai|istanbul|paris|باريس|طوكيو|القاهرة|cairo/i.test(
            seed,
          )
        if (!mentioned || route.destinationEn === 'your destination') return []
        return [
          {
            id: 'dest-1',
            name: locale === 'ar' ? route.destinationAr : route.destinationEn,
            reason:
              locale === 'ar'
                ? 'تناسب الثقافة والطقس والميزانية المرنة'
                : 'Fits culture, weather, and flexible budget',
          },
        ]
      })(),
      showItinerary: wantsPlan || Boolean(meta.structured?.dailyItinerary?.length),
      showConfirmation: wantsConfirm,
      disruptionRecommendation: wantsDisruption
        ? locale === 'ar'
          ? 'أنقل حجوزاتك إلى الرحلة التالية المتاحة مع الحفاظ على الفندق نفسه.'
          : 'Move bookings to the next available flight while keeping the same hotel.'
        : null,
      mapLabel: /خريطة|map|eta|وصول/i.test(lower)
        ? locale === 'ar'
          ? 'المطار → الفندق'
          : 'Airport → hotel'
        : null,
      mapEta: /خريطة|map|eta|وصول/i.test(lower)
        ? locale === 'ar'
          ? '٣٥ دقيقة'
          : '35 min'
        : null,
    }
  }, [locale, message.providerMeta, seed])

  if (isStreaming && !message.content) return null

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
