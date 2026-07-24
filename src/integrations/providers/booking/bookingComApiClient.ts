import type { ProviderError } from '../../../utils/contracts/result'

export interface BookingComHotelResult {
  hotel_id: number
  hotel_name: string
  hotel_class: number
  review_score: number
  review_nr: number
  address: string
  city: string
  url: string
  photos: Array<{ url_original: string; url_max1080: string; url_1440: string; photo_id: number }>
  facilities: Array<{ hotel_facility_id: number; name: string }>
  room_data: Array<{
    room_id: number
    room_name: string
    room_config: string
    bed_configurations: Array<{
      bed_types: Array<{ name: string; count: number }>
    }>
  }>
  product_price: string
  currency_code: string
  product_price_breakdown: {
    product_price: string
    gross_amount_per_night: Array<{ amount: string }>
  }
  mealplan_included: boolean
  key_collection_info: { checkin_from: string; checkout_to: string }
  cancellation: string
  distance_to_city_center_km: number
  latitude: string
  longitude: string
}

export interface BookingComSearchResponse {
  result: BookingComHotelResult[]
  total_count: number
}

/** Raw destination entry from Booking.com RapidAPI searchDestination. */
export interface BookingComDestinationResult {
  dest_id: string | number
  search_type?: string
  dest_type?: string
  label?: string
  city_name?: string
  country?: string
  region?: string
  name?: string
  type?: string
}

export interface BookingComDestinationSearchResponse {
  data?: BookingComDestinationResult[] | { data?: BookingComDestinationResult[] }
  status?: boolean | number | string
  message?: string
}

export interface ResolvedBookingDestination {
  destId: number
  destType: 'city' | 'airport' | 'landmark' | 'region' | 'district' | 'hotel'
  label: string
  query: string
}

export interface HotelSearchQuery {
  destType: 'city' | 'airport' | 'landmark' | 'region' | 'district' | 'hotel'
  destId: number
  checkIn: string
  checkOut: string
  adults: number
  children: number
  rooms: number
  currency: string
  maxResults: number
}

export interface ApiClientConfig {
  /**
   * Server-side RapidAPI key for direct upstream calls (Node/tests).
   * Optional when `proxyUrl` + `invokeApiKey` are set (browser path).
   */
  apiKey?: string | null
  /** Edge Function / proxy URL — SPA must use this instead of shipping RapidAPI keys. */
  proxyUrl?: string | null
  /** Bearer / apikey for invoking the proxy (typically Supabase anon key). */
  invokeApiKey?: string | null
  baseUrl: string
  /** Value for the X-RapidAPI-Host header (direct mode only). */
  rapidApiHost: string
  timeout: number
  maxRetries: number
}

export interface ApiClientResult<T> {
  data: T | null
  error: ProviderError | null
  latency: number
  attempts: number
}

type LogLevel = 'info' | 'warn' | 'error'

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  const prefix = `[Booking:API:${level.toUpperCase()}]`
  const fn = level === 'info' ? console.log : level === 'warn' ? console.warn : console.error
  if (context && Object.keys(context).length > 0) {
    fn(prefix, ts, message, context)
  } else {
    fn(prefix, ts, message)
  }
}

function mapHttpError(status: number, body: string): ProviderError {
  const ts = new Date().toISOString()
  if (status === 401 || status === 403) {
    return { code: 'BOOKING_INVALID_KEY', category: 'auth', severity: 'fatal', message: `Invalid API key (${status}): ${body}`, retryable: false, timestamp: ts }
  }
  if (status === 429) {
    return { code: 'BOOKING_RATE_LIMITED', category: 'rate-limit', severity: 'warning', message: 'Rate limited (429)', retryable: true, timestamp: ts }
  }
  if (status >= 500) {
    return { code: 'BOOKING_SERVER_ERROR', category: 'provider', severity: 'error', message: `Server error (${status})`, retryable: true, timestamp: ts }
  }
  if (status === 400) {
    return { code: 'BOOKING_BAD_REQUEST', category: 'validation', severity: 'warning', message: `Bad request (400): ${body}`, retryable: false, timestamp: ts }
  }
  return { code: 'BOOKING_HTTP_ERROR', category: 'provider', severity: 'error', message: `HTTP ${status}: ${body}`, retryable: status >= 500, timestamp: ts }
}

function mapNetworkError(err: unknown): ProviderError {
  const ts = new Date().toISOString()
  const message = err instanceof Error ? err.message : 'Unknown network error'
  if (message.toLowerCase().includes('abort') || message.toLowerCase().includes('timeout')) {
    return { code: 'BOOKING_TIMEOUT', category: 'timeout', severity: 'error', message: 'Request timed out', retryable: true, timestamp: ts }
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError') || message.toLowerCase().includes('network')) {
    return { code: 'BOOKING_NETWORK_FAILURE', category: 'network', severity: 'error', message: `Network failure: ${message}`, retryable: true, timestamp: ts }
  }
  return { code: 'BOOKING_UNCAUGHT', category: 'unknown', severity: 'error', message, retryable: false, timestamp: ts }
}

export class BookingComApiClient {
  private config: ApiClientConfig

  constructor(config: ApiClientConfig) {
    this.config = config
  }

  private useProxy(): boolean {
    // Prefer direct server key when present (Node / Edge tests); SPA uses proxy only.
    if (this.config.apiKey) return false
    return Boolean(this.config.proxyUrl && this.config.invokeApiKey)
  }

  private headers(): Record<string, string> {
    if (!this.config.apiKey) {
      throw new Error('Booking.com API key is not configured for direct mode')
    }
    return {
      'X-RapidAPI-Key': this.config.apiKey,
      'X-RapidAPI-Host': this.config.rapidApiHost,
    }
  }

  private async fetchPath(
    path: string,
    query: Record<string, string>,
    signal: AbortSignal,
  ): Promise<Response> {
    if (this.useProxy()) {
      return fetch(this.config.proxyUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.invokeApiKey}`,
          apikey: this.config.invokeApiKey!,
        },
        body: JSON.stringify({ path, method: 'GET', query }),
        signal,
      })
    }
    const params = new URLSearchParams(query)
    const url = `${this.config.baseUrl}${path}?${params.toString()}`
    return fetch(url, {
      method: 'GET',
      headers: this.headers(),
      signal,
    })
  }

  /**
   * Resolve a free-text destination (city/place name) to Booking.com dest_id.
   * Endpoint: GET /hotels/searchDestination?query=...
   */
  async searchDestination(query: string): Promise<ApiClientResult<BookingComDestinationResult[]>> {
    const trimmed = query.trim()
    if (!trimmed) {
      return {
        data: null,
        error: {
          code: 'BOOKING_BAD_REQUEST',
          category: 'validation',
          severity: 'warning',
          message: 'Destination query is empty',
          retryable: false,
          timestamp: new Date().toISOString(),
        },
        latency: 0,
        attempts: 0,
      }
    }

    let lastError: ProviderError | null = null
    const maxAttempts = this.config.maxRetries + 1

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const start = Date.now()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      try {
        log('info', `Searching destination (attempt ${attempt})`, { query: trimmed })

        const response = await this.fetchPath(
          '/hotels/searchDestination',
          { query: trimmed },
          controller.signal,
        )
        clearTimeout(timeoutId)
        const latency = Date.now() - start

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          lastError = mapHttpError(response.status, body)
          log('warn', `HTTP ${response.status} on destination attempt ${attempt}`, { latency, error: lastError.code })
          if (!lastError.retryable || attempt >= maxAttempts) {
            return { data: null, error: lastError, latency, attempts: attempt }
          }
          continue
        }

        const raw = await response.json() as BookingComDestinationSearchResponse | BookingComDestinationResult[]
        const destinations = normalizeDestinationPayload(raw)
        log('info', 'Destinations received', { latency, count: destinations.length })
        return { data: destinations, error: null, latency, attempts: attempt }
      } catch (err) {
        clearTimeout(timeoutId)
        const latency = Date.now() - start
        lastError = mapNetworkError(err)
        log('error', `Destination request failed on attempt ${attempt}`, { latency, error: lastError.code })
        if (!lastError.retryable || attempt >= maxAttempts) {
          return { data: null, error: lastError, latency, attempts: attempt }
        }
      }
    }

    return { data: null, error: lastError, latency: 0, attempts: maxAttempts }
  }

  async searchHotels(query: HotelSearchQuery): Promise<ApiClientResult<BookingComSearchResponse>> {
    let lastError: ProviderError | null = null
    const maxAttempts = this.config.maxRetries + 1

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const start = Date.now()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      try {
        const queryParams: Record<string, string> = {
          dest_type: query.destType.trim(),
          dest_id: String(query.destId),
          checkin: query.checkIn,
          checkout: query.checkOut,
          adults: String(query.adults),
          children: String(query.children),
          room_qty: String(query.rooms),
          currency: query.currency,
          page_qty: String(Math.min(query.maxResults, 10)),
          units: 'metric',
          temperature_unit: 'c',
          order_by: 'popularity',
        }

        log('info', `Searching hotels (attempt ${attempt})`, { destId: query.destId, checkIn: query.checkIn })

        const response = await this.fetchPath('/hotels/search', queryParams, controller.signal)
        clearTimeout(timeoutId)
        const latency = Date.now() - start

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          lastError = mapHttpError(response.status, body)
          log('warn', `HTTP ${response.status} on attempt ${attempt}`, { latency, error: lastError.code })
          if (!lastError.retryable || attempt >= maxAttempts) {
            return { data: null, error: lastError, latency, attempts: attempt }
          }
          continue
        }

        const data = await response.json() as BookingComSearchResponse
        const totalLatency = Date.now() - start
        log('info', 'Hotels received', { latency: totalLatency, count: data.result?.length ?? 0 })
        return { data, error: null, latency: totalLatency, attempts: attempt }
      } catch (err) {
        clearTimeout(timeoutId)
        const latency = Date.now() - start
        lastError = mapNetworkError(err)
        log('error', `Request failed on attempt ${attempt}`, { latency, error: lastError.code })
        if (!lastError.retryable || attempt >= maxAttempts) {
          return { data: null, error: lastError, latency, attempts: attempt }
        }
      }
    }

    return { data: null, error: lastError, latency: 0, attempts: maxAttempts }
  }
}

/** Normalize varied RapidAPI response shapes into a flat destination list. */
export function normalizeDestinationPayload(
  raw: BookingComDestinationSearchResponse | BookingComDestinationResult[] | null | undefined,
): BookingComDestinationResult[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(isDestinationEntry)

  if (Array.isArray(raw.data)) {
    return raw.data.filter(isDestinationEntry)
  }

  if (raw.data && typeof raw.data === 'object' && Array.isArray(raw.data.data)) {
    return raw.data.data.filter(isDestinationEntry)
  }

  return []
}

function isDestinationEntry(value: unknown): value is BookingComDestinationResult {
  if (!value || typeof value !== 'object') return false
  const destId = (value as BookingComDestinationResult).dest_id
  return destId !== undefined && destId !== null && String(destId).trim() !== ''
}
