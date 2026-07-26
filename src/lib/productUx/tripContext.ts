/**
 * Active trip context inferred from conversation seed text.
 * Keeps traveler-facing presentation consistent and rejects unrelated demo routes.
 */

import type { ProductLocale } from './copy'

export interface ActiveTripContext {
  originAr: string
  originEn: string
  originCode: string
  destinationCountryAr: string | null
  destinationCountryEn: string | null
  destinationCityAr: string | null
  destinationCityEn: string | null
  destinationCode: string | null
  /** True when country is known but a city is required before inventing a route. */
  needsCityClarification: boolean
  clarificationAr: string | null
  clarificationEn: string | null
  budgetSar: number | null
  travelers: number
  durationDays: number | null
  currency: 'SAR'
  displayDestinationAr: string
  displayDestinationEn: string
}

const MOROCCO_CITY_HINTS: Array<{
  match: RegExp
  cityAr: string
  cityEn: string
  code: string
}> = [
  { match: /مراكش|marrakech|marrakesh/i, cityAr: 'مراكش', cityEn: 'Marrakech', code: 'RAK' },
  {
    match: /الدار البيضاء|casablanca/i,
    cityAr: 'الدار البيضاء',
    cityEn: 'Casablanca',
    code: 'CMN',
  },
  { match: /أكادير|اغادير|agadir/i, cityAr: 'أكادير', cityEn: 'Agadir', code: 'AGA' },
  { match: /الرباط|rabat/i, cityAr: 'الرباط', cityEn: 'Rabat', code: 'RBA' },
  { match: /فاس|fes|fez/i, cityAr: 'فاس', cityEn: 'Fes', code: 'FEZ' },
  { match: /طنجة|tangier|tanger/i, cityAr: 'طنجة', cityEn: 'Tangier', code: 'TNG' },
]

function parseBudgetSar(seed: string): number | null {
  const normalized = seed.replace(/,/g, '').replace(/٬/g, '')
  const m =
    /(\d+(?:\.\d+)?)\s*(?:ألف|الاف|آلاف)?\s*(?:ريال|ر\.?\s*س|sar|rs)/i.exec(normalized)
    || /ميزانية\s*(\d+(?:\.\d+)?)/i.exec(normalized)
  if (!m) return null
  let amount = Number(m[1])
  if (!Number.isFinite(amount)) return null
  if (/ألف|الاف|آلاف/i.test(m[0]) && amount < 1000) amount *= 1000
  // "10,000 ريال" already parsed as 10000
  return Math.round(amount)
}

function parseTravelers(seed: string): number {
  if (/زوجتي|زوجي|wife|husband|spouse|نحن الاثنين|اثنين/i.test(seed)) return 2
  if (/عائلت|family|أطفال|kids/i.test(seed)) return 3
  const m = /(\d+)\s*(?:أشخاص|اشخاص|مسافر|بالغ|adult|people|persons)/i.exec(seed)
  if (m) return Math.max(1, Number(m[1]) || 1)
  return 1
}

function parseDurationDays(seed: string): number | null {
  if (/أسبوع|اسبوع|week/i.test(seed)) return 7
  const m = /(\d+)\s*(?:يوم|أيام|days?)/i.exec(seed)
  if (m) return Math.max(1, Number(m[1]) || 1)
  return null
}

/**
 * Build a single active trip context from the latest user seed / message text.
 */
export function buildActiveTripContext(seedText: string): ActiveTripContext {
  const seed = seedText.trim()
  const budgetSar = parseBudgetSar(seed)
  const travelers = parseTravelers(seed)
  const durationDays = parseDurationDays(seed)

  const base: ActiveTripContext = {
    originAr: 'الرياض',
    originEn: 'Riyadh',
    originCode: 'RUH',
    destinationCountryAr: null,
    destinationCountryEn: null,
    destinationCityAr: null,
    destinationCityEn: null,
    destinationCode: null,
    needsCityClarification: false,
    clarificationAr: null,
    clarificationEn: null,
    budgetSar,
    travelers,
    durationDays,
    currency: 'SAR',
    displayDestinationAr: 'وجهتك',
    displayDestinationEn: 'your destination',
  }

  const moroccoCountry = /المغرب|morocco/i.test(seed)
  const moroccoCity = MOROCCO_CITY_HINTS.find((h) => h.match.test(seed))

  if (moroccoCountry || moroccoCity) {
    base.destinationCountryAr = 'المغرب'
    base.destinationCountryEn = 'Morocco'
    if (moroccoCity) {
      base.destinationCityAr = moroccoCity.cityAr
      base.destinationCityEn = moroccoCity.cityEn
      base.destinationCode = moroccoCity.code
      base.displayDestinationAr = moroccoCity.cityAr
      base.displayDestinationEn = moroccoCity.cityEn
      base.needsCityClarification = false
    } else {
      // Country only — do not invent Marrakech/Casablanca or a flight route.
      base.displayDestinationAr = 'المغرب'
      base.displayDestinationEn = 'Morocco'
      base.needsCityClarification = true
      base.clarificationAr =
        'أي مدينة في المغرب تفضّل؟ مثلاً مراكش أو الدار البيضاء أو أكادير.'
      base.clarificationEn =
        'Which city in Morocco do you prefer? For example Marrakech, Casablanca, or Agadir.'
    }
    return base
  }

  const other: Array<{
    match: RegExp
    cityAr: string
    cityEn: string
    code: string
    countryAr: string
    countryEn: string
  }> = [
    {
      match: /دبي|dubai/i,
      cityAr: 'دبي',
      cityEn: 'Dubai',
      code: 'DXB',
      countryAr: 'الإمارات',
      countryEn: 'UAE',
    },
    {
      match: /طوكيو|tokyo/i,
      cityAr: 'طوكيو',
      cityEn: 'Tokyo',
      code: 'NRT',
      countryAr: 'اليابان',
      countryEn: 'Japan',
    },
    {
      match: /إسطنبول|اسطنبول|istanbul/i,
      cityAr: 'إسطنبول',
      cityEn: 'Istanbul',
      code: 'IST',
      countryAr: 'تركيا',
      countryEn: 'Turkey',
    },
    {
      match: /باريس|paris/i,
      cityAr: 'باريس',
      cityEn: 'Paris',
      code: 'CDG',
      countryAr: 'فرنسا',
      countryEn: 'France',
    },
    {
      match: /القاهرة|cairo/i,
      cityAr: 'القاهرة',
      cityEn: 'Cairo',
      code: 'CAI',
      countryAr: 'مصر',
      countryEn: 'Egypt',
    },
  ]

  for (const hint of other) {
    if (hint.match.test(seed)) {
      base.destinationCountryAr = hint.countryAr
      base.destinationCountryEn = hint.countryEn
      base.destinationCityAr = hint.cityAr
      base.destinationCityEn = hint.cityEn
      base.destinationCode = hint.code
      base.displayDestinationAr = hint.cityAr
      base.displayDestinationEn = hint.cityEn
      return base
    }
  }

  return base
}

/** True when a card/route string conflicts with the active trip destination. */
export function isStaleTripRoute(
  context: ActiveTripContext,
  ...labels: Array<string | null | undefined>
): boolean {
  if (!context.destinationCountryEn && !context.destinationCityEn) return false
  const blob = labels.filter(Boolean).join(' ').toLowerCase()
  if (!blob) return false

  const isMoroccoTrip =
    context.destinationCountryEn === 'Morocco'
    || MOROCCO_CITY_HINTS.some((h) => h.cityEn === context.destinationCityEn)

  if (isMoroccoTrip) {
    if (/dubai|دبي|dxb|auh|abu dhabi/.test(blob)) return true
  }
  if (context.destinationCityEn === 'Dubai' || context.destinationCode === 'DXB') {
    if (/morocco|المغرب|marrakech|مراكش|casablanca|rak|cmn/.test(blob)) return true
  }
  return false
}

export function tripClarificationText(context: ActiveTripContext, locale: ProductLocale): string | null {
  if (!context.needsCityClarification) return null
  return locale === 'ar' ? context.clarificationAr : context.clarificationEn
}
