/**
 * Booking.com Live Provider SDK adapter — Sprint 56.
 *
 * Hotel search abstraction with normalized:
 * hotel, price, currency, rating, photos, location.
 */

import { readLiveProviderSecret } from '../feature'
import type {
  LiveFetch,
  LiveHotelOffer,
  LiveHotelSearchInput,
  LiveProviderCapabilities,
  LiveProviderSdk,
} from '../types'

export type BookingAdapterOptions = {
  apiKey?: string
  rapidApiHost?: string
  baseUrl?: string
  fetchImpl?: LiveFetch
  available?: boolean
}

type BookingHotelRaw = {
  hotel_id?: string | number
  hotel_name?: string
  name?: string
  address?: string
  city?: string
  latitude?: number
  longitude?: number
  review_score?: number
  class?: number
  stars?: number
  min_total_price?: number
  price_breakdown?: { gross_price?: number; currency?: string }
  currency?: string
  photoUrls?: string[]
  main_photo_url?: string
  photos?: Array<{ url_max750?: string; url_original?: string }>
  is_free_cancellable?: number | boolean
}

const CAPABILITIES: LiveProviderCapabilities = {
  flights: false,
  hotels: true,
  activities: false,
  cars: false,
  transfers: false,
  insurance: false,
  airports: false,
}

export function normalizeBookingHotel(
  raw: BookingHotelRaw,
  index: number,
  currencyFallback = 'USD',
): LiveHotelOffer {
  const name = raw.hotel_name || raw.name || `Hotel ${index + 1}`
  const currency = (
    raw.price_breakdown?.currency ||
    raw.currency ||
    currencyFallback
  ).toUpperCase()
  const amount = Number(
    raw.price_breakdown?.gross_price ?? raw.min_total_price ?? 0,
  )
  const photos: string[] = []
  if (raw.main_photo_url) photos.push(raw.main_photo_url)
  if (Array.isArray(raw.photoUrls)) photos.push(...raw.photoUrls.filter(Boolean))
  if (Array.isArray(raw.photos)) {
    for (const p of raw.photos) {
      const url = p.url_max750 || p.url_original
      if (url) photos.push(url)
    }
  }
  const area = raw.address || raw.city || null
  return {
    id: String(raw.hotel_id ?? `booking-hotel-${index}`),
    providerId: 'booking',
    name,
    area,
    stars: raw.class ?? raw.stars ?? null,
    rating: raw.review_score ?? null,
    nightly: { amount, currency },
    photos: [...new Set(photos)],
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    refundable: raw.is_free_cancellable == null ? null : Boolean(raw.is_free_cancellable),
    raw,
  }
}

export function createBookingLiveProvider(options: BookingAdapterOptions = {}): LiveProviderSdk {
  const apiKey =
    options.apiKey ??
    readLiveProviderSecret('RAPIDAPI_KEY') ??
    readLiveProviderSecret('BOOKING_RAPIDAPI_KEY') ??
    readLiveProviderSecret('VITE_RAPIDAPI_KEY') ??
    ''
  const host = options.rapidApiHost ?? 'booking-com15.p.rapidapi.com'
  const baseUrl = (options.baseUrl ?? `https://${host}/api/v1`).replace(/\/$/, '')
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis)
  const hotelCache = new Map<string, LiveHotelOffer>()
  let forcedAvailable = options.available

  const sdk: LiveProviderSdk = {
    providerId: 'booking',
    displayName: 'Booking.com',
    capabilities: CAPABILITIES,
    isAvailable() {
      if (typeof forcedAvailable === 'boolean') return forcedAvailable
      return Boolean(apiKey)
    },
    async searchHotels(input: LiveHotelSearchInput) {
      const params = new URLSearchParams({
        dest_id: input.destination,
        search_type: 'CITY',
        arrival_date: input.checkIn,
        departure_date: input.checkOut || input.checkIn,
        adults: String(input.adults ?? 2),
        room_qty: '1',
        units: 'metric',
        temperature_unit: 'c',
        languagecode: 'en-us',
        currency_code: (input.currency || 'USD').toUpperCase(),
      })
      const url = `${baseUrl}/hotels/searchHotels?${params}`
      const response = await fetchImpl(url, {
        method: 'GET',
        signal: input.signal,
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': host,
        },
      })
      if (!response.ok) throw new Error(`booking_hotel_search_${response.status}`)
      const body = (await response.json()) as {
        data?: { hotels?: BookingHotelRaw[] } | BookingHotelRaw[]
        result?: BookingHotelRaw[]
      }
      const list: BookingHotelRaw[] = Array.isArray(body.data)
        ? body.data
        : body.data && 'hotels' in body.data && Array.isArray(body.data.hotels)
          ? body.data.hotels
          : Array.isArray(body.result)
            ? body.result
            : []
      const offers = list.map((row, i) =>
        normalizeBookingHotel(row, i, (input.currency || 'USD').toUpperCase()),
      )
      for (const offer of offers) hotelCache.set(offer.id, offer)
      return offers
    },
    async getOfferDetails(offerId: string) {
      return hotelCache.get(offerId) ?? null
    },
    async priceOffer(offerId: string) {
      return hotelCache.get(offerId)?.nightly ?? null
    },
  }

  return Object.assign(sdk, {
    setAvailable(value: boolean) {
      forcedAvailable = value
    },
  })
}
