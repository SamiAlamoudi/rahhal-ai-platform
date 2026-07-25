/**
 * Rich in-chat result cards — presentation models only (no provider calls).
 */

export type ResultCardKind =
  | 'flight'
  | 'hotel'
  | 'activity'
  | 'map'
  | 'restaurant'
  | 'transport'
  | 'weather'
  | 'budget'
  | 'visa'
  | 'timeline'

export interface DynamicResultCard {
  id: string
  kind: ResultCardKind
  titleAr: string
  titleEn: string
  subtitleAr: string
  subtitleEn: string
  metaAr?: string
  metaEn?: string
  accent?: string
}

export interface InferredTravelRoute {
  originAr: string
  originEn: string
  destinationAr: string
  destinationEn: string
  /** Airport / city codes for compact English route labels when known. */
  originCode?: string
  destinationCode?: string
}

const DESTINATION_HINTS: Array<{
  match: RegExp
  destinationAr: string
  destinationEn: string
  destinationCode?: string
}> = [
  {
    match: /المغرب|morocco|مراكش|marrakech|marrakesh|الدار البيضاء|casablanca|أكادير|اغادير|agadir|الرباط|rabat/i,
    destinationAr: 'المغرب',
    destinationEn: 'Morocco',
    destinationCode: 'RAK',
  },
  {
    match: /دبي|dubai/i,
    destinationAr: 'دبي',
    destinationEn: 'Dubai',
    destinationCode: 'DXB',
  },
  {
    match: /طوكيو|tokyo/i,
    destinationAr: 'طوكيو',
    destinationEn: 'Tokyo',
    destinationCode: 'NRT',
  },
  {
    match: /إسطنبول|اسطنبول|istanbul/i,
    destinationAr: 'إسطنبول',
    destinationEn: 'Istanbul',
    destinationCode: 'IST',
  },
  {
    match: /باريس|paris/i,
    destinationAr: 'باريس',
    destinationEn: 'Paris',
    destinationCode: 'CDG',
  },
  {
    match: /القاهرة|cairo/i,
    destinationAr: 'القاهرة',
    destinationEn: 'Cairo',
    destinationCode: 'CAI',
  },
]

/**
 * Infer origin/destination labels from conversation seed text.
 * Defaults origin to Riyadh (Saudi product baseline) but never invents Dubai
 * when another destination is clearly requested.
 */
export function inferTravelRouteFromSeed(seedText: string): InferredTravelRoute {
  const text = seedText.trim()
  const originAr = 'الرياض'
  const originEn = 'Riyadh'
  const originCode = 'RUH'
  for (const hint of DESTINATION_HINTS) {
    if (hint.match.test(text)) {
      return {
        originAr,
        originEn,
        originCode,
        destinationAr: hint.destinationAr,
        destinationEn: hint.destinationEn,
        destinationCode: hint.destinationCode,
      }
    }
  }
  return {
    originAr,
    originEn,
    originCode,
    destinationAr: 'وجهتك',
    destinationEn: 'your destination',
  }
}

function demoCardsForRoute(route: InferredTravelRoute): DynamicResultCard[] {
  const flightTitleAr = `${route.originAr} → ${route.destinationAr}`
  const flightTitleEn =
    route.originCode && route.destinationCode
      ? `${route.originCode} → ${route.destinationCode}`
      : `${route.originEn} → ${route.destinationEn}`

  return [
    {
      id: 'flight-demo',
      kind: 'flight',
      titleAr: flightTitleAr,
      titleEn: flightTitleEn,
      subtitleAr: 'مباشرة · صباح الغد',
      subtitleEn: 'Nonstop · tomorrow morning',
      metaAr: 'من ١٬٢٤٠ ر.س',
      metaEn: 'From 1,240 SAR',
      accent: 'sky',
    },
    {
      id: 'hotel-demo',
      kind: 'hotel',
      titleAr: `فندق في ${route.destinationAr}`,
      titleEn: `Hotel in ${route.destinationEn}`,
      subtitleAr: 'تقييم ٤٫٧ · إفطار مشمول',
      subtitleEn: '4.7 rating · breakfast included',
      metaAr: '٨٩٠ ر.س / ليلة',
      metaEn: '890 SAR / night',
      accent: 'teal',
    },
    {
      id: 'weather-demo',
      kind: 'weather',
      titleAr: `طقس ${route.destinationAr}`,
      titleEn: `${route.destinationEn} weather`,
      subtitleAr: 'مشمس · ٢٨°',
      subtitleEn: 'Sunny · 28°',
      metaAr: 'مثالي للتنزّه',
      metaEn: 'Ideal for exploring',
      accent: 'amber',
    },
    {
      id: 'budget-demo',
      kind: 'budget',
      titleAr: 'ملخص الميزانية',
      titleEn: 'Budget snapshot',
      subtitleAr: 'ضمن ميزانيتك المقترحة',
      subtitleEn: 'Within your suggested budget',
      metaAr: '≈ ٧٬٢٠٠ ر.س',
      metaEn: '≈ 7,200 SAR',
      accent: 'emerald',
    },
    {
      id: 'activity-demo',
      kind: 'activity',
      titleAr: `تجربة في ${route.destinationAr}`,
      titleEn: `${route.destinationEn} experience`,
      subtitleAr: 'جولة ثقافية مسائية',
      subtitleEn: 'Evening cultural walk',
      metaAr: 'ساعتان',
      metaEn: '2 hours',
      accent: 'rose',
    },
    {
      id: 'restaurant-demo',
      kind: 'restaurant',
      titleAr: 'مطعم موصى به',
      titleEn: 'Recommended restaurant',
      subtitleAr: 'مأكولات محلية رفيعة',
      subtitleEn: 'Elevated local cuisine',
      metaAr: 'حجز مرن',
      metaEn: 'Flexible booking',
      accent: 'orange',
    },
    {
      id: 'visa-demo',
      kind: 'visa',
      titleAr: 'متطلبات التأشيرة',
      titleEn: 'Visa requirements',
      subtitleAr: 'تحقق سريع للمسافرين السعوديين',
      subtitleEn: 'Quick check for Saudi travelers',
      metaAr: 'إرشاد فقط',
      metaEn: 'Guidance only',
      accent: 'sky',
    },
    {
      id: 'timeline-demo',
      kind: 'timeline',
      titleAr: 'خط زمني للرحلة',
      titleEn: 'Trip timeline',
      subtitleAr: 'يوم الوصول → الاستكشاف → المغادرة',
      subtitleEn: 'Arrival → explore → departure',
      metaAr: 'مسودة',
      metaEn: 'Draft',
      accent: 'teal',
    },
  ]
}

/** Infer demo cards from conversation text for progressive UI (no APIs). */
export function buildDynamicResultCards(seedText: string, limit = 4): DynamicResultCard[] {
  const text = seedText.toLowerCase()
  const kinds = new Set<ResultCardKind>()
  if (/flight|طيران|رحلة|airport/.test(text)) kinds.add('flight')
  if (/hotel|فندق|إقامة/.test(text)) kinds.add('hotel')
  if (/weather|طقس/.test(text)) kinds.add('weather')
  if (/budget|ميزانية|سعر|price/.test(text)) kinds.add('budget')
  if (/restaurant|مطعم|طعام|food/.test(text)) kinds.add('restaurant')
  if (/activity|نشاط|تجربة|tour/.test(text)) kinds.add('activity')
  if (/map|خريطة|location/.test(text)) kinds.add('map')
  if (/transport|مواصلات|taxi|train/.test(text)) kinds.add('transport')
  if (/visa|تأشير|تاشير/.test(text)) kinds.add('visa')
  if (/timeline|جدول|itinerary|خط.?زمني|أيام|days/.test(text)) kinds.add('timeline')

  if (kinds.size === 0) {
    kinds.add('flight')
    kinds.add('hotel')
    kinds.add('weather')
    kinds.add('budget')
  }

  const demoCards = demoCardsForRoute(inferTravelRouteFromSeed(seedText))
  const mapped = demoCards.filter((c) => kinds.has(c.kind)).slice(0, limit)
  if (mapped.length > 0) return mapped
  return demoCards.slice(0, limit)
}

export function resultCardTitle(card: DynamicResultCard, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? card.titleAr : card.titleEn
}

export function resultCardSubtitle(card: DynamicResultCard, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? card.subtitleAr : card.subtitleEn
}

export function resultCardMeta(card: DynamicResultCard, locale: 'ar' | 'en'): string | undefined {
  return locale === 'ar' ? card.metaAr : card.metaEn
}

export function resultCardKindLabel(kind: ResultCardKind, locale: 'ar' | 'en'): string {
  const map: Record<ResultCardKind, { ar: string; en: string }> = {
    flight: { ar: 'طيران', en: 'Flight' },
    hotel: { ar: 'فندق', en: 'Hotel' },
    activity: { ar: 'نشاط', en: 'Activity' },
    map: { ar: 'خريطة', en: 'Map' },
    restaurant: { ar: 'مطعم', en: 'Restaurant' },
    transport: { ar: 'مواصلات', en: 'Transport' },
    weather: { ar: 'طقس', en: 'Weather' },
    budget: { ar: 'ميزانية', en: 'Budget' },
    visa: { ar: 'تأشيرة', en: 'Visa' },
    timeline: { ar: 'خط زمني', en: 'Timeline' },
  }
  return locale === 'ar' ? map[kind].ar : map[kind].en
}
