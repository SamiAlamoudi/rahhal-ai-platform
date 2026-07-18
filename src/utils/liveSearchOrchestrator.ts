/**
 * Live search orchestration — bridges TravelSearchRequest to integration
 * provider services (Amadeus, Booking.com, RentalCars, OpenWeather) while
 * preserving the existing SearchOrchestrationResult shape used by the UI.
 *
 * Services already fall back to mock adapters on failure; this module
 * records those fallbacks as ProviderError entries without dropping results.
 */

import type { TravelSearchRequest } from './travelSearchRequest'
import type { FlightOffer } from './contracts/models/flight'
import type { HotelOffer } from './contracts/models/hotel'
import type { Vehicle } from './contracts/models/rentalCar'
import type { ActivityOffer } from './contracts/models/activity'
import type { ProviderRequest } from './contracts/providers/base'
import type { ProviderResult } from './contracts/result'
import {
  createSearchPlan,
  validateProviderResult,
  normalizeProviderResult,
  deduplicateResults,
  scoreNormalizedOption,
  rankTravelOptions,
  type ProviderError,
  type ProviderSearchResult,
  type SearchOrchestrationResult,
  type SearchProviderType,
} from './searchOrchestrator'
import {
  getFlightService,
  getHotelService,
  getRentalCarService,
  getWeatherService,
  getProviderRegistry,
  type FlightService,
  type HotelService,
  type RentalCarService,
  type WeatherService,
  type WeatherModel,
} from '../integrations'
import { MockActivityAdapter } from '../integrations/adapters/MockActivityAdapter'

export type ProviderSource = 'mock' | 'real' | 'fallback' | 'skipped'

export interface LiveSearchSources {
  flight: ProviderSource
  hotel: ProviderSource
  rentalCar: ProviderSource
  weather: ProviderSource
  activity: ProviderSource
}

export interface LiveSearchOrchestrationResult extends SearchOrchestrationResult {
  weather: WeatherModel | null
  sources: LiveSearchSources
}

export interface LiveSearchDeps {
  flightService?: FlightService
  hotelService?: HotelService
  rentalCarService?: RentalCarService
  weatherService?: WeatherService
  /** Override activity search (defaults to registry activity provider or MockActivityAdapter). */
  searchActivities?: (req: ProviderRequest) => Promise<ProviderResult<ActivityOffer[]>>
}

function toProviderRequest(req: TravelSearchRequest): ProviderRequest {
  return { search: req }
}

function mapFlightOffer(
  offer: FlightOffer,
  providerName: string,
  retrievedAt: string,
): ProviderSearchResult {
  const first = offer.itinerary.segments[0]
  const last = offer.itinerary.segments[offer.itinerary.segments.length - 1]
  return {
    providerId: offer.providerId,
    providerName,
    providerType: 'flight',
    externalId: offer.id,
    title: offer.title,
    description: '',
    currency: offer.currency,
    price: offer.price,
    originalPrice: offer.originalPrice,
    durationMinutes: offer.itinerary.totalDuration,
    stops: offer.itinerary.stops,
    rating: offer.rating,
    location: last?.destination ?? null,
    cancellationPolicy: offer.cancellationPolicy,
    baggageIncluded: offer.itinerary.baggageIncluded,
    familyFriendly: offer.familyFriendly,
    rawMetadata: {
      airline: first?.carrier ?? null,
      flightNumber: first?.flightNumber ?? null,
      origin: first?.origin ?? null,
      destination: last?.destination ?? null,
      departureTime: first?.departure ?? null,
      arrivalTime: last?.arrival ?? null,
      cabin: first?.cabin ?? null,
      refundable: offer.itinerary.refundable,
      providerName,
      bookingUrl: offer.bookingUrl ?? null,
      amadeusOfferId: offer.providerId.startsWith('amadeus-') ? offer.id : null,
    },
    retrievedAt,
  }
}

function mapHotelOffer(
  offer: HotelOffer,
  providerName: string,
  retrievedAt: string,
): ProviderSearchResult {
  return {
    providerId: offer.providerId,
    providerName,
    providerType: 'hotel',
    externalId: offer.id,
    title: offer.title,
    description: '',
    currency: offer.currency,
    price: offer.price,
    originalPrice: offer.originalPrice,
    durationMinutes: null,
    stops: null,
    rating: offer.rating,
    location: offer.location,
    cancellationPolicy: offer.freeCancellation ? 'free cancellation' : null,
    baggageIncluded: null,
    familyFriendly: offer.familyFriendly,
    rawMetadata: {
      hotelStars: offer.hotelStars,
      checkInDate: offer.checkIn,
      checkOutDate: offer.checkOut,
      breakfastIncluded: offer.breakfastIncluded,
      freeCancellation: offer.freeCancellation,
      amenities: offer.amenities.join(', '),
      area: offer.area,
      destination: offer.location,
    },
    retrievedAt,
  }
}

function mapVehicle(
  vehicle: Vehicle,
  providerName: string,
  retrievedAt: string,
): ProviderSearchResult {
  return {
    providerId: vehicle.providerId,
    providerName,
    providerType: 'transportation',
    externalId: `${vehicle.providerId}-${vehicle.vehicleName}-${vehicle.pickupDate}`,
    title: `${vehicle.company} — ${vehicle.vehicleName}`,
    description: `${vehicle.category} · ${vehicle.transmission} · ${vehicle.fuelType}`,
    currency: vehicle.currency,
    price: vehicle.price,
    originalPrice: null,
    durationMinutes: null,
    stops: null,
    rating: vehicle.rating,
    location: vehicle.pickupLocation,
    cancellationPolicy: vehicle.insuranceIncluded ? 'insurance included' : null,
    baggageIncluded: null,
    familyFriendly: vehicle.seats >= 5,
    rawMetadata: {
      company: vehicle.company,
      category: vehicle.category,
      transmission: vehicle.transmission,
      fuelType: vehicle.fuelType,
      seats: vehicle.seats,
      doors: vehicle.doors,
      pickupLocation: vehicle.pickupLocation,
      dropoffLocation: vehicle.dropoffLocation,
      pickupDate: vehicle.pickupDate,
      dropoffDate: vehicle.dropoffDate,
      unlimitedMileage: vehicle.unlimitedMileage,
      insuranceIncluded: vehicle.insuranceIncluded,
      bookingUrl: vehicle.bookingUrl,
      image: vehicle.image,
    },
    retrievedAt,
  }
}

function mapActivityOffer(
  offer: ActivityOffer,
  providerName: string,
  retrievedAt: string,
): ProviderSearchResult {
  return {
    providerId: offer.providerId,
    providerName,
    providerType: 'activity',
    externalId: offer.id,
    title: offer.title,
    description: '',
    currency: offer.currency,
    price: offer.price,
    originalPrice: offer.originalPrice,
    durationMinutes: offer.durationMinutes,
    stops: null,
    rating: offer.rating,
    location: offer.location,
    cancellationPolicy: offer.cancellationPolicy,
    baggageIncluded: null,
    familyFriendly: offer.familyFriendly,
    rawMetadata: {
      activityType: offer.activityType,
      destination: offer.destination,
    },
    retrievedAt,
  }
}

function collectValidResults(
  raw: ProviderSearchResult[],
  errors: ProviderError[],
  providerId: string,
  providerName: string,
): ProviderSearchResult[] {
  const valid: ProviderSearchResult[] = []
  for (const item of raw) {
    const validationErrors = validateProviderResult(item)
    if (validationErrors.length > 0) {
      errors.push({
        providerId,
        providerName,
        error: `Validation failed for ${item.externalId}: ${validationErrors.join(', ')}`,
      })
      continue
    }
    valid.push(item)
  }
  return valid
}

async function resolveActivitySearch(
  deps: LiveSearchDeps,
): Promise<(req: ProviderRequest) => Promise<ProviderResult<ActivityOffer[]>>> {
  if (deps.searchActivities) return deps.searchActivities

  const registry = getProviderRegistry()
  const provider = registry.getActivity()
  if (provider) {
    return (req) => provider.searchActivities(req)
  }

  const mock = new MockActivityAdapter()
  return (req) => mock.searchActivities(req)
}

/**
 * Orchestrate a live multi-provider search.
 * Uses integration services (real adapters when configured, mock otherwise).
 * On provider failure, services return mock data and this records a ProviderError.
 */
export async function orchestrateLiveSearch(
  req: TravelSearchRequest,
  deps: LiveSearchDeps = {},
): Promise<LiveSearchOrchestrationResult> {
  const startedAt = new Date().toISOString()
  const requestId = `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const retrievedAt = startedAt
  const providerReq = toProviderRequest(req)
  const plan = createSearchPlan(req)
  const needed = new Set<SearchProviderType>(plan.providerTypesNeeded)

  const flightService = deps.flightService ?? getFlightService()
  const hotelService = deps.hotelService ?? getHotelService()
  const rentalCarService = deps.rentalCarService ?? getRentalCarService()
  const weatherService = deps.weatherService ?? getWeatherService()
  const searchActivities = await resolveActivitySearch(deps)

  const errors: ProviderError[] = []
  const allRaw: ProviderSearchResult[] = []
  let providersQueried = 0
  let providersSucceeded = 0
  let providersFailed = 0

  const sources: LiveSearchSources = {
    flight: 'skipped',
    hotel: 'skipped',
    rentalCar: 'skipped',
    weather: 'skipped',
    activity: 'skipped',
  }

  // ── Flights ──────────────────────────────────────────────────────────────
  if (needed.has('flight')) {
    providersQueried++
    try {
      const model = await flightService.searchFlights(providerReq)
      sources.flight = model.source
      const name = model.source === 'real' ? 'Amadeus Flights' : 'Flight Provider'
      if (model.error) {
        errors.push({
          providerId: 'flight',
          providerName: name,
          error: model.error,
        })
      }
      const mapped = model.offers.map((o) => mapFlightOffer(o, name, retrievedAt))
      const valid = collectValidResults(mapped, errors, 'flight', name)
      if (valid.length > 0) {
        allRaw.push(...valid)
        providersSucceeded++
      } else {
        providersFailed++
        if (!model.error) {
          errors.push({
            providerId: 'flight',
            providerName: name,
            error: 'No flight offers returned',
          })
        }
      }
    } catch (err) {
      providersFailed++
      sources.flight = 'fallback'
      errors.push({
        providerId: 'flight',
        providerName: 'Flight Provider',
        error: err instanceof Error ? err.message : 'Flight search failed',
      })
    }
  }

  // ── Hotels ───────────────────────────────────────────────────────────────
  if (needed.has('hotel')) {
    providersQueried++
    try {
      const model = await hotelService.searchHotels(providerReq)
      sources.hotel = model.source
      const name = model.source === 'real' ? 'Booking.com Hotels' : 'Hotel Provider'
      if (model.error) {
        errors.push({
          providerId: 'hotel',
          providerName: name,
          error: model.error,
        })
      }
      const mapped = model.offers.map((o) => mapHotelOffer(o, name, retrievedAt))
      const valid = collectValidResults(mapped, errors, 'hotel', name)
      if (valid.length > 0) {
        allRaw.push(...valid)
        providersSucceeded++
      } else {
        providersFailed++
        if (!model.error) {
          errors.push({
            providerId: 'hotel',
            providerName: name,
            error: 'No hotel offers returned',
          })
        }
      }
    } catch (err) {
      providersFailed++
      sources.hotel = 'fallback'
      errors.push({
        providerId: 'hotel',
        providerName: 'Hotel Provider',
        error: err instanceof Error ? err.message : 'Hotel search failed',
      })
    }
  }

  // ── Rental cars (search plan type: transportation) ───────────────────────
  if (needed.has('transportation')) {
    providersQueried++
    try {
      const model = await rentalCarService.searchRentalCars(providerReq)
      sources.rentalCar = model.source
      const name = model.source === 'real' ? 'RentalCars.com' : 'Rental Car Provider'
      if (model.error) {
        errors.push({
          providerId: 'rental-car',
          providerName: name,
          error: model.error,
        })
      }
      const mapped = model.vehicles.map((v) => mapVehicle(v, name, retrievedAt))
      const valid = collectValidResults(mapped, errors, 'rental-car', name)
      if (valid.length > 0) {
        allRaw.push(...valid)
        providersSucceeded++
      } else {
        providersFailed++
        if (!model.error) {
          errors.push({
            providerId: 'rental-car',
            providerName: name,
            error: 'No rental car offers returned',
          })
        }
      }
    } catch (err) {
      providersFailed++
      sources.rentalCar = 'fallback'
      errors.push({
        providerId: 'rental-car',
        providerName: 'Rental Car Provider',
        error: err instanceof Error ? err.message : 'Rental car search failed',
      })
    }
  }

  // ── Activities (mock adapter only today) ─────────────────────────────────
  if (needed.has('activity')) {
    providersQueried++
    try {
      const result = await searchActivities(providerReq)
      const name = 'Activity Provider'
      if (result.success && result.data && result.data.length > 0) {
        sources.activity = 'mock'
        const mapped = result.data.map((o) => mapActivityOffer(o, name, retrievedAt))
        const valid = collectValidResults(mapped, errors, 'activity', name)
        if (valid.length > 0) {
          allRaw.push(...valid)
          providersSucceeded++
        } else {
          providersFailed++
        }
      } else {
        providersFailed++
        sources.activity = 'mock'
        errors.push({
          providerId: 'activity',
          providerName: name,
          error: result.errors[0]?.message ?? 'No activity offers returned',
        })
      }
    } catch (err) {
      providersFailed++
      sources.activity = 'mock'
      errors.push({
        providerId: 'activity',
        providerName: 'Activity Provider',
        error: err instanceof Error ? err.message : 'Activity search failed',
      })
    }
  }

  // ── Weather (OpenWeather when configured; does not produce ranked options) ─
  let weather: WeatherModel | null = null
  if (req.destination) {
    providersQueried++
    try {
      weather = await weatherService.getWeatherForRequest(providerReq)
      sources.weather = weather.source
      if (weather.error) {
        errors.push({
          providerId: 'weather',
          providerName: weather.source === 'real' ? 'OpenWeather' : 'Weather Provider',
          error: weather.error,
        })
      }
      if (weather.info) {
        providersSucceeded++
      } else {
        providersFailed++
      }
    } catch (err) {
      providersFailed++
      sources.weather = 'fallback'
      errors.push({
        providerId: 'weather',
        providerName: 'Weather Provider',
        error: err instanceof Error ? err.message : 'Weather fetch failed',
      })
    }
  }

  // ── Normalize → dedupe → score → rank ────────────────────────────────────
  const normalized = allRaw.map(normalizeProviderResult)
  const { unique, removedCount } = deduplicateResults(normalized)
  const scored = unique.map((opt) => scoreNormalizedOption(req, opt))
  const rankedOptions = rankTravelOptions(scored)

  return {
    requestId,
    startedAt,
    completedAt: new Date().toISOString(),
    providersQueried,
    providersSucceeded,
    providersFailed,
    rawResultsCount: allRaw.length,
    normalizedResultsCount: unique.length,
    duplicateResultsRemoved: removedCount,
    rankedOptions,
    errors,
    weather,
    sources,
  }
}
