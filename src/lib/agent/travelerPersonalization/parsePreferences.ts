/**
 * Sprint 76 — extract traveler preferences from natural conversation.
 * Supports: I usually / I prefer / I always / My favorite / I don't like / Never book / I avoid
 */

import type {
  CabinPreference,
  PreferencePolarity,
  SeatPreference,
  SmokingPreference,
  TripStyleKind,
} from './types'

export interface ParsedPreferenceSignal {
  field:
    | 'airline'
    | 'alliance'
    | 'cabin'
    | 'seat'
    | 'meal'
    | 'hotelChain'
    | 'hotelStars'
    | 'roomType'
    | 'smoking'
    | 'tripStyle'
    | 'destination'
    | 'departureAirport'
    | 'loyalty'
    | 'directFlights'
  value: string
  polarity: PreferencePolarity
  numericValue?: number
}

const AIRLINES: Array<{ keys: string[]; value: string }> = [
  { keys: ['qatar airways', 'qatar', 'الخطوط القطرية', 'قطرية'], value: 'Qatar Airways' },
  { keys: ['emirates', 'طيران الإمارات', 'الامارات'], value: 'Emirates' },
  { keys: ['saudia', 'saudi airline', 'الخطوط السعودية', 'سعودية'], value: 'Saudia' },
  { keys: ['etihad', 'الاتحاد'], value: 'Etihad' },
  { keys: ['turkish airlines', 'turkish', 'الخطوط التركية'], value: 'Turkish Airlines' },
  { keys: ['british airways', 'ba '], value: 'British Airways' },
  { keys: ['lufthansa'], value: 'Lufthansa' },
  { keys: ['singapore airlines', 'singapore'], value: 'Singapore Airlines' },
  { keys: ['cathay', 'cathay pacific'], value: 'Cathay Pacific' },
]

const ALLIANCES: Array<{ keys: string[]; value: string }> = [
  { keys: ['oneworld', 'one world'], value: 'oneworld' },
  { keys: ['star alliance'], value: 'Star Alliance' },
  { keys: ['skyteam', 'sky team'], value: 'SkyTeam' },
]

const HOTEL_CHAINS: Array<{ keys: string[]; value: string }> = [
  { keys: ['marriott', 'marriott hotels', 'ماريوت'], value: 'Marriott' },
  { keys: ['hilton', 'هيلتون'], value: 'Hilton' },
  { keys: ['hyatt', 'هايات'], value: 'Hyatt' },
  { keys: ['ihg', 'intercontinental'], value: 'IHG' },
  { keys: ['accor', 'novotel', 'sofitel'], value: 'Accor' },
  { keys: ['radisson'], value: 'Radisson' },
  { keys: ['four seasons'], value: 'Four Seasons' },
]

const MEALS: Array<{ keys: string[]; value: string }> = [
  { keys: ['vegetarian', 'نباتي'], value: 'vegetarian' },
  { keys: ['vegan', 'فيغان'], value: 'vegan' },
  { keys: ['halal', 'حلال'], value: 'halal' },
  { keys: ['kosher'], value: 'kosher' },
  { keys: ['gluten free', 'gluten-free'], value: 'gluten_free' },
]

function hasPreferCue(lower: string): boolean {
  return /\b(?:i\s+)?(?:usually|prefer|always|normally|typically|like|love|favorite|favourite)\b|أفضل|دائمًا|دائما|عادة|أحب|المفضلة/.test(lower)
}

function hasAvoidCue(lower: string): boolean {
  return /\b(?:don'?t\s+like|do\s+not\s+like|never\s+book|never\s+stay|avoid|hate|no\s+more)\b|لا\s*أحب|أتجنب|تجنب|أبداً|ابدا|لا\s*أحجز/.test(lower)
}

function defaultPolarity(lower: string): PreferencePolarity {
  if (hasAvoidCue(lower)) return 'avoid'
  return 'prefer'
}

function matchCatalog(
  lower: string,
  catalog: Array<{ keys: string[]; value: string }>,
): string | null {
  for (const entry of catalog) {
    if (entry.keys.some((key) => lower.includes(key))) return entry.value
  }
  return null
}

export function parsePreferenceUtterance(text: string | null | undefined): ParsedPreferenceSignal[] {
  if (!text?.trim()) return []
  const lower = text.trim().toLowerCase()
  const signals: ParsedPreferenceSignal[] = []
  const polarity = defaultPolarity(lower)
  const interested = hasPreferCue(lower) || hasAvoidCue(lower)
    || /\balways\s+fly\b|\bprefer\b|\bfavorite\b|\bnever\s+(?:stay|book|fly)\b|\bbusiness\s+class\s+only\b|\bdirect\s+flights?\b|\bwindow\s+seats?\b|\bking\s+beds?\b|\bloyalty\b/.test(lower)
    || /أفضل|دائم|عادة|أتجنب|مقعد|نجمة|درجة/.test(lower)

  if (!interested && !/\bfly\b|\bhotel\b|\bcabin\b|\bseat\b|\bstars?\b|\bbusiness\b|\bleisure\b|\bfamily\b|\bluxury\b|\badventure\b/.test(lower)) {
    return []
  }

  const airline = matchCatalog(lower, AIRLINES)
  if (airline && (/\bfly\b|\bairline\b|\bairways\b|طيران|خطوط/.test(lower) || hasPreferCue(lower) || hasAvoidCue(lower))) {
    signals.push({ field: 'airline', value: airline, polarity })
  }

  const alliance = matchCatalog(lower, ALLIANCES)
  if (alliance) signals.push({ field: 'alliance', value: alliance, polarity })

  const hotel = matchCatalog(lower, HOTEL_CHAINS)
  if (hotel && (/\bhotel\b|\bstay\b|فندق|فنادق/.test(lower) || hasPreferCue(lower) || hasAvoidCue(lower))) {
    signals.push({ field: 'hotelChain', value: hotel, polarity })
  }

  if (/\bbusiness\s+class\s+only\b|\bonly\s+business\b|\bbusiness\s+class\b|درجة\s*أعمال|درجة\s*الاعمال/.test(lower)) {
    signals.push({ field: 'cabin', value: 'business' satisfies CabinPreference, polarity: 'prefer' })
  } else if (/\bfirst\s+class\b|درجة\s*أولى/.test(lower)) {
    signals.push({ field: 'cabin', value: 'first', polarity: polarity === 'avoid' ? 'avoid' : 'prefer' })
  } else if (/\bpremium\s+economy\b/.test(lower)) {
    signals.push({ field: 'cabin', value: 'premium_economy', polarity })
  } else if (/\beconomy\s+(?:only|class)\b|درجة\s*اقتصادية/.test(lower)) {
    signals.push({ field: 'cabin', value: 'economy', polarity })
  }

  if (/\bwindow\s+seats?\b|مقعد\s*نافذة|نافذة/.test(lower)) {
    signals.push({ field: 'seat', value: 'window' satisfies SeatPreference, polarity })
  } else if (/\baisle\s+seats?\b|مقعد\s*ممر/.test(lower)) {
    signals.push({ field: 'seat', value: 'aisle', polarity })
  }

  const meal = matchCatalog(lower, MEALS)
  if (meal && (/\bmeal\b|\bfood\b|وجبة|طعام/.test(lower) || hasPreferCue(lower))) {
    signals.push({ field: 'meal', value: meal, polarity })
  }

  const stars = lower.match(/(?:never\s+stay\s+below|at\s+least|minimum|no\s+less\s+than|لا\s*أقل\s*من)\s*(\d)\s*stars?/)
    ?? lower.match(/(\d)\s*stars?\s*(?:or\s+above|minimum|min)/)
  if (stars) {
    signals.push({
      field: 'hotelStars',
      value: `min${stars[1]}`,
      polarity: 'prefer',
      numericValue: Number(stars[1]),
    })
  }

  if (/\bking\s+beds?\b|سرير\s*كينغ/.test(lower)) {
    signals.push({ field: 'roomType', value: 'king', polarity: 'prefer' })
  } else if (/\btwin\s+beds?\b/.test(lower)) {
    signals.push({ field: 'roomType', value: 'twin', polarity })
  } else if (/\bsuite\b|جناح/.test(lower) && (/\broom\b|\bstay\b|غرفة|فندق/.test(lower) || hasPreferCue(lower))) {
    signals.push({ field: 'roomType', value: 'suite', polarity })
  }

  if (/\bnon[- ]?smoking\b|غير\s*مدخن|منع\s*التدخين/.test(lower)) {
    signals.push({ field: 'smoking', value: 'non_smoking' satisfies SmokingPreference, polarity: 'prefer' })
  } else if (/\bsmoking\s+room\b/.test(lower)) {
    signals.push({ field: 'smoking', value: 'smoking', polarity })
  }

  if (/\btravel\s+for\s+business\b|\bbusiness\s+trip\b|\bfor\s+business\b|سفر\s*عمل|رحلة\s*عمل/.test(lower)) {
    signals.push({ field: 'tripStyle', value: 'business' satisfies TripStyleKind, polarity: 'prefer' })
  } else if (/\bleisure\b|عطلة|ترفيه/.test(lower) && hasPreferCue(lower)) {
    signals.push({ field: 'tripStyle', value: 'leisure', polarity: 'prefer' })
  } else if (/\bfamily\b|عائلي|عائلة/.test(lower) && (hasPreferCue(lower) || /\btravel\b/.test(lower))) {
    signals.push({ field: 'tripStyle', value: 'family', polarity: 'prefer' })
  } else if (/\bluxury\b|فاخر/.test(lower) && (hasPreferCue(lower) || /\bprefer\b|\bstyle\b/.test(lower))) {
    signals.push({ field: 'tripStyle', value: 'luxury', polarity: 'prefer' })
  } else if (/\badventure\b|مغامرة/.test(lower) && hasPreferCue(lower)) {
    signals.push({ field: 'tripStyle', value: 'adventure', polarity: 'prefer' })
  }

  if (/\bdirect\s+flights?\b|\bnon[- ]?stop\b|رحلة\s*مباشرة|مباشر/.test(lower)) {
    signals.push({ field: 'directFlights', value: 'direct', polarity: polarity === 'avoid' ? 'avoid' : 'prefer' })
  }

  // Favorite destinations: "my favorite destination is Tokyo" / "I love Paris"
  const favDest = lower.match(/(?:favorite|favourite)\s+destination(?:\s+is|\s*:)?\s+([a-z\u0600-\u06ff\s]{3,24})/)
  if (favDest?.[1]) {
    signals.push({
      field: 'destination',
      value: favDest[1].trim().replace(/\s+/g, ' '),
      polarity: 'prefer',
    })
  }

  const depAirport = lower.match(/(?:prefer(?:\s+to)?\s+)?(?:depart|fly)\s+from\s+([a-z]{3,20})/)
  if (depAirport?.[1] && hasPreferCue(lower)) {
    signals.push({ field: 'departureAirport', value: depAirport[1].trim(), polarity: 'prefer' })
  }

  if (/\bloyalty\s+program\b|\bmiles\b|\bfrequent\s+flyer\b/.test(lower)) {
    const program = matchCatalog(lower, AIRLINES) ?? matchCatalog(lower, HOTEL_CHAINS)
    if (program) signals.push({ field: 'loyalty', value: program, polarity: 'prefer' })
  }

  // Deduplicate by field+value
  const seen = new Set<string>()
  return signals.filter((signal) => {
    const key = `${signal.field}:${signal.value}:${signal.polarity}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
