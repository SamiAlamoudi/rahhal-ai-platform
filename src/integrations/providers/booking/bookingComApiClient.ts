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

export interface HotelSearchQuery {
  destType: 'city' | 'airport' | ' landmark'
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
  apiKey: string
  baseUrl: string
  /** Value for the X-RapidAPI-Host header. */
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

  async searchHotels(query: HotelSearchQuery): Promise<ApiClientResult<BookingComSearchResponse>> {
    let lastError: ProviderError | null = null
    const maxAttempts = this.config.maxRetries + 1

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const start = Date.now()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      try {
        const params = new URLSearchParams({
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
        })

        const url = `${this.config.baseUrl}/hotels/search?${params.toString()}`
        log('info', `Searching hotels (attempt ${attempt})`, { destId: query.destId, checkIn: query.checkIn })

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': this.config.apiKey,
            'X-RapidAPI-Host': this.config.rapidApiHost,
          },
          signal: controller.signal,
        })
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
