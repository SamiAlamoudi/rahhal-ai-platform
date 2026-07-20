/**
 * Simulated booking providers — swappable for live adapters with zero orchestration changes.
 */

import type {
  BookingOffer,
  BookingProvider,
  BookingProviderDomain,
  BookingSearchQuery,
  MoneyAmount,
} from './types'

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function money(amount: number, currency: string): MoneyAmount {
  return { amount: Math.round(amount), currency: currency.toUpperCase() }
}

function baseOffer(
  domain: BookingProviderDomain,
  providerId: string,
  index: number,
  query: BookingSearchQuery,
  patch: Partial<BookingOffer>,
): BookingOffer {
  const dest = query.destination || 'Trip'
  const currency = query.budgetCurrency || 'SAR'
  return {
    id: `${providerId}:${domain}:${index}`,
    domain,
    providerId,
    title: patch.title || `${dest} option ${index + 1}`,
    subtitle: patch.subtitle,
    price: patch.price || money(1000 + index * 250, currency),
    rating: patch.rating ?? 4.2,
    qualityScore: patch.qualityScore ?? 0.7,
    locationScore: patch.locationScore ?? 0.7,
    durationMinutes: patch.durationMinutes ?? null,
    layoverCount: patch.layoverCount ?? null,
    layoverQuality: patch.layoverQuality ?? null,
    refundable: patch.refundable ?? true,
    refundPolicy: patch.refundPolicy ?? 'moderate',
    walkingDistanceMeters: patch.walkingDistanceMeters ?? null,
    stars: patch.stars ?? null,
    airline: patch.airline ?? null,
    hotelChain: patch.hotelChain ?? null,
    seatType: patch.seatType ?? null,
    mealIncluded: patch.mealIncluded ?? null,
    raw: { simulated: true, domain, index },
  }
}

function createSimulatedProvider(input: {
  providerId: string
  domain: BookingProviderDomain
  displayName: string
  buildOffers: (query: BookingSearchQuery) => BookingOffer[]
}): BookingProvider {
  const catalog = new Map<string, BookingOffer>()

  return {
    providerId: input.providerId,
    domain: input.domain,
    displayName: input.displayName,
    isAvailable: () => true,
    async search(query) {
      const offers = input.buildOffers(query)
      for (const offer of offers) catalog.set(offer.id, offer)
      return offers
    },
    async details(offerId) {
      return catalog.get(offerId) ?? null
    },
    async availability(offerId) {
      const offer = catalog.get(offerId)
      if (!offer) return { available: false, seatsOrRooms: 0 }
      return { available: true, seatsOrRooms: 4 }
    },
    async price(offerId) {
      return catalog.get(offerId)?.price ?? null
    },
    async book(offerId) {
      if (!catalog.has(offerId)) return { ok: false, error: 'offer_not_found' }
      return { ok: true, confirmationId: `sim-book-${offerId}` }
    },
    async cancel(confirmationId) {
      if (!confirmationId.startsWith('sim-book-')) return { ok: false, error: 'unknown_confirmation' }
      return { ok: true }
    },
  }
}

export function createSimulatedFlightProviders(): BookingProvider[] {
  return [
    createSimulatedProvider({
      providerId: 'sim-flights-atlas',
      domain: 'flights',
      displayName: 'Atlas Air Sim',
      buildOffers(query) {
        const seed = hashSeed(`${query.destination}:${query.startDate}:atlas`)
        const currency = query.budgetCurrency || 'SAR'
        return [
          baseOffer('flights', 'sim-flights-atlas', 0, query, {
            title: `${query.origin || 'RUH'} → ${query.destination || 'HND'} · Atlas Direct`,
            price: money(2200 + (seed % 400), currency),
            durationMinutes: 540,
            layoverCount: 0,
            layoverQuality: 1,
            airline: 'Saudia',
            seatType: 'window',
            refundPolicy: 'flexible',
            refundable: true,
            rating: 4.6,
            qualityScore: 0.88,
          }),
          baseOffer('flights', 'sim-flights-atlas', 1, query, {
            title: `${query.origin || 'RUH'} → ${query.destination || 'HND'} · Atlas 1-stop`,
            price: money(1650 + (seed % 300), currency),
            durationMinutes: 780,
            layoverCount: 1,
            layoverQuality: 0.55,
            airline: 'Emirates',
            seatType: 'aisle',
            refundPolicy: 'moderate',
            refundable: true,
            rating: 4.3,
            qualityScore: 0.72,
          }),
        ]
      },
    }),
    createSimulatedProvider({
      providerId: 'sim-flights-orbit',
      domain: 'flights',
      displayName: 'Orbit Air Sim',
      buildOffers(query) {
        const currency = query.budgetCurrency || 'SAR'
        return [
          baseOffer('flights', 'sim-flights-orbit', 0, query, {
            title: `${query.origin || 'RUH'} → ${query.destination || 'HND'} · Orbit Value`,
            // Near-duplicate of Atlas 1-stop for fusion/dedupe testing.
            price: money(1700, currency),
            durationMinutes: 780,
            layoverCount: 1,
            layoverQuality: 0.5,
            airline: 'Emirates',
            refundPolicy: 'strict',
            refundable: false,
            rating: 4.0,
            qualityScore: 0.65,
          }),
          baseOffer('flights', 'sim-flights-orbit', 1, query, {
            title: `${query.origin || 'RUH'} → ${query.destination || 'HND'} · Orbit Comfort`,
            price: money(2450, currency),
            durationMinutes: 560,
            layoverCount: 0,
            layoverQuality: 1,
            airline: 'Qatar Airways',
            seatType: 'window',
            refundPolicy: 'flexible',
            refundable: true,
            rating: 4.8,
            qualityScore: 0.92,
          }),
        ]
      },
    }),
  ]
}

export function createSimulatedHotelProviders(): BookingProvider[] {
  return [
    createSimulatedProvider({
      providerId: 'sim-hotels-nest',
      domain: 'hotels',
      displayName: 'Nest Hotels Sim',
      buildOffers(query) {
        const currency = query.budgetCurrency || 'SAR'
        const dest = query.destination || 'City'
        return [
          baseOffer('hotels', 'sim-hotels-nest', 0, query, {
            title: `${dest} Central Nest`,
            price: money(780, currency),
            stars: 4,
            hotelChain: 'Nest',
            walkingDistanceMeters: 350,
            locationScore: 0.95,
            rating: 4.5,
            qualityScore: 0.84,
            mealIncluded: true,
            refundPolicy: 'flexible',
          }),
          baseOffer('hotels', 'sim-hotels-nest', 1, query, {
            title: `${dest} Nest Value`,
            price: money(520, currency),
            stars: 3,
            hotelChain: 'Nest',
            walkingDistanceMeters: 1800,
            locationScore: 0.55,
            rating: 4.0,
            qualityScore: 0.66,
            mealIncluded: false,
            refundPolicy: 'moderate',
          }),
        ]
      },
    }),
    createSimulatedProvider({
      providerId: 'sim-hotels-harbor',
      domain: 'hotels',
      displayName: 'Harbor Stay Sim',
      buildOffers(query) {
        const currency = query.budgetCurrency || 'SAR'
        const dest = query.destination || 'City'
        return [
          baseOffer('hotels', 'sim-hotels-harbor', 0, query, {
            title: `${dest} Harbor Boutique`,
            // Overlaps Nest Central for dedupe (similar stars/walk/price band).
            price: money(780, currency),
            stars: 4,
            hotelChain: 'Harbor',
            walkingDistanceMeters: 350,
            locationScore: 0.9,
            rating: 4.6,
            qualityScore: 0.86,
            mealIncluded: true,
            refundPolicy: 'flexible',
          }),
          baseOffer('hotels', 'sim-hotels-harbor', 1, query, {
            title: `${dest} Harbor Luxury`,
            price: money(1400, currency),
            stars: 5,
            hotelChain: 'Harbor',
            walkingDistanceMeters: 200,
            locationScore: 0.98,
            rating: 4.9,
            qualityScore: 0.95,
            mealIncluded: true,
            refundPolicy: 'flexible',
          }),
        ]
      },
    }),
  ]
}

export function createSimulatedActivityProviders(): BookingProvider[] {
  return [
    createSimulatedProvider({
      providerId: 'sim-activities-local',
      domain: 'activities',
      displayName: 'Local Experiences Sim',
      buildOffers(query) {
        const currency = query.budgetCurrency || 'SAR'
        const dest = query.destination || 'City'
        return [
          baseOffer('activities', 'sim-activities-local', 0, query, {
            title: `${dest} Food Walk`,
            price: money(180, currency),
            rating: 4.7,
            qualityScore: 0.8,
            walkingDistanceMeters: 600,
            locationScore: 0.85,
          }),
          baseOffer('activities', 'sim-activities-local', 1, query, {
            title: `${dest} Museum Pass`,
            price: money(240, currency),
            rating: 4.4,
            qualityScore: 0.78,
            walkingDistanceMeters: 900,
            locationScore: 0.75,
          }),
        ]
      },
    }),
  ]
}

export function createSimulatedCarRentalProviders(): BookingProvider[] {
  return [
    createSimulatedProvider({
      providerId: 'sim-cars-drive',
      domain: 'car_rental',
      displayName: 'Drive Sim',
      buildOffers(query) {
        const currency = query.budgetCurrency || 'SAR'
        return [
          baseOffer('car_rental', 'sim-cars-drive', 0, query, {
            title: 'Compact automatic',
            price: money(160, currency),
            qualityScore: 0.7,
            rating: 4.1,
            refundPolicy: 'moderate',
          }),
          baseOffer('car_rental', 'sim-cars-drive', 1, query, {
            title: 'SUV family',
            price: money(280, currency),
            qualityScore: 0.82,
            rating: 4.5,
            refundPolicy: 'flexible',
          }),
        ]
      },
    }),
  ]
}

export function createSimulatedTransferProviders(): BookingProvider[] {
  return [
    createSimulatedProvider({
      providerId: 'sim-transfer-gate',
      domain: 'airport_transfer',
      displayName: 'Gate Transfer Sim',
      buildOffers(query) {
        const currency = query.budgetCurrency || 'SAR'
        return [
          baseOffer('airport_transfer', 'sim-transfer-gate', 0, query, {
            title: 'Private airport transfer',
            price: money(220, currency),
            qualityScore: 0.85,
            rating: 4.6,
            durationMinutes: 45,
          }),
          baseOffer('airport_transfer', 'sim-transfer-gate', 1, query, {
            title: 'Shared shuttle',
            price: money(90, currency),
            qualityScore: 0.6,
            rating: 3.9,
            durationMinutes: 75,
          }),
        ]
      },
    }),
  ]
}

export function createSimulatedInsuranceProviders(): BookingProvider[] {
  return [
    createSimulatedProvider({
      providerId: 'sim-insurance-shield',
      domain: 'insurance',
      displayName: 'Shield Travel Sim',
      buildOffers(query) {
        const currency = query.budgetCurrency || 'SAR'
        return [
          baseOffer('insurance', 'sim-insurance-shield', 0, query, {
            title: 'Standard trip cover',
            price: money(120, currency),
            qualityScore: 0.7,
            refundPolicy: 'moderate',
          }),
          baseOffer('insurance', 'sim-insurance-shield', 1, query, {
            title: 'Premium medical + cancel',
            price: money(260, currency),
            qualityScore: 0.9,
            refundPolicy: 'flexible',
          }),
        ]
      },
    }),
  ]
}

export function createSimulatedVisaProviders(): BookingProvider[] {
  return [
    createSimulatedProvider({
      providerId: 'sim-visa-clear',
      domain: 'visa',
      displayName: 'Clear Visa Sim',
      buildOffers(query) {
        const currency = query.budgetCurrency || 'SAR'
        const dest = query.destination || 'destination'
        return [
          baseOffer('visa', 'sim-visa-clear', 0, query, {
            title: `${dest} eVisa assist`,
            price: money(350, currency),
            qualityScore: 0.8,
            rating: 4.2,
          }),
        ]
      },
    }),
  ]
}

export function createDefaultSimulatedBookingProviders(): BookingProvider[] {
  return [
    ...createSimulatedFlightProviders(),
    ...createSimulatedHotelProviders(),
    ...createSimulatedActivityProviders(),
    ...createSimulatedCarRentalProviders(),
    ...createSimulatedTransferProviders(),
    ...createSimulatedInsuranceProviders(),
    ...createSimulatedVisaProviders(),
  ]
}
