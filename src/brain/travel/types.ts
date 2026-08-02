import type { CurrencyCode, IsoDate, LocaleCode } from '../types'

export type TravellerParty = {
  adults: number
  children: number
}

export type TripGoal =
  | 'leisure'
  | 'business'
  | 'family'
  | 'luxury'
  | 'budget'
  | 'adventure'
  | 'unknown'

export type TransportType = 'flight' | 'train' | 'car' | 'transfer' | 'unknown'

export type HotelClass = 1 | 2 | 3 | 4 | 5

export type TravelDraft = {
  origin?: string
  destination?: string
  departureDate?: IsoDate
  returnDate?: IsoDate
  durationNights?: number
  budgetAmount?: number
  currency?: CurrencyCode
  travellers?: TravellerParty
  hotelClass?: HotelClass
  airline?: string
  visaCountry?: string
  transportType?: TransportType
  language?: LocaleCode
  specialNeeds?: string[]
  tripGoal?: TripGoal
}

export type MockFlightOption = {
  id: string
  airline: string
  origin: string
  destination: string
  durationHours: number
  price: number
  currency: CurrencyCode
  stops: number
  quality: number // 0..1
}

export type MockHotelOption = {
  id: string
  name: string
  city: string
  stars: HotelClass
  pricePerNight: number
  currency: CurrencyCode
  quality: number
}

export type MockPackageOption = {
  id: string
  title: string
  destination: string
  nights: number
  totalPrice: number
  currency: CurrencyCode
  quality: number
  includesFlight: boolean
  includesHotel: boolean
}
