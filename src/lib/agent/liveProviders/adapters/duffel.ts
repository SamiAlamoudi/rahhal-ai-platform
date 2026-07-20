/**
 * Duffel Live Provider SDK adapter — Sprint 56.
 *
 * Supports: Offer Search, Offer Details, Offer Pricing.
 * Order creation + cancellation are stubs (stable contracts for later).
 */

import { readLiveProviderSecret } from '../feature'
import type {
  LiveFetch,
  LiveFlightOffer,
  LiveFlightSearchInput,
  LiveMoney,
  LiveProviderCapabilities,
  LiveProviderSdk,
} from '../types'

export type DuffelAdapterOptions = {
  token?: string
  baseUrl?: string
  fetchImpl?: LiveFetch
  available?: boolean
}

type DuffelOfferRaw = {
  id?: string
  total_amount?: string
  total_currency?: string
  owner?: { name?: string; iata_code?: string }
  slices?: Array<{
    duration?: string
    segments?: Array<{
      originating_airport_iata_code?: string
      destination_airport_iata_code?: string
      departing_at?: string
      arriving_at?: string
      marketing_carrier?: { iata_code?: string }
      passengers?: Array<{ cabin_class?: string }>
    }>
  }>
  conditions?: { refund_before_departure?: { allowed?: boolean } }
}

const CAPABILITIES: LiveProviderCapabilities = {
  flights: true,
  hotels: false,
  activities: false,
  cars: false,
  transfers: false,
  insurance: false,
  airports: false,
}

function parseIsoDurationMinutes(iso: string | undefined): number | null {
  if (!iso) return null
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(iso)
  if (!match) return null
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)
}

function normalizeOffer(raw: DuffelOfferRaw, index: number): LiveFlightOffer {
  const segments = raw.slices?.[0]?.segments ?? []
  const first = segments[0]
  const last = segments[segments.length - 1]
  return {
    id: raw.id || `duffel-offer-${index}`,
    providerId: 'duffel',
    from: first?.originating_airport_iata_code || '',
    to: last?.destination_airport_iata_code || '',
    airline: first?.marketing_carrier?.iata_code ?? raw.owner?.iata_code ?? null,
    cabin: first?.passengers?.[0]?.cabin_class ?? null,
    stops: Math.max(0, segments.length - 1),
    durationMinutes: parseIsoDurationMinutes(raw.slices?.[0]?.duration),
    departureAt: first?.departing_at ?? null,
    arrivalAt: last?.arriving_at ?? null,
    price: {
      amount: Number(raw.total_amount ?? 0),
      currency: (raw.total_currency || 'USD').toUpperCase(),
    },
    refundable: raw.conditions?.refund_before_departure?.allowed ?? null,
    raw,
  }
}

export function createDuffelLiveProvider(options: DuffelAdapterOptions = {}): LiveProviderSdk {
  const token = options.token ?? readLiveProviderSecret('DUFFEL_API_TOKEN') ?? ''
  const baseUrl = (options.baseUrl ?? 'https://api.duffel.com').replace(/\/$/, '')
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis)
  const offerCache = new Map<string, LiveFlightOffer>()
  let forcedAvailable = options.available

  async function duffelFetch(path: string, init: RequestInit = {}): Promise<Response> {
    return fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Duffel-Version': 'v2',
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    })
  }

  const sdk: LiveProviderSdk = {
    providerId: 'duffel',
    displayName: 'Duffel',
    capabilities: CAPABILITIES,
    isAvailable() {
      if (typeof forcedAvailable === 'boolean') return forcedAvailable
      return Boolean(token)
    },
    async searchFlights(input: LiveFlightSearchInput) {
      const slices: Array<Record<string, unknown>> = [
        {
          origin: input.origin.toUpperCase(),
          destination: input.destination.toUpperCase(),
          departure_date: input.departureDate,
        },
      ]
      if (input.returnDate) {
        slices.push({
          origin: input.destination.toUpperCase(),
          destination: input.origin.toUpperCase(),
          departure_date: input.returnDate,
        })
      }
      const response = await duffelFetch('/air/offer_requests', {
        method: 'POST',
        signal: input.signal,
        body: JSON.stringify({
          data: {
            slices,
            passengers: Array.from({ length: input.adults ?? 1 }, () => ({ type: 'adult' })),
            cabin_class: 'economy',
          },
        }),
      })
      if (!response.ok) throw new Error(`duffel_offer_search_${response.status}`)
      const body = (await response.json()) as { data?: { offers?: DuffelOfferRaw[] } }
      const offers = (body.data?.offers ?? []).map(normalizeOffer)
      for (const offer of offers) offerCache.set(offer.id, offer)
      return offers
    },
    async getOfferDetails(offerId: string, signal?: AbortSignal) {
      const cached = offerCache.get(offerId)
      if (cached) return cached
      const response = await duffelFetch(`/air/offers/${encodeURIComponent(offerId)}`, {
        method: 'GET',
        signal,
      })
      if (!response.ok) throw new Error(`duffel_offer_details_${response.status}`)
      const body = (await response.json()) as { data?: DuffelOfferRaw }
      if (!body.data) return null
      const offer = normalizeOffer(body.data, 0)
      offerCache.set(offer.id, offer)
      return offer
    },
    async priceOffer(offerId: string, signal?: AbortSignal): Promise<LiveMoney | null> {
      const details = await sdk.getOfferDetails?.(offerId, signal)
      if (!details || !('price' in details)) return null
      // Duffel offer amounts are already priced at offer time.
      return details.price
    },
    async createOrder(offerId: string) {
      // Stub — stable contract for future live order creation.
      if (!offerCache.has(offerId) && !offerId) {
        return { ok: false, error: 'offer_not_found' }
      }
      return { ok: true, orderId: `duffel-order-stub-${offerId}` }
    },
    async cancelOrder(orderId: string) {
      // Stub — stable contract for future live cancellation.
      if (!orderId.startsWith('duffel-order-stub-') && !orderId.startsWith('duf_')) {
        return { ok: false, error: 'unknown_order' }
      }
      return { ok: true }
    },
  }

  return Object.assign(sdk, {
    setAvailable(value: boolean) {
      forcedAvailable = value
    },
  })
}
