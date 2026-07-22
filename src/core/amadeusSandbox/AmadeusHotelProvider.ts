/**
 * Sprint 109 — Amadeus Hotel Search TravelProvider (availability only).
 * Additive — reuses Amadeus OAuth / retry / error classification.
 * Does not modify Amadeus flight search provider behavior.
 */

import {
  classifyProviderFailure,
  createProviderRetryPolicy,
  DEFAULT_PROVIDER_LIMITS,
  ProviderError,
  type FlightSearchRequest,
  type HotelSearchRequest,
  type PackageSearchRequest,
  type ProviderCapabilityMap,
  type ProviderHealthResult,
  type ProviderLimits,
  type ProviderRetryPolicyOptions,
  type ProviderSearchResult,
  type TravelProvider,
} from '../providers'
import { AmadeusSandboxOAuth, amadeusTokenUrl, type AmadeusFetch } from './AmadeusAuth'
import { resolveAmadeusSandboxConfig } from './config'
import { emitAmadeusProviderEvent } from './events'
import { normalizePassengerCounts } from './normalize'
import {
  type AmadeusProviderEvent,
} from './types'

export const AMADEUS_HOTEL_PROVIDER_ID = 'amadeus' as const

export interface AmadeusHotelProviderOptions {
  clientId?: string
  clientSecret?: string
  baseUrl?: string
  fetchImpl?: AmadeusFetch
  now?: () => number
  oauth?: AmadeusSandboxOAuth
  available?: boolean
  retry?: ProviderRetryPolicyOptions
  events?: AmadeusProviderEvent[]
}

interface AmadeusHotelListRow {
  hotelId?: string
  name?: string
  geoCode?: { latitude?: number; longitude?: number }
  address?: {
    cityName?: string
    countryCode?: string
  }
  rating?: string | number
}

interface AmadeusHotelOfferRow {
  type?: string
  hotel?: {
    hotelId?: string
    name?: string
    cityCode?: string
    latitude?: number
    longitude?: number
    rating?: string | number
    amenities?: string[]
    media?: Array<{ uri?: string }>
    address?: { cityName?: string; countryCode?: string }
  }
  available?: boolean
  offers?: Array<{
    id?: string
    room?: { typeEstimated?: { category?: string }; description?: { text?: string } }
    boardType?: string
    price?: {
      total?: string
      currency?: string
      variations?: { average?: { total?: string } }
      taxes?: Array<{ amount?: string }>
    }
    policies?: {
      cancellation?: { type?: string; description?: { text?: string } }
      refundable?: { cancellationRefund?: string }
    }
  }>
}

function unsupported(
  domain: string,
): ProviderSearchResult {
  return {
    ok: false,
    providerId: AMADEUS_HOTEL_PROVIDER_ID,
    mode: 'sandbox',
    results: [],
    partial: false,
    empty: true,
    latencyMs: 0,
    error: `${domain}_not_supported`,
    retryable: false,
  }
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function starsFromRating(rating: string | number | undefined): number | null {
  const n = num(rating)
  if (n == null) return null
  return Math.max(0, Math.min(5, Math.round(n)))
}

function isFreeCancellation(offer: NonNullable<AmadeusHotelOfferRow['offers']>[number]): boolean {
  const refund = offer.policies?.refundable?.cancellationRefund
  if (refund && /refund|free/i.test(refund)) return true
  const cancelType = offer.policies?.cancellation?.type
  if (cancelType && /FREE|FULL/i.test(cancelType)) return true
  const text = offer.policies?.cancellation?.description?.text
  if (text && /free cancellation/i.test(text)) return true
  return false
}

export function createAmadeusHotelSearchProvider(
  options: AmadeusHotelProviderOptions = {},
): TravelProvider {
  const config = resolveAmadeusSandboxConfig({
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    baseUrl: options.baseUrl,
  })
  const now = options.now ?? (() => Date.now())
  const events = options.events
  const mode = 'sandbox' as const
  const oauth =
    options.oauth
    ?? new AmadeusSandboxOAuth({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      tokenUrl: amadeusTokenUrl(config.baseUrl),
      fetchImpl: options.fetchImpl,
      now,
      onTokenRefresh: (detail) => {
        emitAmadeusProviderEvent('provider.token.refresh', detail, events)
      },
    })

  const isAvailable = () =>
    options.available !== false && config.hasCredentials

  const retryPolicy = createProviderRetryPolicy({
    maxAttempts: options.retry?.maxAttempts ?? 3,
    baseDelayMs: options.retry?.baseDelayMs ?? 40,
    maxDelayMs: options.retry?.maxDelayMs ?? 200,
    timeoutMs: options.retry?.timeoutMs ?? 8_000,
    sleep: options.retry?.sleep,
  })

  async function resolveCityCode(
    destination: string,
    signal?: AbortSignal,
  ): Promise<string | null> {
    const trimmed = destination.trim()
    if (/^[A-Za-z]{3}$/.test(trimmed)) return trimmed.toUpperCase()

    const params = new URLSearchParams({
      keyword: trimmed,
      subType: 'CITY',
      'page[limit]': '1',
    })
    const url = `${config.baseUrl.replace(/\/$/, '')}/v1/reference-data/locations?${params}`
    const { response } = await oauth.authorizedFetch(url, { method: 'GET', signal })
    if (!response.ok) {
      await response.text().catch(() => '')
      return null
    }
    const body = (await response.json()) as {
      data?: Array<{ iataCode?: string; subType?: string }>
    }
    const city = (body.data ?? []).find((row) => row.iataCode)
    return city?.iataCode?.toUpperCase() ?? null
  }

  async function listHotelsByCity(
    cityCode: string,
    maxResults: number,
    signal?: AbortSignal,
  ): Promise<AmadeusHotelListRow[]> {
    const params = new URLSearchParams({
      cityCode,
      radius: '50',
      radiusUnit: 'KM',
      hotelSource: 'ALL',
    })
    const url = `${config.baseUrl.replace(/\/$/, '')}/v1/reference-data/locations/hotels/by-city?${params}`
    const { response } = await oauth.authorizedFetch(url, { method: 'GET', signal })
    if (!response.ok) {
      const classified = classifyProviderFailure(
        AMADEUS_HOTEL_PROVIDER_ID,
        new Error(`amadeus_hotel_list_${response.status}`),
        response.status,
      )
      await response.text().catch(() => '')
      throw classified
    }
    const body = (await response.json()) as { data?: AmadeusHotelListRow[] }
    return (body.data ?? []).slice(0, maxResults)
  }

  async function fetchHotelOffers(
    request: HotelSearchRequest,
    hotelIds: string[],
    signal?: AbortSignal,
  ): Promise<AmadeusHotelOfferRow[]> {
    if (hotelIds.length === 0) return []
    const passengers = normalizePassengerCounts({
      adults: request.adults,
      children: request.children,
    })
    const rooms = Math.max(1, Math.min(9, Math.floor(request.rooms ?? 1)))
    const params = new URLSearchParams({
      hotelIds: hotelIds.join(','),
      adults: String(passengers.adults),
      roomQuantity: String(rooms),
      checkInDate: request.checkIn,
      currencyCode: (request.currency || 'SAR').toUpperCase(),
      bestRateOnly: 'true',
    })
    if (request.checkOut) params.set('checkOutDate', request.checkOut)
    if (passengers.children > 0) params.set('childAges', Array(passengers.children).fill('8').join(','))

    const url = `${config.baseUrl.replace(/\/$/, '')}/v3/shopping/hotel-offers?${params}`
    const { response } = await oauth.authorizedFetch(url, { method: 'GET', signal })
    if (!response.ok) {
      const classified = classifyProviderFailure(
        AMADEUS_HOTEL_PROVIDER_ID,
        new Error(`amadeus_hotel_offers_${response.status}`),
        response.status,
      )
      await response.text().catch(() => '')
      throw classified
    }
    const body = (await response.json()) as { data?: AmadeusHotelOfferRow[] }
    return body.data ?? []
  }

  function toResultRows(
    list: AmadeusHotelListRow[],
    offers: AmadeusHotelOfferRow[],
    request: HotelSearchRequest,
  ): Record<string, unknown>[] {
    const listById = new Map(
      list.filter((h) => h.hotelId).map((h) => [String(h.hotelId), h]),
    )
    const rows: Record<string, unknown>[] = []

    for (const row of offers) {
      const hotelId = row.hotel?.hotelId ?? null
      if (!hotelId) continue
      const offer = row.offers?.[0]
      if (!offer) continue
      const listed = listById.get(hotelId)
      const price = num(offer.price?.total) ?? num(offer.price?.variations?.average?.total)
      const currency = (offer.price?.currency || request.currency || 'SAR').toUpperCase()
      const taxSum = (offer.price?.taxes ?? [])
        .map((t) => num(t.amount) ?? 0)
        .reduce((a, b) => a + b, 0)
      const stars = starsFromRating(row.hotel?.rating ?? listed?.rating)
      const city =
        row.hotel?.address?.cityName
        ?? listed?.address?.cityName
        ?? null
      const country =
        row.hotel?.address?.countryCode
        ?? listed?.address?.countryCode
        ?? null
      const hotelName = row.hotel?.name ?? listed?.name ?? hotelId
      const amenities = row.hotel?.amenities ?? []
      const images = (row.hotel?.media ?? [])
        .map((m) => m.uri)
        .filter((u): u is string => Boolean(u))
      const freeCancellation = isFreeCancellation(offer)
      const roomType =
        offer.room?.typeEstimated?.category
        ?? offer.room?.description?.text
        ?? null
      const latitude = row.hotel?.latitude ?? listed?.geoCode?.latitude ?? null
      const longitude = row.hotel?.longitude ?? listed?.geoCode?.longitude ?? null

      rows.push({
        id: offer.id ?? `${hotelId}_${request.checkIn}`,
        hotelId,
        hotelName,
        title: hotelName,
        name: hotelName,
        city,
        country,
        latitude,
        longitude,
        roomType,
        boardType: offer.boardType ?? null,
        rating: stars,
        stars,
        price,
        currency,
        taxes: taxSum > 0 ? taxSum : null,
        freeCancellation,
        refundable: freeCancellation,
        amenities,
        images,
        provider: AMADEUS_HOTEL_PROVIDER_ID,
        providerId: AMADEUS_HOTEL_PROVIDER_ID,
        checkIn: request.checkIn,
        checkOut: request.checkOut ?? null,
        familyFriendly: amenities.some((a) => /FAMILY|KID|CHILD/i.test(a)),
        breakfastIncluded: Boolean(offer.boardType && /BREAKFAST|BB|HB|FB/i.test(offer.boardType)),
        providerConfidence: 0.8,
      })
    }

    // Hotels listed but without live offers — skip (availability only)
    return rows
  }

  async function searchHotelsOnce(
    request: HotelSearchRequest,
    signal?: AbortSignal,
  ): Promise<ProviderSearchResult> {
    const started = now()
    emitAmadeusProviderEvent('provider.request', {
      operation: 'searchHotels',
      destination: request.destination,
      checkIn: request.checkIn,
    }, events)

    if (!isAvailable()) {
      const latencyMs = now() - started
      emitAmadeusProviderEvent('provider.failure', {
        operation: 'searchHotels',
        code: 'SECRETS_MISSING',
        latencyMs,
      }, events)
      return {
        ok: false,
        providerId: AMADEUS_HOTEL_PROVIDER_ID,
        mode,
        results: [],
        partial: false,
        empty: true,
        latencyMs,
        error: 'SECRETS_MISSING',
        retryable: false,
      }
    }

    if (!request.checkOut?.trim()) {
      return {
        ok: false,
        providerId: AMADEUS_HOTEL_PROVIDER_ID,
        mode,
        results: [],
        partial: false,
        empty: true,
        latencyMs: now() - started,
        error: 'INVALID_REQUEST',
        retryable: false,
      }
    }

    try {
      const cityCode = await resolveCityCode(request.destination, signal)
      if (!cityCode) {
        return {
          ok: false,
          providerId: AMADEUS_HOTEL_PROVIDER_ID,
          mode,
          results: [],
          partial: false,
          empty: true,
          latencyMs: now() - started,
          error: 'NOT_FOUND',
          retryable: false,
        }
      }

      const maxResults = Math.min(50, Math.max(1, Math.floor(request.maxResults ?? 20)))
      const listed = await listHotelsByCity(cityCode, maxResults, signal)
      const hotelIds = listed
        .map((h) => h.hotelId)
        .filter((id): id is string => Boolean(id))
        .slice(0, maxResults)

      const offers = await fetchHotelOffers(request, hotelIds, signal)
      const results = toResultRows(listed, offers, request)
      const latencyMs = now() - started

      emitAmadeusProviderEvent('provider.success', {
        operation: 'searchHotels',
        count: results.length,
        latencyMs,
      }, events)

      return {
        ok: true,
        providerId: AMADEUS_HOTEL_PROVIDER_ID,
        mode,
        results,
        partial: false,
        empty: results.length === 0,
        latencyMs,
      }
    } catch (err) {
      const classified = err instanceof ProviderError
        ? err
        : classifyProviderFailure(AMADEUS_HOTEL_PROVIDER_ID, err)
      const latencyMs = now() - started
      emitAmadeusProviderEvent('provider.failure', {
        operation: 'searchHotels',
        code: classified.code,
        statusCode: classified.statusCode,
        latencyMs,
      }, events)
      return {
        ok: false,
        providerId: AMADEUS_HOTEL_PROVIDER_ID,
        mode,
        results: [],
        partial: false,
        empty: true,
        latencyMs,
        error: classified.code,
        retryable: classified.retryable,
      }
    }
  }

  return {
    id: AMADEUS_HOTEL_PROVIDER_ID,
    displayName: 'Amadeus Hotel Search',
    mode,
    capabilities(): ProviderCapabilityMap {
      return {
        flights: false,
        hotels: true,
        packages: false,
        booking: false,
        cancellation: false,
        sandbox: true,
        live: false,
      }
    },
    limits(): ProviderLimits {
      return { ...DEFAULT_PROVIDER_LIMITS, timeoutMs: 8_000 }
    },
    async health(_signal?: AbortSignal): Promise<ProviderHealthResult> {
      const started = now()
      if (!isAvailable()) {
        return {
          providerId: AMADEUS_HOTEL_PROVIDER_ID,
          ok: false,
          mode,
          latencyMs: now() - started,
          detail: 'secrets_missing',
          checkedAt: new Date().toISOString(),
        }
      }
      try {
        const token = await oauth.getToken()
        if (!token.token) {
          return {
            providerId: AMADEUS_HOTEL_PROVIDER_ID,
            ok: false,
            mode,
            latencyMs: now() - started,
            detail: 'oauth_failed',
            checkedAt: new Date().toISOString(),
          }
        }
        return {
          providerId: AMADEUS_HOTEL_PROVIDER_ID,
          ok: true,
          mode,
          latencyMs: now() - started,
          detail: 'oauth_ok',
          checkedAt: new Date().toISOString(),
        }
      } catch (err) {
        return {
          providerId: AMADEUS_HOTEL_PROVIDER_ID,
          ok: false,
          mode,
          latencyMs: now() - started,
          detail: err instanceof Error ? err.message : 'health_failed',
          checkedAt: new Date().toISOString(),
        }
      }
    },
    async searchFlights(_request: FlightSearchRequest): Promise<ProviderSearchResult> {
      return unsupported('flights')
    },
    async searchHotels(request: HotelSearchRequest): Promise<ProviderSearchResult> {
      let attempt = 0
      const outcome = await retryPolicy.execute(AMADEUS_HOTEL_PROVIDER_ID, async (signal) => {
        attempt += 1
        if (attempt > 1) {
          emitAmadeusProviderEvent('provider.retry', {
            operation: 'searchHotels',
            attempt,
          }, events)
        }
        const result = await searchHotelsOnce(request, signal)
        if (!result.ok && result.retryable) {
          throw classifyProviderFailure(
            AMADEUS_HOTEL_PROVIDER_ID,
            new Error(result.error ?? 'retryable_failure'),
            result.error === 'RATE_LIMITED'
              ? 429
              : result.error === 'UNAUTHORIZED'
                ? 401
                : result.error === 'SERVER_ERROR'
                  ? 503
                  : null,
          )
        }
        return result
      })

      if (outcome.ok && outcome.value) return outcome.value

      return {
        ok: false,
        providerId: AMADEUS_HOTEL_PROVIDER_ID,
        mode,
        results: [],
        partial: false,
        empty: true,
        latencyMs: 0,
        error: outcome.circuitOpen
          ? 'CIRCUIT_OPEN'
          : (outcome.code ?? outcome.error ?? 'PROVIDER_UNAVAILABLE'),
        retryable: !outcome.circuitOpen,
      }
    },
    async searchPackages(_request: PackageSearchRequest): Promise<ProviderSearchResult> {
      return unsupported('packages')
    },
  }
}
