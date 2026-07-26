/**
 * Presentation adapters — map existing normalized models into Sprint A cards.
 * No new providers or engines.
 */

import type { FlightCardModel, HotelCardModel } from '../chat/conversationExperienceUi'
import type { CostBreakdown, BudgetTier } from '../agent/integrationBudgetPricing/types'
import type { ProductLocale } from './copy'
import type { ActiveTripContext } from './tripContext'

export type FlightCompareTag = 'best_value' | 'fastest' | 'cheapest' | 'recommended'

export interface FlightResultView {
  id: string
  airline: string
  departure: string
  arrival: string
  durationLabel: string
  stops: number
  price: number
  currency: string
  baggage?: string
  refundability?: string
  reason: string
  compareTag?: FlightCompareTag
}

export interface HotelResultView {
  id: string
  name: string
  imageUrl?: string | null
  rating: number | null
  area: string
  roomType: string
  mealPlan: string
  cancellation: string
  totalPrice: number
  currency: string
  amenities: string[]
  reason: string
}

export interface DestinationResultView {
  id: string
  name: string
  reason: string
  seasonHint?: string
  budgetFit?: string
}

export interface ItineraryItemView {
  id: string
  kind: 'flight' | 'hotel' | 'transport' | 'meeting' | 'activity' | 'meal' | 'free_time' | 'warning'
  title: string
  timeLabel?: string
  detail?: string
  warning?: boolean
  conflict?: boolean
}

export interface ItineraryDayView {
  day: number
  title: string
  items: ItineraryItemView[]
}

export interface BudgetPresentationView {
  currency: string
  totalBudget: number | null
  estimatedTotal: number
  remaining: number | null
  flights: number
  hotels: number
  transportation: number
  meals: number
  activities: number
  reserve: number
  tier: BudgetTier | 'balanced'
  tradeoffAr: string
  tradeoffEn: string
}

export interface ActionConfirmationView {
  kind: 'booking' | 'reservation' | 'modification' | 'cancellation' | 'payment'
  title: string
  selectedOption: string
  travelers: string
  dates: string
  totalAmount: string
  cancellationTerms: string
  requiresExplicitConfirm: true
}

export function flightResultFromModel(
  card: FlightCardModel,
  locale: ProductLocale,
  compareTag?: FlightCompareTag,
): FlightResultView {
  return {
    id: card.id,
    airline: card.airline,
    departure: card.departure,
    arrival: card.arrival,
    durationLabel: card.durationLabel,
    stops: card.stops,
    price: card.price,
    currency: card.currency,
    baggage: card.baggage,
    refundability: card.refundPolicy,
    reason:
      locale === 'ar'
        ? 'متوازن بين الوقت والسعر وملاءمة جدولك'
        : 'Balanced for time, price, and your schedule',
    compareTag,
  }
}

export function hotelResultFromModel(card: HotelCardModel, locale: ProductLocale): HotelResultView {
  return {
    id: card.id,
    name: card.name,
    imageUrl: card.photos[0] ?? null,
    rating: card.rating ?? card.stars,
    area: card.area,
    roomType: card.roomTypes[0] ?? (locale === 'ar' ? 'غرفة قياسية' : 'Standard room'),
    mealPlan: card.breakfast,
    cancellation: card.cancellationPolicy,
    totalPrice: card.price,
    currency: card.currency,
    amenities: card.roomTypes.slice(0, 4),
    reason:
      locale === 'ar'
        ? 'موقع مناسب مع سياسة إلغاء واضحة'
        : 'Good location with a clear cancellation policy',
  }
}

export function budgetFromBreakdown(
  breakdown: CostBreakdown,
  options?: { totalBudget?: number | null; tier?: BudgetTier; locale?: ProductLocale },
): BudgetPresentationView {
  const totalBudget = options?.totalBudget ?? null
  const remaining =
    totalBudget == null ? null : Math.round(totalBudget - breakdown.estimatedTotal)
  return {
    currency: breakdown.currency,
    totalBudget,
    estimatedTotal: breakdown.estimatedTotal,
    remaining,
    flights: breakdown.flights,
    hotels: breakdown.hotels,
    transportation: breakdown.transportation,
    meals: breakdown.meals,
    activities: breakdown.activities,
    reserve: breakdown.reserveHeld,
    tier: options?.tier ?? 'balanced',
    tradeoffAr: breakdown.withinBudget
      ? 'الخطة ضمن الميزانية مع احتياطي للطوارئ.'
      : `تجاوز تقديري بنحو ${breakdown.overBy} ${breakdown.currency} — يمكن تخفيف الفندق أو المرونة في التواريخ.`,
    tradeoffEn: breakdown.withinBudget
      ? 'Plan fits the budget with an emergency reserve.'
      : `Roughly ${breakdown.overBy} ${breakdown.currency} over — soften hotel or dates.`,
  }
}

export function demoItinerary(
  locale: ProductLocale,
  trip?: ActiveTripContext | null,
): ItineraryDayView[] {
  const dest =
    locale === 'ar'
      ? (trip?.displayDestinationAr ?? 'المدينة')
      : (trip?.displayDestinationEn ?? 'the city')
  if (locale === 'ar') {
    return [
      {
        day: 1,
        title: `الوصول إلى ${dest}`,
        items: [
          {
            id: 'd1-f',
            kind: 'flight',
            title: `وصول الطيران إلى ${dest}`,
            timeLabel: '14:20',
            detail: `مطار ${dest} → الفندق`,
          },
          { id: 'd1-h', kind: 'hotel', title: `تسجيل الوصول في ${dest}`, timeLabel: '16:00' },
          { id: 'd1-m', kind: 'meal', title: `عشاء محلي في ${dest}`, timeLabel: '19:30' },
        ],
      },
      {
        day: 2,
        title: `استكشاف ${dest}`,
        items: [
          { id: 'd2-a', kind: 'activity', title: `جولة صباحية في ${dest}`, timeLabel: '09:00' },
          { id: 'd2-t', kind: 'transport', title: 'انتقال داخلي', timeLabel: '13:00' },
          { id: 'd2-f', kind: 'free_time', title: 'وقت حر', timeLabel: '16:00' },
        ],
      },
    ]
  }
  return [
    {
      day: 1,
      title: `Arrival in ${dest}`,
      items: [
        {
          id: 'd1-f',
          kind: 'flight',
          title: `Flight arrival to ${dest}`,
          timeLabel: '14:20',
          detail: `${dest} airport → hotel`,
        },
        { id: 'd1-h', kind: 'hotel', title: `Hotel check-in in ${dest}`, timeLabel: '16:00' },
        { id: 'd1-m', kind: 'meal', title: `Local dinner in ${dest}`, timeLabel: '19:30' },
      ],
    },
    {
      day: 2,
      title: `Exploring ${dest}`,
      items: [
        { id: 'd2-a', kind: 'activity', title: `Morning walk in ${dest}`, timeLabel: '09:00' },
        { id: 'd2-t', kind: 'transport', title: 'Local transfer', timeLabel: '13:00' },
        { id: 'd2-f', kind: 'free_time', title: 'Free time', timeLabel: '16:00' },
      ],
    },
  ]
}

export function demoActionConfirmation(
  locale: ProductLocale,
  trip?: ActiveTripContext | null,
): ActionConfirmationView {
  const dest =
    locale === 'ar'
      ? (trip?.displayDestinationAr ?? 'الوجهة')
      : (trip?.displayDestinationEn ?? 'destination')
  const travelers =
    trip?.travelers && trip.travelers > 1
      ? locale === 'ar'
        ? `${trip.travelers} بالغين`
        : `${trip.travelers} adults`
      : locale === 'ar'
        ? '١ بالغ'
        : '1 adult'
  const budget =
    trip?.budgetSar != null
      ? locale === 'ar'
        ? `${trip.budgetSar.toLocaleString('en-US')} ر.س`
        : `${trip.budgetSar.toLocaleString('en-US')} SAR`
      : locale === 'ar'
        ? '٨٬٤٥٠ ر.س'
        : '8,450 SAR'
  return {
    kind: 'booking',
    title: locale === 'ar' ? 'تأكيد معاينة الحجز' : 'Booking preview confirmation',
    selectedOption:
      locale === 'ar'
        ? `الطيران الموصى به + فندق في ${dest}`
        : `Recommended flight + hotel in ${dest}`,
    travelers,
    dates:
      trip?.durationDays != null
        ? locale === 'ar'
          ? `${trip.durationDays} أيام`
          : `${trip.durationDays} days`
        : locale === 'ar'
          ? '١٢–١٧ مايو'
          : '12–17 May',
    totalAmount: budget,
    cancellationTerms:
      locale === 'ar'
        ? 'إلغاء مجاني حتى ٤٨ ساعة قبل المغادرة (حسب العرض).'
        : 'Free cancellation until 48h before departure (per offer).',
    requiresExplicitConfirm: true,
  }
}
