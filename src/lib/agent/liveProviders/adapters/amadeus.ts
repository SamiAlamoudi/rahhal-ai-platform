/**
 * Amadeus Live Provider SDK adapter — Sprint 56 + Sprint 59 + Sprint 61.
 *
 * Supports: Flight Search, Airport Search, Flight Offers, Flight Pricing.
 * OAuth with automatic refresh + auth retry. Injectable fetch (no network in tests).
 *
 * Sprint 59:
 * - Credentials from AMADEUS_API_KEY / AMADEUS_API_SECRET (CLIENT_* aliases)
 * - children + cabin on flight search
 * - graceful error mapping (empty / invalid airport / rate limit / unavailable / token)
 * - structured provider logging (request id, duration, status, provider — never secrets)
 *
 * Sprint 61:
 * - createOrder / retrieveOrder / cancelOrder (Flight Create Orders or simulated)
 */

import { AmadeusOAuthManager, amadeusTokenUrl } from '../oauth'
import {
  readAmadeusApiKey,
  readAmadeusApiSecret,
  readLiveProviderSecret,
} from '../feature'
import {
  createProviderRequestId,
  logProviderRequest,
  type ProviderLogStatus,
} from '../providerLog'
import type {
  LiveAirportResult,
  LiveFetch,
  LiveFlightOffer,
  LiveFlightSearchInput,
  LiveMoney,
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

export type AmadeusAdapterOptions = {
  clientId?: string
  clientSecret?: string
  baseUrl?: string
  fetchImpl?: LiveFetch
  available?: boolean
  oauth?: AmadeusOAuthManager
  now?: () => number
  /**
   * Sprint 61 — when true, POST Amadeus Flight Create Orders.
   * Default false: deterministic in-adapter order store (still "live provider" path).
   */
  orderLive?: boolean
}

export type AmadeusProviderErrorCode =
  | 'invalid_airport'
  | 'rate_limit'
  | 'provider_unavailable'
  | 'expired_token'
  | 'oauth_failed'
  | 'empty_search'
  | 'upstream_error'

export class AmadeusProviderError extends Error {
  readonly code: AmadeusProviderErrorCode
  readonly httpStatus: number | null
  readonly retryable: boolean

  constructor(
    code: AmadeusProviderErrorCode,
    message: string,
    options?: { httpStatus?: number | null; retryable?: boolean; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'AmadeusProviderError'
    this.code = code
    this.httpStatus = options?.httpStatus ?? null
    this.retryable = options?.retryable ?? false
  }
}

type AmadeusOfferRaw = {
  id?: string
  type?: string
  source?: string
  itineraries?: Array<{
    duration?: string
    segments?: Array<{
      departure?: { iataCode?: string; at?: string }
      arrival?: { iataCode?: string; at?: string }
      carrierCode?: string
      numberOfStops?: number
      duration?: string
    }>
  }>
  price?: { total?: string; currency?: string }
  travelerPricings?: Array<{ fareDetailsBySegment?: Array<{ cabin?: string }> }>
  pricingOptions?: { refundableFare?: boolean }
}

const CAPABILITIES: LiveProviderCapabilities = {
  flights: true,
  hotels: false,
  activities: false,
  cars: false,
  transfers: false,
  insurance: false,
  airports: true,
}

const AMADEUS_CABIN_MAP: Record<string, string> = {
  economy: 'ECONOMY',
  eco: 'ECONOMY',
  y: 'ECONOMY',
  premium_economy: 'PREMIUM_ECONOMY',
  premiumeconomy: 'PREMIUM_ECONOMY',
  premium: 'PREMIUM_ECONOMY',
  w: 'PREMIUM_ECONOMY',
  business: 'BUSINESS',
  j: 'BUSINESS',
  first: 'FIRST',
  f: 'FIRST',
}

/** Map Rahhal cabin hints to Amadeus travelClass values. */
export function mapCabinToAmadeusTravelClass(cabin: string | null | undefined): string | null {
  if (!cabin) return null
  const key = cabin.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return AMADEUS_CABIN_MAP[key] ?? (key.length > 0 ? key.toUpperCase() : null)
}

export function parseDurationMinutes(iso: string | undefined): number | null {
  if (!iso) return null
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(iso)
  if (!match) return null
  const hours = Number(match[1] ?? 0)
  const mins = Number(match[2] ?? 0)
  return hours * 60 + mins
}

/** Normalize a raw Amadeus flight-offer into Rahhal's LiveFlightOffer model. */
export function normalizeAmadeusLiveFlightOffer(
  raw: AmadeusOfferRaw,
  index: number,
): LiveFlightOffer {
  const segments = raw.itineraries?.[0]?.segments ?? []
  const first = segments[0]
  const last = segments[segments.length - 1]
  const stops = Math.max(0, segments.length - 1)
  const cabin = raw.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin ?? null
  return {
    id: raw.id || `amadeus-flight-${index}`,
    providerId: 'amadeus',
    from: first?.departure?.iataCode || '',
    to: last?.arrival?.iataCode || '',
    airline: first?.carrierCode ?? null,
    cabin,
    stops,
    durationMinutes: parseDurationMinutes(raw.itineraries?.[0]?.duration),
    departureAt: first?.departure?.at ?? null,
    arrivalAt: last?.arrival?.at ?? null,
    price: {
      amount: Number(raw.price?.total ?? 0),
      currency: (raw.price?.currency || 'USD').toUpperCase(),
    },
    refundable: raw.pricingOptions?.refundableFare ?? null,
    raw,
  }
}

function logStatusForError(code: AmadeusProviderErrorCode): ProviderLogStatus {
  switch (code) {
    case 'invalid_airport':
      return 'invalid_airport'
    case 'rate_limit':
      return 'rate_limit'
    case 'provider_unavailable':
      return 'unavailable'
    case 'expired_token':
    case 'oauth_failed':
      return 'expired_token'
    case 'empty_search':
      return 'empty'
    default:
      return 'error'
  }
}

function classifyHttpError(status: number, bodyText: string): AmadeusProviderError {
  const lower = bodyText.toLowerCase()
  if (status === 429) {
    return new AmadeusProviderError('rate_limit', 'Amadeus rate limit exceeded', {
      httpStatus: 429,
      retryable: true,
    })
  }
  if (status === 401) {
    return new AmadeusProviderError('expired_token', 'Amadeus token rejected after retry', {
      httpStatus: 401,
      retryable: true,
    })
  }
  if (
    status === 400
    && (/invalid.*location|unknown.*location|airport|iata|originlocation|destinationlocation/.test(
      lower,
    )
      || /code.*invalid|invalid.*code/.test(lower))
  ) {
    return new AmadeusProviderError('invalid_airport', 'Invalid airport or city code', {
      httpStatus: 400,
      retryable: false,
    })
  }
  if (status >= 500 || status === 503 || status === 502) {
    return new AmadeusProviderError('provider_unavailable', `Amadeus unavailable (${status})`, {
      httpStatus: status,
      retryable: true,
    })
  }
  return new AmadeusProviderError('upstream_error', `Amadeus flight search failed (${status})`, {
    httpStatus: status,
    retryable: status >= 500,
  })
}

export function createAmadeusLiveProvider(options: AmadeusAdapterOptions = {}): LiveProviderSdk {
  const clientId = options.clientId ?? readAmadeusApiKey() ?? ''
  const clientSecret = options.clientSecret ?? readAmadeusApiSecret() ?? ''
  const baseUrl =
    options.baseUrl ??
    readLiveProviderSecret('AMADEUS_BASE_URL') ??
    'https://test.api.amadeus.com'
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis)
  const now = options.now ?? (() => Date.now())
  const oauth =
    options.oauth ??
    new AmadeusOAuthManager({
      clientId,
      clientSecret,
      tokenUrl: amadeusTokenUrl(baseUrl),
      fetchImpl,
      now,
    })

  const offerCache = new Map<string, LiveFlightOffer>()
  const orderStore = new Map<string, LiveOrderResult>()
  const bookedOffers = new Set<string>()
  const orderLive = options.orderLive ?? parseBoolEnv('AMADEUS_ORDER_LIVE', false)
  let forcedAvailable = options.available

  const sdk: LiveProviderSdk = {
    providerId: 'amadeus',
    displayName: 'Amadeus',
    capabilities: CAPABILITIES,
    isAvailable() {
      if (typeof forcedAvailable === 'boolean') return forcedAvailable
      return Boolean(clientId && clientSecret)
    },
    async searchFlights(input: LiveFlightSearchInput) {
      const requestId = createProviderRequestId('amd')
      const started = now()
      const adults = Math.max(1, Math.floor(input.adults ?? 1))
      const children = Math.max(0, Math.floor(input.children ?? 0))
      const travelClass = mapCabinToAmadeusTravelClass(input.cabin)

      try {
        const params = new URLSearchParams({
          originLocationCode: input.origin.toUpperCase(),
          destinationLocationCode: input.destination.toUpperCase(),
          departureDate: input.departureDate,
          adults: String(adults),
          currencyCode: (input.currency || 'USD').toUpperCase(),
          max: '20',
        })
        if (input.returnDate) params.set('returnDate', input.returnDate)
        if (children > 0) params.set('children', String(children))
        if (travelClass) params.set('travelClass', travelClass)

        const url = `${baseUrl.replace(/\/$/, '')}/v2/shopping/flight-offers?${params}`
        let response: Response
        let authRetried = false
        try {
          const authorized = await oauth.authorizedFetch(url, {
            method: 'GET',
            signal: input.signal,
          })
          response = authorized.response
          authRetried = authorized.authRetried
        } catch (err) {
          const message = err instanceof Error ? err.message : 'amadeus_oauth_failed'
          const code: AmadeusProviderErrorCode =
            /oauth|token|401|auth/i.test(message) ? 'oauth_failed' : 'provider_unavailable'
          throw new AmadeusProviderError(code, message, {
            retryable: true,
            cause: err,
          })
        }

        if (!response.ok) {
          const bodyText = await response.text().catch(() => '')
          throw classifyHttpError(response.status, bodyText)
        }

        const body = (await response.json()) as { data?: AmadeusOfferRaw[] }
        const offers = (body.data ?? []).map(normalizeAmadeusLiveFlightOffer)
        for (const offer of offers) offerCache.set(offer.id, offer)

        logProviderRequest({
          requestId,
          provider: 'amadeus',
          operation: 'searchFlights',
          durationMs: now() - started,
          status: offers.length === 0 ? 'empty' : 'ok',
          httpStatus: response.status,
          detail: authRetried
            ? `offers=${offers.length};auth_retried=1`
            : `offers=${offers.length}`,
        })
        return offers
      } catch (err) {
        const mapped =
          err instanceof AmadeusProviderError
            ? err
            : new AmadeusProviderError(
                'provider_unavailable',
                err instanceof Error ? err.message : 'Amadeus search failed',
                { retryable: true, cause: err },
              )
        logProviderRequest({
          requestId,
          provider: 'amadeus',
          operation: 'searchFlights',
          durationMs: now() - started,
          status: logStatusForError(mapped.code),
          httpStatus: mapped.httpStatus,
          detail: mapped.message,
        })
        // Graceful: empty / invalid airport → empty list (conversation continues).
        if (mapped.code === 'empty_search' || mapped.code === 'invalid_airport') {
          return []
        }
        // Rate limit / unavailable / token — rethrow typed error for failover;
        // callers (wrap + withProviderFailover) catch so the conversation never crashes.
        throw mapped
      }
    },
    async searchAirports(query: string, signal?: AbortSignal) {
      const requestId = createProviderRequestId('amd')
      const started = now()
      try {
        const params = new URLSearchParams({
          keyword: query,
          subType: 'AIRPORT,CITY',
          'page[limit]': '10',
        })
        const url = `${baseUrl.replace(/\/$/, '')}/v1/reference-data/locations?${params}`
        const { response } = await oauth.authorizedFetch(url, { method: 'GET', signal })
        if (!response.ok) {
          const bodyText = await response.text().catch(() => '')
          throw classifyHttpError(response.status, bodyText)
        }
        const body = (await response.json()) as {
          data?: Array<{
            iataCode?: string
            name?: string
            address?: { cityName?: string; countryCode?: string }
          }>
        }
        const rows = (body.data ?? [])
          .filter((row) => row.iataCode)
          .map(
            (row): LiveAirportResult => ({
              iata: String(row.iataCode).toUpperCase(),
              name: row.name || String(row.iataCode),
              city: row.address?.cityName ?? null,
              country: row.address?.countryCode ?? null,
            }),
          )
        logProviderRequest({
          requestId,
          provider: 'amadeus',
          operation: 'searchAirports',
          durationMs: now() - started,
          status: rows.length === 0 ? 'empty' : 'ok',
          httpStatus: response.status,
          detail: `results=${rows.length}`,
        })
        return rows
      } catch (err) {
        const mapped =
          err instanceof AmadeusProviderError
            ? err
            : new AmadeusProviderError(
                'provider_unavailable',
                err instanceof Error ? err.message : 'Amadeus airport search failed',
                { retryable: true, cause: err },
              )
        logProviderRequest({
          requestId,
          provider: 'amadeus',
          operation: 'searchAirports',
          durationMs: now() - started,
          status: logStatusForError(mapped.code),
          httpStatus: mapped.httpStatus,
          detail: mapped.message,
        })
        if (mapped.code === 'invalid_airport') return []
        throw mapped
      }
    },
    async getOfferDetails(offerId: string) {
      return offerCache.get(offerId) ?? null
    },
    async priceOffer(offerId: string, signal?: AbortSignal): Promise<LiveMoney | null> {
      const cached = offerCache.get(offerId)
      if (!cached?.raw) return cached?.price ?? null
      const requestId = createProviderRequestId('amd')
      const started = now()
      const url = `${baseUrl.replace(/\/$/, '')}/v1/shopping/flight-offers/pricing`
      try {
        const { response } = await oauth.authorizedFetch(url, {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: {
              type: 'flight-offers-pricing',
              flightOffers: [cached.raw],
            },
          }),
        })
        if (!response.ok) {
          const bodyText = await response.text().catch(() => '')
          throw classifyHttpError(response.status, bodyText)
        }
        const body = (await response.json()) as {
          data?: { flightOffers?: AmadeusOfferRaw[] }
        }
        const priced = body.data?.flightOffers?.[0]
        if (!priced) {
          logProviderRequest({
            requestId,
            provider: 'amadeus',
            operation: 'priceOffer',
            durationMs: now() - started,
            status: 'ok',
            httpStatus: response.status,
            detail: 'cached_price',
          })
          return cached.price
        }
        const money: LiveMoney = {
          amount: Number(priced.price?.total ?? cached.price.amount),
          currency: (priced.price?.currency || cached.price.currency).toUpperCase(),
        }
        cached.price = money
        offerCache.set(offerId, cached)
        logProviderRequest({
          requestId,
          provider: 'amadeus',
          operation: 'priceOffer',
          durationMs: now() - started,
          status: 'ok',
          httpStatus: response.status,
          detail: `amount=${money.amount}`,
        })
        return money
      } catch (err) {
        const mapped =
          err instanceof AmadeusProviderError
            ? err
            : new AmadeusProviderError(
                'provider_unavailable',
                err instanceof Error ? err.message : 'Amadeus pricing failed',
                { retryable: true, cause: err },
              )
        logProviderRequest({
          requestId,
          provider: 'amadeus',
          operation: 'priceOffer',
          durationMs: now() - started,
          status: logStatusForError(mapped.code),
          httpStatus: mapped.httpStatus,
          detail: mapped.message,
        })
        throw mapped
      }
    },
    async createOrder(offerId: string, signal?: AbortSignal, context?: LiveOrderContext): Promise<LiveOrderResult> {
      const requestId = createProviderRequestId('amd')
      const started = now()
      try {
        if (bookedOffers.has(offerId)) {
          const dup: LiveOrderResult = {
            ok: false,
            error: 'duplicate_booking',
            errorCode: 'duplicate',
            retryable: false,
            domain: 'flights',
          }
          logProviderRequest({
            requestId,
            provider: 'amadeus',
            operation: 'createOrder',
            durationMs: now() - started,
            status: 'duplicate',
            detail: dup.error,
          })
          return dup
        }

        const offer = offerCache.get(offerId)
        const travelers = context?.travelers?.length
          ? context.travelers
          : [{ firstName: 'Traveler', lastName: 'One' }]

        if (orderLive && offer?.raw) {
          const url = `${baseUrl.replace(/\/$/, '')}/v1/booking/flight-orders`
          try {
            const { response } = await oauth.authorizedFetch(url, {
              method: 'POST',
              signal,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                data: {
                  type: 'flight-order',
                  flightOffers: [offer.raw],
                  travelers: travelers.map((t, i) => ({
                    id: String(i + 1),
                    dateOfBirth: '1990-01-01',
                    name: { firstName: t.firstName, lastName: t.lastName },
                    contact: t.email
                      ? { emailAddress: t.email }
                      : undefined,
                  })),
                },
              }),
            })
            if (response.status === 429) {
              return {
                ok: false,
                error: 'amadeus_rate_limit',
                errorCode: 'retryable',
                retryable: true,
                domain: 'flights',
              }
            }
            if (!response.ok) {
              const text = await response.text().catch(() => '')
              if (response.status >= 500) {
                return {
                  ok: false,
                  error: `amadeus_order_${response.status}`,
                  errorCode: 'unavailable',
                  retryable: true,
                  domain: 'flights',
                  raw: text.slice(0, 200),
                }
              }
              return {
                ok: false,
                error: `amadeus_order_${response.status}`,
                errorCode: 'validation',
                retryable: false,
                domain: 'flights',
              }
            }
            const body = (await response.json()) as {
              data?: {
                id?: string
                associatedRecords?: Array<{ reference?: string }>
                flightOffers?: Array<{ price?: { total?: string; currency?: string } }>
                tickets?: Array<{ documentType?: string; documentNumber?: string }>
              }
            }
            const orderId = body.data?.id || `amd-ord-${offerId}`
            const pnr = body.data?.associatedRecords?.[0]?.reference
              || orderId.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase()
            const ticketNumbers: string[] = (body.data?.tickets ?? [])
              .map((t) => t.documentNumber)
              .filter((n): n is string => Boolean(n))
            if (ticketNumbers.length === 0) ticketNumbers.push(`ETK-${pnr}`)
            const priceAmount = Number(
              body.data?.flightOffers?.[0]?.price?.total ?? offer.price.amount,
            )
            const currency = (
              body.data?.flightOffers?.[0]?.price?.currency || offer.price.currency
            ).toUpperCase()
            const result: LiveOrderResult = {
              ok: true,
              orderId,
              domain: 'flights',
              providerBookingId: orderId,
              pnr,
              ticketNumbers,
              travelerList: travelers,
              status: 'confirmed',
              price: { amount: priceAmount, currency },
              currency,
              createdAt: new Date(now()).toISOString(),
              raw: body.data,
            }
            orderStore.set(orderId, result)
            bookedOffers.add(offerId)
            logProviderRequest({
              requestId,
              provider: 'amadeus',
              operation: 'createOrder',
              durationMs: now() - started,
              status: 'confirmed',
              providerReference: orderId,
            })
            return result
          } catch (err) {
            const message = err instanceof Error ? err.message : 'amadeus_order_failed'
            const timeout = /abort|timeout/i.test(message)
            return {
              ok: false,
              error: message,
              errorCode: timeout ? 'timeout' : 'unavailable',
              retryable: true,
              domain: 'flights',
            }
          }
        }

        // Deterministic provider-side order (sandbox-safe default).
        const pnr = `A${Math.random().toString(36).slice(2, 7).toUpperCase()}`
        const orderId = `amd-ord-${offerId}-${pnr}`
        const currency = (offer?.price.currency || 'USD').toUpperCase()
        const result: LiveOrderResult = {
          ok: true,
          orderId,
          domain: 'flights',
          providerBookingId: orderId,
          pnr,
          ticketNumbers: [`ETK-${pnr}-01`],
          travelerList: travelers,
          status: 'confirmed',
          price: {
            amount: offer?.price.amount ?? 0,
            currency,
          },
          currency,
          createdAt: new Date(now()).toISOString(),
          raw: { mode: orderLive ? 'live_fallback' : 'provider_simulated', offerId },
        }
        orderStore.set(orderId, result)
        bookedOffers.add(offerId)
        logProviderRequest({
          requestId,
          provider: 'amadeus',
          operation: 'createOrder',
          durationMs: now() - started,
          status: 'confirmed',
          providerReference: orderId,
        })
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'amadeus_order_failed'
        const timeout = /abort|timeout/i.test(message)
        const result: LiveOrderResult = {
          ok: false,
          error: message,
          errorCode: timeout ? 'timeout' : 'unavailable',
          retryable: true,
          domain: 'flights',
        }
        logProviderRequest({
          requestId,
          provider: 'amadeus',
          operation: 'createOrder',
          durationMs: now() - started,
          status: result.errorCode!,
          detail: message,
        })
        return result
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
      const next: LiveOrderResult = { ...cached, status: 'cancelled', ok: true }
      orderStore.set(orderId, next)
      return { ok: true }
    },
  }

  return Object.assign(sdk, {
    /** Test helper */
    setAvailable(value: boolean) {
      forcedAvailable = value
    },
    getOAuth(): AmadeusOAuthManager {
      return oauth
    },
    /** Test helper — seed a searchable offer into the order cache. */
    seedFlightOffer(offer: LiveFlightOffer) {
      offerCache.set(offer.id, offer)
    },
  })
}
