/**
 * Trip Planner orchestration — combines existing FlightService (Amadeus/mock)
 * and HotelService (Booking.com/mock) into a single itinerary search.
 *
 * Does not confirm bookings or process payments. Provider adapters stay behind
 * their services; this module only composes results.
 */

import type { TravelSearchRequest } from './travelSearchRequest'
import type { FlightOffer } from './contracts/models/flight'
import type { HotelOffer } from './contracts/models/hotel'
import type { ProviderRequest } from './contracts/providers/base'
import {
  getFlightService,
  getHotelService,
  type FlightService,
  type HotelService,
  type FlightModel,
  type HotelModel,
} from '../integrations'

export interface TripPlannerTravelers {
  adults: number
  children?: number
  infants?: number
}

export interface TripPlannerBudget {
  amount: number
  currency?: string
}

/** Minimal itinerary search input for the trip planner. */
export interface TripPlannerRequest {
  origin: string
  destination: string
  departureDate: string
  returnDate: string
  travelers: TripPlannerTravelers
  budget: TripPlannerBudget
}

export type TripPlannerProviderSource = FlightModel['source'] | HotelModel['source'] | 'skipped'

export interface TripTravelSummary {
  origin: string
  destination: string
  departureDate: string
  returnDate: string
  nights: number
  durationDays: number
  travelers: {
    adults: number
    children: number
    infants: number
    total: number
  }
  currency: string
  budgetAmount: number
}

export interface TripEstimatedCost {
  currency: string
  /** Lowest-priced flight among returned offers (trip fare quote). */
  flight: number | null
  /** Lowest-priced hotel among returned offers (provider quote for the stay). */
  hotel: number | null
  total: number | null
  budgetAmount: number
  remainingBudget: number | null
  withinBudget: boolean | null
}

export interface TripPlannerError {
  domain: 'flight' | 'hotel' | 'validation'
  message: string
}

export interface TripItineraryResult {
  requestId: string
  summary: TripTravelSummary
  flights: FlightOffer[]
  hotels: HotelOffer[]
  /** Convenience picks used for the estimated package cost (cheapest of each). */
  selectedFlight: FlightOffer | null
  selectedHotel: HotelOffer | null
  estimatedCost: TripEstimatedCost
  sources: {
    flight: TripPlannerProviderSource
    hotel: TripPlannerProviderSource
  }
  errors: TripPlannerError[]
  latencyMs: number
}

export interface TripPlannerDeps {
  flightService?: FlightService
  hotelService?: HotelService
}

function nightsBetween(departureDate: string, returnDate: string): number {
  const start = Date.parse(`${departureDate}T00:00:00Z`)
  const end = Date.parse(`${returnDate}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0
  return Math.round((end - start) / (24 * 60 * 60 * 1000))
}

function cheapestByPrice<T extends { price: number }>(offers: T[]): T | null {
  if (offers.length === 0) return null
  return offers.reduce((best, offer) => (offer.price < best.price ? offer : best))
}

function validateTripPlannerRequest(req: TripPlannerRequest): TripPlannerError[] {
  const errors: TripPlannerError[] = []
  if (!req.origin?.trim()) {
    errors.push({ domain: 'validation', message: 'origin is required' })
  }
  if (!req.destination?.trim()) {
    errors.push({ domain: 'validation', message: 'destination is required' })
  }
  if (!req.departureDate?.trim()) {
    errors.push({ domain: 'validation', message: 'departureDate is required' })
  }
  if (!req.returnDate?.trim()) {
    errors.push({ domain: 'validation', message: 'returnDate is required' })
  }
  if (!req.travelers || !(req.travelers.adults > 0)) {
    errors.push({ domain: 'validation', message: 'at least one adult traveler is required' })
  }
  if (!req.budget || !(req.budget.amount > 0)) {
    errors.push({ domain: 'validation', message: 'budget.amount must be greater than zero' })
  }
  const nights = nightsBetween(req.departureDate, req.returnDate)
  if (req.departureDate && req.returnDate && nights <= 0) {
    errors.push({ domain: 'validation', message: 'returnDate must be after departureDate' })
  }
  return errors
}

/**
 * Maps the trip-planner input into the shared TravelSearchRequest used by
 * FlightService / HotelService (and Amadeus / Booking adapters).
 */
export function toTravelSearchRequest(req: TripPlannerRequest): TravelSearchRequest {
  const adults = Math.max(0, Math.floor(req.travelers.adults))
  const children = Math.max(0, Math.floor(req.travelers.children ?? 0))
  const infants = Math.max(0, Math.floor(req.travelers.infants ?? 0))
  const nights = nightsBetween(req.departureDate, req.returnDate)
  const currency = (req.budget.currency || 'SAR').toUpperCase()

  return {
    destination: req.destination.trim(),
    departureCity: req.origin.trim(),
    departureDate: req.departureDate.trim(),
    returnDate: req.returnDate.trim(),
    durationDays: Math.max(nights, 1),
    travelPurpose: 'vacation',
    travelers: {
      adults,
      children,
      infants,
      total: adults + children + infants,
      type: adults + children + infants > 1 ? 'family' : 'solo',
    },
    budgetAmount: req.budget.amount,
    budgetCurrency: currency,
    budgetPriority: 'balanced',
    preferredCabin: 'economy',
    directFlightPreferred: 'any',
    preferredDepartureTime: '',
    preferredArrivalTime: '',
    preferredAirlines: [],
    avoidAirlines: [],
    hotelStars: 0,
    hotelBudget: 0,
    preferredArea: '',
    familyFriendly: children > 0 || infants > 0,
    breakfastRequired: false,
    freeCancellation: false,
    hotelAmenities: [],
    activityStyle: '',
    shoppingInterest: 0,
    natureInterest: 0,
    cultureInterest: 0,
    beachInterest: 0,
    adventureInterest: 0,
    entertainmentInterest: 0,
    lowestPriceWeight: 3,
    comfortWeight: 2,
    timeWeight: 2,
    luxuryWeight: 1,
    familyWeight: children > 0 || infants > 0 ? 3 : 1,
    missingFields: [],
    highConfidence: [],
    mediumConfidence: [],
    lowConfidence: [],
    readyForSearch: true,
    completionPercentage: 100,
  }
}

function buildEstimatedCost(
  currency: string,
  budgetAmount: number,
  flight: FlightOffer | null,
  hotel: HotelOffer | null,
): TripEstimatedCost {
  const flightPrice = flight ? flight.price : null
  const hotelPrice = hotel ? hotel.price : null
  const total =
    flightPrice === null && hotelPrice === null
      ? null
      : (flightPrice ?? 0) + (hotelPrice ?? 0)

  return {
    currency,
    flight: flightPrice,
    hotel: hotelPrice,
    total,
    budgetAmount,
    remainingBudget: total === null ? null : budgetAmount - total,
    withinBudget: total === null ? null : total <= budgetAmount,
  }
}

function emptyResult(
  req: TripPlannerRequest,
  errors: TripPlannerError[],
  start: number,
): TripItineraryResult {
  const nights = nightsBetween(req.departureDate, req.returnDate)
  const adults = Math.max(0, Math.floor(req.travelers?.adults ?? 0))
  const children = Math.max(0, Math.floor(req.travelers?.children ?? 0))
  const infants = Math.max(0, Math.floor(req.travelers?.infants ?? 0))
  const currency = (req.budget?.currency || 'SAR').toUpperCase()
  const budgetAmount = req.budget?.amount ?? 0

  return {
    requestId: crypto.randomUUID(),
    summary: {
      origin: req.origin?.trim() ?? '',
      destination: req.destination?.trim() ?? '',
      departureDate: req.departureDate ?? '',
      returnDate: req.returnDate ?? '',
      nights,
      durationDays: Math.max(nights, 0),
      travelers: {
        adults,
        children,
        infants,
        total: adults + children + infants,
      },
      currency,
      budgetAmount,
    },
    flights: [],
    hotels: [],
    selectedFlight: null,
    selectedHotel: null,
    estimatedCost: buildEstimatedCost(currency, budgetAmount, null, null),
    sources: { flight: 'skipped', hotel: 'skipped' },
    errors,
    latencyMs: Date.now() - start,
  }
}

/**
 * Search flights + hotels for one itinerary and return a unified trip plan.
 * Providers run concurrently via FlightService and HotelService.
 */
export async function planTrip(
  req: TripPlannerRequest,
  deps: TripPlannerDeps = {},
): Promise<TripItineraryResult> {
  const start = Date.now()
  const validationErrors = validateTripPlannerRequest(req)
  if (validationErrors.length > 0) {
    return emptyResult(req, validationErrors, start)
  }

  const search = toTravelSearchRequest(req)
  const providerReq: ProviderRequest = { search }
  const flightService = deps.flightService ?? getFlightService()
  const hotelService = deps.hotelService ?? getHotelService()
  const errors: TripPlannerError[] = []

  const [flightSettled, hotelSettled] = await Promise.allSettled([
    flightService.searchFlights(providerReq),
    hotelService.searchHotels(providerReq),
  ])

  let flights: FlightOffer[] = []
  let hotels: HotelOffer[] = []
  let flightSource: TripPlannerProviderSource = 'skipped'
  let hotelSource: TripPlannerProviderSource = 'skipped'

  if (flightSettled.status === 'fulfilled') {
    flights = flightSettled.value.offers ?? []
    flightSource = flightSettled.value.source
    if (flightSettled.value.error) {
      errors.push({ domain: 'flight', message: flightSettled.value.error })
    }
    if (flights.length === 0 && !flightSettled.value.error) {
      errors.push({ domain: 'flight', message: 'No flight offers returned' })
    }
  } else {
    errors.push({
      domain: 'flight',
      message: flightSettled.reason instanceof Error
        ? flightSettled.reason.message
        : 'Flight search failed',
    })
  }

  if (hotelSettled.status === 'fulfilled') {
    hotels = hotelSettled.value.offers ?? []
    hotelSource = hotelSettled.value.source
    if (hotelSettled.value.error) {
      errors.push({ domain: 'hotel', message: hotelSettled.value.error })
    }
    if (hotels.length === 0 && !hotelSettled.value.error) {
      errors.push({ domain: 'hotel', message: 'No hotel offers returned' })
    }
  } else {
    errors.push({
      domain: 'hotel',
      message: hotelSettled.reason instanceof Error
        ? hotelSettled.reason.message
        : 'Hotel search failed',
    })
  }

  const selectedFlight = cheapestByPrice(flights)
  const selectedHotel = cheapestByPrice(hotels)
  const nights = nightsBetween(req.departureDate, req.returnDate)
  const currency = search.budgetCurrency
  const budgetAmount = search.budgetAmount

  return {
    requestId: crypto.randomUUID(),
    summary: {
      origin: search.departureCity,
      destination: search.destination,
      departureDate: search.departureDate,
      returnDate: search.returnDate,
      nights,
      durationDays: search.durationDays,
      travelers: {
        adults: search.travelers.adults,
        children: search.travelers.children,
        infants: search.travelers.infants,
        total: search.travelers.total,
      },
      currency,
      budgetAmount,
    },
    flights,
    hotels,
    selectedFlight,
    selectedHotel,
    estimatedCost: buildEstimatedCost(currency, budgetAmount, selectedFlight, selectedHotel),
    sources: { flight: flightSource, hotel: hotelSource },
    errors,
    latencyMs: Date.now() - start,
  }
}
