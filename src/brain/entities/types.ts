import type { CurrencyCode, IsoDate, LocaleCode } from '../types'
import type { HotelClass, TransportType, TravellerParty } from '../travel/types'

export type ExtractedEntities = {
  destination?: string
  origin?: string
  dates?: { departure?: IsoDate; return?: IsoDate }
  duration?: number
  budget?: number
  currency?: CurrencyCode
  travellers?: TravellerParty
  children?: number
  hotelClass?: HotelClass
  airline?: string
  preferences?: string[]
  visaCountry?: string
  transportType?: TransportType
  language?: LocaleCode
  specialNeeds?: string[]
  rawMentions: string[]
}
