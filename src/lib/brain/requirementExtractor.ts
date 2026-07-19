import type {
  BrainLocale,
  CabinClass,
  ConversationMemory,
  ExtractedRequirements,
} from './types'

const DESTINATION_ALIASES: Array<{ keys: string[]; value: string }> = [
  { keys: ['tokyo', 'japan', 'طوكيو', 'اليابان'], value: 'Tokyo' },
  { keys: ['dubai', 'دبي'], value: 'Dubai' },
  { keys: ['istanbul', 'اسطنبول', 'إسطنبول', 'تركيا', 'turkey'], value: 'Istanbul' },
  { keys: ['paris', 'باريس', 'france', 'فرنسا'], value: 'Paris' },
  { keys: ['london', 'لندن'], value: 'London' },
  { keys: ['cairo', 'القاهرة', 'egypt', 'مصر'], value: 'Cairo' },
  { keys: ['maldives', 'المالديف'], value: 'Maldives' },
  { keys: ['bali', 'بالي'], value: 'Bali' },
  { keys: ['riyadh', 'الرياض'], value: 'Riyadh' },
  { keys: ['jeddah', 'جدة'], value: 'Jeddah' },
  { keys: ['dammam', 'الدمام'], value: 'Dammam' },
]

const ORIGIN_ALIASES = DESTINATION_ALIASES

const ACTIVITY_KEYS: Array<{ keys: RegExp; value: string }> = [
  { keys: /\bbeach\b|شاطئ|بحر/, value: 'beach' },
  { keys: /\bmuseum\b|متحف/, value: 'culture' },
  { keys: /\bhiking\b|مشي|طبيعة/, value: 'outdoors' },
  { keys: /\bshopping\b|تسوق/, value: 'shopping' },
  { keys: /\bfood\b|\bculinary\b|طعام|مطاعم/, value: 'food' },
  { keys: /\bfamily\b|عائلي|أطفال/, value: 'family' },
]

/**
 * RequirementExtractor — entity/slot extraction from user text (rule-based).
 * Sprint 21: origin, ISO dates, flexible dates, adults/children/infants, hotel need.
 */
export function RequirementExtractor(input: {
  text: string
  locale?: BrainLocale
}): ExtractedRequirements {
  const text = input.text.trim()
  const lower = text.toLowerCase()
  const patch: Partial<ConversationMemory> = {}
  const entities: Record<string, unknown> = {}

  const origin = matchOrigin(lower, text)
  if (origin) {
    patch.origin = origin
    entities.origin = origin
  }

  const destination = matchDestination(lower, text, origin)
  if (destination) {
    patch.destination = destination
    patch.destinations = [destination]
    entities.destination = destination
  }

  const budget = matchBudget(lower, text)
  if (budget) {
    patch.budget = budget
    entities.budget = budget
    if (budget.currency) patch.currency = budget.currency
  }

  const dates = matchTravelDates(lower, text)
  if (dates) {
    patch.travelDates = dates
    entities.travelDates = dates
  }

  const travelers = matchTravelers(lower, text)
  if (travelers) {
    patch.travelers = travelers
    entities.travelers = travelers
  }

  const cabin = matchCabin(lower, text)
  if (cabin) {
    patch.cabinClass = cabin
    entities.cabinClass = cabin
  }

  const airlines = matchList(lower, text, [
    [/saudia|السعودية/, 'Saudia'],
    [/emirates|طيران الإمارات|الامارات/, 'Emirates'],
    [/qatar\s*airways|القطرية/, 'Qatar Airways'],
    [/flynas|ناس/, 'flynas'],
  ])
  if (airlines.length) {
    patch.airlinePreferences = airlines
    entities.airlinePreferences = airlines
  }

  const hotels = matchList(lower, text, [
    [/resort|منتجع/, 'resort'],
    [/boutique|بوتيك/, 'boutique'],
    [/apartment|شقق/, 'apartment'],
    [/5\s*-?\s*star|خمس نجوم|5 نجوم/, '5-star'],
    [/near (?:beach|sea)|قرب البحر|على البحر/, 'beachfront'],
  ])
  if (hotels.length) {
    patch.hotelPreferences = hotels
    entities.hotelPreferences = hotels
  }

  const hotelRequirement = matchHotelRequirement(lower, text)
  if (hotelRequirement !== null) {
    patch.hotelRequirement = hotelRequirement
    entities.hotelRequirement = hotelRequirement
  } else if (hotels.length) {
    patch.hotelRequirement = true
    entities.hotelRequirement = true
  }

  const activities: string[] = []
  for (const row of ACTIVITY_KEYS) {
    if (row.keys.test(lower) || row.keys.test(text)) activities.push(row.value)
  }
  if (activities.length) {
    patch.activities = activities
    entities.activities = activities
  }

  if (/\bvisa\b|تأشيرة|تاشيرة|فيزا/.test(lower) || /تأشيرة/.test(text)) {
    patch.visaRequirements = 'needs_check'
    entities.visaRequirements = 'needs_check'
  }

  if (/[أ-ي]/.test(text)) {
    patch.conversationLanguage = 'ar'
  } else if (/[a-z]/i.test(text)) {
    patch.conversationLanguage = input.locale ?? 'en'
  }

  const currency = matchCurrency(lower, text)
  if (currency) {
    patch.currency = currency
    entities.currency = currency
  }

  return { patch, entities }
}

function matchOrigin(lower: string, original: string): string | null {
  // Prefer explicit "from X to Y" so origin stops before destination.
  const fromTo =
    lower.match(/\bfrom\s+([a-z][a-z]*(?:\s+[a-z][a-z]*)?)\s+to\b/) ||
    original.match(/من\s+([^\s،,]{2,40})\s+(?:إلى|الى)\b/)
  const fromEn = lower.match(
    /\b(?:from|departing(?:\s+from)?|leaving(?:\s+from)?)\s+([a-z][a-z]*(?:\s+[a-z][a-z]*)?)/,
  )
  const fromAr = original.match(/(?:من|مغادرة من|الانطلاق من)\s+([^\s،,]{2,40})/)
  const raw = (fromTo?.[1] || fromEn?.[1] || fromAr?.[1] || '')
    .replace(/[?.!].*$/, '')
    .trim()
  if (!raw) return null
  for (const row of ORIGIN_ALIASES) {
    if (row.keys.some((k) => raw.toLowerCase().includes(k.toLowerCase()) || raw.includes(k))) {
      return row.value
    }
  }
  if (/^(a|the|my|home|here)$/i.test(raw)) return null
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function matchDestination(
  lower: string,
  original: string,
  knownOrigin: string | null,
): string | null {
  for (const row of DESTINATION_ALIASES) {
    if (!row.keys.some((k) => lower.includes(k.toLowerCase()) || original.includes(k))) {
      continue
    }
    if (knownOrigin && row.value === knownOrigin) continue
    return row.value
  }
  const m =
    lower.match(/\b(?:to|in|for|visit(?:ing)?)\s+([a-z][a-z\s]{1,30})/) ||
    original.match(/(?:إلى|الى|في|زيارة)\s+([^\s،,]{2,40})/)
  if (!m?.[1]) return null
  const raw = m[1].replace(/[?.!].*$/, '').trim()
  if (!raw || /^(a|the|my|trip|flight|hotel)$/i.test(raw)) return null
  if (knownOrigin && raw.toLowerCase() === knownOrigin.toLowerCase()) return null
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function matchBudget(lower: string, original: string): ConversationMemory['budget'] | null {
  if (
    /\bflexible\s+budget\b|\bbudget(?:\s+is)?\s+flexible\b|ميزانية مرنة|بدون سقف/.test(lower) ||
    /ميزانية\s*مرنة/.test(original)
  ) {
    return { amount: null, currency: null, flexible: true }
  }
  const m =
    lower.match(/(\d[\d,]{2,})\s*(sar|usd|eur|ر\.?\s*س|ريال|دولار)/i) ||
    original.match(/(\d[\d,]{2,})\s*(ريال|دولار|يورو)/)
  if (!m) return null
  const amount = Number(m[1].replace(/,/g, ''))
  if (!Number.isFinite(amount)) return null
  const rawCur = (m[2] || '').toLowerCase()
  let currency = 'SAR'
  if (/usd|دولار/.test(rawCur)) currency = 'USD'
  else if (/eur|يورو/.test(rawCur)) currency = 'EUR'
  else currency = 'SAR'
  return { amount, currency, flexible: false }
}

function matchTravelDates(
  lower: string,
  original: string,
): ConversationMemory['travelDates'] | null {
  let startDate: string | null = null
  let endDate: string | null = null
  let durationDays: number | null = null
  let flexible = false

  if (/\bflexible dates?\b|تواريخ مرنة|مواعيد مرنة/.test(lower)) {
    flexible = true
  }

  const iso = lower.match(/\b(20\d{2}-\d{2}-\d{2})\b/g)
  if (iso && iso.length >= 1) {
    startDate = iso[0]
    if (iso.length >= 2) endDate = iso[1]
  }

  const duration = matchDuration(lower, original)
  if (duration != null) durationDays = duration

  if (!startDate && !endDate && durationDays == null && !flexible) return null
  return { startDate, endDate, durationDays, flexible }
}

function matchDuration(lower: string, original: string): number | null {
  const m =
    lower.match(/(\d+)\s*(?:days?|nights?)/) ||
    original.match(/(\d+)\s*(?:يوم|أيام|ليلة|ليالي)/)
  if (!m) {
    if (/weekend|نهاية الأسبوع|نهاية الاسبوع/.test(lower)) return 2
    return null
  }
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

function matchTravelers(
  lower: string,
  original: string,
): ConversationMemory['travelers'] | null {
  if (/\bsolo\b|وحدي|لحالي/.test(lower)) {
    return { count: 1, adults: 1, children: 0, infants: 0 }
  }
  if (/\bcouple\b|honeymoon|شهر عسل|اثنين|شخصين/.test(lower)) {
    return { count: 2, adults: 2, children: 0, infants: 0 }
  }

  const adultsMatch =
    lower.match(/(\d+)\s*adults?/) || original.match(/(\d+)\s*(?:بالغ|بالغين|بالغون)/)
  const childrenMatch =
    lower.match(/(\d+)\s*(?:children|child|kids?)/) ||
    original.match(/(\d+)\s*(?:طفل|أطفال|اطفال)/)
  const infantsMatch =
    lower.match(/(\d+)\s*infants?/) || original.match(/(\d+)\s*(?:رضيع|رضع)/)

  if (adultsMatch || childrenMatch || infantsMatch) {
    let adults = adultsMatch ? Number(adultsMatch[1]) : 0
    const children = childrenMatch ? Number(childrenMatch[1]) : 0
    const infants = infantsMatch ? Number(infantsMatch[1]) : 0
    if (!adultsMatch && (children > 0 || infants > 0)) adults = 1
    const count = adults + children + infants
    if (count < 1) return null
    return { count, adults, children, infants }
  }

  if (/\bfamily\b|عائلة/.test(lower) || /عائلة/.test(original)) {
    return { count: 4, adults: 2, children: 2, infants: 0 }
  }

  const m =
    lower.match(/(\d+)\s*(?:travelers?|people|persons?)/) ||
    original.match(/(\d+)\s*(?:مسافر|أشخاص|اشخاص)/)
  if (!m) return null
  const count = Number(m[1])
  if (!Number.isFinite(count) || count < 1) return null
  return { count, adults: count, children: 0, infants: 0 }
}

function matchHotelRequirement(lower: string, original: string): boolean | null {
  if (
    /\bflights?\s*only\b|no hotel|without hotel|طيران فقط|بدون فندق/.test(lower) ||
    /بدون\s*فندق|طيران\s*فقط/.test(original)
  ) {
    return false
  }
  if (
    /\b(?:need|with|include|including)\s+(?:a\s+)?hotel\b|hotel\s+required|مع فندق|أحتاج فندق|نريد فندق/.test(
      lower,
    ) ||
    /مع\s*فندق|أحتاج\s*فندق|فندق\s*أيضا/.test(original)
  ) {
    return true
  }
  return null
}

function matchCabin(lower: string, _original: string): CabinClass | null {
  if (/first class|درجة أولى|الدرجة الاولى/.test(lower)) return 'first'
  if (/business|درجة رجال|رجال الأعمال/.test(lower)) return 'business'
  if (/premium economy|اقتصادية مميزة/.test(lower)) return 'premium_economy'
  if (/economy|اقتصادية/.test(lower)) return 'economy'
  return null
}

function matchCurrency(lower: string, original: string): string | null {
  if (/\busd\b|دولار/.test(lower) || /دولار/.test(original)) return 'USD'
  if (/\beur\b|يورو/.test(lower)) return 'EUR'
  if (/\bsar\b|ريال/.test(lower) || /ريال/.test(original)) return 'SAR'
  return null
}

function matchList(
  lower: string,
  original: string,
  rules: Array<[RegExp, string]>,
): string[] {
  const out: string[] = []
  for (const [re, value] of rules) {
    if (re.test(lower) || re.test(original)) out.push(value)
  }
  return out
}
