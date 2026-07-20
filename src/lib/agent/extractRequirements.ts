import type {
  AgentIntent,
  AgentLocale,
  BudgetStyle,
  PackageScope,
  RegenerateScope,
  TravelerType,
  TripRequirements,
} from './types'
import { detectAgentLocale } from './locale'
import { detectOpenEndedDestination } from './reasoning/openEndedDetector'

const DESTINATION_ALIASES: Array<{ keys: string[]; value: string }> = [
  { keys: ['tokyo', 'طوكيو'], value: 'Tokyo' },
  { keys: ['osaka', 'اوساكا', 'أوساكا'], value: 'Osaka' },
  { keys: ['kyoto', 'كيوتو'], value: 'Kyoto' },
  { keys: ['japan', 'اليابان'], value: 'Japan' },
  { keys: ['sapporo', 'hokkaido', 'سابورو', 'هوكايدو'], value: 'Sapporo' },
  { keys: ['switzerland', 'zurich', 'سويسرا', 'زوريخ'], value: 'Switzerland' },
  { keys: ['austria', 'vienna', 'innsbruck', 'النمسا', 'فيينا'], value: 'Austria' },
  { keys: ['norway', 'oslo', 'bergen', 'النرويج', 'أوسلو', 'اوسلو'], value: 'Norway' },
  { keys: ['canada', 'montreal', 'toronto', 'vancouver', 'كندا', 'مونتريال', 'تورونتو'], value: 'Canada' },
  { keys: ['new zealand', 'new-zealand', 'queenstown', 'auckland', 'نيوزيلندا', 'نيوزيلاندا'], value: 'New Zealand' },
  { keys: ['iceland', 'reykjavik', 'آيسلندا', 'ايسلندا', 'ريكيافيك'], value: 'Iceland' },
  { keys: ['riyadh', 'الرياض'], value: 'Riyadh' },
  { keys: ['jeddah', 'جدة'], value: 'Jeddah' },
  { keys: ['dubai', 'دبي'], value: 'Dubai' },
  { keys: ['paris', 'باريس'], value: 'Paris' },
  { keys: ['rome', 'روما', 'italy', 'إيطاليا', 'ايطاليا'], value: 'Rome' },
  { keys: ['barcelona', 'برشلونة', 'spain', 'إسبانيا', 'اسبانيا'], value: 'Barcelona' },
  { keys: ['france', 'فرنسا'], value: 'Paris' },
  { keys: ['istanbul', 'اسطنبول', 'إسطنبول', 'تركيا', 'turkey'], value: 'Istanbul' },
  { keys: ['london', 'لندن', 'uk', 'britain'], value: 'London' },
  { keys: ['cairo', 'القاهرة', 'egypt', 'مصر'], value: 'Cairo' },
  { keys: ['maldives', 'المالديف'], value: 'Maldives' },
  { keys: ['bali', 'بالي', 'indonesia', 'اندونيسيا', 'إندونيسيا'], value: 'Bali' },
  {
    keys: [
      'morocco', 'marrakech', 'casablanca', 'agadir', 'rabat',
      'المغرب', 'مراكش', 'الدار البيضاء', 'اكادير', 'أكادير', 'الرباط',
    ],
    value: 'Morocco',
  },
]

export interface ExtractionResult {
  locale: AgentLocale
  intent: AgentIntent
  patch: Partial<TripRequirements>
}

export function extractFromUserText(
  text: string,
  fallbackLocale: AgentLocale = 'ar',
): ExtractionResult {
  const locale = detectAgentLocale(text, fallbackLocale)
  const normalized = text.trim()
  const lower = normalized.toLowerCase()
  const intent = detectIntent(lower, normalized, locale)
  const patch: Partial<TripRequirements> = {}

  const regenerateDay = matchRegenerateDay(lower, normalized)
  if (regenerateDay != null) {
    patch.regenerateDay = regenerateDay
    patch.regenerateScope = 'day'
  }

  const regenerateScope = matchRegenerateScope(lower, normalized, intent)
  if (regenerateScope) patch.regenerateScope = regenerateScope

  const origin = matchOrigin(lower, normalized)
  if (origin) patch.origin = origin

  const destinations = matchDestinations(lower, normalized, origin)
  if (destinations.length > 0) {
    patch.destination = destinations[0]
    patch.destinations = destinations
  }

  const duration = matchDuration(lower, normalized)
  if (duration != null) patch.durationDays = duration

  if (/\bweekend\b|عطلة نهاية|نهاية الأسبوع|نهاية الاسبوع/.test(lower) || /نهاية\s*الأسبوع/.test(normalized)) {
    patch.durationDays = patch.durationDays ?? 2
  }

  const budget = matchBudget(lower, normalized)
  if (budget) {
    patch.budgetAmount = budget.amount
    patch.budgetCurrency = budget.currency
    patch.budgetFlexible = false
  } else if (/\bflexible\b|no (?:strict )?budget|أي ميزانية|ميزانية مرنة|بدون سقف/.test(lower) || /ميزانية\s*مرنة/.test(normalized)) {
    patch.budgetFlexible = true
  }

  const travelers = matchTravelers(lower, normalized)
  if (travelers) {
    patch.travelers = travelers.count
    patch.travelerType = travelers.type
  }

  if (/\bhoneymoon\b|شهر عسل/.test(lower) || /شهر\s*عسل/.test(normalized)) {
    patch.tripPurpose = 'honeymoon'
    patch.travelerType = 'couple'
    patch.travelers = patch.travelers ?? 2
    patch.interests = uniqueInterests([...(patch.interests ?? []), 'romance', 'beach'])
  } else if (/\bbusiness\b|work trip|رحلة عمل|عمل\b/.test(lower) || /رحلة\s*عمل/.test(normalized)) {
    patch.tripPurpose = 'business'
    patch.travelerType = 'business'
    patch.travelers = patch.travelers ?? 1
    patch.interests = uniqueInterests([...(patch.interests ?? []), 'meetings', 'city'])
  } else if (/\bfamily\b|عائلي|عائلة|أطفال|اطفال/.test(lower) || /عائلة/.test(normalized)) {
    patch.tripPurpose = 'family'
    patch.travelerType = 'family'
    // Do not invent party size for "family" unless the user stated a number.
  } else if (
    /\bcouple\b|زوجين/.test(lower)
    || /\b(?:with )?(?:my )?(?:wife|husband|spouse|partner)\b/.test(lower)
    || /زوجتي|زوجي|زوجته|زوجها|خطيبتي|خطيبي/.test(normalized)
  ) {
    patch.travelerType = 'couple'
    patch.travelers = patch.travelers ?? 2
  } else if (/\bsolo\b|alone|وحدي|منفرد/.test(lower)) {
    patch.travelerType = 'solo'
    patch.travelers = patch.travelers ?? 1
  } else if (/\bfriends\b|أصدقاء|اصديق/.test(lower)) {
    patch.travelerType = 'friends'
  }

  const dates = matchDates(normalized)
  if (dates.start) patch.startDate = dates.start
  if (dates.end) patch.endDate = dates.end

  const monthDate = matchMonthHint(lower, normalized)
  if (monthDate && !patch.startDate) patch.startDate = monthDate

  const interests = matchInterests(lower, normalized)
  if (interests.length) patch.interests = uniqueInterests([...(patch.interests ?? []), ...interests])

  const weather = matchWeatherPreference(lower, normalized)
  if (weather) patch.weatherPreference = weather

  const budgetStyle = matchBudgetStyle(lower, normalized)
  if (budgetStyle) patch.budgetStyle = budgetStyle

  const hotel = matchHotelPreference(lower, normalized)
  if (hotel) patch.hotelPreference = hotel

  const packageScope = matchPackageScope(lower, normalized)
  if (packageScope) patch.packageScope = packageScope

  const openEnded = detectOpenEndedDestination(
    normalized,
    Boolean(patch.destination),
  )
  // Require a clear open-ended ask (somewhere / مكان / recommend) — weather alone is not enough.
  if (openEnded.isOpenEnded && openEnded.confidence >= 0.5) {
    patch.destinationFlexible = true
    if (openEnded.climateHint && !patch.weatherPreference) {
      patch.weatherPreference = openEnded.climateHint
    }
  }

  if (intent === 'edit') {
    const noteMatch = normalized.match(/(?:note|notes|ملاحظة|ملاحظات)\s*[:：-]?\s*(.+)$/i)
    if (noteMatch?.[1]) patch.notes = noteMatch[1].trim()
  }

  return { locale, intent, patch }
}

function detectIntent(lower: string, original: string, locale: AgentLocale): AgentIntent {
  // Sprint 17 — smart itinerary intents (before order / confirmation / history)
  if (
    /\bshow (?:my )?itinerary\b|\bmy (?:smart )?itinerary\b|\bopen (?:my )?itinerary\b/.test(lower)
    || /أظهر (?:جدولي|الجدول)|اعرض (?:جدولي|الجدول)|جدولي الذكي|الجدول الذكي/.test(original)
  ) {
    return 'show_my_itinerary'
  }
  if (
    /\bwhat(?:'s| is) today(?:'s)? plan\b|\btoday(?:'s)? (?:plan|agenda|schedule)\b/.test(lower)
    || /خطة اليوم|ما خطة اليوم|جدول اليوم/.test(original)
  ) {
    return 'whats_todays_plan'
  }
  if (
    /\bwhen should i leave(?: for the airport)?\b|\bleave for (?:the )?airport\b|\bairport (?:leave|departure) time\b/.test(lower)
    || /متى أغادر للمطار|متى اذهب للمطار|وقت المطار/.test(original)
  ) {
    return 'when_leave_for_airport'
  }
  if (
    /\bsummarize (?:my )?trip\b|\btrip summary\b|\bsummarise (?:my )?trip\b/.test(lower)
    || /لخّص رحلتي|لخص رحلتي|ملخص رحلتي/.test(original)
  ) {
    return 'summarize_my_trip'
  }

  // Sprint 15 — order / payment intents (before confirmation / history / plan)
  // Test `lower` and `original` separately so concatenating does not erase \b boundaries.
  if (
    /\bhow much (?:will|do) i pay\b|\bhow much (?:is|for) (?:my )?(?:order|total|payment)\b|\bwhat (?:is|will be) (?:the |my )?(?:total|price|amount)\b/.test(lower)
    || /كم سأدفع|كم ادفع|كم المبلغ|ما هو الإجمالي/.test(original)
  ) {
    return 'how_much_will_i_pay'
  }
  if (
    /\bis my order ready\b|\border ready\b|\bis (?:the |my )?order (?:ready|complete)\b/.test(lower)
    || /هل الطلب جاهز|هل طلبي جاهز/.test(original)
  ) {
    return 'is_order_ready'
  }
  if (
    /\bshow (?:my )?checkout\b|\bcheckout (?:review|summary|page)\b/.test(lower)
    || /أظهر الدفع|اعرض الدفع|مراجعة الدفع|صفحة الدفع/.test(original)
  ) {
    return 'show_checkout'
  }
  if (
    /\bwhat is my payment status\b|\bpayment status\b|\bhave i paid\b/.test(lower)
    || /حالة الدفع|هل دفعت/.test(original)
  ) {
    return 'what_is_payment_status'
  }

  // Sprint 14 — confirmation intents (before Sprint 13 history / plan)
  if (
    /\bhas my booking been confirmed\b|\bis my booking confirmed\b|\bbooking confirmed\b|هل تم تأكيد|هل حجزي مؤكد|تأكد الحجز/.test(lower + original)
  ) {
    return 'booking_confirmed'
  }
  if (
    /\bshow confirmation\b|\bconfirmation (?:details|summary)\b|أظهر التأكيد|اعرض التأكيد|ملخص التأكيد/.test(lower + original)
  ) {
    return 'show_confirmation'
  }
  if (
    /\bwhat is my booking reference\b|\bbooking reference\b|\bconfirmation reference\b|ما هو مرجع|رقم الحجز|مرجع الحجز/.test(lower + original)
  ) {
    return 'booking_reference'
  }
  if (
    /\bwhat is the booking status\b|\bbooking status\b|حالة الحجز|ما هي حالة/.test(lower + original)
  ) {
    return 'booking_status'
  }

  // Sprint 13 — booking history / My Trips intents (before generic plan/save)
  if (
    /\bsummarize\b.*\b(itinerary|trip|booking)\b|\bitinerary summary\b|لخّص|لخص|ملخص (?:الرحلة|الحجز|مساري)/.test(lower + original)
  ) {
    return 'summarize_itinerary'
  }
  if (
    /\b(booking|trip)\s+details\b|\bshow\b.*\bbooking details\b|تفاصيل الحجز|تفاصيل رحلتي/.test(lower + original)
  ) {
    return 'show_booking_details'
  }
  if (
    /\blatest booking\b|\blast booking\b|\bmy (?:latest|last) (?:booking|trip)\b|أحدث حجز|اخر حجز|آخر حجز/.test(lower + original)
  ) {
    return 'show_latest_booking'
  }
  if (
    /\bshow my trips\b|\bmy trips\b|\blist (?:my )?(?:trips|bookings)\b|\bbooking history\b|رحلاتي|حجوزاتي|اعرض رحلاتي|أظهر رحلاتي/.test(lower + original)
  ) {
    return 'show_trips'
  }

  if (
    /\bregenerate\s+day\b|أعد اليوم|اعد اليوم|جدّد اليوم|جدد اليوم|أعد إنشاء اليوم|اعد انشاء اليوم/.test(lower)
    || /أعد\s*اليوم|اعد\s*اليوم/.test(original)
    || matchRegenerateDay(lower, original) != null
  ) {
    return 'regenerate_day'
  }
  if (
    /\bregenerate\b|\bredo\b|\brefresh\b|أعد إنشاء|اعد انشاء|أعد توليد|اعد توليد|جدّد|جدد/.test(lower)
    && /\bflight|flights|hotel|hotels|activit|attraction|طيران|فنادق|فندق|أنشطة|انشطة|معالم/.test(lower + original)
  ) {
    return 'regenerate'
  }
  if (/\bregenerate\b|أعد إنشاء|اعد انشاء|أعد توليد|اعد توليد|جدّد الخطة|جدد الخطة/.test(lower)) {
    return 'regenerate'
  }
  if (/\bsave\b|احفظ|حفظ الخطة|حفظ الرحلة/.test(lower)) return 'save'
  if (/\bedit\b|update\b|change\b|عدّل|عدل|غيّر|غير|حدّث|حدث/.test(lower)) return 'edit'

  const hasNamedDestination = DESTINATION_ALIASES.some((row) =>
    row.keys.some((k) => lower.includes(k.toLowerCase()) || original.includes(k)),
  )

  // Sprint 45 — open-ended destination discovery (before generic plan).
  const openEnded = detectOpenEndedDestination(original, hasNamedDestination)
  if (openEnded.isOpenEnded && openEnded.confidence >= 0.5) {
    return 'discover'
  }

  if (
    /\bplan\b|\btrip\b|\bvacation\b|\bitinerary\b|\bhoneymoon\b|\bbusiness\b|خط[ةه]|رحل|عطلة|إجازة|اجازة|نهاية|شهر عسل|رحلة عمل/.test(lower)
  ) {
    return 'plan'
  }
  void locale
  return 'answer'
}

function matchRegenerateScope(
  lower: string,
  original: string,
  intent: AgentIntent,
): RegenerateScope | null {
  if (intent === 'regenerate_day') return 'day'
  if (intent !== 'regenerate' && !/\bregenerate\b|\bredo\b|جدد|جدّد|أعد|اعد/.test(lower + original)) {
    return null
  }
  if (/\bflight|flights|طيران/.test(lower) || /طيران/.test(original)) return 'flight'
  if (/\bhotel|hotels|stay|stays|فندق|فنادق/.test(lower) || /فندق|فنادق/.test(original)) return 'hotel'
  if (/\bactivit|attraction|معالم|أنشطة|انشطة/.test(lower) || /معالم|أنشطة|انشطة/.test(original)) {
    return 'activities'
  }
  if (intent === 'regenerate') return 'whole'
  return null
}

function matchRegenerateDay(lower: string, original: string): number | null {
  const en = lower.match(/(?:regenerate|redo|refresh)\s+(?:day\s*)?(\d+)/)
  if (en) return Math.max(1, Math.min(21, Number(en[1])))
  const ar = original.match(/(?:أعد|اعد|جدد|جدّد).*?(\d+)/)
  if (ar) return Math.max(1, Math.min(21, Number(ar[1])))
  const dayOnly = lower.match(/\bday\s*(\d+)\b/)
  if (dayOnly && /\bregenerate\b|redo|refresh|أعد|اعد|جدد/.test(lower + original)) {
    return Math.max(1, Math.min(21, Number(dayOnly[1])))
  }
  return null
}

function aliasForToken(token: string): string | null {
  const lower = token.trim().toLowerCase()
  if (!lower) return null
  for (const entry of DESTINATION_ALIASES) {
    if (entry.keys.some((key) => lower === key || lower.includes(key))) return entry.value
  }
  return null
}

/** Strip English/Arabic "from …" clauses so origin cities cannot steal the destination. */
function stripOriginClauses(lower: string, original: string): { lower: string; original: string } {
  return {
    lower: lower
      .replace(/\b(?:from|depart(?:ing)?\s+from)\s+[a-z][a-z\s]{0,30}?(?=\s*(?:,|\.|$|for\b|with\b|under\b|next\b|to\b|in\b|budget\b|\d))/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
    original: original
      .replace(/(?:من\s+مطار|مغادرة\s+من|السفر\s+من|من)\s+[^\s،,]{2,40}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  }
}

function matchDestinations(
  lower: string,
  original: string,
  origin: string | null,
): string[] {
  const stripped = stripOriginClauses(lower, original)
  const found: string[] = []
  const push = (value: string | null | undefined) => {
    if (!value) return
    if (origin && value === origin && found.length === 0) return
    if (!found.includes(value)) found.push(value)
  }

  // Alias scan first on destination-only text (origin clauses removed).
  for (const entry of DESTINATION_ALIASES) {
    if (entry.keys.some((key) => stripped.lower.includes(key) || stripped.original.includes(key))) {
      push(entry.value)
    }
  }

  // Multi-city: "Paris and Rome" / "باريس وروما"
  const multiEn = stripped.lower.match(
    /\b([a-z][a-z]+)\s+and\s+([a-z][a-z]+)\b/,
  )
  if (multiEn) {
    push(aliasForToken(multiEn[1]!))
    push(aliasForToken(multiEn[2]!))
  }
  const multiAr = stripped.original.match(
    /([^\s،,]{2,40})\s+و\s*([^\s،,]{2,40})/,
  )
  if (multiAr) {
    push(aliasForToken(multiAr[1]!))
    push(aliasForToken(multiAr[2]!))
  }

  // Cue-based free text — ignore verbs after "to" ("to spend", "to visit").
  if (found.length === 0) {
    const enCue = stripped.lower.match(
      /\b(?:to|in)\s+(?!spend|visit|travel|plan|go|have|be|get|make|see|book|want)([a-z][a-z]*(?:\s+[a-z]+){0,2}?)(?=\s*(?:,|\.|$|for\b|with\b|under\b|next\b|from\b|and\b|budget\b|\d|couple|family|solo))/,
    )
    const arCue = stripped.original.match(/(?:إلى|الى)\s+([^\s،,]{2,40})/)
    if (enCue?.[1]) {
      const raw = capitalizeDestination(enCue[1].trim())
      if (raw && !isStopWord(raw)) push(aliasForToken(enCue[1]) || raw)
    }
    if (arCue?.[1]) {
      const raw = capitalizeDestination(arCue[1].trim())
      if (raw && !isStopWord(raw)) push(aliasForToken(arCue[1]) || raw)
    }
  }

  // Bounded free-text fallback (prevents "Barcelona for a couple under…").
  if (found.length === 0) {
    const loose = stripped.lower.match(
      /\bin\s+([a-z][a-z]*(?:\s+[a-z]+){0,1}?)(?=\s*(?:,|\.|$|for\b|with\b|under\b|next\b|from\b|budget\b|\d))/,
    )
      || stripped.original.match(/(?:إلى|الى)\s+([^\s،,]{2,40})/)
    if (loose?.[1]) {
      const raw = capitalizeDestination(loose[1].replace(/[?.!].*$/, '').trim())
      if (raw && !isStopWord(raw) && raw !== origin) push(raw)
    }
  }

  return found.filter((value) => !isStopWord(value)).slice(0, 4)
}

function matchOrigin(lower: string, original: string): string | null {
  const ar = original.match(
    /(?:من\s+مطار|مغادرة\s+من|السفر\s+من|من)\s+([^\s،,]{2,40})/,
  )
  const en = lower.match(
    /\b(?:from|depart(?:ing)?\s+from)\s+([a-z][a-z]*(?:\s+[a-z]+){0,2}?)(?=\s*(?:,|\.|$|for\b|with\b|under\b|next\b|to\b|in\b|budget\b|\d))/,
  )
  const raw = (ar?.[1] || en?.[1] || '').replace(/[?.!].*$/, '').trim()
  if (!raw) return null
  const alias = aliasForToken(raw)
  if (alias) return alias
  for (const entry of DESTINATION_ALIASES) {
    if (entry.keys.some((key) => raw.includes(key) || raw.toLowerCase().includes(key.toLowerCase()))) {
      return entry.value
    }
  }
  const capped = capitalizeDestination(raw)
  return capped && !isStopWord(capped) ? capped : null
}

function matchDuration(lower: string, original: string): number | null {
  const en = lower.match(/(\d+)\s*-?\s*day/)
  if (en) return clampDays(Number(en[1]))
  const ar = original.match(/(\d+)\s*(?:أيام|ايام|يوم)/)
  if (ar) return clampDays(Number(ar[1]))
  const week = lower.match(/(\d+)\s*-?\s*week/) || original.match(/(\d+)\s*(?:أسابيع|اسابيع|أسبوع|اسبوع)/)
  if (week) return clampDays(Number(week[1]) * 7)
  // Word forms: "two weeks", "a fortnight", "أسبوعين"
  const weekWord = lower.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|a|an)\s+-?\s*weeks?\b/,
  )
  if (weekWord) {
    const map: Record<string, number> = {
      a: 1,
      an: 1,
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
    }
    const n = map[weekWord[1]!]
    if (n) return clampDays(n * 7)
  }
  // Word forms: "seven days", "لمدة سبعة أيام"
  const dayWordEn = lower.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|a|an)\s+-?\s*days?\b/,
  )
  if (dayWordEn) {
    const map: Record<string, number> = {
      a: 1,
      an: 1,
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
    }
    const n = map[dayWordEn[1]!]
    if (n) return clampDays(n)
  }
  const dayWordAr = original.match(
    /(?:لمدة\s*)?(يومين|يومان|يوم|واحد|اثنين|اثنان|ثلاثة|ثلاث|أربعة|اربعة|خمسة|ستة|سبعة|ثمانية|تسعة|عشرة)\s*(?:أيام|ايام|يوم)?/,
  )
  if (dayWordAr) {
    const map: Record<string, number> = {
      يوم: 1,
      واحد: 1,
      يومين: 2,
      يومان: 2,
      اثنين: 2,
      اثنان: 2,
      ثلاثة: 3,
      ثلاث: 3,
      أربعة: 4,
      اربعة: 4,
      خمسة: 5,
      ستة: 6,
      سبعة: 7,
      ثمانية: 8,
      تسعة: 9,
      عشرة: 10,
    }
    const n = map[dayWordAr[1]!]
    if (n) return clampDays(n)
  }
  if (/\bfortnight\b/.test(lower)) return 14
  if (/أسبوعين|اسبوعين/.test(original)) return 14
  if (/\bone week\b|أسبوع|اسبوع/.test(lower) || /أسبوع|اسبوع/.test(original)) return 7
  return null
}

function matchBudget(lower: string, original: string): { amount: number; currency: string } | null {
  const underEn = lower.match(/(?:under|below|max(?:imum)?|budget)\s*\$?\s*(\d+(?:[.,]\d+)?)/)
  const underAr = original.match(/(?:أقل من|اقل من|تحت|ميزانية|بميزانية)\s*\$?\s*(\d+(?:[.,]\d+)?)/)
  const plainMoney = lower.match(/\$\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:usd|sar|eur|aed|\$)/)
  const raw = underEn?.[1] || underAr?.[1] || plainMoney?.[1] || plainMoney?.[2]
  if (!raw) return null
  const amount = Number(raw.replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) return null
  let currency = 'USD'
  if (/\bsar\b|ر.?س|ريال/.test(lower) || /ريال/.test(original)) currency = 'SAR'
  else if (/\baed\b|درهم/.test(lower) || /درهم/.test(original)) currency = 'AED'
  else if (/\beur\b|€|يورو/.test(lower)) currency = 'EUR'
  else if (/\$|usd|دولار/.test(lower) || /دولار/.test(original)) currency = 'USD'
  return { amount, currency }
}

function matchTravelers(lower: string, original: string): { count: number; type: TravelerType } | null {
  const en = lower.match(/(\d+)\s*(?:people|persons|travelers|adults|guests)/)
  const ar = original.match(/(\d+)\s*(?:أشخاص|اشخاص|أفراد|افراد|مسافر)/)
  const kids = lower.match(/(\d+)\s*(?:kids?|children)/)
    || original.match(/(\d+)\s*(?:أطفال|اطفال|طفل)/)
  if (kids?.[1]) {
    const childCount = Number(kids[1])
    if (Number.isFinite(childCount) && childCount > 0) {
      // Assume two adults + stated children for family party size.
      return { count: childCount + 2, type: 'family' }
    }
  }
  if (/\bone person\b|\ba person\b|شخص واحد|فرد واحد/.test(lower) || /شخص\s*واحد|فرد\s*واحد/.test(original)) {
    return { count: 1, type: 'solo' }
  }
  const count = Number(en?.[1] || ar?.[1] || 0)
  if (!count) return null
  let type: TravelerType = 'friends'
  if (count === 1) type = 'solo'
  else if (count === 2) type = 'couple'
  else if (count >= 3) type = 'family'
  return { count, type }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const dt = new Date(Date.UTC(year, month - 1, day))
  if (
    dt.getUTCFullYear() !== year
    || dt.getUTCMonth() !== month - 1
    || dt.getUTCDate() !== day
  ) {
    return null
  }
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function formatUtcIso(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

function addUtcDays(base: Date, days: number): Date {
  const next = new Date(base.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function addUtcMonths(base: Date, months: number): Date {
  const next = new Date(base.getTime())
  next.setUTCMonth(next.getUTCMonth() + months)
  return next
}

function matchDates(
  text: string,
  now: Date = new Date(),
): { start: string | null; end: string | null } {
  const iso = [...text.matchAll(/(20\d{2}-\d{2}-\d{2})/g)].map((m) => m[1])
  if (iso.length >= 2) return { start: iso[0], end: iso[1] }
  if (iso.length === 1) return { start: iso[0], end: null }

  const slashDates = [...text.matchAll(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/g)]
  if (slashDates.length > 0) {
    const parsed = slashDates.map((m) => {
      let year = Number(m[3])
      if (year < 100) year += 2000
      return toIsoDate(year, Number(m[2]), Number(m[1]))
    }).filter((v): v is string => !!v)
    if (parsed.length >= 2) return { start: parsed[0], end: parsed[1] }
    if (parsed.length === 1) return { start: parsed[0], end: null }
  }

  const dashDates = [...text.matchAll(/(?:^|[^\d])(\d{1,2})-(\d{1,2})-(20\d{2}|\d{2})(?:[^\d]|$)/g)]
  if (dashDates.length > 0) {
    const parsed = dashDates.map((m) => {
      let year = Number(m[3])
      if (year < 100) year += 2000
      return toIsoDate(year, Number(m[2]), Number(m[1]))
    }).filter((v): v is string => !!v)
    if (parsed.length >= 2) return { start: parsed[0], end: parsed[1] }
    if (parsed.length === 1) return { start: parsed[0], end: null }
  }

  const lower = text.toLowerCase()
  if (/\btomorrow\b|غداً|غدا|بكره|بكرة/.test(lower) || /غدا/.test(text)) {
    return { start: formatUtcIso(addUtcDays(now, 1)), end: null }
  }
  if (
    /\bnext\s+week\b/.test(lower)
    || /بعد\s*أسبوع|بعد\s*اسبوع/.test(text)
    || /الأسبوع\s*القادم|الاسبوع\s*القادم|الأسبوع\s*المقبل|الاسبوع\s*المقبل/.test(text)
  ) {
    return { start: formatUtcIso(addUtcDays(now, 7)), end: null }
  }
  if (
    /\bnext\s+month\b/.test(lower)
    || /بعد\s*شهر/.test(text)
    || /الشهر\s*القادم|الشهر\s*المقبل/.test(text)
  ) {
    return { start: formatUtcIso(addUtcMonths(now, 1)), end: null }
  }

  return { start: null, end: null }
}

/** Resolve soft month hints like "next April" into a planning start date (YYYY-MM-01). */
function matchMonthHint(lower: string, original: string): string | null {
  const months: Array<{ keys: string[]; month: number }> = [
    { keys: ['january', 'يناير'], month: 1 },
    { keys: ['february', 'فبراير'], month: 2 },
    { keys: ['march', 'مارس'], month: 3 },
    { keys: ['april', 'أبريل', 'ابريل'], month: 4 },
    { keys: ['may', 'مايو'], month: 5 },
    { keys: ['june', 'يونيو'], month: 6 },
    { keys: ['july', 'يوليو'], month: 7 },
    { keys: ['august', 'أغسطس', 'اغسطس'], month: 8 },
    { keys: ['september', 'سبتمبر'], month: 9 },
    { keys: ['october', 'أكتوبر', 'اكتوبر'], month: 10 },
    { keys: ['november', 'نوفمبر'], month: 11 },
    { keys: ['december', 'ديسمبر'], month: 12 },
  ]
  for (const entry of months) {
    if (entry.keys.some((k) => lower.includes(k) || original.includes(k))) {
      const now = new Date()
      let year = now.getUTCFullYear()
      if (entry.month <= now.getUTCMonth() + 1) year += 1
      if (/\bnext\b|القادم|المقبل/.test(lower) || /القادم|المقبل/.test(original)) {
        if (entry.month <= now.getUTCMonth() + 1) {
          // already bumped
        } else {
          // keep current year for an upcoming month
        }
      }
      const mm = String(entry.month).padStart(2, '0')
      return `${year}-${mm}-01`
    }
  }
  return null
}

function matchInterests(lower: string, original: string): string[] {
  const catalog: Array<{ keys: string[]; value: string }> = [
    { keys: ['food', 'culinary', 'طعام', 'مطاعم'], value: 'food' },
    { keys: ['museum', 'culture', 'متحف', 'ثقافة'], value: 'culture' },
    { keys: ['beach', 'sea', 'شاطئ', 'بحر'], value: 'beach' },
    { keys: ['nature', 'hike', 'طبيعة', 'hiking'], value: 'nature' },
    { keys: ['shopping', 'تسوق'], value: 'shopping' },
    { keys: ['adventure', 'مغامرة'], value: 'adventure' },
    { keys: ['surprise me', 'any interest', 'no preference', 'أي اهتمام', 'بدون تفضيل', 'فاجأني'], value: 'any' },
  ]
  const found: string[] = []
  for (const entry of catalog) {
    if (entry.keys.some((k) => lower.includes(k.toLowerCase()) || original.includes(k))) {
      found.push(entry.value)
    }
  }
  return found
}

function matchWeatherPreference(lower: string, original: string): string | null {
  if (/\bmild\b|معتدل/.test(lower) || /معتدل/.test(original)) return 'mild'
  // Distinguish true cold from merely cool — ranking depends on this.
  if (/\bcold\b|ثلج|snow|تجمد|قارص/.test(lower) || /بارد|ثلج/.test(original)) return 'cold'
  if (/\bcool\b|مائل للبرودة|منعش/.test(lower) || /مائل للبرودة|منعش/.test(original)) return 'cool'
  if (/\bhot\b|حار/.test(lower) || /حار/.test(original)) return 'hot'
  if (/\bwarm\b|دافئ/.test(lower) || /دافئ/.test(original)) return 'warm'
  if (/\bdry\b|جاف/.test(lower) || /جاف/.test(original)) return 'dry'
  if (/\brainy\b|ممطر/.test(lower) || /ممطر/.test(original)) return 'rainy'
  if (/\bany weather\b|flexible weather|أي طقس|طقس مرن|لا يهم الطقس/.test(lower) || /أي\s*طقس/.test(original)) {
    return 'flexible'
  }
  const weatherHint = lower.match(/(?:prefer(?:red)?|want)?\s*(?:weather|climate)\s*[:：-]?\s*([a-z\s]{3,20})/)
  if (weatherHint?.[1]) return weatherHint[1].trim()
  return null
}

function matchBudgetStyle(lower: string, original: string): BudgetStyle | null {
  if (/\bluxury\b|فاخر|فاخرة|luxury style/.test(lower) || /فاخر/.test(original)) return 'luxury'
  if (
    /\bcheap\b|\bbudget\b|economy|رخيص|اقتصادي|منخفض التكلفة|رخيصة/.test(lower)
    || /اقتصادي|رخيص/.test(original)
  ) {
    // Avoid treating "budget $3000" alone as budget-style when "mid-range" also present
    if (/\bmid[- ]?range\b|متوسط/.test(lower) || /متوسط/.test(original)) return 'midrange'
    if (/\bcheap\b|\bbudget style\b|\bbudget trip\b|\bon a budget\b|رحلة اقتصادية/.test(lower)) {
      return 'budget'
    }
    if (/\bluxury\b/.test(lower)) return 'luxury'
    if (/\bbudget\b/.test(lower) && !/(?:under|below|max|budget)\s*\$?\s*\d/.test(lower)) return 'budget'
  }
  if (/\bmid[- ]?range\b|متوسط|وسط/.test(lower) || /متوسط/.test(original)) return 'midrange'
  if (/\bluxury or budget\b/.test(lower)) return null
  return null
}

function matchHotelPreference(lower: string, original: string): string | null {
  if (/\bcentral hotel\b|hotel downtown|وسط المدينة|فندق وسط/.test(lower) || /وسط\s*المدينة/.test(original)) {
    return 'central'
  }
  if (/\bboutique\b|بوتيك/.test(lower) || /بوتيك/.test(original)) return 'boutique'
  if (/\bresort\b|منتجع/.test(lower) || /منتجع/.test(original)) return 'resort'
  if (/\bapartment\b|شقة|airbnb/.test(lower) || /شقة/.test(original)) return 'apartment'
  if (/\bnear airport\b|قرب المطار|قريب من المطار/.test(lower)) return 'near_airport'
  if (/\bno hotel preference\b|any hotel|أي فندق|بدون تفضيل فندق|لا يهم الفندق/.test(lower)) {
    return 'any'
  }
  const hotelHint = lower.match(/(?:hotel|stay|فندق)\s*(?:preference|prefers?)?\s*[:：-]?\s*([a-z_]{3,24})/)
  if (hotelHint?.[1] && !['in', 'to', 'for', 'and'].includes(hotelHint[1])) {
    return hotelHint[1]
  }
  return null
}

function matchPackageScope(lower: string, original: string): PackageScope | null {
  if (/\bflights?\s*only\b|flight only|طيران فقط|رحلات فقط/.test(lower) || /طيران\s*فقط/.test(original)) {
    return 'flights_only'
  }
  if (/\bfull package\b|full trip|complete package|باقة كاملة|رحلة كاملة|حزمة كاملة/.test(lower)
    || /باقة\s*كاملة|رحلة\s*كاملة/.test(original)) {
    return 'full_package'
  }
  return null
}

function clampDays(value: number): number {
  if (!Number.isFinite(value)) return 3
  return Math.min(21, Math.max(1, Math.round(value)))
}

function capitalizeDestination(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function isStopWord(value: string): boolean {
  const normalized = value.trim()
  if (!normalized) return true
  if (/\b(For|With|Under|Couple|Family|Solo|Budget|Days?)\b/i.test(normalized) && normalized.split(/\s+/).length > 2) {
    return true
  }
  return [
    'A', 'The', 'My', 'Our', 'Trip', 'Plan', 'Weekend', 'Day', 'Days',
    'Honeymoon', 'Business', 'For', 'With', 'Under', 'Couple', 'Family',
  ].includes(normalized)
}

function uniqueInterests(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value.trim())
  }
  return out
}
