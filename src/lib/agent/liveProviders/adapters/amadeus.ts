/**
 * Amadeus Live Provider SDK adapter — Sprint 56.
 *
 * Supports: Flight Search, Airport Search, Flight Offers, Flight Pricing.
 * OAuth with automatic refresh + auth retry. Injectable fetch (no network in tests).
 */

import { AmadeusOAuthManager, amadeusTokenUrl } from '../oauth'
import { readLiveProviderSecret } from '../feature'
import type {
  LiveAirportResult,
  LiveFetch,
  LiveFlightOffer,
  LiveFlightSearchInput,
  LiveMoney,
  LiveProviderCapabilities,
  LiveProviderSdk,
} from '../types'

export type AmadeusAdapterOptions = {
  clientId?: string
  clientSecret?: string
  baseUrl?: string
  fetchImpl?: LiveFetch
  available?: boolean
  oauth?: AmadeusOAuthManager
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
  }

  return Object.assign(sdk, {
    /** Test helper */
    setAvailable(value: boolean) {
      forcedAvailable = value
    },
    getOAuth(): AmadeusOAuthManager {
      return oauth
    },
  })
}
