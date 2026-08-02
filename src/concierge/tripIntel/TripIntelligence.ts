import type { TravelDraft } from '../../brain/travel/types'
import { MOCK_DESTINATION_META } from '../../brain/travel/mockCatalog'
import type { TripIntelSection } from '../types'

const LABELS: Record<TripIntelSection['id'], { en: string; ar: string }> = {
  best_time: { en: 'Best Time', ar: 'أفضل وقت' },
  weather: { en: 'Weather', ar: 'الطقس' },
  visa: { en: 'Visa', ar: 'التأشيرة' },
  currency: { en: 'Currency', ar: 'العملة' },
  safety: { en: 'Safety', ar: 'الأمان' },
  local_tips: { en: 'Local Tips', ar: 'نصائح محلية' },
  dress_code: { en: 'Dress Code', ar: 'قواعد اللباس' },
  time_difference: { en: 'Time Difference', ar: 'فرق التوقيت' },
  internet: { en: 'Internet', ar: 'الإنترنت' },
  power_adapter: { en: 'Power Adapter', ar: 'محوّل الكهرباء' },
  transportation: { en: 'Transportation', ar: 'التنقّل' },
  airport_tips: { en: 'Airport Tips', ar: 'نصائح المطار' },
  cultural_etiquette: { en: 'Cultural Etiquette', ar: 'آداب الثقافة' },
  emergency_numbers: { en: 'Emergency Numbers', ar: 'أرقام الطوارئ' },
}

/** Mock destination intelligence — no live APIs. */
export function buildTripIntelligence(
  draft: TravelDraft,
  locale: 'ar' | 'en' = 'en',
): TripIntelSection[] {
  const city = draft.destination ?? 'your destination'
  const key = city.trim().toLowerCase()
  const meta = MOCK_DESTINATION_META[key]
  const ar = locale === 'ar'
  const L = (id: TripIntelSection['id']) => LABELS[id][locale]

  const bodies: Record<TripIntelSection['id'], string> = {
    best_time: meta
      ? ar
        ? `الموسم الحالي: ${meta.season}. اختر الكتف لهدوء أكبر.`
        : `Seasonality: ${meta.season}. Shoulder weeks feel quieter.`
      : ar
        ? 'الربيع والخريف عادةً ألطف للحركة.'
        : 'Spring and autumn usually feel gentler for movement.',
    weather: meta
      ? ar
        ? `الطقس المعتاد: ${meta.typicalWeather}.`
        : `Typical weather: ${meta.typicalWeather}.`
      : ar
        ? 'تحقّق من الطبقة الخفيفة للمساء.'
        : 'Pack a light layer for evenings.',
    visa: draft.visaCountry
      ? ar
        ? `راجع متطلبات الدخول إلى ${draft.visaCountry} قبل الحجز النهائي.`
        : `Review entry requirements for ${draft.visaCountry} before you lock plans.`
      : ar
        ? `راجع التأشيرة لـ ${city} حسب جنسيتك.`
        : `Confirm visa needs for ${city} against your passport.`,
    currency: ar
      ? `اعتمد ${draft.currency ?? 'العملة المحلية'} للإنفاق اليومي، واحتفظ ببطاقة احتياط.`
      : `Budget daily spend in ${draft.currency ?? 'local currency'}; keep a backup card.`,
    safety: ar
      ? `${city} آمنة عموماً للمسافر الواعي — تجنّب المناطق المزدحمة ليلاً إن أمكن.`
      : `${city} is generally calm for mindful travelers — avoid crowded late-night pockets when tired.`,
    local_tips: ar
      ? 'ابدأ صباحاً للأماكن الأشهر، واترك المساء للأماكن الهادئة.'
      : 'Visit icons early; keep evenings for quieter rooms and courtyards.',
    dress_code: ar
      ? 'أناقة مريحة — غطاء خفيف للأماكن الرسمية أو الدينية.'
      : 'Refined comfort — a light cover for formal or sacred spaces.',
    time_difference: ar
      ? 'خطّط أول يوم بهدوء لتعويض فرق التوقيت.'
      : 'Keep day one soft to settle the time shift.',
    internet: ar
      ? 'eSIM أو شريحة محلية — معظم الفنادق تقدّم واي فاي هادئاً.'
      : 'eSIM or local SIM — most calm hotels offer reliable Wi‑Fi.',
    power_adapter: ar
      ? 'محوّل عالمي صغير يكفي لمعظم الوجهات.'
      : 'A compact universal adapter covers most destinations.',
    transportation: ar
      ? 'التاكسي الموثوق أو التحويل الخاص من المطار يحفظ بداية الرحلة.'
      : 'A trusted transfer from the airport protects the first hour.',
    airport_tips: ar
      ? 'صل قبل الإقلاع بساعتين للرحلات الإقليمية، وثلاث دولية.'
      : 'Arrive ~2h early for regional flights, ~3h for long-haul.',
    cultural_etiquette: ar
      ? 'ابتسامة هادئة وتحية بسيطة تفتح أبواباً أكثر من الاستعجال.'
      : 'A calm greeting opens more doors than haste.',
    emergency_numbers: ar
      ? 'احفظ رقم الطوارئ المحلي وسفارة بلدك في هاتفك قبل المغادرة.'
      : 'Save local emergency and your embassy contact before you depart.',
  }

  return (Object.keys(LABELS) as TripIntelSection['id'][]).map((id) => ({
    id,
    title: L(id),
    body: bodies[id],
    tone: id === 'safety' || id === 'visa' ? 'caution' : id === 'best_time' ? 'highlight' : 'calm',
  }))
}
