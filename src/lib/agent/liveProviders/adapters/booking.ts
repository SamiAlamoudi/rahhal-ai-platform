/**
 * Booking.com Live Provider SDK adapter — Sprint 56 + Sprint 60.
 *
 * Hotel search via RapidAPI Booking.com Connectivity-style endpoints.
 * Normalizes supplier payloads into Rahhal's LiveHotelOffer model.
 *
 * Sprint 60:
 * - Credentials from env only (BOOKING_API_KEY / RAPIDAPI_KEY / …)
 * - Destination resolution (numeric dest_id or searchDestination)
 * - Full hotel normalization (address, room, cancel, taxes, amenities, …)
 * - Graceful errors: empty / invalid destination / timeout / rate limit / unavailable
 * - Structured provider logging (never secrets)
 */

import {
  mapDestType,
  normalizeDestinationQuery,
  parseNumericDestId,
  pickBestDestination,
} from '../../../../integrations/providers/booking/destinationResolution'
import type { BookingComDestinationResult } from '../../../../integrations/providers/booking/bookingComApiClient'
import { readBookingApiKey, readLiveProviderSecret } from '../feature'
import {
  createProviderRequestId,
  logProviderRequest,
  type ProviderLogStatus,
} from '../providerLog'
import type {
  LiveFetch,
  LiveHotelOffer,
  LiveHotelSearchInput,
  LiveMoney,
  LiveProviderCapabilities,
  LiveProviderSdk,
} from '../types'

export type BookingAdapterOptions = {
  apiKey?: string
  rapidApiHost?: string
  baseUrl?: string
  fetchImpl?: LiveFetch
  available?: boolean
  timeoutMs?: number
  now?: () => number
}

export type BookingProviderErrorCode =
  | 'invalid_destination'
  | 'rate_limit'
  | 'provider_unavailable'
  | 'timeout'
  | 'empty_search'
  | 'upstream_error'

export class BookingProviderError extends Error {
  readonly code: BookingProviderErrorCode
  readonly httpStatus: number | null
  readonly retryable: boolean

  constructor(
    code: BookingProviderErrorCode,
    message: string,
    options?: { httpStatus?: number | null; retryable?: boolean; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'BookingProviderError'
    this.code = code
    this.httpStatus = options?.httpStatus ?? null
    this.retryable = options?.retryable ?? false
  }
}

type BookingHotelRaw = {
  hotel_id?: string | number
  id?: string | number
  hotel_name?: string
  name?: string
  address?: string
  city?: string
  latitude?: number | string
  longitude?: number | string
  review_score?: number
  class?: number
  stars?: number
  hotel_class?: number
  min_total_price?: number
  product_price?: string | number
  price_breakdown?: {
    gross_price?: number
    gross_amount?: number
    excluded?: number
    included_taxes?: number
    currency?: string
    gross_amount_per_night?: Array<{ amount?: string | number }>
  }
  product_price_breakdown?: {
    gross_amount?: { value?: number; currency?: string }
    gross_amount_per_night?: { value?: number; currency?: string } | Array<{ amount?: string }>
    excluded_amount?: { value?: number; currency?: string }
    included_taxes_and_charges_amount?: { value?: number; currency?: string }
  }
  currency?: string
  currency_code?: string
  photoUrls?: string[]
  main_photo_url?: string
  photos?: Array<{ url_max750?: string; url_max1080?: string; url_1440?: string; url_original?: string }>
  is_free_cancellable?: number | boolean
  cancellation?: string
  facilities?: Array<{ name?: string } | string>
  hotel_facilities?: Array<{ name?: string } | string>
  amenities?: string[]
  room_data?: Array<{
    room_name?: string
    bed_configurations?: Array<{
      bed_types?: Array<{ name?: string; count?: number }>
    }>
  }>
  unit_configuration_label?: string
  distance_to_cc?: number | string
  distance_to_city_center_km?: number
  distance?: number | string
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

function money(amount: number, currency: string): LiveMoney {
  return {
    amount: Math.round((Number.isFinite(amount) ? amount : 0) * 100) / 100,
    currency: currency.toUpperCase(),
  }
}

function num(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function nightsBetween(checkIn: string, checkOut: string | null | undefined): number {
  if (!checkOut || checkOut === checkIn) return 1
  const a = Date.parse(`${checkIn}T00:00:00Z`)
  const b = Date.parse(`${checkOut}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 1
  return Math.max(1, Math.round((b - a) / 86_400_000))
}

function defaultCheckOut(checkIn: string, nights = 3): string {
  const d = new Date(`${checkIn}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return checkIn
  d.setUTCDate(d.getUTCDate() + nights)
  return d.toISOString().slice(0, 10)
}

function extractPhotos(raw: BookingHotelRaw): string[] {
  const photos: string[] = []
  if (raw.main_photo_url) photos.push(raw.main_photo_url)
  if (Array.isArray(raw.photoUrls)) photos.push(...raw.photoUrls.filter(Boolean))
  if (Array.isArray(raw.photos)) {
    for (const p of raw.photos) {
      const url = p.url_max1080 || p.url_max750 || p.url_1440 || p.url_original
      if (url) photos.push(url)
    }
  }
  return [...new Set(photos)]
}

function extractAmenities(raw: BookingHotelRaw): string[] {
  if (Array.isArray(raw.amenities) && raw.amenities.length) {
    return raw.amenities.map(String).filter(Boolean)
  }
  const facilities = raw.facilities ?? raw.hotel_facilities ?? []
  return facilities
    .map((f) => (typeof f === 'string' ? f : f?.name || ''))
    .filter(Boolean)
}

function extractRoomType(raw: BookingHotelRaw): string | null {
  if (raw.unit_configuration_label) return raw.unit_configuration_label
  const room = raw.room_data?.[0]
  if (!room) return 'Standard Room'
  const bed = room.bed_configurations?.[0]?.bed_types?.[0]
  if (bed?.name) {
    return `${room.room_name || 'Room'} (${bed.count ?? 1}x ${bed.name})`
  }
  return room.room_name || 'Standard Room'
}

function extractCancellation(raw: BookingHotelRaw): {
  policy: string | null
  refundable: boolean | null
} {
  if (raw.cancellation) {
    const policy = String(raw.cancellation)
    return {
      policy,
      refundable: /free|gratuit|مجاني|refundable/i.test(policy),
    }
  }
  if (raw.is_free_cancellable == null) {
    return { policy: null, refundable: null }
  }
  const refundable = Boolean(raw.is_free_cancellable)
  return {
    policy: refundable ? 'Free cancellation' : 'Non-refundable',
    refundable,
  }
}

function extractDistanceKm(raw: BookingHotelRaw): number | null {
  if (raw.distance_to_city_center_km != null) return num(raw.distance_to_city_center_km, NaN) || null
  if (raw.distance_to_cc != null) return num(raw.distance_to_cc, NaN) || null
  if (raw.distance != null) return num(raw.distance, NaN) || null
  return null
}

function extractPricing(
  raw: BookingHotelRaw,
  currencyFallback: string,
  nights: number,
): { nightly: LiveMoney; total: LiveMoney; taxes: LiveMoney; currency: string } {
  const currency = (
    raw.product_price_breakdown?.gross_amount?.currency
    || raw.price_breakdown?.currency
    || raw.currency_code
    || raw.currency
    || currencyFallback
  ).toUpperCase()

  const perNightFromBreakdown = (() => {
    const pn = raw.product_price_breakdown?.gross_amount_per_night
    if (pn && !Array.isArray(pn) && pn.value != null) return num(pn.value)
    if (Array.isArray(raw.price_breakdown?.gross_amount_per_night)) {
      return num(raw.price_breakdown?.gross_amount_per_night?.[0]?.amount)
    }
    return 0
  })()

  const totalAmount = num(
    raw.product_price_breakdown?.gross_amount?.value
      ?? raw.price_breakdown?.gross_amount
      ?? raw.price_breakdown?.gross_price
      ?? raw.min_total_price
      ?? raw.product_price
      ?? 0,
  )

  const taxesAmount = num(
    raw.product_price_breakdown?.included_taxes_and_charges_amount?.value
      ?? raw.product_price_breakdown?.excluded_amount?.value
      ?? raw.price_breakdown?.included_taxes
      ?? raw.price_breakdown?.excluded
      ?? 0,
  )

  const nightlyAmount =
    perNightFromBreakdown > 0
      ? perNightFromBreakdown
      : nights > 0
        ? totalAmount / nights
        : totalAmount

  return {
    currency,
    nightly: money(nightlyAmount, currency),
    total: money(totalAmount || nightlyAmount * nights, currency),
    taxes: money(taxesAmount, currency),
  }
}

/** Normalize a Booking.com hotel row into Rahhal's LiveHotelOffer. */
export function normalizeBookingHotel(
  raw: BookingHotelRaw,
  index: number,
  currencyFallback = 'USD',
  nights = 1,
): LiveHotelOffer {
  const name = raw.hotel_name || raw.name || `Hotel ${index + 1}`
  const address = raw.address || null
  const area = raw.address || raw.city || null
  const pricing = extractPricing(raw, currencyFallback, Math.max(1, nights))
  const cancel = extractCancellation(raw)
  return {
    id: String(raw.hotel_id ?? raw.id ?? `booking-hotel-${index}`),
    providerId: 'booking',
    name,
    address,
    area,
    stars: raw.class ?? raw.stars ?? raw.hotel_class ?? null,
    rating: raw.review_score ?? null,
    roomType: extractRoomType(raw),
    cancellationPolicy: cancel.policy,
    nightly: pricing.nightly,
    total: pricing.total,
    taxes: pricing.taxes,
    currency: pricing.currency,
    photos: extractPhotos(raw),
    amenities: extractAmenities(raw),
    latitude: raw.latitude == null ? null : num(raw.latitude, NaN) || null,
    longitude: raw.longitude == null ? null : num(raw.longitude, NaN) || null,
    distanceFromCenterKm: extractDistanceKm(raw),
    refundable: cancel.refundable,
    raw,
  }
}

function logStatusForError(code: BookingProviderErrorCode): ProviderLogStatus {
  switch (code) {
    case 'invalid_destination':
      return 'invalid_destination'
    case 'rate_limit':
      return 'rate_limit'
    case 'timeout':
      return 'timeout'
    case 'provider_unavailable':
      return 'unavailable'
    case 'empty_search':
      return 'empty'
    default:
      return 'error'
  }
}

function classifyHttpError(status: number, bodyText: string): BookingProviderError {
  const lower = bodyText.toLowerCase()
  if (status === 429) {
    return new BookingProviderError('rate_limit', 'Booking.com rate limit exceeded', {
      httpStatus: 429,
      retryable: true,
    })
  }
  if (
    status === 400
    && (/dest|destination|city|invalid|unknown|not found|bad request/.test(lower) || !lower)
  ) {
    return new BookingProviderError('invalid_destination', 'Invalid hotel destination', {
      httpStatus: 400,
      retryable: false,
    })
  }
  if (status === 404) {
    return new BookingProviderError('invalid_destination', 'Hotel destination not found', {
      httpStatus: 404,
      retryable: false,
    })
  }
  if (status >= 500 || status === 503 || status === 502) {
    return new BookingProviderError('provider_unavailable', `Booking.com unavailable (${status})`, {
      httpStatus: status,
      retryable: true,
    })
  }
  return new BookingProviderError('upstream_error', `Booking.com hotel search failed (${status})`, {
    httpStatus: status,
    retryable: status >= 500,
  })
}

function classifyFetchError(err: unknown): BookingProviderError {
  if (err instanceof BookingProviderError) return err
  const message = err instanceof Error ? err.message : 'Booking.com request failed'
  if (/abort|timeout|timed out/i.test(message)) {
    return new BookingProviderError('timeout', message, { retryable: true, cause: err })
  }
  return new BookingProviderError('provider_unavailable', message, {
    retryable: true,
    cause: err,
  })
}

function extractHotelList(body: unknown): BookingHotelRaw[] {
  if (!body || typeof body !== 'object') return []
  const record = body as {
    data?: { hotels?: BookingHotelRaw[]; result?: BookingHotelRaw[] } | BookingHotelRaw[]
    result?: BookingHotelRaw[]
    hotels?: BookingHotelRaw[]
  }
  if (Array.isArray(record.data)) return record.data
  if (record.data && typeof record.data === 'object') {
    if (Array.isArray(record.data.hotels)) return record.data.hotels
    if (Array.isArray(record.data.result)) return record.data.result
  }
  if (Array.isArray(record.result)) return record.result
  if (Array.isArray(record.hotels)) return record.hotels
  return []
}

function extractDestinations(body: unknown): BookingComDestinationResult[] {
  if (Array.isArray(body)) return body as BookingComDestinationResult[]
  if (!body || typeof body !== 'object') return []
  const record = body as {
    data?: BookingComDestinationResult[] | { destinations?: BookingComDestinationResult[] }
    result?: BookingComDestinationResult[]
  }
  if (Array.isArray(record.data)) return record.data
  if (record.data && typeof record.data === 'object' && Array.isArray(record.data.destinations)) {
    return record.data.destinations
  }
  if (Array.isArray(record.result)) return record.result
  return []
}

export function createBookingLiveProvider(options: BookingAdapterOptions = {}): LiveProviderSdk {
  const apiKey = options.apiKey ?? readBookingApiKey() ?? ''
  const host =
    options.rapidApiHost
    ?? readLiveProviderSecret('BOOKING_RAPIDAPI_HOST')
    ?? readLiveProviderSecret('VITE_BOOKING_HOST')
    ?? 'booking-com15.p.rapidapi.com'
  const baseUrl = (
    options.baseUrl
    ?? readLiveProviderSecret('VITE_HOTEL_BASE_URL')
    ?? `https://${host}/api/v1`
  ).replace(/\/$/, '')
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis)
  const timeoutMs = options.timeoutMs ?? 8_000
  const now = options.now ?? (() => Date.now())
  const hotelCache = new Map<string, LiveHotelOffer>()
  let forcedAvailable = options.available

  async function authorizedGet(url: string, signal?: AbortSignal): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort)
    try {
      return await fetchImpl(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': host,
        },
      })
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }

  async function resolveDestination(
    destination: string,
    signal?: AbortSignal,
  ): Promise<{ destId: string; destType: string }> {
    const numeric = parseNumericDestId(destination)
    if (numeric !== null) {
      return { destId: String(numeric), destType: 'CITY' }
    }

    const query = normalizeDestinationQuery(destination)
    if (!query) {
      throw new BookingProviderError('invalid_destination', 'Destination is empty', {
        retryable: false,
      })
    }

    const url = `${baseUrl}/hotels/searchDestination?${new URLSearchParams({ query })}`
    let response: Response
    try {
      response = await authorizedGet(url, signal)
    } catch (err) {
      throw classifyFetchError(err)
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '')
      throw classifyHttpError(response.status, bodyText)
    }

    const body = await response.json()
    const picked = pickBestDestination(extractDestinations(body), query)
    if (picked) {
      return {
        destId: String(picked.destId),
        destType: mapDestType(picked.destType).toUpperCase(),
      }
    }
    // Legacy / test-friendly fallback: some mocks and older endpoints accept the
    // free-text destination as dest_id. Live APIs will then return 400 → [].
    return { destId: query, destType: 'CITY' }
  }

  const sdk: LiveProviderSdk = {
    providerId: 'booking',
    displayName: 'Booking.com',
    capabilities: CAPABILITIES,
    isAvailable() {
      if (typeof forcedAvailable === 'boolean') return forcedAvailable
      return Boolean(apiKey)
    },
    async searchHotels(input: LiveHotelSearchInput) {
      const requestId = createProviderRequestId('bkg')
      const started = now()
      const checkOut = input.checkOut || defaultCheckOut(input.checkIn, 3)
      const nights = nightsBetween(input.checkIn, checkOut)
      const adults = Math.max(1, Math.floor(input.adults ?? 2))
      const children = Math.max(0, Math.floor(input.children ?? 0))
      const rooms = Math.max(1, Math.floor(input.rooms ?? 1))
      const currency = (input.currency || 'USD').toUpperCase()

      try {
        const dest = await resolveDestination(input.destination, input.signal)
        const params = new URLSearchParams({
          dest_id: dest.destId,
          dest_type: dest.destType.toLowerCase() === 'city' ? 'city' : dest.destType.toLowerCase(),
          search_type: 'CITY',
          arrival_date: input.checkIn,
          departure_date: checkOut,
          checkin: input.checkIn,
          checkout: checkOut,
          adults: String(adults),
          children: String(children),
          room_qty: String(rooms),
          units: 'metric',
          temperature_unit: 'c',
          languagecode: 'en-us',
          currency_code: currency,
          currency,
          page_qty: '10',
          order_by: 'popularity',
        })

        // Prefer /hotels/search (Connectivity-style); fall back to searchHotels for older mocks.
        const primaryUrl = `${baseUrl}/hotels/search?${params}`
        let response: Response
        try {
          response = await authorizedGet(primaryUrl, input.signal)
          if (response.status === 404) {
            response = await authorizedGet(`${baseUrl}/hotels/searchHotels?${params}`, input.signal)
          }
        } catch (err) {
          throw classifyFetchError(err)
        }

        if (!response.ok) {
          const bodyText = await response.text().catch(() => '')
          throw classifyHttpError(response.status, bodyText)
        }

        const body = await response.json()
        const list = extractHotelList(body)
        const offers = list.map((row, i) => normalizeBookingHotel(row, i, currency, nights))
        for (const offer of offers) hotelCache.set(offer.id, offer)

        logProviderRequest({
          requestId,
          provider: 'booking',
          operation: 'searchHotels',
          durationMs: now() - started,
          status: offers.length === 0 ? 'empty' : 'ok',
          httpStatus: response.status,
          detail: `hotels=${offers.length};dest=${dest.destId}`,
        })
        return offers
      } catch (err) {
        const mapped = classifyFetchError(err)
        logProviderRequest({
          requestId,
          provider: 'booking',
          operation: 'searchHotels',
          durationMs: now() - started,
          status: logStatusForError(mapped.code),
          httpStatus: mapped.httpStatus,
          detail: mapped.message,
        })
        // Graceful: empty / invalid destination → [] so conversation continues.
        if (
          mapped.code === 'empty_search'
          || mapped.code === 'invalid_destination'
        ) {
          return []
        }
        // timeout / rate limit / unavailable — typed throw for failover; orchestrator catches.
        throw mapped
      }
    },
    async getOfferDetails(offerId: string) {
      return hotelCache.get(offerId) ?? null
    },
    async priceOffer(offerId: string) {
      const cached = hotelCache.get(offerId)
      return cached?.total ?? cached?.nightly ?? null
    },
  }

  return Object.assign(sdk, {
    setAvailable(value: boolean) {
      forcedAvailable = value
    },
  })
}
