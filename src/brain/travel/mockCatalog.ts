import type { MockFlightOption, MockHotelOption, MockPackageOption } from './types'

/** Static mock inventory — no provider calls. */
export const MOCK_FLIGHTS: readonly MockFlightOption[] = [
  {
    id: 'fl-sv-ruh-ist',
    airline: 'Saudia',
    origin: 'RUH',
    destination: 'IST',
    durationHours: 4.5,
    price: 1850,
    currency: 'SAR',
    stops: 0,
    quality: 0.86,
  },
  {
    id: 'fl-ek-ruh-dxb',
    airline: 'Emirates',
    origin: 'RUH',
    destination: 'DXB',
    durationHours: 1.8,
    price: 980,
    currency: 'SAR',
    stops: 0,
    quality: 0.92,
  },
  {
    id: 'fl-xy-jed-cai',
    airline: 'flynas',
    origin: 'JED',
    destination: 'CAI',
    durationHours: 2.4,
    price: 720,
    currency: 'SAR',
    stops: 0,
    quality: 0.74,
  },
  {
    id: 'fl-qr-doh-lhr',
    airline: 'Qatar Airways',
    origin: 'DOH',
    destination: 'LHR',
    durationHours: 7.2,
    price: 3200,
    currency: 'SAR',
    stops: 0,
    quality: 0.94,
  },
]

export const MOCK_HOTELS: readonly MockHotelOption[] = [
  {
    id: 'ht-ist-pera',
    name: 'Pera Palace',
    city: 'Istanbul',
    stars: 5,
    pricePerNight: 920,
    currency: 'SAR',
    quality: 0.9,
  },
  {
    id: 'ht-dxb-creek',
    name: 'Creek View',
    city: 'Dubai',
    stars: 4,
    pricePerNight: 540,
    currency: 'SAR',
    quality: 0.82,
  },
  {
    id: 'ht-cai-nile',
    name: 'Nile Soft',
    city: 'Cairo',
    stars: 3,
    pricePerNight: 280,
    currency: 'SAR',
    quality: 0.7,
  },
]

export const MOCK_PACKAGES: readonly MockPackageOption[] = [
  {
    id: 'pk-ist-calm-4',
    title: 'Istanbul Calm 4N',
    destination: 'Istanbul',
    nights: 4,
    totalPrice: 5400,
    currency: 'SAR',
    quality: 0.88,
    includesFlight: true,
    includesHotel: true,
  },
  {
    id: 'pk-dxb-weekend',
    title: 'Dubai Weekend',
    destination: 'Dubai',
    nights: 3,
    totalPrice: 3900,
    currency: 'SAR',
    quality: 0.84,
    includesFlight: true,
    includesHotel: true,
  },
]

export const MOCK_DESTINATION_META: Record<
  string,
  {
    season: 'peak' | 'shoulder' | 'low'
    familySuitability: number
    businessSuitability: number
    typicalWeather: string
    holidaysNote?: string
  }
> = {
  istanbul: {
    season: 'shoulder',
    familySuitability: 0.85,
    businessSuitability: 0.7,
    typicalWeather: 'mild',
    holidaysNote: 'Ramadan evenings quieter in some districts',
  },
  dubai: {
    season: 'peak',
    familySuitability: 0.9,
    businessSuitability: 0.95,
    typicalWeather: 'hot',
  },
  cairo: {
    season: 'shoulder',
    familySuitability: 0.75,
    businessSuitability: 0.65,
    typicalWeather: 'warm',
  },
  london: {
    season: 'peak',
    familySuitability: 0.8,
    businessSuitability: 0.95,
    typicalWeather: 'cool_rain',
  },
}
