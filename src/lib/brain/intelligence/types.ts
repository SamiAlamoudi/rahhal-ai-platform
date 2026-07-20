/**
 * Sprint 53 — Real World Intelligence Layer types.
 * Live signals only — not another reasoning framework.
 */

export type LiveDomain =
  | 'flight'
  | 'hotel'
  | 'weather'
  | 'visa'
  | 'event'
  | 'safety'
  | 'exchange'
  | 'transport'
  | 'price_watch'

export type LiveProviderId = string

export type LiveEventType =
  | 'PriceChanged'
  | 'WeatherChanged'
  | 'FlightDelayed'
  | 'VisaUpdated'
  | 'HotelUnavailable'
  | 'ExchangeRateChanged'
  | 'TripAffected'

export interface LiveEvent {
  type: LiveEventType
  domain: LiveDomain
  providerId: LiveProviderId
  at: string
  payload: Record<string, unknown>
}

export interface Money {
  amount: number
  currency: string
}

export interface LiveProviderHealth {
  providerId: LiveProviderId
  domain: LiveDomain
  healthy: boolean
  circuitState: 'closed' | 'open' | 'half_open'
  lastError: string | null
  latencyMs: number | null
}

export interface LiveQuery {
  domain: LiveDomain
  destination?: string | null
  origin?: string | null
  startDate?: string | null
  endDate?: string | null
  adults?: number | null
  currency?: string | null
  nationality?: string | null
  cabin?: string | null
  budgetAmount?: number | null
  locale?: 'ar' | 'en'
  now?: Date
}

export interface FlightOffer {
  id: string
  airline: string
  flightNumber: string
  origin: string
  destination: string
  departAt: string
  arriveAt: string
  durationMinutes: number
  layovers: number
  cabin: string
  fareClass: string
  seatsRemaining: number
  baggageKg: number
  refundable: boolean
  price: Money
  priceTrend: 'down' | 'stable' | 'up'
  historicalLow: Money
  confidence: number
}

export interface HotelOffer {
  id: string
  name: string
  stars: number
  nightly: Money
  total: Money
  amenities: string[]
  familySuitability: number
  luxuryScore: number
  guestRating: number
  cancellation: 'free' | 'partial' | 'non_refundable'
  distanceKm: number
  nearbyAttractions: string[]
  breakfast: boolean
  parking: boolean
  internet: boolean
  available: boolean
  confidence: number
}

export interface WeatherSignal {
  destination: string
  currentC: number
  condition: string
  forecast: Array<{ day: string; highC: number; lowC: number; rainChance: number; condition: string }>
  humidity: number
  airQualityIndex: number
  windKph: number
  uvIndex: number
  seasonAlert: string | null
  travelSuitability: number
  confidence: number
}

export interface VisaSignal {
  destination: string
  nationality: string
  requirement: 'visa_free' | 'visa_on_arrival' | 'evisa' | 'embassy' | 'forbidden' | 'unknown'
  transitVisaRequired: boolean
  processingDays: number
  requiredDocuments: string[]
  validityDays: number
  warnings: string[]
  confidence: number
}

export interface EventSignal {
  destination: string
  holidays: string[]
  festivals: string[]
  conferences: string[]
  sportEvents: string[]
  schoolVacations: boolean
  peakSeason: boolean
  trafficImpact: 'low' | 'medium' | 'high'
  hotelDemand: 'low' | 'medium' | 'high'
  confidence: number
}

export interface SafetySignal {
  destination: string
  advisoryLevel: 'none' | 'watch' | 'warning' | 'critical'
  naturalDisasters: string[]
  politicalRisk: number
  diseaseOutbreaks: string[]
  airportDisruption: string | null
  securityAlerts: string[]
  confidence: number
}

export interface ExchangeSignal {
  base: string
  quote: string
  rate: number
  dailyChangePct: number
  trend7d: 'down' | 'stable' | 'up'
  budgetConverted: Money | null
  spendingForecast: Money | null
  confidence: number
}

export interface TransportSignal {
  destination: string
  options: Array<{
    mode: 'metro' | 'taxi' | 'uber' | 'train' | 'bus' | 'rental' | 'airport_transfer'
    etaMinutes: number
    price: Money
    notes: string
  }>
  confidence: number
}

export interface PriceWatchSignal {
  watches: Array<{
    kind: 'flight' | 'hotel' | 'package'
    label: string
    current: Money
    previous: Money
    changePct: number
    inventoryLimited: boolean
    notify: 'drop' | 'rise' | 'limited' | null
  }>
  confidence: number
}

export interface AvailabilityResult {
  available: boolean
  units: number
  notes: string | null
}

export interface PricingResult {
  price: Money
  taxes: Money
  total: Money
  fareClass?: string | null
  confidence: number
}

export interface BookingResult {
  bookingId: string
  status: 'confirmed' | 'pending' | 'failed'
  message: string
}

export interface CancelResult {
  bookingId: string
  cancelled: boolean
  refund: Money | null
  message: string
}

export interface StatusResult {
  bookingId: string
  status: string
  details: Record<string, unknown>
}

export interface LiveDomainResultMap {
  flight: FlightOffer[]
  hotel: HotelOffer[]
  weather: WeatherSignal
  visa: VisaSignal
  event: EventSignal
  safety: SafetySignal
  exchange: ExchangeSignal
  transport: TransportSignal
  price_watch: PriceWatchSignal
}

export interface LiveIntelligenceSnapshot {
  domains: LiveDomain[]
  flights: FlightOffer[]
  hotels: HotelOffer[]
  weather: WeatherSignal | null
  visa: VisaSignal | null
  events: EventSignal | null
  safety: SafetySignal | null
  exchange: ExchangeSignal | null
  transport: TransportSignal | null
  priceWatch: PriceWatchSignal | null
  providerIds: string[]
  eventsEmitted: LiveEventType[]
  cacheHits: number
  cacheMisses: number
  degraded: boolean
  latencyMs: number
  confidence: number
  summary: string | null
}
