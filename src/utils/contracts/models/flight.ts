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
  /** Optional enrichment when the provider supplies terminals. */
  departureTerminal?: string | null
  arrivalTerminal?: string | null
  /** Marketing vs operating carrier when distinct. */
  operatingCarrier?: string | null
  fareFamily?: string | null
  bookingClass?: string | null
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
  /**
   * Optional provider deep-link for Rahhal redirect booking mode.
   * Amadeus Self-Service search does not return a merchant checkout URL;
   * adapters may supply a safe HTTPS handoff link carrying the offer id.
   */
  bookingUrl?: string | null
}
