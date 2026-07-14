import type { ProviderError } from '../../../utils/contracts/result'

export interface RentalCarsSearchResult {
  vehicle_id: string
  vendor_name: string
  vendor_id: string
  vehicle_name: string
  category: string
  transmission: string
  fuel_type: string
  seats: number
  doors: number
  air_conditioning: boolean
  luggage_large: number
  luggage_small: number
  price_per_day: string
  currency: string
  total_price: string
  pickup_location: string
  dropoff_location: string
  unlimited_mileage: boolean
  insurance_included: boolean
  rating: number
  image_url: string
  booking_url: string
}

export interface RentalCarsSearchResponse {
  results: RentalCarsSearchResult[]
  total_count: number
  search_id: string
}

export interface RentalCarSearchQuery {
  pickupLocation: string
  dropoffLocation: string
  pickupDate: string
  dropoffDate: string
  pickupTime: string
  dropoffTime: string
  driverAge: number
  currency: string
  maxResults: number
}

export interface ApiClientConfig {
  apiKey: string
  baseUrl: string
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
  const prefix = `[RentalCars:API:${level.toUpperCase()}]`
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
    return { code: 'RENTAL_INVALID_KEY', category: 'auth', severity: 'fatal', message: `Invalid API key (${status}): ${body}`, retryable: false, timestamp: ts }
  }
  if (status === 429) {
    return { code: 'RENTAL_RATE_LIMITED', category: 'rate-limit', severity: 'warning', message: 'Rate limited (429)', retryable: true, timestamp: ts }
  }
  if (status >= 500) {
    return { code: 'RENTAL_SERVER_ERROR', category: 'provider', severity: 'error', message: `Server error (${status})`, retryable: true, timestamp: ts }
  }
  if (status === 400) {
    return { code: 'RENTAL_BAD_REQUEST', category: 'validation', severity: 'warning', message: `Bad request (400): ${body}`, retryable: false, timestamp: ts }
  }
  return { code: 'RENTAL_HTTP_ERROR', category: 'provider', severity: 'error', message: `HTTP ${status}: ${body}`, retryable: status >= 500, timestamp: ts }
}

function mapNetworkError(err: unknown): ProviderError {
  const ts = new Date().toISOString()
  const message = err instanceof Error ? err.message : 'Unknown network error'
  if (message.toLowerCase().includes('abort') || message.toLowerCase().includes('timeout')) {
    return { code: 'RENTAL_TIMEOUT', category: 'timeout', severity: 'error', message: 'Request timed out', retryable: true, timestamp: ts }
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError') || message.toLowerCase().includes('network')) {
    return { code: 'RENTAL_NETWORK_FAILURE', category: 'network', severity: 'error', message: `Network failure: ${message}`, retryable: true, timestamp: ts }
  }
  return { code: 'RENTAL_UNCAUGHT', category: 'unknown', severity: 'error', message, retryable: false, timestamp: ts }
}

export class RentalCarsApiClient {
  private config: ApiClientConfig

  constructor(config: ApiClientConfig) {
    this.config = config
  }

  async searchRentalCars(query: RentalCarSearchQuery): Promise<ApiClientResult<RentalCarsSearchResponse>> {
    let lastError: ProviderError | null = null
    const maxAttempts = this.config.maxRetries + 1

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const start = Date.now()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      try {
        const params = new URLSearchParams({
          pickup_location: query.pickupLocation,
          dropoff_location: query.dropoffLocation,
          pickup_date: query.pickupDate,
          dropoff_date: query.dropoffDate,
          pickup_time: query.pickupTime,
          dropoff_time: query.dropoffTime,
          driver_age: String(query.driverAge),
          currency: query.currency,
          page_size: String(Math.min(query.maxResults, 20)),
        })

        const url = `${this.config.baseUrl}/rentalcars/search?${params.toString()}`
        log('info', `Searching rental cars (attempt ${attempt})`, { pickup: query.pickupLocation, date: query.pickupDate })

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': this.config.apiKey,
            'X-RapidAPI-Host': 'rentalcars-api.p.rapidapi.com',
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

        const data = await response.json() as RentalCarsSearchResponse
        const totalLatency = Date.now() - start
        log('info', 'Rental cars received', { latency: totalLatency, count: data.results?.length ?? 0 })
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
