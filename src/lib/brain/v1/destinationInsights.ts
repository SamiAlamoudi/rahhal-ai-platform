/**
 * Sprint 87 — Structured destination knowledge for Brain preview reasoning.
 * Indicative bands only — never presented as live quotes.
 */

import type { TravelPlanSlots } from './planning/types'

export type TripStyleHint = 'leisure' | 'business' | 'family' | 'weekend' | 'solo'

export type DestinationInsight = {
  destinationKey: string
  displayNameAr: string
  displayNameEn: string
  cities: string[]
  citiesEn: string[]
  seasonNoteAr: string
  seasonNoteEn: string
  typicalDurationDays: { min: number; max: number; recommended: number }
  /** Indicative mid-range total for recommended duration; not a live quote. */
  indicativeBudgetSar: { low: number; mid: number; high: number }
  weatherNoteAr: string
  weatherNoteEn: string
  flightNoteAr: string
  flightNoteEn: string
  timezoneNoteAr: string
  timezoneNoteEn: string
  attractionsAr: string[]
  attractionsEn: string[]
  itinerarySketchAr: string[]
  itinerarySketchEn: string[]
  cityContrastAr?: string
  cityContrastEn?: string
  styleNotesAr: Partial<Record<TripStyleHint, string>>
  styleNotesEn: Partial<Record<TripStyleHint, string>>
}

const CATALOG: Record<string, DestinationInsight> = {
  morocco: {
    destinationKey: 'morocco',
    displayNameAr: 'المغرب',
    displayNameEn: 'Morocco',
    cities: ['مراكش', 'فاس', 'الدار البيضاء', 'أكادير'],
    citiesEn: ['Marrakech', 'Fes', 'Casablanca', 'Agadir'],
    seasonNoteAr:
      'أفضل موسم عام غالباً الربيع (مارس–مايو) والخريف (سبتمبر–نوفمبر).',
    seasonNoteEn:
      'Spring (Mar–May) and autumn (Sep–Nov) are usually the most comfortable seasons.',
    typicalDurationDays: { min: 5, max: 10, recommended: 7 },
    indicativeBudgetSar: { low: 4500, mid: 7500, high: 12000 },
    weatherNoteAr: 'الساحل ألطف صيفاً؛ الداخل أدفأ مع تباين ليلي أوضح.',
    weatherNoteEn: 'The coast stays milder in summer; inland cities run warmer with cooler nights.',
    flightNoteAr: 'من الرياض/جدة عادة مباشرة أو بتوقف (~6–9 ساعات).',
    flightNoteEn: 'From Riyadh/Jeddah typically direct or one-stop (~6–9 hours).',
    timezoneNoteAr: 'فرق ساعة تقريباً عن السعودية حسب الموسم.',
    timezoneNoteEn: 'Roughly a one-hour offset from Saudi time depending on the season.',
    attractionsAr: ['جامع الفنا', 'فاس القديمة', 'شواطئ أكادير', 'أسواق التوابل'],
    attractionsEn: ['Jemaa el-Fnaa', 'Fes medina', 'Agadir beaches', 'spice souks'],
    itinerarySketchAr: [
      'يومان مراكش: أسواق وحدائق',
      'يومان فاس: مدينة قديمة وحِرف',
      'يومان ساحل (أكادير أو الدار البيضاء)',
    ],
    itinerarySketchEn: [
      '2 days Marrakech: souks and gardens',
      '2 days Fes: medina and crafts',
      '2 days coast (Agadir or Casablanca)',
    ],
    cityContrastAr: 'مراكش حيوية؛ فاس تاريخ؛ الدار البيضاء عملية؛ أكادير شاطئ وهدوء.',
    cityContrastEn: 'Marrakech is lively; Fes is historic; Casablanca is practical; Agadir is beach-calm.',
    styleNotesAr: {
      leisure: 'مزيج مدينة + ساحل يناسب أول زيارة.',
      family: 'أكادير/الدار أسهل عائلياً من الأزقة الكثيفة.',
      weekend: 'ركز على مدينة واحدة لتقليل التنقل.',
      solo: 'مراكش وفاس غنيتان بالمشي للمسافر الفردي.',
      business: 'الدار البيضاء الأنسب لاجتماعات العمل.',
    },
    styleNotesEn: {
      leisure: 'A city-plus-coast mix suits a first visit.',
      family: 'Agadir/Casablanca are easier for families than dense medina lanes.',
      weekend: 'Focus on one city to cut transfers.',
      solo: 'Marrakech and Fes reward solo walking.',
      business: 'Casablanca fits business meetings best.',
    },
  },
  agadir: {
    destinationKey: 'agadir',
    displayNameAr: 'أكادير',
    displayNameEn: 'Agadir',
    cities: ['أكادير'],
    citiesEn: ['Agadir'],
    seasonNoteAr: 'مناسبة معظم السنة؛ الربيع والخريف مريحان للشواطئ.',
    seasonNoteEn: 'Comfortable most of the year; spring and autumn are ideal for the beach.',
    typicalDurationDays: { min: 3, max: 7, recommended: 5 },
    indicativeBudgetSar: { low: 3500, mid: 5500, high: 9000 },
    weatherNoteAr: 'مناخ ساحلي ألطف من مراكش صيفاً.',
    weatherNoteEn: 'Coastal climate is milder than Marrakech in summer.',
    flightNoteAr: 'غالباً عبر الدار البيضاء أو رحلات موسمية.',
    flightNoteEn: 'Often via Casablanca or seasonal direct options.',
    timezoneNoteAr: 'نفس توقيت المغرب تقريباً.',
    timezoneNoteEn: 'Same timezone band as the rest of Morocco.',
    attractionsAr: ['شاطئ أكادير', 'الكورنيش', 'سوق الأحد'],
    attractionsEn: ['Agadir beach', 'the corniche', 'Souk El Had'],
    itinerarySketchAr: [
      'يوم وصول واسترخاء على الشاطئ',
      'يوم كورنيش وأسواق',
      'يوم أنشطة خفيفة أو رحلة قصيرة',
    ],
    itinerarySketchEn: [
      'Arrival day and beach reset',
      'Corniche and local markets',
      'Light activities or a short day trip',
    ],
    styleNotesAr: {
      family: 'شاطئ ومرافق أوضح للعائلة.',
      weekend: 'عطلة قصيرة مركّزة على الاسترخاء.',
      leisure: 'إيقاع أهدأ مع تركيز ساحلي.',
    },
    styleNotesEn: {
      family: 'Beach and facilities are clearer for families.',
      weekend: 'A short stay focused on downtime.',
      leisure: 'Slower coastal pace than Marrakech.',
    },
  },
  japan: {
    destinationKey: 'japan',
    displayNameAr: 'اليابان',
    displayNameEn: 'Japan',
    cities: ['طوكيو', 'كيوتو', 'أوساكا'],
    citiesEn: ['Tokyo', 'Kyoto', 'Osaka'],
    seasonNoteAr: 'الربيع (ساكورا) والخريف ممتازان؛ الصيف رطب؛ الشتاء لهوكايدو.',
    seasonNoteEn: 'Spring (sakura) and autumn are excellent; summer is humid; winter suits Hokkaido.',
    typicalDurationDays: { min: 7, max: 14, recommended: 10 },
    indicativeBudgetSar: { low: 12000, mid: 18000, high: 28000 },
    weatherNoteAr: 'طوكيو/أوساكا رطبة صيفاً؛ كيوتو ألطف ربيعاً وخريفاً.',
    weatherNoteEn: 'Tokyo/Osaka are humid in summer; Kyoto is nicer in spring and autumn.',
    flightNoteAr: 'رحلة طويلة من السعودية (~12–16 ساعة) عادة بتوقف.',
    flightNoteEn: 'Long-haul from Saudi (~12–16 hours), usually with a stop.',
    timezoneNoteAr: 'اليابان UTC+9 — خطط لأيام وصول مرنة.',
    timezoneNoteEn: 'Japan is UTC+9 — plan flexible arrival days.',
    attractionsAr: ['أحياء طوكيو', 'معابد كيوتو', 'شينكانسن', 'طعام الشارع'],
    attractionsEn: ['Tokyo neighborhoods', 'Kyoto temples', 'Shinkansen', 'street food'],
    itinerarySketchAr: [
      '3–4 أيام طوكيو',
      '2–3 أيام كيوتو',
      'يوم أوساكا أو نقل شينكانسن',
    ],
    itinerarySketchEn: [
      '3–4 days Tokyo',
      '2–3 days Kyoto',
      'Osaka day or Shinkansen hop',
    ],
    cityContrastAr: 'طوكيو عصرية؛ كيوتو تراثية؛ أوساكا طعام وطاقة.',
    cityContrastEn: 'Tokyo is modern; Kyoto is heritage; Osaka is food and energy.',
    styleNotesAr: {
      family: 'قلّل التنقل اليومي مع الأطفال.',
      solo: 'القطارات ممتازة للمسافر الفردي.',
      leisure: 'مزيج مدينة + تراث لأول زيارة.',
    },
    styleNotesEn: {
      family: 'Keep daily transfers light with children.',
      solo: 'Trains make solo travel easy.',
      leisure: 'City plus heritage is the balanced first visit.',
    },
  },
  london: {
    destinationKey: 'london',
    displayNameAr: 'لندن',
    displayNameEn: 'London',
    cities: ['لندن'],
    citiesEn: ['London'],
    seasonNoteAr: 'أواخر الربيع إلى أوائل الخريف ألطف.',
    seasonNoteEn: 'Late spring through early autumn is usually the most pleasant.',
    typicalDurationDays: { min: 3, max: 7, recommended: 4 },
    indicativeBudgetSar: { low: 6000, mid: 9500, high: 15000 },
    weatherNoteAr: 'طقس متقلب — طبقات خفيفة ومظلة مفيدة.',
    weatherNoteEn: 'Changeable weather — light layers and an umbrella help.',
    flightNoteAr: 'من الرياض/جدة غالباً مباشرة أو بتوقف قصير (~7–8 ساعات).',
    flightNoteEn: 'From Riyadh/Jeddah often direct or short-stop (~7–8 hours).',
    timezoneNoteAr: 'فرق بسيط نسبياً عن السعودية.',
    timezoneNoteEn: 'Relatively small timezone gap versus Saudi Arabia.',
    attractionsAr: ['وسط لندن', 'المتاحف', 'أحياء الأعمال'],
    attractionsEn: ['central London', 'museums', 'business districts'],
    itinerarySketchAr: [
      'يوم وسط المدينة',
      'يوم اجتماعات + سكن قريب',
      'نصف يوم مرن',
    ],
    itinerarySketchEn: [
      'Central London day',
      'Meetings day with nearby stay',
      'Half flexible day',
    ],
    styleNotesAr: {
      business: 'فندق قرب الاجتماعات ومطار/قطار مناسب.',
      leisure: 'أضف متاحف وضفاف النهر.',
      weekend: 'ركز على حيّين فقط.',
    },
    styleNotesEn: {
      business: 'Stay near meetings with easy airport/train access.',
      leisure: 'Add museums and the riverfront.',
      weekend: 'Keep it to two neighborhoods.',
    },
  },
  dubai: {
    destinationKey: 'dubai',
    displayNameAr: 'دبي',
    displayNameEn: 'Dubai',
    cities: ['دبي'],
    citiesEn: ['Dubai'],
    seasonNoteAr: 'الأفضل نوفمبر–مارس؛ الصيف للأنشطة الداخلية.',
    seasonNoteEn: 'Best Nov–Mar; summer favors indoor plans.',
    typicalDurationDays: { min: 2, max: 5, recommended: 3 },
    indicativeBudgetSar: { low: 2500, mid: 4500, high: 8000 },
    weatherNoteAr: 'صيف حار جداً؛ الشتاء معتدل للمشي والشاطئ.',
    weatherNoteEn: 'Summers are intense; winter suits walking and beach time.',
    flightNoteAr: 'من السعودية رحلة قصيرة (~2–3 ساعات) — مثالية لعطلة نهاية الأسبوع.',
    flightNoteEn: 'Short hop from Saudi (~2–3 hours) — ideal for a weekend.',
    timezoneNoteAr: 'لا إرهاق فرق توقيت يذكر.',
    timezoneNoteEn: 'Negligible jet lag from Saudi Arabia.',
    attractionsAr: ['المارينا', 'وسط دبي', 'التسوق'],
    attractionsEn: ['Marina', 'Downtown Dubai', 'shopping'],
    itinerarySketchAr: [
      'يوم مارينا/وسط المدينة',
      'يوم تسوق أو تجربة خفيفة',
      'صباح مرن قبل المغادرة',
    ],
    itinerarySketchEn: [
      'Marina / Downtown day',
      'Shopping or light experience day',
      'Flexible morning before departure',
    ],
    styleNotesAr: {
      weekend: 'خطة مضغوطة لحيّين كحد أقصى.',
      family: 'مولات وأنشطة داخلية آمنة صيفاً.',
      leisure: 'مزيج مدينة + استرخاء.',
    },
    styleNotesEn: {
      weekend: 'Keep the plan to two areas max.',
      family: 'Malls and indoor activities are safer in summer.',
      leisure: 'City energy plus downtime.',
    },
  },
  switzerland: {
    destinationKey: 'switzerland',
    displayNameAr: 'سويسرا',
    displayNameEn: 'Switzerland',
    cities: ['زيورخ', 'إنترلاكن', 'جنيف'],
    citiesEn: ['Zurich', 'Interlaken', 'Geneva'],
    seasonNoteAr: 'الصيف للبحيرات؛ الشتاء للتزلج؛ الربيع/الخريف أقل ازدحاماً.',
    seasonNoteEn: 'Summer for lakes; winter for skiing; spring/autumn are quieter.',
    typicalDurationDays: { min: 5, max: 10, recommended: 7 },
    indicativeBudgetSar: { low: 10000, mid: 16000, high: 25000 },
    weatherNoteAr: 'الجبال أبرد؛ المدن ألطف — خطط لطبقات.',
    weatherNoteEn: 'Mountains run colder than cities — pack layers.',
    flightNoteAr: 'من السعودية عادة بتوقف (~7–10 ساعات).',
    flightNoteEn: 'From Saudi usually one-stop (~7–10 hours).',
    timezoneNoteAr: 'فرق ساعة تقريباً عن السعودية.',
    timezoneNoteEn: 'About a one-hour offset from Saudi time.',
    attractionsAr: ['البحيرات', 'القطارات الجبلية', 'القرى الألبية'],
    attractionsEn: ['lakes', 'mountain trains', 'Alpine villages'],
    itinerarySketchAr: [
      'يومان مدينة وصول',
      'يومان بحيرات/إنترلاكن',
      'يوم قطار منظر طبيعي بإيقاع عائلي',
    ],
    itinerarySketchEn: [
      '2 days arrival city',
      '2 days lakes / Interlaken',
      'Scenic train day at a family pace',
    ],
    cityContrastAr: 'زيورخ عملية؛ إنترلاكن طبيعة؛ جنيف هدوء بحيرة.',
    cityContrastEn: 'Zurich is practical; Interlaken is nature; Geneva is lake-calm.',
    styleNotesAr: {
      family: 'قطارات ومسارات قصيرة أفضل من تنقلات طويلة.',
      leisure: 'ركز على بحيرة + جبل بدل تكديس مدن.',
    },
    styleNotesEn: {
      family: 'Short train hops beat long daily transfers.',
      leisure: 'Lake plus mountain beats packing too many cities.',
    },
  },
}

const ALIASES: Array<{ keys: string[]; catalog: string }> = [
  { keys: ['أغادير', 'اكادير', 'agadir'], catalog: 'agadir' },
  { keys: ['المغرب', 'مغرب', 'morocco', 'مراكش', 'marrakech', 'فاس', 'fes', 'الدار البيضاء', 'casablanca'], catalog: 'morocco' },
  { keys: ['اليابان', 'طوكيو', 'كيوتو', 'أوساكا', 'japan', 'tokyo', 'kyoto', 'osaka'], catalog: 'japan' },
  { keys: ['لندن', 'بريطانيا', 'إنجلترا', 'london', 'uk', 'britain'], catalog: 'london' },
  { keys: ['دبي', 'الامارات', 'الإمارات', 'dubai', 'uae'], catalog: 'dubai' },
  { keys: ['سويسرا', 'زيورخ', 'جنيف', 'إنترلاكن', 'switzerland', 'zurich', 'geneva', 'interlaken'], catalog: 'switzerland' },
]

export function resolveDestinationCatalogKey(destination?: string | null): string | null {
  if (!destination?.trim()) return null
  const d = destination.trim().toLowerCase()
  for (const row of ALIASES) {
    if (row.keys.some((k) => d.includes(k.toLowerCase()))) return row.catalog
  }
  return null
}

/** Prefer city-level insight when specialRequests pins a focus city. */
export function resolveInsightKey(
  destination?: string | null,
  specialRequests?: string | null,
): string | null {
  const fromSpecial = specialRequests?.match(/preferredCity=([^\s|;]+)/i)?.[1]
  if (fromSpecial) {
    const cityKey = resolveDestinationCatalogKey(fromSpecial)
    if (cityKey) return cityKey
  }
  if (destination && /أغادير|اكادير|agadir/i.test(destination)) return 'agadir'
  return resolveDestinationCatalogKey(destination)
}

export function getDestinationInsight(
  destination?: string | null,
  specialRequests?: string | null,
): DestinationInsight | null {
  const key = resolveInsightKey(destination, specialRequests)
  return key ? CATALOG[key] ?? null : null
}

export function inferTripStyle(params: {
  durationDays?: number | null
  specialRequests?: string | null
  travelerProfileHint?: string | null
  adults?: number | null
  children?: number | null
}): TripStyleHint {
  const blob = `${params.specialRequests ?? ''} ${params.travelerProfileHint ?? ''}`.toLowerCase()
  if (/tripstyle=business|\bbusiness\b|عمل|أعمال/.test(blob)) return 'business'
  if (/tripstyle=weekend|نهاية أسبوع|\bweekend\b/.test(blob)) return 'weekend'
  if (
    /tripstyle=family|عائلة|أطفال|\bfamily\b/.test(blob)
    || (params.children != null && params.children > 0)
  ) {
    return 'family'
  }
  if (/tripstyle=solo|فردي|\bsolo\b/.test(blob) || params.adults === 1) {
    if (/tripstyle=solo|فردي|\bsolo\b/.test(blob)) return 'solo'
  }
  if (params.durationDays != null && params.durationDays > 0 && params.durationDays <= 3) {
    return 'weekend'
  }
  if (/tripstyle=weekend|duration=([123])\b/.test(blob)) return 'weekend'
  return 'leisure'
}

export function readTaggedDuration(specialRequests?: string | null): number | null {
  const m = specialRequests?.match(/duration=(\d+)/i)
  return m ? Number(m[1]) : null
}

export function buildDestinationReasoningLines(slots: TravelPlanSlots): string[] {
  const insight = getDestinationInsight(slots.destination, slots.specialRequests)
  if (!insight) return []
  const style = inferTripStyle({
    durationDays: readTaggedDuration(slots.specialRequests),
    specialRequests: slots.specialRequests,
    adults: slots.adults,
    children: slots.children,
  })
  const lines = [
    `destination=${insight.destinationKey}`,
    `season=${insight.seasonNoteEn}`,
    `weather=${insight.weatherNoteEn}`,
    `flight=${insight.flightNoteEn}`,
    `timezone=${insight.timezoneNoteEn}`,
    `duration=${insight.typicalDurationDays.recommended}d`,
    `budgetBandSar=${insight.indicativeBudgetSar.low}-${insight.indicativeBudgetSar.high}`,
    `style=${style}`,
    `attractions=${insight.attractionsEn.slice(0, 3).join('|')}`,
  ]
  const styleNote = insight.styleNotesEn[style]
  if (styleNote) lines.push(`styleNote=${styleNote}`)
  return lines
}

export function indicativeBudgetForSlots(slots: TravelPlanSlots): {
  amount: number
  currency: 'SAR'
  noteAr: string
  noteEn: string
} | null {
  const insight = getDestinationInsight(slots.destination, slots.specialRequests)
  if (!insight) return null
  const style = inferTripStyle({
    durationDays: readTaggedDuration(slots.specialRequests),
    specialRequests: slots.specialRequests,
    adults: slots.adults,
    children: slots.children,
  })
  let amount = insight.indicativeBudgetSar.mid
  if (style === 'weekend') amount = Math.round(insight.indicativeBudgetSar.low * 0.85)
  if (style === 'family') amount = Math.round(insight.indicativeBudgetSar.mid * 1.15)
  if (style === 'business') amount = Math.round(insight.indicativeBudgetSar.high * 0.9)
  return {
    amount,
    currency: 'SAR',
    noteAr: 'تقدير إرشادي أولي — ليس عرض سعر حي.',
    noteEn: 'Preliminary indicative estimate — not a live quote.',
  }
}
