export type CabinClass = 'economy' | 'premium-economy' | 'business' | 'first'

export interface FlightSegment {
  origin: string
  destination: string
  departure: string
  arrival: string
  carrier: string
  flightNumber: string
  aircraft: string | null
  cabin: CabinClass
  durationMinutes: number
}

export interface FlightItinerary {
  segments: FlightSegment[]
  totalDuration: number
  stops: number
  refundable: boolean
  baggageIncluded: boolean
}

export interface FlightOffer {
  id: string
  providerId: string
  title: string
  currency: string
  price: number
  originalPrice: number | null
  rating: number | null
  itinerary: FlightItinerary
  familyFriendly: boolean
  cancellationPolicy: string | null
}
