/**
 * Sprint 42 — presentation view-models for rich travel cards.
 * Built from ConversationStructuredResponse / UnifiedTravelPlanOption only.
 * No new search or booking engines.
 */

import type { ConversationStructuredResponse } from '../conversationExperience/types'
import type { UnifiedTravelPlanOption } from '../../brain/unifiedTravel/types'
import { pickTopPlan } from './structuredMeta'

export type TravelCardKind = 'flight' | 'hotel' | 'car' | 'activity' | 'visa' | 'insurance'

export interface FlightCardModel {
  kind: 'flight'
  id: string
  airline: string
  logoLabel: string
  departure: string
  arrival: string
  durationLabel: string
  stops: number
  baggage: string
  refundPolicy: string
  changePolicy: string
  fareFamily: string
  price: number
  currency: string
  loyaltyPoints: number
}

export interface HotelCardModel {
  kind: 'hotel'
  id: string
  name: string
  photos: string[]
  mapQuery: string
  stars: number
  rating: number | null
  reviewsLabel: string
  roomTypes: string[]
  breakfast: string
  cancellationPolicy: string
  refundPolicy: string
  loyaltyRewards: string
  price: number
  currency: string
  area: string
}

export interface CarCardModel {
  kind: 'car'
  id: string
  vehicleLabel: string
  imageLabel: string
  supplier: string
  insurance: string
  mileage: string
  fuelPolicy: string
  cancellation: string
  pickup: string
  dropoff: string
  price: number
  currency: string
}

export interface ActivityCardModel {
  kind: 'activity'
  id: string
  title: string
  images: string[]
  duration: string
  availability: string
  refundRules: string
  locationQuery: string
  priceLabel: string
}

export interface VisaCardModel {
  kind: 'visa'
  id: string
  requiredDocuments: string[]
  processingTime: string
  status: string
  passportValidity: string
  estimatedApproval: string
}

export interface InsuranceCardModel {
  kind: 'insurance'
  id: string
  coverageSummary: string
  exclusions: string[]
  cancellation: string
  emergencyAssistance: string
  priceLabel: string
}

export type TravelCardModel =
  | FlightCardModel
  | HotelCardModel
  | CarCardModel
  | ActivityCardModel
  | VisaCardModel
  | InsuranceCardModel

export function buildTravelCards(
  structured: ConversationStructuredResponse | null,
  options?: { locale?: 'ar' | 'en' },
): TravelCardModel[] {
  if (!structured) return []
  const locale = options?.locale ?? 'ar'
  const plan = pickTopPlan(structured)
  const cards: TravelCardModel[] = []

  for (const flight of structured.flights.slice(0, 4)) {
    const rich = plan?.flight && plan.flight.id === flight.id ? plan.flight : plan?.flight
    cards.push({
      kind: 'flight',
      id: flight.id,
      airline: flight.airline,
      logoLabel: flight.airline.slice(0, 2).toUpperCase(),
      departure: flight.from,
      arrival: flight.to,
      durationLabel: rich ? `${rich.durationHours}h` : locale === 'ar' ? 'حسب الجدول' : 'See schedule',
      stops: flight.stops,
      baggage: locale === 'ar' ? 'حقيبة مقصورة + وزن محدد بالأجرة' : 'Cabin bag + fare-based checked',
      refundPolicy: locale === 'ar' ? 'حسب عائلة الأجرة / سياسة الاسترداد' : 'Per fare family / refund policy',
      changePolicy: locale === 'ar' ? 'تغيير برسوم محتملة' : 'Changes may incur fees',
      fareFamily: flight.cabin,
      price: flight.price,
      currency: flight.currency,
      loyaltyPoints: Math.max(0, Math.round(flight.price * 0.05)),
    })
  }

  for (const hotel of structured.hotels.slice(0, 4)) {
    const rich = plan?.hotel && plan.hotel.id === hotel.id ? plan.hotel : plan?.hotel
    cards.push({
      kind: 'hotel',
      id: hotel.id,
      name: hotel.name,
      photos: [`hotel:${hotel.id}`],
      mapQuery: `${hotel.name} ${hotel.area}`,
      stars: hotel.stars,
      rating: rich?.guestScore ?? null,
      reviewsLabel: rich?.guestScore != null
        ? locale === 'ar' ? `تقييم ${rich.guestScore}/10` : `${rich.guestScore}/10 guest score`
        : locale === 'ar' ? 'تقييمات المسافرين' : 'Traveler reviews',
      roomTypes: rich?.amenities?.slice(0, 3).length
        ? rich.amenities.slice(0, 3)
        : [locale === 'ar' ? 'غرفة قياسية' : 'Standard room'],
      breakfast: rich?.amenities?.some((a) => /breakfast|إفطار/i.test(a))
        ? (locale === 'ar' ? 'إفطار متاح' : 'Breakfast available')
        : (locale === 'ar' ? 'تحقق من الإفطار' : 'Breakfast varies'),
      cancellationPolicy: rich?.freeCancellation
        ? (locale === 'ar' ? 'إلغاء مجاني ضمن الشروط' : 'Free cancellation (terms apply)')
        : (locale === 'ar' ? 'سياسة إلغاء الفندق' : 'Hotel cancellation policy'),
      refundPolicy: locale === 'ar' ? 'حسب سياسة المورد والاسترداد' : 'Per supplier refund policy',
      loyaltyRewards: plan?.loyaltyAligned
        ? (locale === 'ar' ? 'متوافق مع برامج الولاء' : 'Loyalty-aligned option')
        : (locale === 'ar' ? 'نقاط بيلامو عند الإكمال' : 'Bilamo points on completion'),
      price: hotel.nightly,
      currency: hotel.currency,
      area: hotel.area,
    })
  }

  // Presentation-only enrichments from itinerary / plan context (no new engines).
  if (structured.dailyItinerary.length) {
    for (const day of structured.dailyItinerary.slice(0, 3)) {
      const item = day.items[0] ?? day.title
      cards.push({
        kind: 'activity',
        id: `activity-${day.day}`,
        title: item,
        images: [`activity:${day.day}`],
        duration: locale === 'ar' ? '٢–٤ ساعات' : '2–4 hours',
        availability: locale === 'ar' ? 'حسب تاريخ الرحلة' : 'Per trip dates',
        refundRules: locale === 'ar' ? 'قواعد الاسترداد حسب النشاط' : 'Activity refund rules apply',
        locationQuery: day.title,
        priceLabel: locale === 'ar' ? 'ضمن تقدير التكلفة' : 'Included in estimate',
      })
    }
  }

  if (plan?.cost.transport) {
    cards.push({
      kind: 'car',
      id: `car-${plan.id}`,
      vehicleLabel: locale === 'ar' ? 'سيارة اقتصادية' : 'Economy car',
      imageLabel: 'CAR',
      supplier: locale === 'ar' ? 'مورد النقل' : 'Transport supplier',
      insurance: locale === 'ar' ? 'تأمين أساسي' : 'Basic insurance',
      mileage: locale === 'ar' ? 'كيلومترات محدودة/غير محدودة حسب العرض' : 'Mileage per offer',
      fuelPolicy: locale === 'ar' ? 'نفس مستوى الوقود' : 'Same-to-same fuel',
      cancellation: locale === 'ar' ? 'إلغاء حسب المورد' : 'Supplier cancellation',
      pickup: plan.flight?.to ?? (locale === 'ar' ? 'مطار الوصول' : 'Arrival airport'),
      dropoff: plan.hotel?.area ?? (locale === 'ar' ? 'الفندق' : 'Hotel'),
      price: plan.cost.transport,
      currency: plan.cost.currency,
    })
  }

  cards.push({
    kind: 'visa',
    id: `visa-${structured.topPlanId ?? 'plan'}`,
    requiredDocuments: locale === 'ar'
      ? ['جواز سفر ساري', 'صورة شخصية', 'إثبات حجز']
      : ['Valid passport', 'Photo', 'Booking proof'],
    processingTime: locale === 'ar' ? 'حسب الجنسية والوجهة' : 'Depends on nationality & destination',
    status: locale === 'ar' ? 'يحتاج مراجعة' : 'Needs review',
    passportValidity: locale === 'ar' ? '٦ أشهر على الأقل عادة' : 'Typically 6+ months validity',
    estimatedApproval: locale === 'ar' ? 'تقديري — راجع متطلبات التأشيرة' : 'Estimate — verify visa rules',
  })

  cards.push({
    kind: 'insurance',
    id: `insurance-${structured.topPlanId ?? 'plan'}`,
    coverageSummary: locale === 'ar'
      ? 'تغطية طبية وإلغاء سفر أساسية للرحلة'
      : 'Basic medical + trip cancellation coverage',
    exclusions: locale === 'ar'
      ? ['حالات سابقة غير مفصح عنها', 'أنشطة عالية الخطورة']
      : ['Undeclared pre-existing conditions', 'High-risk activities'],
    cancellation: locale === 'ar' ? 'إلغاء وفق وثيقة التأمين' : 'Per policy terms',
    emergencyAssistance: locale === 'ar' ? 'مساعدة طوارئ على مدار الساعة' : '24/7 emergency assistance',
    priceLabel: locale === 'ar' ? 'يُحسب عند الشراء' : 'Quoted at purchase',
  })

  return cards
}

export function enrichPlanForBooking(structured: ConversationStructuredResponse | null): UnifiedTravelPlanOption | null {
  return pickTopPlan(structured)
}
