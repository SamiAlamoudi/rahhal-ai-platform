/**
 * Sprint 112 — PreferenceExtractor
 * Pattern-based extraction from conversation text (no fixed entity catalogs).
 * Captures free-form values after preference / avoidance cues.
 */

import type {
  CabinClassKind,
  ExtractedPreferenceSignal,
  PreferenceKey,
  PreferencePolarity,
  SeatTypeKind,
  TravelStyleKind,
} from './types'

function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function polarityOf(text: string): PreferencePolarity {
  if (
    /\b(don'?t|do not|never|avoid|hate|dislike|لا\s*أحب|أتجنب|تجنب)\b/i.test(
      text,
    )
  ) {
    return 'avoid'
  }
  return 'prefer'
}

function push(
  out: ExtractedPreferenceSignal[],
  signal: ExtractedPreferenceSignal,
): void {
  const exists = out.some(
    (s) =>
      s.key === signal.key
      && String(s.value).toLowerCase() === String(signal.value).toLowerCase()
      && s.polarity === signal.polarity,
  )
  if (!exists) out.push(signal)
}

function mapCabin(raw: string): CabinClassKind | null {
  const t = raw.toLowerCase()
  if (/premium\s*economy|اقتصادية\s*مميزة/.test(t)) return 'premium_economy'
  if (/business|رجال\s*الأعمال|اعمال/.test(t)) return 'business'
  if (/first|درجة\s*أولى|اولى/.test(t)) return 'first'
  if (/economy|اقتصادية/.test(t)) return 'economy'
  return null
}

function mapSeat(raw: string): SeatTypeKind | null {
  const t = raw.toLowerCase()
  if (/window|نافذة|شباك/.test(t)) return 'window'
  if (/aisle|ممر/.test(t)) return 'aisle'
  if (/middle|وسط/.test(t)) return 'middle'
  return null
}

function mapStyle(raw: string): TravelStyleKind | null {
  const t = raw.toLowerCase()
  if (/business|عمل|أعمال/.test(t)) return 'business'
  if (/family|wife|husband|kids|children|عائلة|زوجتي|زوجي|الأطفال/.test(t)) {
    return 'family'
  }
  if (/luxury|premium|فاخر/.test(t)) return 'luxury'
  if (/adventure|مغامرة/.test(t)) return 'adventure'
  if (/beach|شاطئ/.test(t)) return 'beach'
  if (/shopping|تسوق/.test(t)) return 'shopping'
  if (/leisure|vacation|holiday|استجمام|إجازة/.test(t)) return 'leisure'
  return null
}

function mapDepartureWindow(
  raw: string,
): 'morning' | 'afternoon' | 'evening' | 'night' | null {
  const t = raw.toLowerCase()
  if (/morning|صباح/.test(t)) return 'morning'
  if (/afternoon|ظهر|بعد\s*الظهر/.test(t)) return 'afternoon'
  if (/evening|مساء/.test(t)) return 'evening'
  if (/night|ليل/.test(t)) return 'night'
  return null
}

/**
 * Extract preference signals from a single utterance.
 * Uses linguistic cues + capture groups — values are free-form (not catalog-bound).
 */
export function extractPreferencesFromText(
  text: string,
): ExtractedPreferenceSignal[] {
  const raw = normalizeSpace(text)
  if (!raw) return []
  const lower = raw.toLowerCase()
  const out: ExtractedPreferenceSignal[] = []
  const polarity = polarityOf(lower)

  // Airlines: "I always fly X", "prefer X Airways"
  const airlinePatterns = [
    /\b(?:always|usually|prefer|love)\s+fly(?:ing)?\s+([a-z][a-z0-9 .'-]{1,40})/gi,
    /\bfly\s+([a-z][a-z0-9 .'-]{1,40})\s+(?:only|always|usually)/gi,
    /\b(?:preferred|favorite|favourite)\s+airline(?:s)?\s*(?:is|are|:)?\s+([a-z][a-z0-9 .'-]{1,40})/gi,
    /\bairline\s+(?:is|:)\s+([a-z][a-z0-9 .'-]{1,40})/gi,
  ]
  for (const re of airlinePatterns) {
    for (const m of raw.matchAll(re)) {
      const value = titleCase(m[1]!.replace(/[.!,;]+$/, '').trim())
      if (value.length >= 2) {
        push(out, {
          key: 'preferredAirlines',
          value,
          polarity,
          confidence: 0.72,
          raw: m[0]!,
        })
      }
    }
  }

  // Hotel chains: "I prefer Marriott", "stay at Hilton"
  const hotelPatterns = [
    /\b(?:prefer|love|always|usually)\s+(?:stay(?:ing)?\s+at\s+)?([a-z][a-z0-9 .'-]{1,30})\s+hotels?\b/gi,
    /\b(?:prefer|love|always)\s+([A-Z][a-zA-Z0-9 .'-]{1,30})\b/g,
    /\bstay(?:ing)?\s+(?:at|with)\s+([a-z][a-z0-9 .'-]{1,30})/gi,
  ]
  for (const re of hotelPatterns) {
    for (const m of raw.matchAll(re)) {
      const captured = m[1]!.replace(/[.!,;]+$/, '').trim()
      // Skip generic words captured by broad prefer pattern
      if (
        /^(fly|flights?|budget|cabin|window|aisle|morning|evening|direct|long|short|with|my|the|a|an)$/i.test(
          captured,
        )
      ) {
        continue
      }
      if (
        /hotel|marriott|hilton|hyatt|radisson|novotel|sofitel|intercontinental|accor|four seasons|sheraton|westin|ritz/i.test(
          m[0]!,
        )
        || /hotel/i.test(raw)
      ) {
        push(out, {
          key: 'preferredHotelChains',
          value: titleCase(captured.replace(/\s+hotels?$/i, '')),
          polarity,
          confidence: 0.7,
          raw: m[0]!,
        })
      }
    }
  }
  // Explicit "I prefer Marriott." without "hotel"
  const bareHotel = raw.match(
    /\b(?:prefer|love|always\s+book)\s+(marriott|hilton|hyatt|radisson|novotel|sofitel|sheraton|westin)\b/i,
  )
  if (bareHotel) {
    push(out, {
      key: 'preferredHotelChains',
      value: titleCase(bareHotel[1]!),
      polarity,
      confidence: 0.78,
      raw: bareHotel[0]!,
    })
  }

  // Cabin
  const cabinHit = raw.match(
    /\b(?:prefer|always|usually|like)?\s*(?:fly\s+)?(premium\s*economy|business|first|economy)\s*(?:class|cabin)?/i,
  )
  if (cabinHit) {
    const cabin = mapCabin(cabinHit[1]!)
    if (cabin) {
      push(out, {
        key: 'preferredCabinClass',
        value: cabin,
        polarity,
        confidence: 0.75,
        raw: cabinHit[0]!,
      })
    }
  }

  // Hotel stars
  const stars = raw.match(/\b([1-5])\s*[- ]?\s*stars?\b/i)
    ?? raw.match(/\bstars?\s*(?:of|:)?\s*([1-5])\b/i)
  if (stars) {
    push(out, {
      key: 'preferredHotelStars',
      value: Number(stars[1]),
      polarity,
      confidence: 0.74,
      raw: stars[0]!,
    })
  }

  // Budget
  const budget = raw.match(
    /\b(?:budget|around|about| roughly)\s*(?:is\s*)?(?:around|about|roughly)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(sar|usd|eur|aed|gbp)?/i,
  )
    ?? raw.match(
      /\b([0-9][0-9,]*(?:\.[0-9]+)?)\s*(sar|usd|eur|aed|gbp)\b/i,
    )
  if (budget && /budget|around|about|sar|usd|eur|aed|gbp/i.test(raw)) {
    const amount = Number(budget[1]!.replace(/,/g, ''))
    if (Number.isFinite(amount) && amount > 0) {
      push(out, {
        key: 'budgetRange',
        value: amount,
        polarity: 'prefer',
        confidence: 0.8,
        raw: budget[0]!,
      })
      if (budget[2]) {
        push(out, {
          key: 'currency',
          value: budget[2]!.toUpperCase(),
          polarity: 'prefer',
          confidence: 0.85,
          raw: budget[0]!,
        })
      }
    }
  }

  // Layovers
  if (/\b(long\s+layovers?|don'?t\s+like\s+long\s+layovers?|no\s+long\s+layovers?|avoid\s+layovers?)\b/i.test(raw)) {
    push(out, {
      key: 'preferredLayoverMinutes',
      value: 90,
      polarity: 'avoid',
      confidence: 0.76,
      raw: 'long layovers',
    })
  }
  if (/\b(direct\s+flights?\s+only|non[- ]?stop\s+only|prefer\s+direct)\b/i.test(raw)) {
    push(out, {
      key: 'preferredLayoverMinutes',
      value: 0,
      polarity: 'prefer',
      confidence: 0.8,
      raw: 'direct flights',
    })
  }
  const layoverMins = raw.match(
    /\b(?:layover|connection)\s*(?:under|max(?:imum)?|less\s+than)?\s*(\d+)\s*(?:min|minutes|hours|hrs)?/i,
  )
  if (layoverMins) {
    let minutes = Number(layoverMins[1])
    if (/hour|hrs/i.test(layoverMins[0]!)) minutes *= 60
    if (Number.isFinite(minutes)) {
      push(out, {
        key: 'preferredLayoverMinutes',
        value: minutes,
        polarity: 'prefer',
        confidence: 0.7,
        raw: layoverMins[0]!,
      })
    }
  }

  // Travel with family / wife
  if (
    /\b(travel(?:s|ing)?\s+with\s+(?:my\s+)?(?:wife|husband|family|kids|children)|family\s+trip)\b/i.test(
      raw,
    )
  ) {
    push(out, {
      key: 'travelStyles',
      value: 'family',
      polarity: 'prefer',
      confidence: 0.82,
      raw: 'family travel',
    })
  }

  // Travel styles
  for (const style of [
    'business',
    'luxury',
    'adventure',
    'beach',
    'shopping',
    'leisure',
  ] as TravelStyleKind[]) {
    if (new RegExp(`\\b${style}\\b`, 'i').test(raw) && /travel|trip|style|prefer/i.test(raw)) {
      const mapped = mapStyle(style)
      if (mapped) {
        push(out, {
          key: 'travelStyles',
          value: mapped,
          polarity,
          confidence: 0.65,
          raw: style,
        })
      }
    }
  }
  const styleMapped = mapStyle(raw)
  if (styleMapped && /i\s+(am|travel|prefer)|style/i.test(raw)) {
    push(out, {
      key: 'travelStyles',
      value: styleMapped,
      polarity: 'prefer',
      confidence: 0.68,
      raw: styleMapped,
    })
  }

  // Seat
  const seatHit = raw.match(/\b(window|aisle|middle)\s+seat\b/i)
    ?? raw.match(/\bprefer\s+(window|aisle|middle)\b/i)
  if (seatHit) {
    const seat = mapSeat(seatHit[1]!)
    if (seat) {
      push(out, {
        key: 'preferredSeatType',
        value: seat,
        polarity,
        confidence: 0.73,
        raw: seatHit[0]!,
      })
    }
  }

  // Meals
  const meal = raw.match(
    /\b(vegetarian|vegan|halal|kosher|gluten[- ]?free)\b/i,
  )
  if (meal && /meal|food|eat|prefer|always/i.test(raw)) {
    push(out, {
      key: 'preferredMealOptions',
      value: meal[1]!.toLowerCase().replace(/\s+/g, '_'),
      polarity,
      confidence: 0.7,
      raw: meal[0]!,
    })
  }

  // Amenities
  const amenity = raw.match(
    /\b(wifi|pool|spa|gym|breakfast|parking|kids\s*club)\b/i,
  )
  if (amenity && /hotel|prefer|need|want|amenities?/i.test(raw)) {
    push(out, {
      key: 'preferredHotelAmenities',
      value: titleCase(amenity[1]!),
      polarity,
      confidence: 0.66,
      raw: amenity[0]!,
    })
  }

  // Departure times
  const timeWindow = mapDepartureWindow(raw)
  if (timeWindow && /depart|flight|prefer|morning|evening|afternoon|night/i.test(raw)) {
    push(out, {
      key: 'preferredDepartureTimes',
      value: timeWindow,
      polarity,
      confidence: 0.68,
      raw: timeWindow,
    })
  }

  // Duration
  const duration = raw.match(
    /\b(?:usually|typically|trips?\s+of)\s*(\d+)\s*(?:day|night)s?\b/i,
  )
  if (duration) {
    push(out, {
      key: 'typicalTripDurationDays',
      value: Number(duration[1]),
      polarity: 'prefer',
      confidence: 0.7,
      raw: duration[0]!,
    })
  }

  // Airports (IATA-like)
  const depAirport = raw.match(
    /\b(?:depart(?:ing)?\s+from|from)\s+([A-Z]{3})\b/,
  )
  if (depAirport) {
    push(out, {
      key: 'preferredDepartureAirports',
      value: depAirport[1]!,
      polarity: 'prefer',
      confidence: 0.7,
      raw: depAirport[0]!,
    })
  }
  const arrAirport = raw.match(
    /\b(?:arriv(?:e|ing)\s+(?:in|at|to)|to)\s+([A-Z]{3})\b/,
  )
  if (arrAirport) {
    push(out, {
      key: 'preferredArrivalAirports',
      value: arrAirport[1]!,
      polarity: 'prefer',
      confidence: 0.65,
      raw: arrAirport[0]!,
    })
  }

  // Destinations / countries (prefer going to X)
  const dest = raw.match(
    /\b(?:prefer|love|favorite|favourite)\s+(?:going\s+to\s+|visiting\s+)?([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]{2,})?)/,
  )
  if (dest && !/Airline|Marriott|Hilton|Hyatt|Budget|Cabin|Window|Aisle/.test(dest[1]!)) {
    push(out, {
      key: 'preferredDestinations',
      value: dest[1]!,
      polarity,
      confidence: 0.6,
      raw: dest[0]!,
    })
  }

  // Language / currency / timezone explicit
  const lang = raw.match(/\b(?:language|speak)\s*(?:is|:)?\s*([a-z]{2,12})\b/i)
  if (lang) {
    push(out, {
      key: 'language',
      value: lang[1]!.toLowerCase(),
      polarity: 'prefer',
      confidence: 0.7,
      raw: lang[0]!,
    })
  }
  const tz = raw.match(/\b(?:timezone|time\s*zone)\s*(?:is|:)?\s*([A-Za-z_/+-]{3,40})\b/i)
  if (tz) {
    push(out, {
      key: 'timezone',
      value: tz[1]!,
      polarity: 'prefer',
      confidence: 0.7,
      raw: tz[0]!,
    })
  }

  return out
}

export function extractPreferencesFromMessages(
  messages: Array<{ role?: string; text: string }>,
): ExtractedPreferenceSignal[] {
  const out: ExtractedPreferenceSignal[] = []
  for (const msg of messages) {
    if (msg.role && msg.role !== 'user') continue
    for (const signal of extractPreferencesFromText(msg.text)) {
      push(out, signal)
    }
  }
  return out
}

export class PreferenceExtractor {
  extractFromText(text: string): ExtractedPreferenceSignal[] {
    return extractPreferencesFromText(text)
  }

  extractFromMessages(
    messages: Array<{ role?: string; text: string }>,
  ): ExtractedPreferenceSignal[] {
    return extractPreferencesFromMessages(messages)
  }
}

export function createPreferenceExtractor(): PreferenceExtractor {
  return new PreferenceExtractor()
}

// silence unused PreferenceKey import usage for external typing
export type { PreferenceKey }
