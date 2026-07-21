/**
 * Sprint 73 — Normalize provider hotel offers → UnifiedHotel.
 */

import type { HotelProviderId, UnifiedHotel } from './types'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return fallback
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value)
  }
  return fallback
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  return fallback
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => asString(v)).filter(Boolean)
  }
  return []
}

function normalizeProvider(raw: unknown): HotelProviderId {
  const v = asString(raw, 'mock').toLowerCase()
  if (v === 'amadeus' || v === 'duffel' || v === 'booking' || v === 'mock' || v === 'hotelbeds') {
    return v
  }
  if (v === 'simulated' || v === 'booking.com') return v === 'booking.com' ? 'booking' : 'mock'
  return 'mock'
}

export function normalizeHotelOffer(
  raw: unknown,
  fallbackProvider: HotelProviderId = 'mock',
): UnifiedHotel | null {
  const o = asRecord(raw)
  const nightly = asRecord(o.nightly)
  const total = asRecord(o.total)
  const taxesObj = asRecord(o.taxes)
  const provider = normalizeProvider(o.providerId ?? o.provider ?? fallbackProvider)
  const hotelName = asString(o.name ?? o.hotelName, provider === 'mock' ? 'Mock Hotel' : '')
  if (!hotelName && !asString(o.id)) return null

  const hotelId = asString(o.id ?? o.hotelId, `${provider}_${hotelName.replace(/\s+/g, '_').toLowerCase()}`)
  const city = asString(o.city ?? o.area ?? o.destination, 'Unknown')
  const pricePerNight = asNumber(
    nightly.amount ?? o.pricePerNight ?? o.price,
    provider === 'mock' ? 350 : 0,
  )
  const currency = asString(
    nightly.currency ?? total.currency ?? o.currency,
    'SAR',
  )
  const totalPrice = asNumber(total.amount ?? o.totalPrice, pricePerNight)
  const taxes = asNumber(taxesObj.amount ?? o.taxes, Math.round(totalPrice * 0.15))
  const lat = o.latitude ?? asRecord(o.coordinates).latitude
  const lon = o.longitude ?? asRecord(o.coordinates).longitude
  const coordinates =
    typeof lat === 'number' && typeof lon === 'number'
      ? { latitude: lat, longitude: lon }
      : null

  const amenities = asStringArray(o.amenities)
  const breakfastIncluded =
    asBool(o.breakfastIncluded)
    || amenities.some((a) => a.toLowerCase().includes('breakfast'))
  const freeCancellation =
    asBool(o.freeCancellation)
    || asString(o.cancellationPolicy).toLowerCase().includes('free')
  const refundable = asBool(o.refundable, freeCancellation || provider === 'mock')

  return {
    hotelId,
    provider,
    hotelName,
    city,
    country: asString(o.country, 'SA'),
    coordinates,
    stars: asNumber(o.stars, provider === 'mock' ? 4 : 0),
    rating: asNumber(o.rating, provider === 'mock' ? 8.2 : 0),
    reviewCount: asNumber(o.reviewCount ?? o.reviews, provider === 'mock' ? 120 : 0),
    images: asStringArray(o.photos ?? o.images),
    amenities,
    roomTypes: asStringArray(o.roomTypes).length
      ? asStringArray(o.roomTypes)
      : [asString(o.roomType, 'standard')],
    boardType: asString(o.boardType, breakfastIncluded ? 'breakfast' : 'room_only'),
    pricePerNight,
    currency,
    totalPrice,
    taxes,
    refundable,
    freeCancellation,
    breakfastIncluded,
    bookingToken: asString(o.bookingToken ?? o.booking_token, `hbt_${hotelId}`),
    providerMetadata: {
      rawId: hotelId,
      mode: o.mode ?? null,
      source: provider,
      address: o.address ?? null,
    },
    distanceKm:
      typeof o.distanceFromCenterKm === 'number'
        ? o.distanceFromCenterKm
        : typeof o.distanceKm === 'number'
          ? o.distanceKm
          : null,
  }
}

export function normalizeHotelOffers(
  offers: unknown[],
  fallbackProvider: HotelProviderId,
): UnifiedHotel[] {
  const out: UnifiedHotel[] = []
  for (const offer of offers) {
    const normalized = normalizeHotelOffer(offer, fallbackProvider)
    if (normalized) out.push(normalized)
  }
  return out
}

export function enrichMockHotel(
  partial: Partial<UnifiedHotel> & Pick<UnifiedHotel, 'city'>,
  index = 0,
): UnifiedHotel {
  const hotelId = partial.hotelId ?? `mock_hotel_${partial.city}_${index}`
  const pricePerNight = partial.pricePerNight ?? 300 + index * 50
  return {
    hotelId,
    provider: 'mock',
    hotelName: partial.hotelName ?? `Mock Hotel ${index + 1}`,
    city: partial.city,
    country: partial.country ?? 'AE',
    coordinates: partial.coordinates ?? {
      latitude: 25.2 + index * 0.01,
      longitude: 55.27 + index * 0.01,
    },
    stars: partial.stars ?? (3 + (index % 3)),
    rating: partial.rating ?? 7.5 + (index % 3) * 0.5,
    reviewCount: partial.reviewCount ?? 80 + index * 20,
    images: partial.images ?? [`https://cdn.example/hotel_${index}.jpg`],
    amenities: partial.amenities ?? ['wifi', 'pool', ...(index % 2 === 0 ? ['breakfast'] : [])],
    roomTypes: partial.roomTypes ?? ['standard', 'deluxe'],
    boardType: partial.boardType ?? (index % 2 === 0 ? 'breakfast' : 'room_only'),
    pricePerNight,
    currency: partial.currency ?? 'SAR',
    totalPrice: partial.totalPrice ?? pricePerNight * 3,
    taxes: partial.taxes ?? Math.round(pricePerNight * 0.15),
    refundable: partial.refundable ?? index % 2 === 0,
    freeCancellation: partial.freeCancellation ?? index % 2 === 0,
    breakfastIncluded: partial.breakfastIncluded ?? index % 2 === 0,
    bookingToken: partial.bookingToken ?? `hbt_${hotelId}`,
    providerMetadata: partial.providerMetadata ?? { source: 'mock' },
    distanceKm: partial.distanceKm ?? index * 1.5,
  }
}
