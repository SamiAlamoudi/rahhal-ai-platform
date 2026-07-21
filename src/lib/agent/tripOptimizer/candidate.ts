/**
 * Shared itinerary candidate shape for score modules.
 */

export interface FlightLegFacts {
  id: string
  airline: string
  price: number
  currency: string
  durationMinutes: number | null
  stops: number
  cabin: string | null
  arrivalHour: number | null
  departureHour: number | null
  layoverMinutes: number | null
  payload: Record<string, unknown>
}

export interface HotelStayFacts {
  id: string
  name: string
  chain: string | null
  price: number
  currency: string
  stars: number | null
  rating: number | null
  walkMinutes: number | null
  checkInHour: number | null
  checkOutHour: number | null
  familyFriendly: boolean
  businessFriendly: boolean
  payload: Record<string, unknown>
}

export interface ItineraryCandidate {
  id: string
  flight: FlightLegFacts
  hotel: HotelStayFacts
  totalPrice: number
  currency: string
  budgetCap: number | null
  remainingBudget: number | null
  personalizationBoost: number
  weatherFit: number | null
  riskHint: number | null
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function hourFromUnknown(value: unknown): number | null {
  if (typeof value === 'number' && value >= 0 && value <= 23) return value
  if (typeof value === 'string') {
    const m = value.match(/T(\d{2}):/)
    if (m) return Number(m[1])
    const h = Number(value)
    if (!Number.isNaN(h) && h >= 0 && h <= 23) return h
  }
  return null
}
