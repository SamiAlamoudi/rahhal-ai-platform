/**
 * Country / city helpers for TripState — pure, no provider calls.
 */

const BROAD_COUNTRIES = new Set([
  'morocco', 'japan', 'italy', 'spain', 'france', 'turkey', 'egypt',
  'indonesia', 'maldives', 'canada', 'switzerland', 'austria', 'norway',
  'iceland', 'new zealand', 'greece', 'portugal', 'thailand', 'uae',
])

const CITY_TO_COUNTRY: Array<{ city: RegExp; cityEn: string; countryEn: string }> = [
  { city: /^(marrakech|marrakesh|مراكش)$/i, cityEn: 'Marrakech', countryEn: 'Morocco' },
  { city: /^(casablanca|الدار البيضاء)$/i, cityEn: 'Casablanca', countryEn: 'Morocco' },
  { city: /^(agadir|أكادير|اكادير)$/i, cityEn: 'Agadir', countryEn: 'Morocco' },
  { city: /^(tangier|tanger|طنجة)$/i, cityEn: 'Tangier', countryEn: 'Morocco' },
  { city: /^(rabat|الرباط)$/i, cityEn: 'Rabat', countryEn: 'Morocco' },
  { city: /^(fes|fez|فاس)$/i, cityEn: 'Fes', countryEn: 'Morocco' },
  { city: /^(tokyo|طوكيو)$/i, cityEn: 'Tokyo', countryEn: 'Japan' },
  { city: /^(kyoto|كيوتو)$/i, cityEn: 'Kyoto', countryEn: 'Japan' },
  { city: /^(osaka|أوساكا|اوساكا)$/i, cityEn: 'Osaka', countryEn: 'Japan' },
  { city: /^(dubai|دبي)$/i, cityEn: 'Dubai', countryEn: 'UAE' },
  { city: /^(istanbul|إسطنبول|اسطنبول)$/i, cityEn: 'Istanbul', countryEn: 'Turkey' },
  { city: /^(paris|باريس)$/i, cityEn: 'Paris', countryEn: 'France' },
  { city: /^(cairo|القاهرة)$/i, cityEn: 'Cairo', countryEn: 'Egypt' },
  { city: /^(bali|بالي)$/i, cityEn: 'Bali', countryEn: 'Indonesia' },
]

const COUNTRY_ALIASES: Array<{ match: RegExp; countryEn: string }> = [
  { match: /morocco|المغرب|للمغرب/i, countryEn: 'Morocco' },
  { match: /japan|اليابان|لليابان/i, countryEn: 'Japan' },
  { match: /turkey|تركيا/i, countryEn: 'Turkey' },
  { match: /egypt|مصر/i, countryEn: 'Egypt' },
  { match: /france|فرنسا/i, countryEn: 'France' },
  { match: /uae|الإمارات|الامارات|للإمارات|للامارات/i, countryEn: 'UAE' },
  { match: /indonesia|إندونيسيا|اندونيسيا/i, countryEn: 'Indonesia' },
]

export function isBroadCountry(name: string | null | undefined): boolean {
  if (!name) return false
  return BROAD_COUNTRIES.has(name.trim().toLowerCase())
}

export function resolveGeography(destination: string | null | undefined): {
  country: string | null
  city: string | null
} {
  if (!destination?.trim()) return { country: null, city: null }
  const raw = destination.trim()

  for (const row of CITY_TO_COUNTRY) {
    if (row.city.test(raw)) {
      return { country: row.countryEn, city: row.cityEn }
    }
  }

  for (const row of COUNTRY_ALIASES) {
    if (row.match.test(raw)) {
      return { country: row.countryEn, city: null }
    }
  }

  if (isBroadCountry(raw)) {
    return { country: capitalize(raw), city: null }
  }

  // Unknown named place — treat as city; country unknown.
  return { country: null, city: capitalize(raw) }
}

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}
