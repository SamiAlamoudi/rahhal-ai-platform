/**
 * Booking.com Live Provider SDK adapter — Sprint 56.
 *
 * Hotel search abstraction with normalized:
 * hotel, price, currency, rating, photos, location.
 */

import { readLiveProviderSecret } from '../feature'
import { createProviderRequestId, logProviderRequest } from '../providerLog'
import type {
  LiveFetch,
  LiveHotelOffer,
  LiveHotelSearchInput,
  LiveOrderContext,
  LiveOrderResult,
  LiveProviderCapabilities,
  LiveProviderSdk,
} from '../types'

function parseBoolEnv(key: string, fallback: boolean): boolean {
  const value = readLiveProviderSecret(key)
  if (value == null) return fallback
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return fallback
}

export type BookingAdapterOptions = {
  apiKey?: string
  rapidApiHost?: string
  baseUrl?: string
  fetchImpl?: LiveFetch
  available?: boolean
  /** When true, attempt HTTP hotel order endpoint (if configured). */
  orderLive?: boolean
  now?: () => number
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
  const orderStore = new Map<string, LiveOrderResult>()
  const bookedOffers = new Set<string>()
  const now = options.now ?? (() => Date.now())
  const orderLive = options.orderLive ?? parseBoolEnv('BOOKING_ORDER_LIVE', false)
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
    async createOrder(offerId: string, signal?: AbortSignal, context?: LiveOrderContext): Promise<LiveOrderResult> {
      const requestId = createProviderRequestId('bkg')
      const started = now()
      try {
        if (bookedOffers.has(offerId)) {
          return {
            ok: false,
            error: 'duplicate_booking',
            errorCode: 'duplicate',
            retryable: false,
            domain: 'hotels',
          }
        }
        const offer = hotelCache.get(offerId)
        if (!offer && !offerId) {
          return {
            ok: false,
            error: 'offer_not_found',
            errorCode: 'validation',
            retryable: false,
            domain: 'hotels',
          }
        }
        const travelers = context?.travelers?.length
          ? context.travelers
          : [{ firstName: 'Guest', lastName: 'One' }]
        const guestNames = travelers.map((t) => `${t.firstName} ${t.lastName}`.trim())
        const checkIn = context?.checkIn ?? null
        const checkOut = context?.checkOut ?? null
        const roomType = context?.roomType ?? offer?.area ?? 'Standard Room'
        const currency = (offer?.nightly.currency || 'USD').toUpperCase()
        const amount = offer?.nightly.amount ?? 0

        if (orderLive) {
          const orderUrl = `${baseUrl}/hotels/book`
          try {
            const response = await fetchImpl(orderUrl, {
              method: 'POST',
              signal,
              headers: {
                'Content-Type': 'application/json',
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': host,
              },
              body: JSON.stringify({
                hotel_id: offerId,
                checkin: checkIn,
                checkout: checkOut,
                guests: guestNames,
              }),
            })
            if (response.status === 429) {
              return {
                ok: false,
                error: 'booking_rate_limit',
                errorCode: 'retryable',
                retryable: true,
                domain: 'hotels',
              }
            }
            if (!response.ok) {
              return {
                ok: false,
                error: `booking_order_${response.status}`,
                errorCode: response.status >= 500 ? 'unavailable' : 'validation',
                retryable: response.status >= 500,
                domain: 'hotels',
              }
            }
            const body = (await response.json()) as {
              confirmation?: string
              reservation_id?: string
            }
            const orderId = body.reservation_id || `bkg-rsv-${offerId}`
            const confirmation = body.confirmation || orderId
            const result: LiveOrderResult = {
              ok: true,
              orderId,
              domain: 'hotels',
              providerBookingId: orderId,
              hotelConfirmation: confirmation,
              guestNames,
              roomType,
              checkIn,
              checkOut,
              travelerList: travelers,
              status: 'confirmed',
              price: { amount, currency },
              currency,
              createdAt: new Date(now()).toISOString(),
              raw: body,
            }
            orderStore.set(orderId, result)
            bookedOffers.add(offerId)
            logProviderRequest({
              requestId,
              provider: 'booking',
              operation: 'createOrder',
              durationMs: now() - started,
              status: 'confirmed',
              providerReference: orderId,
            })
            return result
          } catch (err) {
            const message = err instanceof Error ? err.message : 'booking_order_failed'
            const timeout = /abort|timeout/i.test(message)
            return {
              ok: false,
              error: message,
              errorCode: timeout ? 'timeout' : 'unavailable',
              retryable: true,
              domain: 'hotels',
            }
          }
        }

        const confirmation = `HTL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        const orderId = `bkg-rsv-${offerId}-${confirmation}`
        const result: LiveOrderResult = {
          ok: true,
          orderId,
          domain: 'hotels',
          providerBookingId: orderId,
          hotelConfirmation: confirmation,
          guestNames,
          roomType,
          checkIn,
          checkOut,
          travelerList: travelers,
          status: 'confirmed',
          price: { amount, currency },
          currency,
          createdAt: new Date(now()).toISOString(),
          raw: { mode: 'provider_simulated', offerId },
        }
        orderStore.set(orderId, result)
        bookedOffers.add(offerId)
        logProviderRequest({
          requestId,
          provider: 'booking',
          operation: 'createOrder',
          durationMs: now() - started,
          status: 'confirmed',
          providerReference: orderId,
        })
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'booking_order_failed'
        const timeout = /abort|timeout/i.test(message)
        return {
          ok: false,
          error: message,
          errorCode: timeout ? 'timeout' : 'unavailable',
          retryable: true,
          domain: 'hotels',
        }
      }
    },
    async retrieveOrder(orderId: string): Promise<LiveOrderResult | null> {
      const cached = orderStore.get(orderId)
      if (!cached) return { ok: false, error: 'not_found', errorCode: 'not_found', orderId }
      return { ...cached }
    },
    async cancelOrder(orderId: string) {
      const cached = orderStore.get(orderId)
      if (!cached) return { ok: false, error: 'unknown_order', errorCode: 'not_found' as const }
      orderStore.set(orderId, { ...cached, status: 'cancelled', ok: true })
      return { ok: true }
    },
  }

  return Object.assign(sdk, {
    setAvailable(value: boolean) {
      forcedAvailable = value
    },
    seedHotelOffer(offer: LiveHotelOffer) {
      hotelCache.set(offer.id, offer)
    },
  })
}
