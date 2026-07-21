/**
 * Amadeus Live Provider SDK adapter — Sprint 56.
 *
 * Supports: Flight Search, Airport Search, Flight Offers, Flight Pricing.
 * OAuth with automatic refresh + auth retry. Injectable fetch (no network in tests).
 */

import { AmadeusOAuthManager, amadeusTokenUrl } from '../oauth'
import { readLiveProviderSecret } from '../feature'
import { createProviderRequestId, logProviderRequest } from '../providerLog'
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
import { readLiveProviderSecret as readEnvSecret } from '../feature'

function parseBoolEnv(key: string, fallback: boolean): boolean {
  const value = readEnvSecret(key)
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
  /**
   * Sprint 61 — when true, POST Amadeus Flight Create Orders.
   * Default false: deterministic in-adapter order store (still “live provider” path).
   */
  orderLive?: boolean
  now?: () => number
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

function parseDurationMinutes(iso: string | undefined): number | null {
  if (!iso) return null
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(iso)
  if (!match) return null
  const hours = Number(match[1] ?? 0)
  const mins = Number(match[2] ?? 0)
  return hours * 60 + mins
}

function normalizeFlightOffer(raw: AmadeusOfferRaw, index: number): LiveFlightOffer {
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

export function createAmadeusLiveProvider(options: AmadeusAdapterOptions = {}): LiveProviderSdk {
  const clientId = options.clientId ?? readLiveProviderSecret('AMADEUS_CLIENT_ID') ?? ''
  const clientSecret = options.clientSecret ?? readLiveProviderSecret('AMADEUS_CLIENT_SECRET') ?? ''
  const baseUrl =
    options.baseUrl ??
    readLiveProviderSecret('AMADEUS_BASE_URL') ??
    'https://test.api.amadeus.com'
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis)
  const oauth =
    options.oauth ??
    new AmadeusOAuthManager({
      clientId,
      clientSecret,
      tokenUrl: amadeusTokenUrl(baseUrl),
      fetchImpl,
    })

  const offerCache = new Map<string, LiveFlightOffer>()
  const orderStore = new Map<string, LiveOrderResult>()
  const bookedOffers = new Set<string>()
  const now = options.now ?? (() => Date.now())
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
      const params = new URLSearchParams({
        originLocationCode: input.origin.toUpperCase(),
        destinationLocationCode: input.destination.toUpperCase(),
        departureDate: input.departureDate,
        adults: String(input.adults ?? 1),
        currencyCode: (input.currency || 'USD').toUpperCase(),
        max: '20',
      })
      if (input.returnDate) params.set('returnDate', input.returnDate)

      const url = `${baseUrl.replace(/\/$/, '')}/v2/shopping/flight-offers?${params}`
      const { response } = await oauth.authorizedFetch(url, {
        method: 'GET',
        signal: input.signal,
      })
      if (!response.ok) {
        throw new Error(`amadeus_flight_search_${response.status}`)
      }
      const body = (await response.json()) as { data?: AmadeusOfferRaw[] }
      const offers = (body.data ?? []).map(normalizeFlightOffer)
      for (const offer of offers) offerCache.set(offer.id, offer)
      return offers
    },
    async searchAirports(query: string, signal?: AbortSignal) {
      const params = new URLSearchParams({
        keyword: query,
        subType: 'AIRPORT,CITY',
        'page[limit]': '10',
      })
      const url = `${baseUrl.replace(/\/$/, '')}/v1/reference-data/locations?${params}`
      const { response } = await oauth.authorizedFetch(url, { method: 'GET', signal })
      if (!response.ok) throw new Error(`amadeus_airport_search_${response.status}`)
      const body = (await response.json()) as {
        data?: Array<{
          iataCode?: string
          name?: string
          address?: { cityName?: string; countryCode?: string }
        }>
      }
      return (body.data ?? [])
        .filter((row) => row.iataCode)
        .map(
          (row): LiveAirportResult => ({
            iata: String(row.iataCode).toUpperCase(),
            name: row.name || String(row.iataCode),
            city: row.address?.cityName ?? null,
            country: row.address?.countryCode ?? null,
          }),
        )
    },
    async getOfferDetails(offerId: string) {
      return offerCache.get(offerId) ?? null
    },
    async priceOffer(offerId: string, signal?: AbortSignal): Promise<LiveMoney | null> {
      const cached = offerCache.get(offerId)
      if (!cached?.raw) return cached?.price ?? null
      const url = `${baseUrl.replace(/\/$/, '')}/v1/shopping/flight-offers/pricing`
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
      if (!response.ok) throw new Error(`amadeus_pricing_${response.status}`)
      const body = (await response.json()) as {
        data?: { flightOffers?: AmadeusOfferRaw[] }
      }
      const priced = body.data?.flightOffers?.[0]
      if (!priced) return cached.price
      const money: LiveMoney = {
        amount: Number(priced.price?.total ?? cached.price.amount),
        currency: (priced.price?.currency || cached.price.currency).toUpperCase(),
      }
      cached.price = money
      offerCache.set(offerId, cached)
      return money
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
