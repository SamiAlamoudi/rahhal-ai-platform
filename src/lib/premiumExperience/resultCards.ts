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

const DEMO_CARDS: DynamicResultCard[] = [
  {
    id: 'flight-demo',
    kind: 'flight',
    titleAr: 'الرياض → دبي',
    titleEn: 'RUH → DXB',
    subtitleAr: 'مباشرة · صباح الغد',
    subtitleEn: 'Nonstop · tomorrow morning',
    metaAr: 'من ١٬٢٤٠ ر.س',
    metaEn: 'From 1,240 SAR',
    accent: 'sky',
  },
  {
    id: 'hotel-demo',
    kind: 'hotel',
    titleAr: 'فندق وسط المدينة',
    titleEn: 'City Center Hotel',
    subtitleAr: 'تقييم ٤٫٧ · إفطار مشمول',
    subtitleEn: '4.7 rating · breakfast included',
    metaAr: '٨٩٠ ر.س / ليلة',
    metaEn: '890 SAR / night',
    accent: 'teal',
  },
  {
    id: 'weather-demo',
    kind: 'weather',
    titleAr: 'طقس الوجهة',
    titleEn: 'Destination weather',
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
    titleAr: 'تجربة مميزة',
    titleEn: 'Signature experience',
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
]

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

  if (kinds.size === 0) {
    kinds.add('flight')
    kinds.add('hotel')
    kinds.add('weather')
    kinds.add('budget')
  }

  const mapped = DEMO_CARDS.filter((c) => kinds.has(c.kind)).slice(0, limit)
  if (mapped.length > 0) return mapped
  return DEMO_CARDS.slice(0, limit)
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
  }
  return locale === 'ar' ? map[kind].ar : map[kind].en
}
