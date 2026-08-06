/**
 * Live flight provider — calls /api/bilamo-flights-search (server-side Amadeus).
 * Never reads AMADEUS_* secrets in the browser. Falls back to local demo inventory.
 */

import { createDemoFlightSearchProvider } from './demoProvider'
import { mapApiOffersToNormalized } from './mapFromLive'
import type { FlightSearchProvider } from './provider'
import type {
  BilamoFlightSearchRequest,
  FlightOfferDetails,
  FlightProviderHealth,
  FlightSearchProviderResult,
  NormalizedFlightOffer,
} from './types'

export type LiveFlightProviderOptions = {
  /** Override endpoint (tests). */
  endpoint?: string
  /** Inject auth header getter (Supabase access token). */
  getAccessToken?: () => Promise<string | null>
  /** Inject fetch for tests. */
  fetchImpl?: typeof fetch
  /** Graceful fallback when live fails. */
  fallbackToDemo?: boolean
  timeoutMs?: number
}

async function defaultAccessToken(): Promise<string | null> {
  try {
    const { supabase } = await import('../../supabaseClient')
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

function toApiBody(request: BilamoFlightSearchRequest): Record<string, unknown> {
  return {
    origin: request.origin,
    destination: request.destination,
    departureDate: request.departureDate,
    returnDate: request.returnDate ?? null,
    adults: request.adults,
    children: request.children ?? 0,
    infants: request.infants ?? 0,
    cabin: request.cabin ?? 'economy',
    directOnly: request.directOnly === true,
    preferredAirlines: request.preferredAirlines ?? [],
    maxStops: request.maxStops ?? null,
    currency: request.currency ?? 'SAR',
  }
}

export function createLiveFlightSearchProvider(
  options: LiveFlightProviderOptions = {},
): FlightSearchProvider {
  const endpoint = options.endpoint || '/api/bilamo-flights-search'
  const fetchImpl = options.fetchImpl || fetch
  const getAccessToken = options.getAccessToken || defaultAccessToken
  const fallbackToDemo = options.fallbackToDemo !== false
  const timeoutMs = options.timeoutMs ?? 12_000
  const catalog = new Map<string, NormalizedFlightOffer>()
  const demo = createDemoFlightSearchProvider()

  return {
    providerId: 'bilamo-live-flights',

    async searchFlights(request): Promise<FlightSearchProviderResult> {
      const started = Date.now()
      const controller = new AbortController()
      const onAbort = () => controller.abort()
      request.signal?.addEventListener('abort', onAbort)
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const token = await getAccessToken()
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (token) headers.Authorization = `Bearer ${token}`

        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(toApiBody(request)),
          signal: controller.signal,
        })

        const payload = await response.json().catch(() => ({})) as {
          ok?: boolean
          mode?: string
          offers?: Array<Record<string, unknown>>
          error?: string
          rateLimited?: boolean
          fallbackDemo?: boolean
        }

        if (!response.ok || !payload.ok || !Array.isArray(payload.offers) || payload.offers.length === 0) {
          if (fallbackToDemo) {
            const demoResult = await demo.searchFlights(request)
            return {
              ...demoResult,
              error: payload.error || `live_unavailable_${response.status}`,
              mode: 'demo',
            }
          }
          return {
            ok: false,
            mode: 'live',
            offers: [],
            error: payload.error || `live_http_${response.status}`,
            timedOut: false,
            rateLimited: payload.rateLimited === true || response.status === 429,
            latencyMs: Date.now() - started,
          }
        }

        const offers = mapApiOffersToNormalized(payload.offers)
        for (const offer of offers) catalog.set(offer.offerId, offer)
        const mode = payload.mode === 'demo' ? 'demo' : 'live'
        return {
          ok: true,
          mode,
          offers: mode === 'demo'
            ? offers.map((o) => ({ ...o, provider: 'demo' as const, meta: { demo: true, dataSource: 'demo' as const } }))
            : offers,
          error: payload.error || null,
          timedOut: false,
          rateLimited: payload.rateLimited === true,
          latencyMs: Date.now() - started,
        }
      } catch (err) {
        const timedOut = controller.signal.aborted
        if (fallbackToDemo) {
          const demoResult = await demo.searchFlights(request)
          return {
            ...demoResult,
            error: timedOut ? 'timeout' : (err instanceof Error ? err.message : 'live_failed'),
            timedOut,
            mode: 'demo',
          }
        }
        return {
          ok: false,
          mode: 'live',
          offers: [],
          error: timedOut ? 'timeout' : (err instanceof Error ? err.message : 'live_failed'),
          timedOut,
          rateLimited: false,
          latencyMs: Date.now() - started,
        }
      } finally {
        clearTimeout(timer)
        request.signal?.removeEventListener('abort', onAbort)
      }
    },

    async getOfferDetails(offerId): Promise<FlightOfferDetails | null> {
      const offer = catalog.get(offerId)
      if (!offer) return demo.getOfferDetails(offerId)
      return {
        offer,
        segments: [{
          airline: offer.airline,
          flightNumber: offer.flightNumber,
          origin: offer.origin,
          destination: offer.destination,
          departAt: offer.departAt,
          arriveAt: offer.arriveAt,
          durationMinutes: offer.durationMinutes,
        }],
      }
    },

    async healthCheck(): Promise<FlightProviderHealth> {
      try {
        const token = await getAccessToken()
        const headers: Record<string, string> = {}
        if (token) headers.Authorization = `Bearer ${token}`
        const response = await fetchImpl(endpoint, {
          method: 'GET',
          headers,
        })
        const payload = await response.json().catch(() => ({})) as {
          ok?: boolean
          detail?: string
          provider?: string
        }
        return {
          ok: response.ok && payload.ok !== false,
          mode: 'live',
          provider: payload.provider === 'amadeus' ? 'amadeus' : 'unknown',
          detail: payload.detail || (response.ok ? 'Live endpoint reachable' : 'Live endpoint unhealthy'),
          checkedAt: new Date().toISOString(),
        }
      } catch {
        return {
          ok: false,
          mode: 'live',
          provider: 'unknown',
          detail: 'Live endpoint unreachable',
          checkedAt: new Date().toISOString(),
        }
      }
    },
  }
}
