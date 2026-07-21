/**
 * Bridge LiveProviderSdk → BookingProvider (Sprint 55 contracts).
 * Ranking / fusion stay in Booking Intelligence; providers return structured data only.
 */

import type {
  BookingOffer,
  BookingProvider,
  BookingProviderDomain,
  BookingSearchQuery,
  MoneyAmount,
} from '../bookingIntelligence/types'
import type {
  LiveFlightOffer,
  LiveHotelOffer,
  LiveProviderSdk,
} from './types'

function money(amount: number, currency: string): MoneyAmount {
  return { amount: Math.round(amount * 100) / 100, currency: currency.toUpperCase() }
}

function flightToBooking(offer: LiveFlightOffer): BookingOffer {
  return {
    id: offer.id,
    domain: 'flights',
    providerId: offer.providerId,
    title: `${offer.from} → ${offer.to}`,
    subtitle: offer.airline ?? undefined,
    price: money(offer.price.amount, offer.price.currency),
    rating: null,
    qualityScore: 0.75,
    locationScore: 0.7,
    durationMinutes: offer.durationMinutes,
    layoverCount: offer.stops,
    layoverQuality: offer.stops === 0 ? 1 : Math.max(0.2, 1 - offer.stops * 0.25),
    refundable: offer.refundable,
    refundPolicy: offer.refundable === true ? 'flexible' : offer.refundable === false ? 'strict' : 'unknown',
    airline: offer.airline,
    seatType: offer.cabin,
    raw: offer.raw ?? offer,
  }
}

function hotelGuestRatingToFive(rating: number | null | undefined): number | null {
  if (rating == null || !Number.isFinite(rating)) return null
  // Booking.com guest scores are typically 0–10; BookingOffer ranking expects ~0–5.
  return rating > 5 ? Math.round((rating / 2) * 10) / 10 : rating
}

function hotelLocationScore(offer: LiveHotelOffer): number {
  if (offer.distanceFromCenterKm != null && Number.isFinite(offer.distanceFromCenterKm)) {
    const km = offer.distanceFromCenterKm
    if (km <= 0.5) return 0.98
    if (km <= 1.5) return 0.9
    if (km <= 3) return 0.75
    if (km <= 6) return 0.55
    return 0.35
  }
  if (offer.latitude != null && offer.longitude != null) return 0.7
  return offer.area || offer.address ? 0.6 : 0.45
}

function hotelToBooking(offer: LiveHotelOffer): BookingOffer {
  const currency = offer.currency || offer.total.currency || offer.nightly.currency
  const totalPrice = offer.total.amount > 0 ? offer.total : offer.nightly
  const walkingDistanceMeters =
    offer.distanceFromCenterKm != null && Number.isFinite(offer.distanceFromCenterKm)
      ? Math.round(offer.distanceFromCenterKm * 1000)
      : null
  const guestRating = hotelGuestRatingToFive(offer.rating)
  return {
    id: offer.id,
    domain: 'hotels',
    providerId: offer.providerId,
    title: offer.name,
    subtitle: offer.address || offer.area || undefined,
    price: money(totalPrice.amount, currency),
    rating: guestRating,
    qualityScore: guestRating != null ? Math.min(1, guestRating / 5) : 0.7,
    locationScore: hotelLocationScore(offer),
    walkingDistanceMeters,
    stars: offer.stars,
    refundable: offer.refundable,
    refundPolicy: offer.refundable === true ? 'flexible' : offer.refundable === false ? 'strict' : 'unknown',
    hotelChain: null,
    mealIncluded: offer.amenities.some((a) => /breakfast|إفطار/i.test(a)) || null,
    raw: {
      ...(typeof offer.raw === 'object' && offer.raw ? offer.raw : {}),
      provider: offer.providerId,
      address: offer.address,
      roomType: offer.roomType,
      cancellationPolicy: offer.cancellationPolicy,
      nightly: offer.nightly,
      total: offer.total,
      taxes: offer.taxes,
      currency: offer.currency,
      photos: offer.photos,
      amenities: offer.amenities,
      latitude: offer.latitude,
      longitude: offer.longitude,
      distanceFromCenterKm: offer.distanceFromCenterKm,
    },
  }
}

function createCatalogBridge(input: {
  sdk: LiveProviderSdk
  domain: BookingProviderDomain
  search: (query: BookingSearchQuery) => Promise<BookingOffer[]>
}): BookingProvider {
  const catalog = new Map<string, BookingOffer>()
  return {
    providerId: `${input.sdk.providerId}:${input.domain}`,
    domain: input.domain,
    displayName: `${input.sdk.displayName} (${input.domain})`,
    isAvailable: () => input.sdk.isAvailable(),
    async search(query) {
      const offers = await input.search(query)
      for (const offer of offers) catalog.set(offer.id, offer)
      return offers
    },
    async details(offerId) {
      const cached = catalog.get(offerId)
      if (cached) return cached
      const details = await input.sdk.getOfferDetails?.(offerId)
      if (!details) return null
      if ('nightly' in details) {
        const mapped = hotelToBooking(details)
        catalog.set(mapped.id, mapped)
        return mapped
      }
      if ('from' in details) {
        const mapped = flightToBooking(details)
        catalog.set(mapped.id, mapped)
        return mapped
      }
      return null
    },
    async availability(offerId) {
      const offer = catalog.get(offerId)
      if (!offer) return { available: false, seatsOrRooms: 0 }
      return { available: true, seatsOrRooms: 3 }
    },
    async price(offerId) {
      const priced = await input.sdk.priceOffer?.(offerId)
      if (priced) return money(priced.amount, priced.currency)
      return catalog.get(offerId)?.price ?? null
    },
    async book(offerId, signal) {
      if (input.sdk.createOrder) {
        const result = await input.sdk.createOrder(offerId, signal)
        return {
          ok: result.ok,
          confirmationId: result.orderId,
          error: result.error,
        }
      }
      if (!catalog.has(offerId)) return { ok: false, error: 'offer_not_found' }
      return { ok: true, confirmationId: `live-book-${offerId}` }
    },
    async cancel(confirmationId, signal) {
      if (input.sdk.cancelOrder) {
        return input.sdk.cancelOrder(confirmationId, signal)
      }
      return { ok: true }
    },
  }
}

/** Map one LiveProviderSdk into BookingProvider entries for supported domains. */
export function bridgeLiveProviderToBooking(sdk: LiveProviderSdk): BookingProvider[] {
  const out: BookingProvider[] = []

  if (sdk.capabilities.flights && sdk.searchFlights) {
    out.push(
      createCatalogBridge({
        sdk,
        domain: 'flights',
        async search(query) {
          if (!query.origin || !query.destination || !query.startDate) return []
          const offers = await sdk.searchFlights!({
            origin: query.origin,
            destination: query.destination,
            departureDate: query.startDate,
            returnDate: query.endDate,
            adults: query.adults ?? query.travelers ?? 1,
            children: query.children ?? 0,
            cabin: query.cabin ?? null,
            currency: query.budgetCurrency ?? undefined,
            signal: query.signal,
          })
          return offers.map(flightToBooking)
        },
      }),
    )
  }

  if (sdk.capabilities.hotels && sdk.searchHotels) {
    out.push(
      createCatalogBridge({
        sdk,
        domain: 'hotels',
        async search(query) {
          if (!query.destination || !query.startDate) return []
          const offers = await sdk.searchHotels!({
            destination: query.destination,
            checkIn: query.startDate,
            checkOut: query.endDate,
            adults: query.adults ?? query.travelers ?? 2,
            children: query.children ?? 0,
            currency: query.budgetCurrency ?? undefined,
            signal: query.signal,
          })
          return offers.map(hotelToBooking)
        },
      }),
    )
  }

  // Optional domain stubs when SDK implements them later
  if (sdk.capabilities.activities && sdk.searchActivities) {
    const searchFn = sdk.searchActivities.bind(sdk)
    out.push(
      createCatalogBridge({
        sdk,
        domain: 'activities',
        async search(query) {
          const offers = await searchFn({
            destination: query.destination,
            origin: query.origin,
            startDate: query.startDate,
            endDate: query.endDate,
            travelers: query.travelers,
            currency: query.budgetCurrency ?? undefined,
            signal: query.signal,
          })
          return offers.map((offer) => ({
            id: offer.id,
            domain: 'activities' as const,
            providerId: offer.providerId,
            title: offer.title,
            price: money(offer.price.amount, offer.price.currency),
            rating: offer.rating,
            qualityScore: 0.7,
            raw: offer.raw ?? offer,
          }))
        },
      }),
    )
  }

  if (sdk.capabilities.cars && sdk.searchCars) {
    const searchFn = sdk.searchCars.bind(sdk)
    out.push(
      createCatalogBridge({
        sdk,
        domain: 'car_rental',
        async search(query) {
          const offers = await searchFn({
            destination: query.destination,
            origin: query.origin,
            startDate: query.startDate,
            endDate: query.endDate,
            travelers: query.travelers,
            currency: query.budgetCurrency ?? undefined,
            signal: query.signal,
          })
          return offers.map((offer) => ({
            id: offer.id,
            domain: 'car_rental' as const,
            providerId: offer.providerId,
            title: offer.title,
            price: money(offer.price.amount, offer.price.currency),
            qualityScore: 0.7,
            raw: offer.raw ?? offer,
          }))
        },
      }),
    )
  }

  if (sdk.capabilities.transfers && sdk.searchTransfers) {
    const searchFn = sdk.searchTransfers.bind(sdk)
    out.push(
      createCatalogBridge({
        sdk,
        domain: 'airport_transfer',
        async search(query) {
          const offers = await searchFn({
            destination: query.destination,
            origin: query.origin,
            startDate: query.startDate,
            endDate: query.endDate,
            travelers: query.travelers,
            currency: query.budgetCurrency ?? undefined,
            signal: query.signal,
          })
          return offers.map((offer) => ({
            id: offer.id,
            domain: 'airport_transfer' as const,
            providerId: offer.providerId,
            title: offer.title,
            price: money(offer.price.amount, offer.price.currency),
            durationMinutes: offer.durationMinutes,
            qualityScore: 0.7,
            raw: offer.raw ?? offer,
          }))
        },
      }),
    )
  }

  if (sdk.capabilities.insurance && sdk.searchInsurance) {
    const searchFn = sdk.searchInsurance.bind(sdk)
    out.push(
      createCatalogBridge({
        sdk,
        domain: 'insurance',
        async search(query) {
          const offers = await searchFn({
            destination: query.destination,
            origin: query.origin,
            startDate: query.startDate,
            endDate: query.endDate,
            travelers: query.travelers,
            currency: query.budgetCurrency ?? undefined,
            signal: query.signal,
          })
          return offers.map((offer) => ({
            id: offer.id,
            domain: 'insurance' as const,
            providerId: offer.providerId,
            title: offer.title,
            price: money(offer.price.amount, offer.price.currency),
            qualityScore: 0.7,
            raw: offer.raw ?? offer,
          }))
        },
      }),
    )
  }

  return out
}
