/**
 * Sprint 109 — map GatewayResponse → HotelOffer[] + ranking groups.
 * Never expose Amadeus SDK objects.
 */

import type { GatewayOffer, GatewayResponse } from '../../../core/providerGateway'
import type {
  HotelOffer,
  LiveHotelRankKind,
  LiveHotelRankedGroup,
  LiveHotelSearchError,
  LiveHotelSearchResult,
} from './types'
import { SPRINT109_LIVE_HOTEL_SEARCH_VERSION } from './types'

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function bool(value: unknown): boolean {
  return value === true
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => str(v)).filter((v): v is string => Boolean(v))
}

export function mapGatewayOfferToHotelOffer(offer: GatewayOffer): HotelOffer {
  const raw = offer.raw ?? {}
  const hotelId = str(raw.hotelId) ?? offer.id
  const hotelName = str(raw.hotelName) ?? str(raw.name) ?? offer.title ?? hotelId
  return {
    id: offer.id,
    hotelId,
    hotelName,
    city: str(raw.city),
    country: str(raw.country),
    latitude: num(raw.latitude),
    longitude: num(raw.longitude),
    roomType: str(raw.roomType),
    boardType: str(raw.boardType),
    rating: num(raw.rating),
    stars: num(raw.stars) ?? num(raw.rating),
    price: offer.price ?? num(raw.price),
    currency: (offer.currency || str(raw.currency) || 'SAR').toUpperCase(),
    taxes: num(raw.taxes),
    freeCancellation: bool(raw.freeCancellation) || bool(raw.refundable),
    amenities: strList(raw.amenities),
    images: strList(raw.images),
    provider: str(raw.provider) ?? offer.providerId,
  }
}

/** Decision-engine-ready plain hotel record. */
export function toDecisionEngineHotelRecord(hotel: HotelOffer): Record<string, unknown> {
  return {
    id: hotel.id,
    providerId: hotel.provider,
    name: hotel.hotelName,
    title: hotel.hotelName,
    price: hotel.price,
    currency: hotel.currency,
    stars: hotel.stars,
    rating: hotel.rating,
    refundable: hotel.freeCancellation,
    familyFriendly: hotel.amenities.some((a) => /family|kid|child/i.test(a)),
    hotelId: hotel.hotelId,
    city: hotel.city,
    country: hotel.country,
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    roomType: hotel.roomType,
    boardType: hotel.boardType,
    taxes: hotel.taxes,
    freeCancellation: hotel.freeCancellation,
    amenities: hotel.amenities,
    images: hotel.images,
    provider: hotel.provider,
    providerConfidence: 0.8,
  }
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const r = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(a))
}

export function rankHotelOffers(
  hotels: HotelOffer[],
  ref?: { latitude?: number | null; longitude?: number | null },
): LiveHotelRankedGroup[] {
  const defs: Array<{ kind: LiveHotelRankKind; label: string }> = [
    { kind: 'best_overall', label: 'Best Overall' },
    { kind: 'budget', label: 'Budget' },
    { kind: 'luxury', label: 'Luxury' },
    { kind: 'business', label: 'Business' },
    { kind: 'family', label: 'Family' },
    { kind: 'closest_location', label: 'Closest Location' },
  ]

  const pickBudget = (): HotelOffer | null => {
    const priced = hotels.filter((h) => h.price != null)
    if (priced.length === 0) return null
    return [...priced].sort((a, b) => a.price! - b.price! || a.id.localeCompare(b.id))[0] ?? null
  }

  const pickLuxury = (): HotelOffer | null => {
    return [...hotels].sort((a, b) => {
      const stars = (b.stars ?? 0) - (a.stars ?? 0)
      if (stars !== 0) return stars
      return (b.price ?? 0) - (a.price ?? 0) || a.id.localeCompare(b.id)
    })[0] ?? null
  }

  const pickBusiness = (): HotelOffer | null => {
    const scored = hotels.map((h) => {
      let score = 0
      if ((h.stars ?? 0) >= 4) score += 2
      if (h.amenities.some((a) => /WIFI|BUSINESS|MEETING|WORK/i.test(a))) score += 2
      if (h.boardType && /BREAKFAST|BB/i.test(h.boardType)) score += 1
      if (h.freeCancellation) score += 1
      return { h, score }
    })
    scored.sort((a, b) => b.score - a.score || a.h.id.localeCompare(b.h.id))
    return scored[0]?.h ?? null
  }

  const pickFamily = (): HotelOffer | null => {
    const family = hotels.filter((h) =>
      h.amenities.some((a) => /FAMILY|KID|CHILD|POOL/i.test(a)),
    )
    const pool = family.length > 0 ? family : hotels
    return pickBudget() && pool.length
      ? [...pool].sort((a, b) => (a.price ?? 9_999) - (b.price ?? 9_999))[0] ?? null
      : null
  }

  const pickClosest = (): HotelOffer | null => {
    const lat = ref?.latitude
    const lon = ref?.longitude
    if (lat == null || lon == null) return null
    const withCoords = hotels.filter((h) => h.latitude != null && h.longitude != null)
    if (withCoords.length === 0) return null
    return [...withCoords].sort((a, b) => {
      const da = haversineKm(lat, lon, a.latitude!, a.longitude!)
      const db = haversineKm(lat, lon, b.latitude!, b.longitude!)
      return da - db || a.id.localeCompare(b.id)
    })[0] ?? null
  }

  const pickBestOverall = (): HotelOffer | null => {
    if (hotels.length === 0) return null
    return [...hotels].sort((a, b) => {
      const score = (h: HotelOffer) => {
        let s = 0
        if (h.stars != null) s += h.stars * 10
        if (h.freeCancellation) s += 5
        if (h.price != null) s += Math.max(0, 40 - h.price / 100)
        if (h.amenities.length > 0) s += Math.min(10, h.amenities.length)
        return s
      }
      return score(b) - score(a) || a.id.localeCompare(b.id)
    })[0] ?? null
  }

  const picks: Record<LiveHotelRankKind, HotelOffer | null> = {
    best_overall: pickBestOverall(),
    budget: pickBudget(),
    luxury: pickLuxury(),
    business: pickBusiness(),
    family: pickFamily(),
    closest_location: pickClosest(),
  }

  return defs.map((d) => ({
    kind: d.kind,
    label: d.label,
    offer: picks[d.kind],
  }))
}

export function mapGatewayError(
  response: GatewayResponse,
): LiveHotelSearchError | null {
  if (response.error) {
    const code = response.error.code.toUpperCase()
    let httpStatus: number | null = null
    if (code === 'UNAUTHORIZED' || code === 'SECRETS_MISSING') httpStatus = 401
    else if (code === 'FORBIDDEN') httpStatus = 403
    else if (code === 'NOT_FOUND') httpStatus = 404
    else if (code === 'RATE_LIMITED') httpStatus = 429
    else if (code === 'SERVER_ERROR') httpStatus = 500

    return {
      code,
      message:
        code === 'SECRETS_MISSING' || code === 'UNAUTHORIZED'
          ? 'Amadeus authentication failed — check credentials or refresh the OAuth token.'
          : response.error.message,
      retryable: response.error.retryable,
      rateLimited: response.error.rateLimited,
      timedOut: response.error.timedOut,
      httpStatus,
    }
  }

  if (response.ok && response.offers.length === 0) {
    return {
      code: 'EMPTY_RESULTS',
      message: 'No hotels found for the search criteria.',
      retryable: false,
      rateLimited: false,
      timedOut: false,
      httpStatus: null,
    }
  }

  return null
}

export function mapGatewayResponseToLiveHotelSearch(
  response: GatewayResponse,
  partial: {
    enabled: boolean
    validationErrors?: string[]
    meta?: LiveHotelSearchResult['meta']
    latitude?: number | null
    longitude?: number | null
  },
): LiveHotelSearchResult {
  const hotels = response.offers
    .filter((o) => o.kind === 'hotel')
    .map(mapGatewayOfferToHotelOffer)

  const hasHotels = hotels.length > 0
  const error = mapGatewayError({
    ...response,
    empty: !hasHotels,
  })

  return {
    version: SPRINT109_LIVE_HOTEL_SEARCH_VERSION,
    enabled: partial.enabled,
    ok: response.ok && hasHotels,
    empty: !hasHotels,
    hotels,
    hotelOffers: hotels.map(toDecisionEngineHotelRecord),
    rankings: rankHotelOffers(hotels, {
      latitude: partial.latitude,
      longitude: partial.longitude,
    }),
    latencyMs: response.latencyMs,
    attempts: response.attempts,
    error: response.ok && hasHotels ? null : error,
    validationErrors: partial.validationErrors ?? [],
    logs: response.logs.slice(),
    meta: partial.meta ?? {
      destination: null,
      checkInDate: null,
      checkOutDate: null,
      adults: null,
      children: null,
      rooms: null,
      currency: null,
      providerId: response.providerId,
      maxResults: null,
    },
  }
}

export class LiveHotelSearchMapper {
  mapOffer(offer: GatewayOffer): HotelOffer {
    return mapGatewayOfferToHotelOffer(offer)
  }

  mapResponse(
    response: GatewayResponse,
    partial: {
      enabled: boolean
      validationErrors?: string[]
      meta?: LiveHotelSearchResult['meta']
      latitude?: number | null
      longitude?: number | null
    },
  ): LiveHotelSearchResult {
    return mapGatewayResponseToLiveHotelSearch(response, partial)
  }
}

export function createLiveHotelSearchMapper(): LiveHotelSearchMapper {
  return new LiveHotelSearchMapper()
}
