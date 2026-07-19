/**
 * Sprint 31 — Provider search helpers (flights + hotels) for the unified planner.
 * Sandbox / mock friendly — no production credentials required.
 */

import {
  applyHotelMemoryPreferenceBoost,
  createHotelProviderRegistry,
  searchHotelsForOrchestrator,
  type HotelProviderRegistry,
  type NormalizedHotelResult,
} from '../../hotels'
import { MockFlightAdapter } from '../../../integrations/adapters/MockFlightAdapter'
import type { TravelSearchRequest, CabinPreference } from '../../../utils/travelSearchRequest'
import type { ActivityStyle } from '../../../utils/requirementAnalyzer'
import type {
  UnifiedFlightLeg,
  UnifiedHotelStay,
  UnifiedTravelPlannerContext,
} from './types'

export async function searchUnifiedFlights(
  ctx: UnifiedTravelPlannerContext,
): Promise<UnifiedFlightLeg[]> {
  const adapter = new MockFlightAdapter()
  const search = buildTravelSearchRequest(ctx)
  const result = await adapter.searchFlights({ search })
  const offers = result.data ?? []
  return offers.slice(0, 6).map((offer, index) => {
    const firstSeg = offer.itinerary.segments[0]
    const lastSeg = offer.itinerary.segments[offer.itinerary.segments.length - 1]
    return {
      id: offer.id || `flight_${index}`,
      from: firstSeg?.origin ?? ctx.origin ?? 'RUH',
      to: lastSeg?.destination ?? ctx.destination ?? 'DXB',
      airline: firstSeg?.carrier ?? offer.title.split(' ')[0] ?? 'Airline',
      cabin: firstSeg?.cabin ?? ctx.cabinClass ?? 'economy',
      price: offer.price,
      currency: offer.currency || ctx.currency,
      stops: offer.itinerary.stops,
      durationHours: Math.max(1.5, Math.round((offer.itinerary.totalDuration / 60) * 10) / 10),
      providerId: offer.providerId || 'mock-flight-001',
    }
  })
}

export async function searchUnifiedHotels(
  ctx: UnifiedTravelPlannerContext,
  options?: { registry?: HotelProviderRegistry },
): Promise<{ stays: UnifiedHotelStay[]; providerId: string | null; raw: NormalizedHotelResult[] }> {
  const registry = options?.registry ?? createHotelProviderRegistry()
  const result = await searchHotelsForOrchestrator(
    {
      destination: ctx.destination,
      startDate: ctx.startDate,
      endDate: ctx.endDate,
      adults: ctx.adults,
      children: ctx.children,
      currency: ctx.currency,
      preferredHotels: ctx.preferredHotels,
      budgetAmount: ctx.budgetAmount,
    },
    { registry },
  )

  const boosted = applyHotelMemoryPreferenceBoost(
    result.offers,
    ctx.preferredHotels,
  )

  const stays = boosted.slice(0, 6).map((offer) => toHotelStay(offer, ctx.nights))
  return {
    stays,
    providerId: result.providerId,
    raw: boosted,
  }
}

export function toHotelStay(
  offer: NormalizedHotelResult,
  nightsFallback: number,
): UnifiedHotelStay {
  const nights = Math.max(1, offer.nights || nightsFallback)
  return {
    id: offer.id,
    name: offer.name,
    area: offer.area || offer.location,
    stars: offer.starRating,
    nightly: offer.nightly,
    nights,
    stayTotal: offer.price || roundMoney(offer.nightly * nights),
    currency: offer.currency,
    providerId: String(offer.providerId),
    amenities: [...offer.amenities],
    freeCancellation: offer.cancellation.freeCancellation,
    guestScore: offer.guestReviews.score,
  }
}

function buildTravelSearchRequest(ctx: UnifiedTravelPlannerContext): TravelSearchRequest {
  return {
    destination: ctx.destination || 'Dubai',
    departureCity: ctx.origin || 'Riyadh',
    departureDate: ctx.startDate || daysFromToday(14),
    returnDate: ctx.endDate || daysFromToday(17),
    durationDays: ctx.nights,
    travelPurpose: 'vacation',
    travelers: {
      adults: ctx.adults,
      children: ctx.children,
      infants: 0,
      total: ctx.adults + ctx.children,
      type: ctx.adults >= 2 ? 'couple' : 'solo',
    },
    budgetAmount: ctx.budgetAmount ?? 8000,
    budgetCurrency: ctx.currency,
    budgetPriority: 'balanced',
    preferredCabin: toCabinPreference(ctx.cabinClass),
    directFlightPreferred: 'any',
    preferredDepartureTime: '',
    preferredArrivalTime: '',
    preferredAirlines: [...ctx.preferredAirlines],
    avoidAirlines: [],
    hotelStars: 4,
    hotelBudget: Math.round((ctx.budgetAmount ?? 4000) / Math.max(1, ctx.nights)),
    preferredArea: '',
    familyFriendly: ctx.children > 0,
    breakfastRequired: false,
    freeCancellation: false,
    hotelAmenities: [],
    activityStyle: (ctx.activities[0] ?? '') as ActivityStyle,
    shoppingInterest: 0,
    natureInterest: 0,
    cultureInterest: 0,
    beachInterest: 0,
    adventureInterest: 0,
    entertainmentInterest: 0,
    lowestPriceWeight: 0,
    comfortWeight: 0,
    timeWeight: 0,
    luxuryWeight: 0,
    familyWeight: 0,
    missingFields: [],
    highConfidence: [],
    mediumConfidence: [],
    lowConfidence: [],
    readyForSearch: true,
    completionPercentage: 100,
  }
}

function daysFromToday(offset: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function toCabinPreference(cabin: string | null): CabinPreference {
  if (
    cabin === 'economy'
    || cabin === 'premium-economy'
    || cabin === 'business'
    || cabin === 'first'
  ) {
    return cabin
  }
  return 'economy'
}
