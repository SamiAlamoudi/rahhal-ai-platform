/**
 * Smart travel cards — project existing booking/order data + curated inspiration.
 */

import type { BookingRecord } from '../booking/bookingRecord'
import type { ManagedOrder } from '../orderManagement'
import { MANAGED_ORDER_STATUS_LABELS } from '../orderManagement'
import type { HomeLocale, TravelCardKind, TravelSmartCardModel } from './types'

const DESTINATIONS: Array<{
  id: string
  titleAr: string
  titleEn: string
  subtitleAr: string
  subtitleEn: string
  promptAr: string
  promptEn: string
}> = [
  {
    id: 'dest-istanbul',
    titleAr: 'إسطنبول',
    titleEn: 'Istanbul',
    subtitleAr: 'ثقافة وأسواق على البوسفور',
    subtitleEn: 'Culture and bazaars on the Bosphorus',
    promptAr: 'خطط لي رحلة إلى إسطنبول.',
    promptEn: 'Plan a trip to Istanbul.',
  },
  {
    id: 'dest-maldives',
    titleAr: 'المالديف',
    titleEn: 'Maldives',
    subtitleAr: 'هدوء وجزر فيروزية',
    subtitleEn: 'Calm turquoise islands',
    promptAr: 'أريد إجازة في المالديف.',
    promptEn: 'I want a vacation in the Maldives.',
  },
  {
    id: 'dest-paris',
    titleAr: 'باريس',
    titleEn: 'Paris',
    subtitleAr: 'فن ومعالم كلاسيكية',
    subtitleEn: 'Art and classic landmarks',
    promptAr: 'خطط لي عطلة في باريس.',
    promptEn: 'Plan a holiday in Paris.',
  },
]

const INSPIRATION: Array<{
  id: string
  titleAr: string
  titleEn: string
  subtitleAr: string
  subtitleEn: string
  promptAr: string
  promptEn: string
}> = [
  {
    id: 'insp-weekend-escape',
    titleAr: 'هروب نهاية أسبوع',
    titleEn: 'Weekend escape',
    subtitleAr: 'مدينة قريبة خلال ٤٨ ساعة',
    subtitleEn: 'A nearby city in 48 hours',
    promptAr: 'اقترح لي هروباً لنهاية الأسبوع.',
    promptEn: 'Suggest a weekend escape.',
  },
  {
    id: 'insp-no-visa',
    titleAr: 'وجهات بلا تأشيرة',
    titleEn: 'Visa-light getaways',
    subtitleAr: 'خيارات سهلة للمسافر السعودي',
    subtitleEn: 'Easy options for Saudi travelers',
    promptAr: 'أعطني وجهات بدون تأشيرة معقدة.',
    promptEn: 'Give me destinations with easy visa rules.',
  },
]

export function upcomingTripCards(records: BookingRecord[], limit = 3): TravelSmartCardModel[] {
  return records.slice(0, limit).map((r) => ({
    id: `upcoming-${r.sessionId}`,
    kind: 'upcoming_trip' as TravelCardKind,
    titleAr: r.flight
      ? `${r.flight.origin} → ${r.flight.destination}`
      : r.itemTitles[0] ?? r.bookingReference,
    titleEn: r.flight
      ? `${r.flight.origin} → ${r.flight.destination}`
      : r.itemTitles[0] ?? r.bookingReference,
    subtitleAr: r.bookingReference,
    subtitleEn: r.bookingReference,
    metaAr: r.flight?.airline ?? undefined,
    metaEn: r.flight?.airline ?? undefined,
    href: `/my-trips/${encodeURIComponent(r.sessionId)}`,
    statusChip: {
      labelAr: 'قادمة',
      labelEn: 'Upcoming',
      tone: 'info',
    },
  }))
}

export function recentOrderCards(orders: ManagedOrder[], limit = 3): TravelSmartCardModel[] {
  return orders.slice(0, limit).map((o) => ({
    id: `order-${o.orderId}`,
    kind: 'recent_order' as TravelCardKind,
    titleAr: o.orderNumber,
    titleEn: o.orderNumber,
    subtitleAr: o.itinerary?.summary ?? o.bookingReference,
    subtitleEn: o.itinerary?.summary ?? o.bookingReference,
    metaAr: `${o.totalAmount.toLocaleString('ar-SA')} ${o.currency}`,
    metaEn: `${o.totalAmount.toLocaleString('en-US')} ${o.currency}`,
    href: o.checkoutPath,
    statusChip: {
      labelAr: MANAGED_ORDER_STATUS_LABELS[o.orderStatus],
      labelEn: MANAGED_ORDER_STATUS_LABELS[o.orderStatus],
      tone: o.orderStatus === 'paid' || o.orderStatus === 'confirmed' ? 'success' : 'warning',
    },
  }))
}

export function recommendedDestinationCards(): TravelSmartCardModel[] {
  return DESTINATIONS.map((d) => ({
    id: d.id,
    kind: 'recommended_destination' as TravelCardKind,
    titleAr: d.titleAr,
    titleEn: d.titleEn,
    subtitleAr: d.subtitleAr,
    subtitleEn: d.subtitleEn,
    href: `/chat?seed=${encodeURIComponent(d.promptEn)}`,
    statusChip: {
      labelAr: 'موصى به',
      labelEn: 'Recommended',
      tone: 'neutral',
    },
  }))
}

export function travelInspirationCards(): TravelSmartCardModel[] {
  return INSPIRATION.map((d) => ({
    id: d.id,
    kind: 'travel_inspiration' as TravelCardKind,
    titleAr: d.titleAr,
    titleEn: d.titleEn,
    subtitleAr: d.subtitleAr,
    subtitleEn: d.subtitleEn,
    href: `/chat?seed=${encodeURIComponent(d.promptEn)}`,
  }))
}

/** Placeholder cards — foundation for future saved searches / price alerts. */
export function placeholderUtilityCards(locale: HomeLocale): TravelSmartCardModel[] {
  void locale
  return [
    {
      id: 'saved-searches',
      kind: 'saved_search',
      titleAr: 'عمليات البحث المحفوظة',
      titleEn: 'Saved searches',
      subtitleAr: 'قريباً — احفظ بحثك وارجع إليه',
      subtitleEn: 'Coming soon — save a search and return later',
      href: '/search',
      statusChip: { labelAr: 'قريباً', labelEn: 'Soon', tone: 'neutral' },
    },
    {
      id: 'price-alerts',
      kind: 'price_alert',
      titleAr: 'تنبيهات الأسعار',
      titleEn: 'Price alerts',
      subtitleAr: 'قريباً — راقب تغيّر الأسعار',
      subtitleEn: 'Coming soon — watch fare changes',
      href: '/search',
      statusChip: { labelAr: 'قريباً', labelEn: 'Soon', tone: 'neutral' },
    },
  ]
}

export function buildTravelCards(input: {
  upcoming: BookingRecord[]
  orders: ManagedOrder[]
  includePlaceholders?: boolean
  locale?: HomeLocale
}): TravelSmartCardModel[] {
  const cards: TravelSmartCardModel[] = [
    ...upcomingTripCards(input.upcoming),
    ...recentOrderCards(input.orders),
    ...recommendedDestinationCards(),
    ...travelInspirationCards(),
  ]
  if (input.includePlaceholders === true) {
    cards.push(...placeholderUtilityCards(input.locale ?? 'ar'))
  }
  return cards
}

export function cardTitle(card: TravelSmartCardModel, locale: HomeLocale): string {
  return locale === 'ar' ? card.titleAr : card.titleEn
}

export function cardSubtitle(card: TravelSmartCardModel, locale: HomeLocale): string {
  return locale === 'ar' ? card.subtitleAr : card.subtitleEn
}
