import type {
  CanonicalLocation,
  CanonicalPlaceDetails,
  CanonicalPlaceSuggestion,
  CanonicalRouteLeg,
  GoogleMapsClientConfig,
  GoogleMapsOperation,
} from './types'

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'
const PLACES_TEXT_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
const PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json'
const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json'
const DISTANCE_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json'
const TIMEZONE_URL = 'https://maps.googleapis.com/maps/api/timezone/json'

export class GoogleMapsApiClient {
  private readonly config: GoogleMapsClientConfig
  private readonly fetchImpl: typeof fetch

  constructor(config: GoogleMapsClientConfig) {
    this.config = config
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis)
  }

  async geocode(address: string): Promise<CanonicalLocation[]> {
    const data = await this.request('geocode', { address })
    return parseGeocodeResults(data)
  }

  async reverseGeocode(lat: number, lng: number): Promise<CanonicalLocation[]> {
    const data = await this.request('reverse_geocode', { latlng: `${lat},${lng}` })
    return parseGeocodeResults(data)
  }

  async placeSearch(query: string, type?: string): Promise<CanonicalLocation[]> {
    const data = await this.request('place_search', { query, ...(type ? { type } : {}) })
    return parsePlaceSearchResults(data)
  }

  async placeDetails(placeId: string): Promise<CanonicalPlaceDetails | null> {
    const data = await this.request('place_details', {
      place_id: placeId,
      fields: 'place_id,name,formatted_address,geometry,address_component,types,international_phone_number,website,rating',
    })
    return parsePlaceDetails(data)
  }

  async autocomplete(input: string): Promise<CanonicalPlaceSuggestion[]> {
    const data = await this.request('autocomplete', { input })
    return parseAutocomplete(data)
  }

  async distanceMatrix(input: {
    origins: string[]
    destinations: string[]
    mode?: string
  }): Promise<CanonicalRouteLeg[]> {
    const data = await this.request('distance_matrix', {
      origins: input.origins.join('|'),
      destinations: input.destinations.join('|'),
      mode: input.mode || 'transit',
    })
    return parseDistanceMatrix(data, input.origins, input.destinations, input.mode || 'transit')
  }

  async timezone(lat: number, lng: number): Promise<string | null> {
    const data = await this.request('timezone', {
      location: `${lat},${lng}`,
      timestamp: Math.floor(Date.now() / 1000),
    })
    const row = data as { timeZoneId?: string; status?: string }
    if (row.status && row.status !== 'OK') return null
    return row.timeZoneId ?? null
  }

  private async request(
    operation: GoogleMapsOperation,
    params: Record<string, string | number>,
  ): Promise<Record<string, unknown>> {
    if (this.config.proxyUrl && this.config.invokeApiKey) {
      return this.requestViaProxy(operation, params)
    }
    if (!this.config.apiKey) {
      throw Object.assign(new Error('Google Maps API key is not configured'), {
        code: 'unavailable',
      })
    }
    return this.requestDirect(operation, params)
  }

  private async requestViaProxy(
    operation: GoogleMapsOperation,
    params: Record<string, string | number>,
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)
    try {
      const response = await this.fetchImpl(this.config.proxyUrl!, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.invokeApiKey}`,
          apikey: this.config.invokeApiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operation, params }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      const text = await response.text()
      if (response.status === 429) {
        throw Object.assign(new Error('rate_limited'), { code: 'rate_limited' })
      }
      if (!response.ok) {
        throw Object.assign(new Error(`Google Maps proxy failed (${response.status}): ${text}`), {
          code: response.status === 401 ? 'unavailable' : 'upstream_error',
        })
      }
      return JSON.parse(text) as Record<string, unknown>
    } catch (error) {
      clearTimeout(timer)
      throw error
    }
  }

  private async requestDirect(
    operation: GoogleMapsOperation,
    params: Record<string, string | number>,
  ): Promise<Record<string, unknown>> {
    const url = buildGoogleUrl(operation, params, this.config.apiKey!)
    let lastError: unknown
    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt += 1) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)
      try {
        const response = await this.fetchImpl(url, { signal: controller.signal })
        clearTimeout(timer)
        const text = await response.text()
        if (response.status === 429) {
          throw Object.assign(new Error('rate_limited'), { code: 'rate_limited' })
        }
        if (!response.ok) {
          throw Object.assign(new Error(`Google Maps HTTP ${response.status}: ${text}`), {
            code: 'upstream_error',
          })
        }
        const data = JSON.parse(text) as Record<string, unknown>
        const status = String(data.status ?? 'OK')
        if (status === 'OVER_QUERY_LIMIT' || status === 'RESOURCE_EXHAUSTED') {
          throw Object.assign(new Error('rate_limited'), { code: 'rate_limited' })
        }
        if (status === 'REQUEST_DENIED') {
          throw Object.assign(new Error('Google Maps request denied'), { code: 'unavailable' })
        }
        if (status !== 'OK' && status !== 'ZERO_RESULTS') {
          throw Object.assign(new Error(`Google Maps status ${status}`), { code: 'upstream_error' })
        }
        return data
      } catch (error) {
        clearTimeout(timer)
        lastError = error
        const retryable = isRetryable(error)
        if (!retryable || attempt > this.config.maxRetries) break
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }
}

function buildGoogleUrl(
  operation: GoogleMapsOperation,
  params: Record<string, string | number>,
  apiKey: string,
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) search.set(key, String(value))
  search.set('key', apiKey)
  const base = {
    geocode: GEOCODE_URL,
    reverse_geocode: GEOCODE_URL,
    place_search: PLACES_TEXT_URL,
    place_details: PLACE_DETAILS_URL,
    autocomplete: AUTOCOMPLETE_URL,
    distance_matrix: DISTANCE_URL,
    timezone: TIMEZONE_URL,
  }[operation]
  return `${base}?${search.toString()}`
}

function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return code === 'rate_limited'
    || code === 'upstream_error'
    || message.includes('timeout')
    || message.includes('abort')
    || message.includes('network')
}

function parseGeocodeResults(data: Record<string, unknown>): CanonicalLocation[] {
  const results = Array.isArray(data.results) ? data.results as Array<Record<string, unknown>> : []
  return results.map((row) => geocodeRowToLocation(row))
}

function parsePlaceSearchResults(data: Record<string, unknown>): CanonicalLocation[] {
  const results = Array.isArray(data.results) ? data.results as Array<Record<string, unknown>> : []
  return results.map((row) => placeRowToLocation(row))
}

function parsePlaceDetails(data: Record<string, unknown>): CanonicalPlaceDetails | null {
  const row = data.result as Record<string, unknown> | undefined
  if (!row) return null
  return {
    location: placeRowToLocation(row),
    phone: typeof row.international_phone_number === 'string' ? row.international_phone_number : null,
    website: typeof row.website === 'string' ? row.website : null,
    rating: typeof row.rating === 'number' ? row.rating : null,
  }
}

function parseAutocomplete(data: Record<string, unknown>): CanonicalPlaceSuggestion[] {
  const predictions = Array.isArray(data.predictions)
    ? data.predictions as Array<Record<string, unknown>>
    : []
  return predictions.map((row) => ({
    placeId: String(row.place_id ?? ''),
    description: String(row.description ?? ''),
    types: Array.isArray(row.types) ? row.types.map(String) : [],
  })).filter((row) => row.placeId)
}

function parseDistanceMatrix(
  data: Record<string, unknown>,
  origins: string[],
  destinations: string[],
  mode: string,
): CanonicalRouteLeg[] {
  const rows = Array.isArray(data.rows) ? data.rows as Array<Record<string, unknown>> : []
  const legs: CanonicalRouteLeg[] = []
  for (let i = 0; i < rows.length; i += 1) {
    const elements = Array.isArray(rows[i].elements)
      ? rows[i].elements as Array<Record<string, unknown>>
      : []
    for (let j = 0; j < elements.length; j += 1) {
      const el = elements[j]
      if (String(el.status ?? '') !== 'OK') continue
      const distance = el.distance as { value?: number } | undefined
      const duration = el.duration as { value?: number } | undefined
      const meters = Number(distance?.value ?? 0)
      const seconds = Number(duration?.value ?? 0)
      legs.push({
        from: origins[i] ?? `origin-${i}`,
        to: destinations[j] ?? `destination-${j}`,
        mode,
        distanceKm: Math.round((meters / 1000) * 10) / 10,
        durationMinutes: Math.max(1, Math.round(seconds / 60)),
        fromLocation: null,
        toLocation: null,
      })
    }
  }
  return legs
}

function geocodeRowToLocation(row: Record<string, unknown>): CanonicalLocation {
  const geometry = row.geometry as { location?: { lat?: number; lng?: number } } | undefined
  const components = Array.isArray(row.address_components)
    ? row.address_components as Array<Record<string, unknown>>
    : []
  const name = String(row.name ?? row.formatted_address ?? 'Location')
  const formattedAddress = typeof row.formatted_address === 'string' ? row.formatted_address : null
  return {
    label: formattedAddress ?? name,
    name,
    formattedAddress,
    placeId: typeof row.place_id === 'string' ? row.place_id : null,
    lat: typeof geometry?.location?.lat === 'number' ? geometry.location.lat : null,
    lng: typeof geometry?.location?.lng === 'number' ? geometry.location.lng : null,
    countryCode: findComponent(components, 'country', 'short'),
    country: findComponent(components, 'country', 'long'),
    city: findComponent(components, 'locality', 'long')
      || findComponent(components, 'administrative_area_level_1', 'long'),
    types: Array.isArray(row.types) ? row.types.map(String) : [],
    timezoneId: null,
  }
}

function placeRowToLocation(row: Record<string, unknown>): CanonicalLocation {
  const base = geocodeRowToLocation(row)
  const name = String(row.name ?? base.name)
  return {
    ...base,
    name,
    label: name,
  }
}

function findComponent(
  components: Array<Record<string, unknown>>,
  type: string,
  nameStyle: 'short' | 'long' = 'long',
): string | null {
  for (const component of components) {
    const types = Array.isArray(component.types) ? component.types.map(String) : []
    if (!types.includes(type)) continue
    if (nameStyle === 'short' && typeof component.short_name === 'string') return component.short_name
    if (typeof component.long_name === 'string') return component.long_name
  }
  return null
}
