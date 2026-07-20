/**
 * Curated destination knowledge for open-ended travel reasoning.
 * Deterministic climate/budget/visa priors — not live weather APIs.
 */

import type { ClimateBand, DestinationClimateProfile } from './types'

/** Helper: fill 12 months with a climate pattern. */
function months(...bands: ClimateBand[]): ClimateBand[] {
  if (bands.length !== 12) {
    throw new Error('climateByMonth must have 12 entries')
  }
  return bands
}

/**
 * Compact catalog oriented to Gulf / Saudi travelers.
 * Climate bands are approximate seasonal priors for ranking only.
 */
export const DESTINATION_CATALOG: DestinationClimateProfile[] = [
  {
    id: 'istanbul',
    nameEn: 'Istanbul',
    nameAr: 'إسطنبول',
    region: 'Europe/Asia',
    climateByMonth: months('cold', 'cold', 'cool', 'mild', 'mild', 'warm', 'hot', 'hot', 'warm', 'mild', 'cool', 'cold'),
    dailyBudgetSar: { low: 450, mid: 700, high: 1200 },
    visaFromSaudi: 'evisa',
    bestFor: ['culture', 'food', 'city', 'shopping'],
    risks: ['busy_season_summer'],
    flightHoursFromRiyadh: 4,
  },
  {
    id: 'tbilisi',
    nameEn: 'Tbilisi',
    nameAr: 'تبليسي',
    region: 'Caucasus',
    climateByMonth: months('cold', 'cold', 'cool', 'mild', 'mild', 'warm', 'warm', 'warm', 'mild', 'cool', 'cold', 'cold'),
    dailyBudgetSar: { low: 350, mid: 550, high: 900 },
    visaFromSaudi: 'visa_free',
    bestFor: ['nature', 'culture', 'food', 'adventure'],
    risks: ['mountain_weather'],
    flightHoursFromRiyadh: 5,
  },
  {
    id: 'geneva',
    nameEn: 'Geneva',
    nameAr: 'جنيف',
    region: 'Europe',
    climateByMonth: months('cold', 'cold', 'cool', 'mild', 'mild', 'warm', 'warm', 'warm', 'mild', 'cool', 'cold', 'cold'),
    dailyBudgetSar: { low: 900, mid: 1400, high: 2200 },
    visaFromSaudi: 'embassy',
    bestFor: ['nature', 'culture', 'city'],
    risks: ['schengen_visa', 'high_cost'],
    flightHoursFromRiyadh: 7,
  },
  {
    id: 'baku',
    nameEn: 'Baku',
    nameAr: 'باكو',
    region: 'Caucasus',
    climateByMonth: months('cold', 'cold', 'cool', 'mild', 'warm', 'warm', 'hot', 'hot', 'warm', 'mild', 'cool', 'cold'),
    dailyBudgetSar: { low: 400, mid: 650, high: 1000 },
    visaFromSaudi: 'evisa',
    bestFor: ['culture', 'city', 'food'],
    risks: ['summer_heat'],
    flightHoursFromRiyadh: 3.5,
  },
  {
    id: 'amman',
    nameEn: 'Amman',
    nameAr: 'عمّان',
    region: 'Levant',
    climateByMonth: months('cool', 'cool', 'mild', 'mild', 'warm', 'hot', 'hot', 'hot', 'warm', 'mild', 'cool', 'cool'),
    dailyBudgetSar: { low: 400, mid: 650, high: 1100 },
    visaFromSaudi: 'visa_on_arrival',
    bestFor: ['culture', 'family', 'food'],
    risks: ['summer_heat'],
    flightHoursFromRiyadh: 2,
  },
  {
    id: 'london',
    nameEn: 'London',
    nameAr: 'لندن',
    region: 'Europe',
    climateByMonth: months('cold', 'cold', 'cool', 'mild', 'mild', 'mild', 'warm', 'warm', 'mild', 'cool', 'cool', 'cold'),
    dailyBudgetSar: { low: 800, mid: 1300, high: 2000 },
    visaFromSaudi: 'embassy',
    bestFor: ['culture', 'shopping', 'city', 'food'],
    risks: ['uk_visa', 'rain', 'high_cost'],
    flightHoursFromRiyadh: 7,
  },
  {
    id: 'paris',
    nameEn: 'Paris',
    nameAr: 'باريس',
    region: 'Europe',
    climateByMonth: months('cold', 'cold', 'cool', 'mild', 'mild', 'warm', 'warm', 'warm', 'mild', 'cool', 'cool', 'cold'),
    dailyBudgetSar: { low: 850, mid: 1350, high: 2100 },
    visaFromSaudi: 'embassy',
    bestFor: ['culture', 'food', 'romance', 'shopping'],
    risks: ['schengen_visa', 'high_cost'],
    flightHoursFromRiyadh: 7,
  },
  {
    id: 'cairo',
    nameEn: 'Cairo',
    nameAr: 'القاهرة',
    region: 'North Africa',
    climateByMonth: months('mild', 'mild', 'warm', 'warm', 'hot', 'hot', 'hot', 'hot', 'warm', 'warm', 'mild', 'mild'),
    dailyBudgetSar: { low: 300, mid: 500, high: 900 },
    visaFromSaudi: 'visa_on_arrival',
    bestFor: ['culture', 'family', 'food'],
    risks: ['summer_heat', 'traffic'],
    flightHoursFromRiyadh: 3,
  },
  {
    id: 'dubai',
    nameEn: 'Dubai',
    nameAr: 'دبي',
    region: 'GCC',
    climateByMonth: months('mild', 'mild', 'warm', 'warm', 'hot', 'hot', 'hot', 'hot', 'hot', 'warm', 'mild', 'mild'),
    dailyBudgetSar: { low: 500, mid: 900, high: 1600 },
    visaFromSaudi: 'visa_free',
    bestFor: ['shopping', 'family', 'city', 'beach'],
    risks: ['extreme_summer_heat'],
    flightHoursFromRiyadh: 1.5,
  },
  {
    id: 'maldives',
    nameEn: 'Maldives',
    nameAr: 'المالديف',
    region: 'Indian Ocean',
    climateByMonth: months('warm', 'warm', 'warm', 'warm', 'warm', 'rainy', 'rainy', 'rainy', 'warm', 'warm', 'warm', 'warm'),
    dailyBudgetSar: { low: 900, mid: 1500, high: 2800 },
    visaFromSaudi: 'visa_on_arrival',
    bestFor: ['beach', 'romance', 'honeymoon'],
    risks: ['high_cost', 'monsoon'],
    flightHoursFromRiyadh: 6,
  },
  {
    id: 'bali',
    nameEn: 'Bali',
    nameAr: 'بالي',
    region: 'Southeast Asia',
    climateByMonth: months('rainy', 'rainy', 'rainy', 'mild', 'mild', 'dry', 'dry', 'dry', 'dry', 'mild', 'rainy', 'rainy'),
    dailyBudgetSar: { low: 350, mid: 600, high: 1100 },
    visaFromSaudi: 'visa_on_arrival',
    bestFor: ['beach', 'nature', 'romance', 'adventure'],
    risks: ['long_haul', 'rainy_season'],
    flightHoursFromRiyadh: 12,
  },
  {
    id: 'marrakech',
    nameEn: 'Marrakech',
    nameAr: 'مراكش',
    region: 'North Africa',
    climateByMonth: months('cool', 'cool', 'mild', 'mild', 'warm', 'hot', 'hot', 'hot', 'warm', 'mild', 'cool', 'cool'),
    dailyBudgetSar: { low: 400, mid: 650, high: 1100 },
    visaFromSaudi: 'visa_free',
    bestFor: ['culture', 'food', 'adventure'],
    risks: ['summer_heat'],
    flightHoursFromRiyadh: 7,
  },
  {
    id: 'tokyo',
    nameEn: 'Tokyo',
    nameAr: 'طوكيو',
    region: 'East Asia',
    climateByMonth: months('cold', 'cold', 'cool', 'mild', 'mild', 'warm', 'hot', 'hot', 'warm', 'mild', 'cool', 'cold'),
    dailyBudgetSar: { low: 700, mid: 1100, high: 1800 },
    visaFromSaudi: 'embassy',
    bestFor: ['culture', 'food', 'city', 'shopping'],
    risks: ['long_haul', 'visa', 'high_cost'],
    flightHoursFromRiyadh: 12,
  },
  {
    id: 'cappadocia',
    nameEn: 'Cappadocia',
    nameAr: 'كابادوكيا',
    region: 'Turkey',
    climateByMonth: months('cold', 'cold', 'cool', 'mild', 'mild', 'warm', 'hot', 'hot', 'warm', 'mild', 'cool', 'cold'),
    dailyBudgetSar: { low: 400, mid: 650, high: 1000 },
    visaFromSaudi: 'evisa',
    bestFor: ['nature', 'adventure', 'romance', 'culture'],
    risks: ['winter_cold'],
    flightHoursFromRiyadh: 4.5,
  },
  {
    id: 'salalah',
    nameEn: 'Salalah',
    nameAr: 'صلالة',
    region: 'GCC',
    climateByMonth: months('mild', 'mild', 'warm', 'warm', 'warm', 'mild', 'cool', 'cool', 'mild', 'warm', 'mild', 'mild'),
    dailyBudgetSar: { low: 350, mid: 550, high: 900 },
    visaFromSaudi: 'visa_on_arrival',
    bestFor: ['nature', 'family', 'beach'],
    risks: ['khareef_crowds'],
    flightHoursFromRiyadh: 2.5,
  },
]

export function findDestinationProfile(name: string | null | undefined): DestinationClimateProfile | null {
  if (!name) return null
  const key = name.trim().toLowerCase()
  return DESTINATION_CATALOG.find((row) =>
    row.id === key
    || row.nameEn.toLowerCase() === key
    || row.nameAr === name.trim()
    || key.includes(row.id)
  ) ?? null
}
