import type { ExtractedEntities, TripPurposeKind } from './types'

const DESTINATIONS: Array<{ keys: string[]; value: string }> = [
  { keys: ['tokyo', 'طوكيو'], value: 'Tokyo' },
  { keys: ['osaka', 'اوساكا', 'أوساكا'], value: 'Osaka' },
  { keys: ['kyoto', 'كيوتو'], value: 'Kyoto' },
  { keys: ['japan', 'اليابان'], value: 'Japan' },
  { keys: ['dubai', 'دبي'], value: 'Dubai' },
  { keys: ['istanbul', 'اسطنبول', 'إسطنبول'], value: 'Istanbul' },
  { keys: ['paris', 'باريس'], value: 'Paris' },
  { keys: ['london', 'لندن'], value: 'London' },
  { keys: ['maldives', 'المالديف'], value: 'Maldives' },
  { keys: ['bali', 'بالي'], value: 'Bali' },
  { keys: ['riyadh', 'الرياض'], value: 'Riyadh' },
  { keys: ['jeddah', 'جدة'], value: 'Jeddah' },
  { keys: ['cairo', 'القاهرة'], value: 'Cairo' },
  { keys: ['rome', 'روما'], value: 'Rome' },
  { keys: ['barcelona', 'برشلونة'], value: 'Barcelona' },
  { keys: ['new york', 'نيويورك'], value: 'New York' },
  { keys: ['singapore', 'سنغافورة'], value: 'Singapore' },
]

const MONTHS: Array<{ keys: string[]; value: string }> = [
  { keys: ['january', 'يناير'], value: 'January' },
  { keys: ['february', 'فبراير'], value: 'February' },
  { keys: ['march', 'مارس'], value: 'March' },
  { keys: ['april', 'أبريل', 'ابريل'], value: 'April' },
  { keys: ['may', 'مايو'], value: 'May' },
  { keys: ['june', 'يونيو'], value: 'June' },
  { keys: ['july', 'يوليو'], value: 'July' },
  { keys: ['august', 'أغسطس', 'اغسطس'], value: 'August' },
  { keys: ['september', 'سبتمبر'], value: 'September' },
  { keys: ['october', 'أكتوبر', 'اكتوبر'], value: 'October' },
  { keys: ['november', 'نوفمبر'], value: 'November' },
  { keys: ['december', 'ديسمبر'], value: 'December' },
]

function emptyEntities(): ExtractedEntities {
  return {
    destination: null,
    cities: [],
    budgetAmount: null,
    currency: null,
    monthHint: null,
    startDate: null,
    endDate: null,
    flexibleDates: null,
    adults: null,
    children: null,
    infants: null,
    purpose: null,
    hotelPreferences: [],
    flightPreferences: [],
    airlines: [],
    seatPreference: null,
    stopoverPreference: null,
    activities: [],
    visaStatus: null,
    passportNationality: null,
    weatherPreference: null,
    specialRequests: [],
    cues: [],
  }
}

function matchFirst(text: string, table: Array<{ keys: string[]; value: string }>): string | null {
  for (const row of table) {
    for (const key of row.keys) {
      if (text.includes(key)) return row.value
    }
  }
  return null
}

function matchAll(text: string, table: Array<{ keys: string[]; value: string }>): string[] {
  const out: string[] = []
  for (const row of table) {
    if (row.keys.some((k) => text.includes(k))) out.push(row.value)
  }
  return out
}

function parseBudget(text: string, original: string): { amount: number; currency: string } | null {
  const sar = /(?:sar|ر\.?\s*س|ريال|riyal)s?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i.exec(text)
    ?? /([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:sar|ر\.?\s*س|ريال|riyal)/i.exec(text)
    ?? /(?:around|about|حوالي|قرابة|around)\s*([0-9][0-9,]*)/i.exec(text)
    ?? /(?:ميزانية|budget)\s*(?:حول|حوالي|around)?\s*([0-9][0-9,]*)/i.exec(original)
    ?? /(?:ten thousand|عشرة آلاف|١٠٠٠٠|10000)/i.exec(text)

  if (/ten thousand|عشرة آلاف|١٠٬?٠٠٠|10000/.test(text)) {
    return { amount: 10000, currency: 'SAR' }
  }
  if (!sar) return null
  const raw = (sar[1] ?? '10000').replace(/,/g, '')
  const amount = Number(raw)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const currency = /usd|دولار/.test(text) ? 'USD' : /eur|يورو/.test(text) ? 'EUR' : 'SAR'
  return { amount, currency }
}

function parseTravelers(text: string, original: string): {
  adults: number | null
  children: number | null
  infants: number | null
} {
  let adults: number | null = null
  let children: number | null = null
  let infants: number | null = null

  if (/\bwith my wife\b|مع زوجتي|أنا وزوجتي|me and my wife/.test(text) || /مع\s*زوجتي/.test(original)) {
    adults = 2
  }
  if (/\bwith my husband\b|مع زوجي/.test(text)) adults = 2
  if (/\bcouple\b|ثنائي|لشخصين|two adults|٢ بالغ|2 adults/.test(text)) adults = adults ?? 2
  if (/\bsolo\b|وحدي|لوحة|شخص واحد|alone\b/.test(text)) adults = adults ?? 1

  const adultsMatch = /([0-9]+)\s*adults?|([0-9]+)\s*بالغ/.exec(text)
  if (adultsMatch) adults = Number(adultsMatch[1] ?? adultsMatch[2])

  const childrenMatch = /([0-9]+)\s*(?:kids?|children)|([0-9]+)\s*أطفال/.exec(text)
  if (childrenMatch) children = Number(childrenMatch[1] ?? childrenMatch[2])
  if (/\bwith (?:a |my )?kid\b|مع طفل|أطفال/.test(text) && children == null) children = 1

  const infantMatch = /([0-9]+)\s*infants?|([0-9]+)\s*رض[يي]ع/.exec(text)
  if (infantMatch) infants = Number(infantMatch[1] ?? infantMatch[2])

  const family = /\bfamily\b|عائلي|عائلة/.test(text)
  if (family && adults == null) adults = 2
  if (family && children == null) children = children ?? 1

  return { adults, children, infants }
}

function parsePurpose(text: string): TripPurposeKind {
  if (/\bhoneymoon\b|شهر عسل/.test(text)) return 'honeymoon'
  if (/\bbusiness\b|رحلة عمل|work trip/.test(text)) return 'business'
  if (/\bfamily\b|عائلي|عائلة/.test(text)) return 'family'
  if (/\badventure\b|مغامرة/.test(text)) return 'adventure'
  if (/\bluxury\b|فاخر|خمس نجوم|5\s*star/.test(text)) return 'luxury'
  if (/\bleisure\b|سياحة|vacation|holiday|إجازة|اجازة/.test(text)) return 'leisure'
  return null
}

/** Rule-based entity extraction — Arabic, English, mixed. */
export function extractEntities(userText: string): ExtractedEntities {
  const entities = emptyEntities()
  const original = userText.trim()
  const text = original.toLowerCase()
  if (!original) return entities

  const cities = matchAll(text, DESTINATIONS)
  entities.cities = cities
  entities.destination = cities[0] ?? null
  if (entities.destination) entities.cues.push(`destination:${entities.destination}`)

  entities.monthHint = matchFirst(text, MONTHS)
  if (entities.monthHint) entities.cues.push(`month:${entities.monthHint}`)

  const budget = parseBudget(text, original)
  if (budget) {
    entities.budgetAmount = budget.amount
    entities.currency = budget.currency
    entities.cues.push(`budget:${budget.amount}${budget.currency}`)
  }

  if (/\bflexible dates?\b|تواريخ مرنة|مرن في التواريخ|أي وقت|anytime/.test(text)) {
    entities.flexibleDates = true
    entities.cues.push('flexible_dates')
  }

  const travelers = parseTravelers(text, original)
  entities.adults = travelers.adults
  entities.children = travelers.children
  entities.infants = travelers.infants
  if (travelers.adults != null) entities.cues.push(`adults:${travelers.adults}`)

  entities.purpose = parsePurpose(text)
  if (entities.purpose) entities.cues.push(`purpose:${entities.purpose}`)

  if (/\bquiet\b|هادئ|هدو|peaceful/.test(text)) entities.hotelPreferences.push('quiet')
  if (/\bfamily hotel\b|فندق عائلي|family-friendly/.test(text)) {
    entities.hotelPreferences.push('family-friendly')
  }
  if (/\bbeach\b|شاطئ|sea view|إطلالة بحر/.test(text)) entities.hotelPreferences.push('beach')
  if (/\bcentral\b|وسط المدينة|city center/.test(text)) entities.hotelPreferences.push('central')
  if (/\bluxury hotel\b|فندق فاخر|5\s*star|خمس نجوم/.test(text)) {
    entities.hotelPreferences.push('luxury')
  }

  if (/\bdirect\b|بدون توقف|non[\s-]?stop|مباشر/.test(text)) {
    entities.stopoverPreference = 'direct'
    entities.flightPreferences.push('direct')
  } else if (/\bone stop\b|توقف واحد|stopover ok|لا مانع من توقف/.test(text)) {
    entities.stopoverPreference = 'flexible'
    entities.flightPreferences.push('one-stop-ok')
  }

  if (/\bwindow\b|نافذة/.test(text)) entities.seatPreference = 'window'
  if (/\baisle\b|ممر/.test(text)) entities.seatPreference = 'aisle'

  if (/\bsaudia\b|السعودية/.test(text)) entities.airlines.push('Saudia')
  if (/\bemirates\b|طيران الإمارات/.test(text)) entities.airlines.push('Emirates')
  if (/\bqatar\b|القطرية/.test(text)) entities.airlines.push('Qatar Airways')

  if (/\bmuseum\b|متحف/.test(text)) entities.activities.push('museums')
  if (/\bfood\b|طعام|مطاعم|street food/.test(text)) entities.activities.push('food')
  if (/\bshopping\b|تسوق/.test(text)) entities.activities.push('shopping')
  if (/\bhiking\b|مشي|طبيعة/.test(text)) entities.activities.push('nature')

  if (/\bvisa\b|تأشير/.test(text)) entities.visaStatus = 'needs_check'
  if (/\bsaudi\b|سعودي|saudi passport|جواز سعودي/.test(text)) {
    entities.passportNationality = 'SA'
  }

  if (/\bcold\b|بارد|ثلج/.test(text)) entities.weatherPreference = 'cold'
  if (/\bwarm\b|حار|مشمس|sunny/.test(text)) entities.weatherPreference = 'warm'

  if (/\bwheelchair\b|كرسي متحرك/.test(text)) entities.specialRequests.push('accessibility')
  if (/\bhalal\b|حلال/.test(text)) entities.specialRequests.push('halal')

  return entities
}

export const EntityExtractor = {
  extract: extractEntities,
}
