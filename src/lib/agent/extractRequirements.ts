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
import { resolveDestinationIdentity } from './destinationIdentity'
import { normalizeArabicAsrForExtraction } from '../chat/voice/arabicAsrNormalize'

const DESTINATION_ALIASES: Array<{ keys: string[]; value: string }> = [
  { keys: ['tokyo', 'طوكيو'], value: 'Tokyo' },
  { keys: ['bangkok', 'بانكوك', 'بان كوك'], value: 'Bangkok' },
  { keys: ['phuket', 'بوكيت', 'فوكت', 'بوكيت تايلند'], value: 'Phuket' },
  { keys: ['osaka', 'اوساكا', 'أوساكا'], value: 'Osaka' },
  { keys: ['kyoto', 'كيوتو'], value: 'Kyoto' },
  { keys: ['yemen', 'sanaa', 'اليمن', 'صنعاء'], value: 'اليمن' },
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
  { keys: ['lebanon', 'لبنان', 'beirut', 'بيروت'], value: 'لبنان' },
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
  /** Sprint 89 — merge hints (not persisted on TripRequirements). */
  flags?: {
    /** Replace destination list instead of unioning with prior turns. */
    replaceDestinations?: boolean
  }
}

export function extractFromUserText(
  text: string,
  fallbackLocale: AgentLocale = 'ar',
): ExtractionResult {
  const locale = detectAgentLocale(text, fallbackLocale)
  // Parser-only enrichment (digits / word-dates / cabin aliases). Display stays original.
  const normalized = normalizeArabicAsrForExtraction(text.trim())
  const lower = normalized.toLowerCase()
  const intent = detectIntent(lower, normalized, locale)
  const patch: Partial<TripRequirements> = {}
  const flags: NonNullable<ExtractionResult['flags']> = {}

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
    // Latest confirmed destination list always replaces stale / demo / prior-session places.
    flags.replaceDestinations = true
    const normalizedList = destinations.map((d) => resolveDestinationIdentity(d)?.label ?? d)
    const unique = [...new Set(normalizedList)]
    const primary = unique[0]!
    const identity = resolveDestinationIdentity(primary)
    patch.destination = identity?.label ?? primary
    patch.destinations = unique
    patch.destinationCity = identity?.city ?? (identity?.label === primary ? primary : null)
    patch.destinationCountry = identity?.country ?? null
    // Explicit "instead of X" cues collapse to the single new place.
    if (isDestinationReplaceCue(lower, normalized)) {
      patch.destinations = [patch.destination]
    }
  }

  const duration = matchDuration(lower, normalized)
  if (duration != null) patch.durationDays = duration

  if (/\bweekend\b|عطلة نهاية|نهاية الأسبوع|نهاية الاسبوع/.test(lower) || /نهاية\s*الأسبوع/.test(normalized)) {
    // Weekend phrase wins over a bare "أسبوع" match inside "نهاية الأسبوع".
    patch.durationDays = 2
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
    // Do not invent travelers=2 — ask if count was not stated.
    patch.interests = uniqueInterests([...(patch.interests ?? []), 'romance', 'beach'])
  } else if (
    // Bare "Business" / بزنس is cabin class — only treat explicit work-trip cues as purpose.
    /\bbusiness\s*(?:trip|travel)\b|\bwork\s*trip\b|رحلة\s*عمل|سفر\s*عمل/.test(lower)
    || /رحلة\s*عمل|سفر\s*عمل/.test(normalized)
  ) {
    patch.tripPurpose = 'business'
    patch.travelerType = 'business'
    // Do not invent travelers=1 unless the user stated a count.
    patch.interests = uniqueInterests([...(patch.interests ?? []), 'meetings', 'city'])
  } else if (/\bfamily\b|عائلي|عائلة|أطفال|اطفال/.test(lower) || /عائلة/.test(normalized)) {
    patch.tripPurpose = 'family'
    patch.travelerType = 'family'
    // Do not invent party size for "family" unless the user stated a number.
  } else if (
    /\bcouple\b|زوجين/.test(lower)
    || /\b(?:with )?(?:my )?(?:wife|husband|spouse|partner)\b/.test(lower)
    || /\b(?:avec )?(?:ma |mon )?(?:femme|mari|époux|epoux|épouse|epouse|conjoint[e]?)\b/.test(lower)
    || /زوجتي|زوجي|زوجته|زوجها|خطيبتي|خطيبي/.test(normalized)
  ) {
    patch.travelerType = 'couple'
    // Explicit spouse / partner phrasing is a stated party of two.
    // Bare "couple" / زوجين alone must NOT invent a count.
    if (
      /\b(?:with )?(?:my )?(?:wife|husband|spouse|partner)\b/.test(lower)
      || /\b(?:avec )?(?:ma |mon )?(?:femme|mari|époux|epoux|épouse|epouse|conjoint[e]?)\b/.test(lower)
      || /زوجتي|زوجي|زوجته|زوجها|خطيبتي|خطيبي|مع\s*زوجتي|مع\s*زوجي/.test(normalized)
    ) {
      patch.travelers = patch.travelers ?? 2
    }
  } else if (/\bsolo\b|alone|وحدي|منفرد/.test(lower)) {
    patch.travelerType = 'solo'
    // Solo wording is an explicit party-size signal.
    patch.travelers = patch.travelers ?? 1
  } else if (/\bfriends\b|أصدقاء|اصديق/.test(lower)) {
    patch.travelerType = 'friends'
  }

  const dates = matchDates(normalized)
  if (dates.start) patch.startDate = dates.start
  if (dates.end) patch.endDate = dates.end
  if (
    dates.start
    && dates.end
    && patch.durationDays == null
  ) {
    const startMs = Date.parse(`${dates.start}T00:00:00Z`)
    const endMs = Date.parse(`${dates.end}T00:00:00Z`)
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      patch.durationDays = clampDays(Math.round((endMs - startMs) / 86_400_000))
    }
  }

  const monthDate = matchMonthHint(lower, normalized)
  if (monthDate && !patch.startDate) patch.startDate = monthDate

  // Integration Sprint 2 — flexible dates / flight preferences (additive, never blocking).
  if (
    /\bflexible\s+dates?\b|\bdates?\s+flexible\b|around\s+next\s+week|تواريخ?\s*مرنة|مرن\s*في\s*التواريخ|حوالي\s*الأسبوع|حوالي\s*الاسبوع/.test(lower)
    || /تواريخ\s*مرنة|مرن\s*بالتاريخ/.test(normalized)
  ) {
    patch.datesFlexible = true
  }
  if (
    /\bnext\s+week\b/.test(lower)
    || /\bla\s+semaine\s+prochaine\b|\bsemaine\s+prochaine\b/.test(lower)
    || /الأسبوع\s*القادم|الاسبوع\s*القادم|الأسبوع\s*المقبل|الاسبوع\s*المقبل|الأسبوع\s*الجاي|الاسبوع\s*الجاي/.test(normalized)
  ) {
    // Soft flexibility when traveler says "next week" without a hard day.
    if (!isoHardDate(normalized)) patch.datesFlexible = patch.datesFlexible ?? true
  }

  const cabin = matchCabinPreference(lower, normalized)
  if (cabin) patch.cabinPreference = cabin

  const airline = matchPreferredAirline(lower, normalized)
  if (airline) patch.preferredAirline = airline

  const depWindow = matchPreferredDepartureTime(lower, normalized)
  if (depWindow) patch.preferredDepartureTime = depWindow

  const childrenOnly = matchChildrenCount(lower, normalized)
  if (childrenOnly != null) patch.children = childrenOnly

  const interests = matchInterests(lower, normalized)
  if (interests.length) patch.interests = uniqueInterests([...(patch.interests ?? []), ...interests])

  const weather = matchWeatherPreference(lower, normalized)
  if (weather) patch.weatherPreference = weather

  const budgetStyle = matchBudgetStyle(lower, normalized)
  if (budgetStyle) patch.budgetStyle = budgetStyle

  const hotel = matchHotelPreference(lower, normalized)
  if (hotel) patch.hotelPreference = hotel

  // Integration Sprint 3 — hotel rooms / area / amenities / policies (additive).
  const rooms = matchRooms(lower, normalized)
  if (rooms != null) patch.rooms = rooms

  const area = matchPreferredArea(lower, normalized)
  if (area) patch.preferredArea = area

  if (
    /\bbreakfast\b|includes? breakfast|with breakfast|إفطار|افطار|يشمل الإفطار|يشمل الافطار/.test(lower)
    || /يشمل\s*الإفطار|يشمل\s*الافطار|مع\s*إفطار|مع\s*افطار/.test(normalized)
  ) {
    patch.breakfastRequired = true
  }
  if (
    /\bfree cancellation\b|refundable|إلغاء مجاني|الغاء مجاني|قابل للاسترداد/.test(lower)
    || /إلغاء\s*مجاني|الغاء\s*مجاني/.test(normalized)
  ) {
    patch.freeCancellationRequired = true
  }

  const amenities = matchHotelAmenities(lower, normalized)
  if (amenities.length) {
    patch.hotelAmenities = amenities
    if (amenities.includes('breakfast')) patch.breakfastRequired = true
  }

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

  // Star / villa hotel class cues (additive to hotelPreference).
  const hotelClass = matchHotelClass(lower, normalized)
  if (hotelClass) {
    patch.hotelPreference = patch.hotelPreference
      ? `${patch.hotelPreference}|${hotelClass}`
      : hotelClass
  }

  return {
    locale,
    intent,
    patch,
    ...(Object.keys(flags).length > 0 ? { flags } : {}),
  }
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
    /\bplan\b|\btrip\b|\bvacation\b|\bitinerary\b|\bhoneymoon\b|\bbook\b|\bflight\b|\bflights\b/.test(lower)
    || /خط[ةه]|رحل|سفر|أسافر|اسافر|أبغى|ابغى|أبي|ابي|حجز|طيران|عطلة|إجازة|اجازة|نهاية|شهر عسل|رحلة عمل/.test(lower + original)
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
    // Origin city must never appear as a destination (e.g. "Riyadh to Tokyo").
    if (origin && value === origin) return
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
      /\b(?:to|in)\s+(?!spend|visit|travel|plan|go|have|be|get|make|see|book|want|only|just|about|change|continue)([a-z][a-z]*(?:\s+[a-z]+){0,2}?)(?=\s*(?:,|\.|$|for\b|with\b|under\b|next\b|from\b|and\b|budget\b|\d|couple|family|solo|instead\b))/,
    )
    const frCue = stripped.lower.match(
      /\b(?:à|a|au|aux|en|vers)\s+(?!la\b|le\b|les\b|un\b|une\b|des\b|partir|aller|voyage)([a-zàâäéèêëïîôùûüç][a-zàâäéèêëïîôùûüç]*(?:\s+[a-zàâäéèêëïîôùûüç]+){0,2}?)(?=\s*(?:,|\.|$|pour\b|avec\b|la\s+semaine\b|semaine\b|next\b|from\b|et\b|budget\b|\d))/,
    )
    // Do not use bare "ل" — it false-matches the trailing letter of words like "ريال".
    const arCue = stripped.original.match(/(?:إلى|الى)\s+([^\s،,]{2,40})/)
    if (enCue?.[1]) {
      const token = enCue[1].trim()
      if (!isInvalidDestinationToken(token)) {
        const raw = capitalizeDestination(token)
        if (raw && !isStopWord(raw)) push(aliasForToken(token) || raw)
      }
    }
    if (frCue?.[1]) {
      const token = frCue[1].trim()
      if (!isInvalidDestinationToken(token)) {
        const raw = capitalizeDestination(token)
        if (raw && !isStopWord(raw)) push(aliasForToken(token) || raw)
      }
    }
    if (arCue?.[1]) {
      const token = arCue[1].trim()
      if (!isInvalidDestinationToken(token)) {
        const raw = capitalizeDestination(token)
        if (raw && !isStopWord(raw)) push(aliasForToken(token) || raw)
      }
    }
  }

  // Bounded free-text fallback (prevents "Barcelona for a couple under…").
  if (found.length === 0) {
    const loose = stripped.lower.match(
      /\bin\s+([a-z][a-z]*(?:\s+[a-z]+){0,1}?)(?=\s*(?:,|\.|$|for\b|with\b|under\b|next\b|from\b|budget\b|\d|instead\b))/,
    )
      || stripped.original.match(/(?:إلى|الى)\s+([^\s،,]{2,40})/)
    if (loose?.[1]) {
      const token = loose[1].replace(/[?.!].*$/, '').trim()
      if (!isInvalidDestinationToken(token)) {
        const raw = capitalizeDestination(token)
        if (raw && !isStopWord(raw) && raw !== origin) push(raw)
      }
    }
  }

  return found.filter((value) => !isStopWord(value) && !isInvalidDestinationToken(value)).slice(0, 4)
}

function matchOrigin(lower: string, original: string): string | null {
  // Route form: "Riyadh to Tokyo" / "من الرياض إلى طوكيو" (both ends known places).
  for (const m of lower.matchAll(
    /\b([a-z][a-z]*(?:\s+[a-z]+){0,2}?)\s+to\s+([a-z][a-z]*(?:\s+[a-z]+){0,2}?)\b/g,
  )) {
    const fromAlias = aliasForToken(m[1]!)
    const toAlias = aliasForToken(m[2]!)
    if (fromAlias && toAlias && fromAlias !== toAlias) return fromAlias
  }
  const routeAr = original.match(
    /(?:من\s+مطار|مغادرة\s+من|السفر\s+من|من)\s+([^\s،,]{2,40})\s+(?:إلى|الى)\s+([^\s،,]{2,40})/,
  )
  if (routeAr) {
    const fromAlias = aliasForToken(routeAr[1]!)
    const toAlias = aliasForToken(routeAr[2]!)
    if (fromAlias && toAlias && fromAlias !== toAlias) return fromAlias
  }

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
  // Word forms: "two weeks", "a fortnight", "أسبوعين" — before bare "عشرة"
  // so "بميزانية عشرة آلاف" is never mistaken for 10 days.
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
  if (/\bfortnight\b/.test(lower)) return 14
  if (/أسبوعين|اسبوعين/.test(original)) return 14
  if (/\bone week\b|أسبوع|اسبوع/.test(lower) || /أسبوع|اسبوع/.test(original)) return 7
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
  // Require أيام/يوم for Arabic day-count words — never steal "عشرة" from "عشرة آلاف".
  const dayWordAr = original.match(
    /(?:لمدة\s*)?(يومين|يومان|يوم|واحد|اثنين|اثنان|ثلاثة|ثلاث|أربعة|اربعة|خمسة|ستة|سبعة|ثمانية|تسعة|عشرة)\s+(?:أيام|ايام|يوم)/,
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
  // Standalone يومين / يومان without trailing أيام
  if (/\bيومين\b|\bيومان\b/.test(original)) return 2
  // Soft duration answers from consultant prompts ("عطلة قصيرة أم أسبوع؟")
  if (
    /عطلة\s*قصيرة|رحلة\s*قصيرة|إجازة\s*قصيرة|اجازة\s*قصيرة|قصيرة\s*جدا/.test(original)
    || /(?:^|[\s،,])قصيرة(?:[\s،,]|$)/.test(original)
    || /\bshort\s+(?:break|trip|holiday|vacation)\b/.test(lower)
  ) {
    return 3
  }
  if (
    /عطلة\s*متوسطة|رحلة\s*متوسطة|إجازة\s*متوسطة|اجازة\s*متوسطة/.test(original)
    || /\bmedium\s+(?:break|trip|holiday)\b/.test(lower)
  ) {
    return 5
  }
  if (
    /عطلة\s*طويلة|رحلة\s*طويلة|إجازة\s*طويلة|اجازة\s*طويلة/.test(original)
    || /\blong\s+(?:break|trip|holiday|vacation)\b/.test(lower)
  ) {
    return 10
  }
  return null
}

/** Eastern / Persian digits → ASCII so "٥٠٠٠" and "5000" share one parser. */
function normalizeNumerals(text: string): string {
  const map: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  }
  return text.replace(/[٠-٩۰-۹]/g, (ch) => map[ch] ?? ch)
}

function matchBudget(lower: string, original: string): { amount: number; currency: string } | null {
  const lowerN = normalizeNumerals(lower)
  const originalN = normalizeNumerals(original)

  const arabicWordAmount = matchArabicWordBudget(originalN)
  if (arabicWordAmount != null) {
    let currency = 'SAR'
    if (/\baed\b|درهم/.test(lowerN) || /درهم/.test(originalN)) currency = 'AED'
    else if (/\beur\b|€|يورو/.test(lowerN)) currency = 'EUR'
    else if (/\$|usd|دولار/.test(lowerN) || /دولار/.test(originalN)) currency = 'USD'
    else if (/\bsar\b|ر.?س|ريال/.test(lowerN) || /ريال/.test(originalN) || /ميزانية/.test(originalN)) {
      currency = 'SAR'
    }
    return { amount: arabicWordAmount, currency }
  }

  // Bare numeric reply: "5000", "12,000", "2500.50", "٥٠٠٠"
  // (consultant follow-ups often answer budget with a number alone)
  const bare = originalN.trim().match(/^(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)$/)
  if (bare?.[1]) {
    const amount = Number(bare[1].replace(/,/g, ''))
    if (Number.isFinite(amount) && amount > 0) {
      return { amount, currency: 'USD' }
    }
  }

  // Allow fillers: "budget is only 1500", "change budget to just 2000 SAR"
  // Note: do not use bare `spend \d` — that steals day counts from "spend 5 days".
  const underEn = lowerN.match(
    /(?:under|below|max(?:imum)?|less than|budget(?:\s+(?:is|to|of))?|my budget is|keep(?:\s+\w+)?\s+under|spend\s+up\s+to)\s*(?:of\s*)?(?:only|just|about|around|approx(?:imately)?)?\s*(?:sar|usd|aed|eur|\$)?\s*\$?\s*(\d+(?:[.,]\d+)?)/,
  )
  const underAr = originalN.match(
    /(?:أقل من|اقل من|تحت|ميزانية|بميزانية|ميزانيتي|غير الميزانية إلى|إلى فقط)\s*(?:ريال|دولار|درهم)?\s*\$?\s*(\d+(?:[.,]\d+)?)/,
  )
  const sarFirst = lowerN.match(/\b(?:sar|usd|aed|eur)\s*(\d+(?:[.,]\d+)?)/)
  const plainMoney = lowerN.match(/\$\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:usd|sar|eur|aed|\$|ريال|دولار|درهم)/)
  const raw = underEn?.[1] || underAr?.[1] || sarFirst?.[1] || plainMoney?.[1] || plainMoney?.[2]
  if (!raw) return null
  const amount = Number(raw.replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) return null
  let currency = 'USD'
  if (/\bsar\b|ر.?س|ريال/.test(lowerN) || /ريال/.test(originalN) || /ميزانية/.test(originalN)) {
    currency = 'SAR'
  } else if (/\baed\b|درهم/.test(lowerN) || /درهم/.test(originalN)) currency = 'AED'
  else if (/\beur\b|€|يورو/.test(lowerN)) currency = 'EUR'
  else if (/\$|usd|دولار/.test(lowerN) || /دولار/.test(originalN)) currency = 'USD'
  return { amount, currency }
}

/** "عشرة آلاف"، "خمسة آلاف"، "ألفان"، "الف" → numeric SAR-scale amounts. */
function matchArabicWordBudget(original: string): number | null {
  const units: Record<string, number> = {
    واحد: 1,
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
  const multi = original.match(
    /(واحد|اثنين|اثنان|ثلاثة|ثلاث|أربعة|اربعة|خمسة|ستة|سبعة|ثمانية|تسعة|عشرة)\s*(?:آلاف|الاف|ألف|الف)/,
  )
  if (multi?.[1] && units[multi[1]] != null) {
    return units[multi[1]]! * 1000
  }
  if (/ألفان|الفين|ألفين|الفان/.test(original)) return 2000
  if (/(?:ميزانية|بميزانية|ميزانيتي).{0,12}(?:ألف|الف)\b/.test(original)) return 1000
  return null
}

function matchTravelers(lower: string, original: string): { count: number; type: TravelerType } | null {
  const wordCounts: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  }
  // Include singular "traveler" — fixtures say "1 traveler" / "2 travelers".
  const personUnit = 'people|persons|travelers?|travellers?|adults|guests|passengers|pax'
  const en = lower.match(
    new RegExp(`(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\s*(?:${personUnit})\\b`),
  )
  const ar = original.match(/(\d+)\s*(?:أشخاص|اشخاص|أفراد|افراد|مسافر)/)
  const kids = lower.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:kids?|children)/)
    || original.match(/(\d+)\s*(?:أطفال|اطفال|طفل)/)
  if (kids?.[1]) {
    const childCount = wordCounts[kids[1]] ?? Number(kids[1])
    if (Number.isFinite(childCount) && childCount > 0) {
      // Assume two adults + stated children for family party size.
      return { count: childCount + 2, type: 'family' }
    }
  }
  if (/\bone person\b|\ba person\b|شخص واحد|فرد واحد/.test(lower) || /شخص\s*واحد|فرد\s*واحد/.test(original)) {
    return { count: 1, type: 'solo' }
  }
  // Arabic dual / word forms: لشخصين، شخصين، اثنان أشخاص، أنا وزوجتي…
  // CRITICAL: do NOT match bare "اثنين" — it is a substring of weekday "الاثنين".
  if (
    /ل?شخصين|شخصان|فردين/.test(original)
    || /(?:^|[^\u0600-\u06FF])اثنين\s*(?:أشخاص|اشخاص|أفراد|افراد|مسافر)/.test(original)
    || /(?:^|[^\u0600-\u06FF])اثنان\s*(?:أشخاص|اشخاص|أفراد|افراد|مسافر)/.test(original)
    || /أنا\s*وزوجتي|انا\s*وزوجتي|أنا\s*و\s*زوجتي|مع\s*زوجتي/.test(original)
  ) {
    return { count: 2, type: 'couple' }
  }
  if (/ل?ثلاثة\s*(?:أشخاص|افراد|أفراد)|ثلاث\s*(?:أشخاص|افراد)/.test(original)) {
    return { count: 3, type: 'family' }
  }
  const raw = en?.[1] || ar?.[1] || ''
  const count = wordCounts[raw] ?? Number(raw || 0)
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

  // Weekend phrases → concrete Sat–Sun window (approx travel period).
  const weekendNext =
    /\bnext\s+weekend\b/.test(lower)
    || /نهاية\s*الأسبوع\s*القادم|نهاية\s*الاسبوع\s*القادم|عطلة\s*نهاية\s*الأسبوع\s*القادمة|عطلة\s*نهاية\s*الاسبوع\s*القادمة/.test(text)
  const weekendThis =
    /\bthis\s+weekend\b/.test(lower)
    || /نهاية\s*الأسبوع\s*هذي|نهاية\s*الاسبوع\s*هذي|نهاية\s*الأسبوع\s*هذه|نهاية\s*الاسبوع\s*هذه|عطلة\s*نهاية\s*الأسبوع|عطلة\s*نهاية\s*الاسبوع/.test(text)
  const weekendBare =
    /\bweekend\b/.test(lower)
    || /نهاية\s*الأسبوع|نهاية\s*الاسبوع/.test(text)
  if (weekendNext || weekendThis || weekendBare) {
    const range = upcomingWeekendRange(now, { preferNext: weekendNext || (!weekendThis && weekendBare) })
    return range
  }

  if (/\btomorrow\b|غداً|غدا|بكره|بكرة/.test(lower) || /غدا/.test(text)) {
    return { start: formatUtcIso(addUtcDays(now, 1)), end: null }
  }
  if (
    /\bnext\s+week\b/.test(lower)
    || /\bla\s+semaine\s+prochaine\b|\bsemaine\s+prochaine\b/.test(lower)
    || /بعد\s*أسبوع|بعد\s*اسبوع/.test(text)
    || /الأسبوع\s*القادم|الاسبوع\s*القادم|الأسبوع\s*المقبل|الاسبوع\s*المقبل|الأسبوع\s*الجاي|الاسبوع\s*الجاي/.test(text)
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

  // "3 Aug to 13 Aug" / "3 August – 13 August 2026" / "Aug 3 to Aug 13"
  const parsedDayMonth = parseDayMonthDateRange(lower, now)
  if (parsedDayMonth) return parsedDayMonth

  return { start: null, end: null }
}

const MONTH_NAME_TO_NUM: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
}

function monthNameToNumber(token: string): number | null {
  const key = token.toLowerCase().replace(/\.$/, '')
  return MONTH_NAME_TO_NUM[key] ?? null
}

function resolveCalendarYear(month: number, day: number, explicitYear: number | null, now: Date): number {
  if (explicitYear && explicitYear >= 2000) return explicitYear
  let year = now.getUTCFullYear()
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const candidate = Date.UTC(year, month - 1, day)
  if (candidate < todayUtc) year += 1
  return year
}

/** Parse "3 Aug to 13 Aug" / "من 3 أغسطس إلى 13 أغسطس" / "August 3 – August 13, 2026". */
function parseDayMonthDateRange(
  lower: string,
  now: Date,
): { start: string; end: string } | null {
  const monthEn = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'
  const monthAr = 'يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر'
  const dayFirst = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthEn})(?:\\s*,?\\s*(20\\d{2}))?`
    + `\\s*(?:to|through|until|till|–|-|—)\\s*`
    + `(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthEn})(?:\\s*,?\\s*(20\\d{2}))?\\b`,
  )
  const monthFirst = new RegExp(
    `\\b(${monthEn})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(20\\d{2}))?`
    + `\\s*(?:to|through|until|till|–|-|—)\\s*`
    + `(${monthEn})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(20\\d{2}))?\\b`,
  )
  // "من 3 أغسطس إلى 13 أغسطس" / "3 أغسطس إلى 13 أغسطس"
  const arabicRange = new RegExp(
    `(?:من\\s*)?(\\d{1,2})\\s+(${monthAr})(?:\\s+(20\\d{2}))?`
    + `\\s*(?:إلى|الى|لـ|/|-|–|—)\\s*`
    + `(\\d{1,2})\\s+(${monthAr})(?:\\s+(20\\d{2}))?`,
  )

  const buildRange = (
    startDay: number,
    startMonthToken: string,
    startYearToken: string | undefined,
    endDay: number,
    endMonthToken: string,
    endYearToken: string | undefined,
  ): { start: string; end: string } | null => {
    const startMonth = monthNameToNumber(startMonthToken) ?? arabicMonthToNumber(startMonthToken)
    const endMonth = monthNameToNumber(endMonthToken) ?? arabicMonthToNumber(endMonthToken)
    if (!startMonth || !endMonth) return null
    const startYear = resolveCalendarYear(
      startMonth,
      startDay,
      startYearToken ? Number(startYearToken) : null,
      now,
    )
    let endYear = endYearToken ? Number(endYearToken) : startYear
    if (!endYearToken) {
      endYear = startYear
      const startUtc = Date.UTC(startYear, startMonth - 1, startDay)
      const endUtc = Date.UTC(endYear, endMonth - 1, endDay)
      if (endUtc < startUtc) endYear = startYear + 1
    }
    const start = toIsoDate(startYear, startMonth, startDay)
    const end = toIsoDate(endYear, endMonth, endDay)
    if (start && end) return { start, end }
    return null
  }

  const a = lower.match(dayFirst)
  if (a) {
    const range = buildRange(Number(a[1]), a[2]!, a[3], Number(a[4]), a[5]!, a[6])
    if (range) return range
  }

  const b = lower.match(monthFirst)
  if (b) {
    const range = buildRange(Number(b[2]), b[1]!, b[3], Number(b[5]), b[4]!, b[6])
    if (range) return range
  }

  // Match against original casing text via lower (Arabic months unchanged by toLowerCase).
  const ar = lower.match(arabicRange)
  if (ar) {
    const range = buildRange(Number(ar[1]), ar[2]!, ar[3], Number(ar[4]), ar[5]!, ar[6])
    if (range) return range
  }

  return null
}

function arabicMonthToNumber(token: string): number | null {
  const map: Record<string, number> = {
    يناير: 1,
    فبراير: 2,
    مارس: 3,
    أبريل: 4,
    ابريل: 4,
    مايو: 5,
    يونيو: 6,
    يوليو: 7,
    أغسطس: 8,
    اغسطس: 8,
    سبتمبر: 9,
    أكتوبر: 10,
    اكتوبر: 10,
    نوفمبر: 11,
    ديسمبر: 12,
  }
  return map[token] ?? null
}

/** Upcoming Saturday–Sunday window used for "weekend" / "next weekend" inference. */
function upcomingWeekendRange(
  now: Date,
  options: { preferNext: boolean },
): { start: string; end: string } {
  const day = now.getUTCDay() // 0 Sun … 6 Sat
  let daysUntilSaturday: number
  if (day === 6) {
    daysUntilSaturday = options.preferNext ? 7 : 0
  } else if (day === 0) {
    // Sunday: "this weekend" started yesterday; "next" is the following Saturday.
    daysUntilSaturday = options.preferNext ? 6 : -1
  } else {
    daysUntilSaturday = 6 - day
  }
  const saturday = addUtcDays(now, daysUntilSaturday)
  const sunday = addUtcDays(saturday, 1)
  return { start: formatUtcIso(saturday), end: formatUtcIso(sunday) }
}

/**
 * Resolve soft month hints like "next April" into a planning start date.
 * Uses mid-month (15) as an anchor — month-only intake is not a hard booking date.
 */
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
      return `${year}-${mm}-15`
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
  if (/\bbest value\b|أفضل قيمة|افضل قيمة|value for money|premium\b|بريميوم/.test(lower)) {
    if (/\bluxury\b|فاخر/.test(lower)) return 'luxury'
    return 'midrange'
  }
  if (
    /\bcheap\b|\bbudget\b|economy|cheapest|رخيص|اقتصادي|منخفض التكلفة|رخيصة/.test(lower)
    || /اقتصادي|رخيص/.test(original)
  ) {
    // Avoid treating "budget $3000" alone as budget-style when "mid-range" also present
    if (/\bmid[- ]?range\b|متوسط/.test(lower) || /متوسط/.test(original)) return 'midrange'
    if (/\bcheap\b|\bcheapest\b|\bbudget style\b|\bbudget trip\b|\bon a budget\b|رحلة اقتصادية/.test(lower)) {
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
  if (/\bprivate villa\b|villa\b|فيلا/.test(lower) || /فيلا/.test(original)) return 'villa'
  if (/\bnear airport\b|قرب المطار|قريب من المطار/.test(lower)) return 'near_airport'
  if (/\bno hotel preference\b|any hotel|أي فندق|بدون تفضيل فندق|لا يهم الفندق/.test(lower)) {
    return 'any'
  }
  const hotelHint = lower.match(/(?:hotel|stay|فندق)\s*(?:preference|prefers?)?\s*[:：-]?\s*([a-z_]{3,24})/)
  if (hotelHint?.[1] && !['in', 'to', 'for', 'and', 'class', 'star', 'stars'].includes(hotelHint[1])) {
    return hotelHint[1]
  }
  return null
}

function matchHotelClass(lower: string, original: string): string | null {
  const stars = lower.match(/\b([1-5])\s*-?\s*star(?:s)?\b/)
    || original.match(/([1-5])\s*نجوم/)
  if (stars?.[1]) return `${stars[1]}_star`
  // Explicit star phrasing only — bare "luxury" is budgetStyle, not hotel class.
  if (/\bfive[\s-]?star\b|5[\s-]?star\b|خمس نجوم/.test(lower) || /خمس\s*نجوم/.test(original)) {
    return '5_star'
  }
  if (/\bbudget hotel\b|hostel\b/.test(lower)) return 'budget'
  return null
}

function matchRooms(lower: string, original: string): number | null {
  const en = lower.match(/(\d+)\s*rooms?/)
  if (en?.[1]) {
    const n = Number(en[1])
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  const ar = original.match(/(\d+)\s*(?:غرف|غرفة)/)
  if (ar?.[1]) {
    const n = Number(ar[1])
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  if (/غرفتين|غرفتان/.test(original)) return 2
  if (/\btwo rooms\b/.test(lower)) return 2
  return null
}

function matchPreferredArea(lower: string, original: string): string | null {
  if (/\bdowntown\b|city center|وسط المدينة|وسط البلد/.test(lower) || /وسط\s*المدينة|وسط\s*البلد/.test(original)) {
    return 'central'
  }
  if (/\bbeach\b|seafront|شاطئ|الكورنيش/.test(lower) || /شاطئ|الكورنيش/.test(original)) return 'beach'
  if (/\bmarina\b|المارينا|مرسى/.test(lower) || /المارينا/.test(original)) return 'marina'
  if (/\bnear airport\b|قرب المطار|قريب من المطار/.test(lower) || /قرب\s*المطار/.test(original)) {
    return 'near_airport'
  }
  if (/\bbusiness district\b|منطقة الأعمال|حي الأعمال/.test(lower) || /منطقة\s*الأعمال/.test(original)) {
    return 'business_district'
  }
  const areaEn = lower.match(/(?:near|around|in)\s+(?:the\s+)?([a-z][a-z\s]{2,24}?)\s*(?:area|district|neighborhood)/)
  if (areaEn?.[1]) return areaEn[1].trim()
  return null
}

function matchHotelAmenities(lower: string, original: string): string[] {
  const out: string[] = []
  if (/\bbreakfast\b|إفطار|افطار/.test(lower) || /إفطار|افطار/.test(original)) out.push('breakfast')
  if (/\bparking\b|مواقف|موقف سيارات/.test(lower) || /موقف/.test(original)) out.push('parking')
  if (/\bpool\b|مسبح|سباحة/.test(lower) || /مسبح/.test(original)) out.push('pool')
  if (/\bgym\b|fitness|نادي رياضي|جيم/.test(lower) || /نادي\s*رياضي|جيم/.test(original)) out.push('gym')
  if (/\bbeach\b|شاطئ/.test(lower) || /شاطئ/.test(original)) out.push('beach')
  if (/\bspaf?\b|سبا|مساج/.test(lower) || /سبا/.test(original)) out.push('spa')
  if (/\bwifi\b|wi-fi|إنترنت|انترنت/.test(lower) || /واي\s*فاي|إنترنت|انترنت/.test(original)) out.push('wifi')
  if (/\bfamily[- ]friendly\b|عائلي|مناسب للعائلات/.test(lower) || /مناسب\s*للعائلات|عائلي/.test(original)) {
    out.push('family')
  }
  // Require explicit hotel cue — do not steal "درجة رجال الأعمال" (cabin).
  if (
    /\bbusiness hotel\b/.test(lower)
    || /فندق\s*أعمال|فندق\s*اعمال|فندق\s*لرجال\s*الأعمال/.test(original)
  ) {
    out.push('business')
  }
  if (/\bairport hotel\b|فندق المطار/.test(lower) || /فندق\s*المطار/.test(original)) out.push('airport')
  return [...new Set(out)]
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

function isoHardDate(text: string): boolean {
  return /20\d{2}-\d{2}-\d{2}/.test(text) || /\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}/.test(text)
}

function matchCabinPreference(lower: string, original: string): string | null {
  if (
    /\bfirst\s*class\b|درجة أولى|الدرجة الاولى|الدرجة الأولى/.test(lower)
    || /درجة\s*أولى|درجة\s*اولى/.test(original)
  ) {
    return 'first'
  }
  // Bare "Business" / بزنس = Business Class cabin (not a lifestyle/advice question).
  if (
    /\bbusiness(?:\s*class)?\b|\bbiz\b/.test(lower)
    || /درجة\s*رجال\s*الأعمال|درجة\s*الأعمال|درجة\s*اعمال|رجال\s*اعمال|رجال\s*الأعمال|بزنس/.test(original)
  ) {
    return 'business'
  }
  if (/\bpremium\s*economy\b|اقتصادية مميزة|بريميوم/.test(lower) || /اقتصادية\s*مميزة/.test(original)) {
    return 'premium_economy'
  }
  if (
    /\beconomy(?:\s*class)?\b|سياحية|درجة اقتصادية|الضيافة/.test(lower)
    || /درجة\s*اقتصادية|سياحية|درجة\s*الضيافة|على\s*الضيافة|بالضيافة|\bالضيافة\b/.test(original)
  ) {
    return 'economy'
  }
  return null
}

function matchPreferredAirline(lower: string, original: string): string | null {
  if (/\bsaudi\s*airlines?\b|\bsv\b/.test(lower) || /الخطوط\s*السعودية|سعودية/.test(original)) return 'SV'
  if (/\bemirates\b|\bek\b/.test(lower) || /طيران\s*الإمارات|طيران\s*الامارات/.test(original)) return 'EK'
  if (/\bqatar\s*airways?\b|\bqr\b/.test(lower) || /القطرية/.test(original)) return 'QR'
  if (/\bethiad\b|\bey\b/.test(lower) || /الاتحاد/.test(original)) return 'EY'
  if (/\bflynas\b|\bxy\b/.test(lower) || /طيران\s*ناس|فلاي\s*ناس/.test(original)) return 'XY'
  if (/\broyal\s*air\s*maroc\b/.test(lower) || /الملكية\s*المغربية/.test(original)) return 'AT'
  const en = lower.match(/(?:prefer|preferred|with)\s+([a-z][a-z\s]{1,20}?)\s*air(?:lines?|ways)?/)
  if (en?.[1]) return en[1].trim()
  const ar = original.match(/(?:أفضل|افضل|أفضلية)\s+([^\s،,]{2,20})/)
  if (ar?.[1]) return ar[1].trim()
  return null
}

function matchPreferredDepartureTime(
  lower: string,
  original: string,
): 'morning' | 'afternoon' | 'evening' | 'night' | null {
  if (/\bmorning\b|صباح|فجّر|فجر/.test(lower) || /صباح/.test(original)) return 'morning'
  if (/\bafternoon\b|ظهر|بعد الظهر|بعدالظهر/.test(lower) || /بعد\s*الظهر/.test(original)) return 'afternoon'
  if (/\bevening\b|مساء|العصر/.test(lower) || /مساء/.test(original)) return 'evening'
  if (/\bnight\b|ليلة|ليلي|بعد منتصف/.test(lower) || /ليلي|ليلة/.test(original)) return 'night'
  return null
}

function matchChildrenCount(lower: string, original: string): number | null {
  const en = lower.match(/(\d+)\s*(?:kids?|children|child)/)
  if (en?.[1]) {
    const n = Number(en[1])
    if (Number.isFinite(n) && n >= 0) return Math.floor(n)
  }
  const ar = original.match(/(\d+)\s*(?:أطفال|اطفال|طفل|طفلة)/)
  if (ar?.[1]) {
    const n = Number(ar[1])
    if (Number.isFinite(n) && n >= 0) return Math.floor(n)
  }
  // Dual / plural without explicit digits (common Gulf/Saudi phrasing).
  if (/طفلين|طفلان/.test(original)) return 2
  if (/ثلاثة\s*أطفال|ثلاث\s*اطفال|٣\s*أطفال/.test(original)) return 3
  if (/\bkids\b|\bchildren\b/.test(lower) && !/\d/.test(lower)) return 1
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

const MONTH_NAMES = new Set([
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
])

const DESTINATION_STOP_TOKENS = new Set([
  'a', 'the', 'my', 'our', 'trip', 'plan', 'weekend', 'day', 'days',
  'honeymoon', 'business', 'for', 'with', 'under', 'couple', 'family',
  'solo', 'budget', 'only', 'just', 'about', 'around', 'instead', 'change',
  'dates', 'date', 'continue', 'later', 'stop', 'resume', 'back',
  'hotel', 'flight', 'flights', 'adults', 'adult', 'kids', 'children',
  'people', 'travelers', 'travellers', 'next', 'this', 'last', 'month',
  'year', 'week', 'weeks', 'now', 'please', 'make', 'it', 'to', 'of',
])

function isDestinationReplaceCue(lower: string, original: string): boolean {
  return (
    /\bchange(?:\s+the)?\s+destination\b/.test(lower)
    || /\bswitch(?:\s+(?:the\s+)?destination)?\s+to\b/.test(lower)
    || /\binstead(?:\s+of)?\b/.test(lower)
    || /\bactually\b.+\bto\b/.test(lower)
    || /\bnot\s+[a-z]+\s*[,—-]\s*/.test(lower)
    || /غير(?:\s+ال)?وجهة|بدل(?:اً|ا)?\s+(?:من|عن)|بدلا من/.test(original)
  )
}

/** Reject numeric / month / filler free-text captures that are not places. */
function isInvalidDestinationToken(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/[?.!,]/g, '')
  if (!normalized) return true
  if (/^\d+(?:[.,]\d+)?$/.test(normalized)) return true
  if (MONTH_NAMES.has(normalized)) return true
  const parts = normalized.split(/\s+/).filter(Boolean)
  if (parts.every((p) => DESTINATION_STOP_TOKENS.has(p) || MONTH_NAMES.has(p))) return true
  if (parts.length >= 1 && DESTINATION_STOP_TOKENS.has(parts[0]!) && parts.slice(1).every((p) => MONTH_NAMES.has(p) || DESTINATION_STOP_TOKENS.has(p))) {
    return true
  }
  // "april instead", "only 1500" style leftovers after capitalization
  if (parts.some((p) => MONTH_NAMES.has(p)) && parts.every((p) => MONTH_NAMES.has(p) || DESTINATION_STOP_TOKENS.has(p))) {
    return true
  }
  return false
}

function isStopWord(value: string): boolean {
  const normalized = value.trim()
  if (!normalized) return true
  if (isInvalidDestinationToken(normalized)) return true
  if (/\b(For|With|Under|Couple|Family|Solo|Budget|Days?)\b/i.test(normalized) && normalized.split(/\s+/).length > 2) {
    return true
  }
  const title = normalized
  return [
    'A', 'The', 'My', 'Our', 'Trip', 'Plan', 'Weekend', 'Day', 'Days',
    'Honeymoon', 'Business', 'For', 'With', 'Under', 'Couple', 'Family',
    'Only', 'Just', 'About', 'Instead', 'April', 'March', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
    'January', 'February',
  ].includes(title)
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
