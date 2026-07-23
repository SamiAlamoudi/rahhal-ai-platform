/**
 * Deterministic city cost priors for Planning Draft.
 * SAR-centric (Gulf traveler baseline). Not live inventory.
 */

export interface CityCostPrior {
  nameEn: string
  nameAr: string
  /** Round-trip flight hours from Riyadh (rough). */
  flightHoursFromRiyadh: number
  /** Mid-range hotel nightly SAR (shoulder season). */
  hotelNightlySar: number
  /** Daily food+local spend mid SAR per person. */
  dailyLocalSar: number
  /** Relative hotel pressure vs peer cities in the same country. */
  relativeHotelCost: 'lower' | 'typical' | 'higher'
  style: Array<'beach' | 'city' | 'culture' | 'nature' | 'resort'>
  /** Peak months (1–12) where hotels/flights inflate ~15–25%. */
  peakMonths: number[]
}

/** Country → candidate cities for draft comparison. */
export const COUNTRY_CITY_PRIORS: Record<string, CityCostPrior[]> = {
  morocco: [
    {
      nameEn: 'Agadir',
      nameAr: 'أكادير',
      flightHoursFromRiyadh: 7.5,
      hotelNightlySar: 280,
      dailyLocalSar: 180,
      relativeHotelCost: 'lower',
      style: ['beach', 'resort'],
      peakMonths: [7, 8],
    },
    {
      nameEn: 'Marrakech',
      nameAr: 'مراكش',
      flightHoursFromRiyadh: 7.5,
      hotelNightlySar: 420,
      dailyLocalSar: 220,
      relativeHotelCost: 'higher',
      style: ['city', 'culture'],
      peakMonths: [3, 4, 10, 11, 12],
    },
    {
      nameEn: 'Casablanca',
      nameAr: 'الدار البيضاء',
      flightHoursFromRiyadh: 7,
      hotelNightlySar: 360,
      dailyLocalSar: 210,
      relativeHotelCost: 'typical',
      style: ['city'],
      peakMonths: [7, 8],
    },
  ],
  japan: [
    {
      nameEn: 'Tokyo',
      nameAr: 'طوكيو',
      flightHoursFromRiyadh: 11,
      hotelNightlySar: 650,
      dailyLocalSar: 320,
      relativeHotelCost: 'higher',
      style: ['city', 'culture'],
      peakMonths: [3, 4, 10, 11],
    },
    {
      nameEn: 'Kyoto',
      nameAr: 'كيوتو',
      flightHoursFromRiyadh: 11.5,
      hotelNightlySar: 580,
      dailyLocalSar: 280,
      relativeHotelCost: 'typical',
      style: ['culture', 'city'],
      peakMonths: [3, 4, 10, 11],
    },
    {
      nameEn: 'Osaka',
      nameAr: 'أوساكا',
      flightHoursFromRiyadh: 11,
      hotelNightlySar: 520,
      dailyLocalSar: 270,
      relativeHotelCost: 'lower',
      style: ['city', 'culture'],
      peakMonths: [3, 4],
    },
  ],
  turkey: [
    {
      nameEn: 'Istanbul',
      nameAr: 'إسطنبول',
      flightHoursFromRiyadh: 4,
      hotelNightlySar: 380,
      dailyLocalSar: 200,
      relativeHotelCost: 'typical',
      style: ['city', 'culture'],
      peakMonths: [6, 7, 8],
    },
    {
      nameEn: 'Antalya',
      nameAr: 'أنطاليا',
      flightHoursFromRiyadh: 4.5,
      hotelNightlySar: 320,
      dailyLocalSar: 180,
      relativeHotelCost: 'lower',
      style: ['beach', 'resort'],
      peakMonths: [6, 7, 8],
    },
    {
      nameEn: 'Cappadocia',
      nameAr: 'كابدوكيا',
      flightHoursFromRiyadh: 4.5,
      hotelNightlySar: 400,
      dailyLocalSar: 190,
      relativeHotelCost: 'higher',
      style: ['nature', 'culture'],
      peakMonths: [4, 5, 9, 10],
    },
  ],
  egypt: [
    {
      nameEn: 'Cairo',
      nameAr: 'القاهرة',
      flightHoursFromRiyadh: 2.5,
      hotelNightlySar: 300,
      dailyLocalSar: 160,
      relativeHotelCost: 'typical',
      style: ['city', 'culture'],
      peakMonths: [12, 1, 2],
    },
    {
      nameEn: 'Luxor',
      nameAr: 'الأقصر',
      flightHoursFromRiyadh: 3,
      hotelNightlySar: 280,
      dailyLocalSar: 150,
      relativeHotelCost: 'lower',
      style: ['culture'],
      peakMonths: [12, 1, 2],
    },
    {
      nameEn: 'Red Sea',
      nameAr: 'البحر الأحمر',
      flightHoursFromRiyadh: 2.5,
      hotelNightlySar: 350,
      dailyLocalSar: 170,
      relativeHotelCost: 'typical',
      style: ['beach', 'resort'],
      peakMonths: [7, 8, 12, 1],
    },
  ],
  italy: [
    {
      nameEn: 'Rome',
      nameAr: 'روما',
      flightHoursFromRiyadh: 6,
      hotelNightlySar: 700,
      dailyLocalSar: 350,
      relativeHotelCost: 'typical',
      style: ['city', 'culture'],
      peakMonths: [5, 6, 7, 8, 9],
    },
    {
      nameEn: 'Florence',
      nameAr: 'فلورنسا',
      flightHoursFromRiyadh: 6.5,
      hotelNightlySar: 680,
      dailyLocalSar: 340,
      relativeHotelCost: 'higher',
      style: ['culture', 'city'],
      peakMonths: [5, 6, 7, 9],
    },
    {
      nameEn: 'Amalfi Coast',
      nameAr: 'ساحل أمالفي',
      flightHoursFromRiyadh: 6.5,
      hotelNightlySar: 900,
      dailyLocalSar: 380,
      relativeHotelCost: 'higher',
      style: ['beach', 'nature'],
      peakMonths: [6, 7, 8],
    },
  ],
  spain: [
    {
      nameEn: 'Barcelona',
      nameAr: 'برشلونة',
      flightHoursFromRiyadh: 7,
      hotelNightlySar: 620,
      dailyLocalSar: 300,
      relativeHotelCost: 'typical',
      style: ['city', 'beach', 'culture'],
      peakMonths: [6, 7, 8],
    },
    {
      nameEn: 'Madrid',
      nameAr: 'مدريد',
      flightHoursFromRiyadh: 7,
      hotelNightlySar: 580,
      dailyLocalSar: 290,
      relativeHotelCost: 'typical',
      style: ['city', 'culture'],
      peakMonths: [5, 6, 9, 10],
    },
    {
      nameEn: 'Andalusia',
      nameAr: 'الأندلس',
      flightHoursFromRiyadh: 7.5,
      hotelNightlySar: 480,
      dailyLocalSar: 250,
      relativeHotelCost: 'lower',
      style: ['culture', 'city'],
      peakMonths: [3, 4, 5, 9, 10],
    },
  ],
}

/** Single-city / specific destination priors when country pack is not used. */
export const CITY_ONLY_PRIORS: Record<string, CityCostPrior> = {
  tokyo: COUNTRY_CITY_PRIORS.japan![0]!,
  kyoto: COUNTRY_CITY_PRIORS.japan![1]!,
  osaka: COUNTRY_CITY_PRIORS.japan![2]!,
  istanbul: COUNTRY_CITY_PRIORS.turkey![0]!,
  marrakech: COUNTRY_CITY_PRIORS.morocco![1]!,
  paris: {
    nameEn: 'Paris',
    nameAr: 'باريس',
    flightHoursFromRiyadh: 7,
    hotelNightlySar: 750,
    dailyLocalSar: 360,
    relativeHotelCost: 'higher',
    style: ['city', 'culture'],
    peakMonths: [5, 6, 7, 9, 12],
  },
  london: {
    nameEn: 'London',
    nameAr: 'لندن',
    flightHoursFromRiyadh: 7,
    hotelNightlySar: 780,
    dailyLocalSar: 370,
    relativeHotelCost: 'higher',
    style: ['city', 'culture'],
    peakMonths: [6, 7, 8, 12],
  },
  dubai: {
    nameEn: 'Dubai',
    nameAr: 'دبي',
    flightHoursFromRiyadh: 2,
    hotelNightlySar: 550,
    dailyLocalSar: 280,
    relativeHotelCost: 'typical',
    style: ['city', 'beach', 'resort'],
    peakMonths: [12, 1, 2],
  },
  bali: {
    nameEn: 'Bali',
    nameAr: 'بالي',
    flightHoursFromRiyadh: 12,
    hotelNightlySar: 350,
    dailyLocalSar: 180,
    relativeHotelCost: 'lower',
    style: ['beach', 'nature', 'resort'],
    peakMonths: [7, 8, 12],
  },
}

/** Rough FX → SAR for internal math (deterministic). */
export function toSar(amount: number, currency: string): number {
  const c = currency.toUpperCase()
  if (c === 'SAR' || c === 'ر.س' || c === 'ريال') return amount
  if (c === 'USD' || c === '$') return Math.round(amount * 3.75)
  if (c === 'EUR' || c === '€') return Math.round(amount * 4.05)
  if (c === 'AED') return Math.round(amount * 1.02)
  return amount
}

export function fromSar(amountSar: number, currency: string): number {
  const c = currency.toUpperCase()
  if (c === 'SAR' || c === 'ر.س' || c === 'ريال') return Math.round(amountSar)
  if (c === 'USD' || c === '$') return Math.round(amountSar / 3.75)
  if (c === 'EUR' || c === '€') return Math.round(amountSar / 4.05)
  if (c === 'AED') return Math.round(amountSar / 1.02)
  return Math.round(amountSar)
}
