/**
 * Real Google Maps Platform ProviderAdapter for the agent aggregation layer.
 * TravelAgentService never imports this — only the Provider Registry does.
 *
 * Capabilities (canonical models only — no Google response objects leak):
 * destination search, city/airport/hotel/attraction/country lookup,
 * address + lat/lng normalization, timezone, distance, route duration.
 */

import { GoogleMapsApiClient } from '../../../../../integrations/providers/googleMaps/googleMapsApiClient'
import type {
  CanonicalLocation,
  CanonicalPlaceDetails,
  CanonicalPlaceSuggestion,
  CanonicalRouteLeg,
} from '../../../../../integrations/providers/googleMaps/types'
import { createProviderAdapter } from '../../baseAdapter'
import { normalizeProviderError, statusFromErrorCode } from '../../errors'
import type {
  AggregationQuery,
  ProviderAdapter,
  ProviderFetchResult,
} from '../../types'
import {
  isGoogleMapsConfigured,
  resolveGoogleMapsProviderConfig,
  type GoogleMapsProviderConfig,
} from './config'
import { routeLegsToNormalizedOffers } from './normalizeToOffer'

export interface CreateGoogleMapsProviderAdapterOptions {
  config?: Partial<GoogleMapsProviderConfig>
  /** Injectable fetch dependencies for tests. */
  deps?: {
    search?: (query: AggregationQuery, config: GoogleMapsProviderConfig) => Promise<ProviderFetchResult>
    client?: GoogleMapsApiClient
  }
}

/** Extended adapter surface for geolocation lookups (still never exposes Google types). */
export interface GoogleMapsProviderAdapter extends ProviderAdapter {
  searchDestination(query: string): Promise<CanonicalLocation[]>
  lookupCity(name: string): Promise<CanonicalLocation | null>
  lookupAirport(name: string): Promise<CanonicalLocation | null>
  lookupHotel(name: string, near?: string): Promise<CanonicalLocation | null>
  lookupAttraction(name: string, near?: string): Promise<CanonicalLocation | null>
  lookupCountry(name: string): Promise<CanonicalLocation | null>
  normalizeAddress(address: string): Promise<CanonicalLocation | null>
  normalizeCoordinates(lat: number, lng: number): Promise<CanonicalLocation | null>
  getTimezone(lat: number, lng: number): Promise<string | null>
  calculateDistance(from: string, to: string, mode?: string): Promise<CanonicalRouteLeg | null>
  estimateRouteDuration(from: string, to: string, mode?: string): Promise<number | null>
  autocomplete(input: string): Promise<CanonicalPlaceSuggestion[]>
  placeDetails(placeId: string): Promise<CanonicalPlaceDetails | null>
}

export function createGoogleMapsProviderAdapter(
  options: CreateGoogleMapsProviderAdapterOptions = {},
): GoogleMapsProviderAdapter {
  const config = resolveGoogleMapsProviderConfig(options.config)
  let client: GoogleMapsApiClient | null = options.deps?.client ?? null

  const ensureClient = (): GoogleMapsApiClient => {
    if (!isGoogleMapsConfigured(config) && !options.deps?.client) {
      throw new Error('Google Maps provider is not configured')
    }
    if (!client) {
      client = new GoogleMapsApiClient({
        apiKey: config.apiKey,
        proxyUrl: config.proxyUrl,
        invokeApiKey: config.invokeApiKey,
        timeoutMs: config.timeoutMs,
        maxRetries: config.maxRetries,
      })
    }
    return client
  }

  const base = createProviderAdapter({
    metadata: {
      id: 'google_maps',
      displayName: 'Google Maps Platform',
      domains: ['maps'],
      priority: 95,
      reliability: 0.94,
      mocked: false,
      futureSlot: false,
    },
    isAvailable: () => isGoogleMapsConfigured(config) || Boolean(options.deps?.search || options.deps?.client),
    capabilities: {
      features: [
        'geocode',
        'reverse_geocode',
        'place_search',
        'place_details',
        'autocomplete',
        'distance_matrix',
        'timezone',
        'coordinate_normalize',
        'destination_search',
        'city_lookup',
        'airport_lookup',
        'hotel_lookup',
        'attraction_lookup',
        'country_lookup',
        'route_legs',
        'directions',
      ],
      supportsSearch: true,
      supportsRealtime: true,
      rateLimitPerMinute: 60,
      mocked: false,
      futureSlot: false,
    },
    async fetch(query) {
      if (options.deps?.search) {
        return options.deps.search(query, config)
      }
      return searchGoogleMapsRoutes(query, ensureClient)
    },
  })

  const lookup = createLookupApi(ensureClient)

  return {
    ...base,
    ...lookup,
  }
}

function createLookupApi(ensureClient: () => GoogleMapsApiClient): Omit<GoogleMapsProviderAdapter, keyof ProviderAdapter> {
  return {
    async searchDestination(query) {
      const client = ensureClient()
      const places = await client.placeSearch(query)
      if (places.length > 0) return places
      return client.geocode(query)
    },
    async lookupCity(name) {
      return firstOf(async () => {
        const client = ensureClient()
        const places = await client.placeSearch(name, 'locality')
        const city = places.find((p) => p.types.includes('locality') || p.types.includes('administrative_area_level_1'))
        if (city) return withTimezone(client, city)
        const geocoded = await client.geocode(name)
        return withTimezone(client, geocoded[0] ?? null)
      })
    },
    async lookupAirport(name) {
      return firstOf(async () => {
        const client = ensureClient()
        const query = name.toLowerCase().includes('airport') ? name : `${name} airport`
        const places = await client.placeSearch(query, 'airport')
        const airport = places.find((p) => p.types.includes('airport')) ?? places[0] ?? null
        return withTimezone(client, airport)
      })
    },
    async lookupHotel(name, near) {
      return firstOf(async () => {
        const client = ensureClient()
        const query = near ? `${name} hotel ${near}` : `${name} hotel`
        const places = await client.placeSearch(query, 'lodging')
        return withTimezone(client, places[0] ?? null)
      })
    },
    async lookupAttraction(name, near) {
      return firstOf(async () => {
        const client = ensureClient()
        const query = near ? `${name} ${near}` : name
        const places = await client.placeSearch(query, 'tourist_attraction')
        return withTimezone(client, places[0] ?? null)
      })
    },
    async lookupCountry(name) {
      return firstOf(async () => {
        const client = ensureClient()
        const geocoded = await client.geocode(name)
        const country = geocoded.find((p) => p.types.includes('country')) ?? geocoded[0] ?? null
        return withTimezone(client, country)
      })
    },
    async normalizeAddress(address) {
      return firstOf(async () => {
        const client = ensureClient()
        const results = await client.geocode(address)
        return withTimezone(client, results[0] ?? null)
      })
    },
    async normalizeCoordinates(lat, lng) {
      return firstOf(async () => {
        const client = ensureClient()
        const results = await client.reverseGeocode(lat, lng)
        return withTimezone(client, results[0] ?? null)
      })
    },
    async getTimezone(lat, lng) {
      return ensureClient().timezone(lat, lng)
    },
    async calculateDistance(from, to, mode = 'transit') {
      const legs = await ensureClient().distanceMatrix({
        origins: [from],
        destinations: [to],
        mode,
      })
      return legs[0] ?? null
    },
    async estimateRouteDuration(from, to, mode = 'transit') {
      const legs = await ensureClient().distanceMatrix({
        origins: [from],
        destinations: [to],
        mode,
      })
      return legs[0]?.durationMinutes ?? null
    },
    async autocomplete(input) {
      return ensureClient().autocomplete(input)
    },
    async placeDetails(placeId) {
      return ensureClient().placeDetails(placeId)
    },
  }
}

async function searchGoogleMapsRoutes(
  query: AggregationQuery,
  ensureClient: () => GoogleMapsApiClient,
): Promise<ProviderFetchResult> {
  const started = Date.now()
  const providerId = 'google_maps'

  try {
    const client = ensureClient()
    const destination = String(query.input.destination ?? '').trim()
    const hubs = Array.isArray(query.input.hubs)
      ? query.input.hubs.map(String).map((h) => h.trim()).filter(Boolean)
      : []

    const points = hubs.length >= 2
      ? hubs
      : hubs.length === 1 && destination && hubs[0] !== destination
        ? [hubs[0], destination]
        : destination
          ? [destination, destination]
          : []

    if (points.length === 0) {
      return {
        providerId,
        status: 'error',
        items: [],
        error: 'destination or hubs required for maps search',
        errorCode: 'invalid_input',
        durationMs: Date.now() - started,
      }
    }

    // Resolve / normalize each hub via geocode when possible.
    const resolved: CanonicalLocation[] = []
    for (const point of points) {
      const geocoded = await client.geocode(point)
      const loc = geocoded[0] ?? null
      if (loc) {
        resolved.push(await withTimezone(client, loc) as CanonicalLocation)
      } else {
        resolved.push({
          label: point,
          name: point,
          formattedAddress: point,
          placeId: null,
          lat: null,
          lng: null,
          countryCode: null,
          country: null,
          city: null,
          types: [],
          timezoneId: null,
        })
      }
    }

    const mode = String(query.input.mode ?? 'transit')
    const legs: CanonicalRouteLeg[] = []

    if (resolved.length === 1 || (resolved.length === 2 && resolved[0].label === resolved[1].label)) {
      // Destination-only: emit a local orientation leg with normalized coordinates.
      const loc = resolved[0]
      legs.push({
        from: loc.label,
        to: loc.label,
        mode: 'lookup',
        distanceKm: 0,
        durationMinutes: 0,
        fromLocation: loc,
        toLocation: loc,
      })
    } else {
      for (let i = 0; i < resolved.length - 1; i += 1) {
        const from = resolved[i]
        const to = resolved[i + 1]
        const fromKey = coordsOrLabel(from)
        const toKey = coordsOrLabel(to)
        const matrix = await client.distanceMatrix({
          origins: [fromKey],
          destinations: [toKey],
          mode,
        })
        const leg = matrix[0]
        if (leg) {
          legs.push({
            ...leg,
            from: from.label,
            to: to.label,
            fromLocation: from,
            toLocation: to,
          })
        } else {
          // Geodesic fallback when Distance Matrix returns no element.
          const distanceKm = haversineKm(from, to) ?? 12
          legs.push({
            from: from.label,
            to: to.label,
            mode,
            distanceKm: Math.round(distanceKm * 10) / 10,
            durationMinutes: Math.max(1, Math.round(distanceKm * 3)),
            fromLocation: from,
            toLocation: to,
          })
        }
      }
    }

    const items = routeLegsToNormalizedOffers(legs, providerId)
    return {
      providerId,
      status: 'ok',
      items,
      error: null,
      errorCode: null,
      durationMs: Date.now() - started,
    }
  } catch (error) {
    const normalized = normalizeProviderError(error)
    const code = mapGoogleMapsErrorCode(error, normalized.code)
    return {
      providerId,
      status: statusFromErrorCode(code),
      items: [],
      error: normalized.message,
      errorCode: code,
      durationMs: Date.now() - started,
      retryAfterMs: code === 'rate_limited' ? (normalized.retryAfterMs ?? 2_000) : normalized.retryAfterMs,
    }
  }
}

async function withTimezone(
  client: GoogleMapsApiClient,
  location: CanonicalLocation | null,
): Promise<CanonicalLocation | null> {
  if (!location) return null
  if (location.timezoneId) return location
  if (location.lat == null || location.lng == null) return location
  try {
    const timezoneId = await client.timezone(location.lat, location.lng)
    return { ...location, timezoneId }
  } catch {
    return location
  }
}

async function firstOf<T>(fn: () => Promise<T>): Promise<T> {
  return fn()
}

function coordsOrLabel(location: CanonicalLocation): string {
  if (location.lat != null && location.lng != null) {
    return `${location.lat},${location.lng}`
  }
  return location.formattedAddress || location.label
}

function haversineKm(a: CanonicalLocation, b: CanonicalLocation): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function mapGoogleMapsErrorCode(
  error: unknown,
  fallback: import('../../types').ProviderErrorCode,
): import('../../types').ProviderErrorCode {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: string }).code)
    if (code === 'rate_limited') return 'rate_limited'
    if (code === 'unavailable') return 'unavailable'
    if (code === 'timeout') return 'timeout'
    if (code === 'upstream_error') return 'upstream_error'
  }
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('rate')) return 'rate_limited'
  if (message.includes('abort') || message.includes('timeout')) return 'timeout'
  return fallback
}
