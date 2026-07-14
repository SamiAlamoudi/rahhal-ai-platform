import type { ProviderError } from '../../../utils/contracts/result'

export interface AmadeusFlightOffersResponse {
  meta: {
    count: number
    links?: { self?: string; next?: string; previous?: string }
    currency?: string
    defaults?: Record<string, unknown>
  }
  data: AmadeusFlightOffer[]
  dictionaries?: AmadeusDictionaries
}

export interface AmadeusFlightOffer {
  type: string
  id: string
  source: string
  instantTicketingRequired: boolean
  nonHomogeneous: boolean
  oneWay: boolean
  lastTicketingDate: string
  lastTicketingDateTime?: string
  numberOfBookableSeats: number
  itineraries: AmadeusItinerary[]
  price: AmadeusPrice
  pricingOptions?: AmadeusPricingOptions
  validatingAirlineCodes: string[]
  travelerPricings?: AmadeusTravelerPricing[]
}

export interface AmadeusItinerary {
  duration: string
  segments: AmadeusSegment[]
}

export interface AmadeusSegment {
  departure: { iataCode: string; at: string; terminal?: string }
  arrival: { iataCode: string; at: string; terminal?: string }
  carrierCode: string
  number: string
  aircraft?: { code: string }
  duration: string
  id: string
  numberOfStops: number
  blacklistedInEU?: boolean
  co2Emissions?: Array<{ weight: number; weightUnit: string; cabin: string }>
}

export interface AmadeusPrice {
  currency: string
  total: string
  base: string
  fees?: Array<{ amount: string; type: string }>
  grandTotal?: string
  billingFrequency?: string
}

export interface AmadeusPricingOptions {
  fareType: string
  includedCheckedBagsOnly: boolean
  refundableFare: boolean
  noRestrictionFare: boolean
  noPenaltyFare: boolean
  noChangeFees: boolean
}

export interface AmadeusTravelerPricing {
  travelerId: number
  fareOption: string
  travelerType: string
  price: AmadeusPrice
  fareDetailsBySegment?: AmadeusFareDetail[]
}

export interface AmadeusFareDetail {
  segmentId: string
  cabin: string
  fareBasis: string
  brandedFare?: string
  class: string
  includedCheckedBags?: { weight: number; weightUnit: string }
  amenities?: AmadeusAmenity[]
}

export interface AmadeusAmenity {
  code: string
  name: string
  amenityType: string
  isChargeable: boolean
}

export interface AmadeusDictionaries {
  carriers?: Record<string, string>
  aircraft?: Record<string, string>
  currencies?: Record<string, string>
  aircraftList?: Array<{ code: string; name: string }>
}

export interface FlightSearchQuery {
  origin: string
  destination: string
  departureDate: string
  adults: number
  cabin?: string
  currency?: string
  maxResults?: number
}

export interface ApiClientConfig {
  baseUrl: string
  timeout: number
  maxRetries: number
}

export interface ApiClientResult<T> {
  data: T | null
  error: ProviderError | null
  latency: number
  attempts: number
  tokenRefreshed: boolean
}

type LogLevel = 'info' | 'warn' | 'error'

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  const prefix = `[Amadeus:API:${level.toUpperCase()}]`
  const fn = level === 'info' ? console.log : level === 'warn' ? console.warn : console.error
  if (context && Object.keys(context).length > 0) {
    fn(prefix, ts, message, context)
  } else {
    fn(prefix, ts, message)
  }
}

function mapHttpError(status: number, body: string): ProviderError {
  const ts = new Date().toISOString()
  if (status === 401) {
    return { code: 'AMADEUS_TOKEN_EXPIRED', category: 'auth', severity: 'error', message: `Token expired or invalid (401): ${body}`, retryable: true, timestamp: ts }
  }
  if (status === 429) {
    return { code: 'AMADEUS_RATE_LIMITED', category: 'rate-limit', severity: 'warning', message: 'Rate limited (429)', retryable: true, timestamp: ts }
  }
  if (status >= 500) {
    return { code: 'AMADEUS_SERVER_ERROR', category: 'provider', severity: 'error', message: `Server error (${status})`, retryable: true, timestamp: ts }
  }
  if (status === 400) {
    return { code: 'AMADEUS_BAD_REQUEST', category: 'validation', severity: 'warning', message: `Bad request (400): ${body}`, retryable: false, timestamp: ts }
  }
  return { code: 'AMADEUS_HTTP_ERROR', category: 'provider', severity: 'error', message: `HTTP ${status}: ${body}`, retryable: status >= 500, timestamp: ts }
}

function mapNetworkError(err: unknown): ProviderError {
  const ts = new Date().toISOString()
  const message = err instanceof Error ? err.message : 'Unknown network error'
  if (message.toLowerCase().includes('abort') || message.toLowerCase().includes('timeout')) {
    return { code: 'AMADEUS_TIMEOUT', category: 'timeout', severity: 'error', message: 'Request timed out', retryable: true, timestamp: ts }
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError') || message.toLowerCase().includes('network')) {
    return { code: 'AMADEUS_NETWORK_FAILURE', category: 'network', severity: 'error', message: `Network failure: ${message}`, retryable: true, timestamp: ts }
  }
  return { code: 'AMADEUS_UNCAUGHT', category: 'unknown', severity: 'error', message, retryable: false, timestamp: ts }
}

import { AmadeusOAuthClient } from './amadeusOAuthClient'

export class AmadeusFlightApiClient {
  private config: ApiClientConfig
  private oauthClient: AmadeusOAuthClient

  constructor(
    config: ApiClientConfig,
    oauthClient: AmadeusOAuthClient,
  ) {
    this.config = config
    this.oauthClient = oauthClient
  }

  getOAuthClient(): AmadeusOAuthClient {
    return this.oauthClient
  }

  async searchFlightOffers(query: FlightSearchQuery): Promise<ApiClientResult<AmadeusFlightOffersResponse>> {
    let tokenRefreshed = false

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      const tokenResult = await this.oauthClient.getToken()
      if (tokenResult.error || !tokenResult.token) {
        return { data: null, error: tokenResult.error, latency: 0, attempts: attempt, tokenRefreshed: false }
      }

      const start = Date.now()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      try {
        const params = new URLSearchParams({
          originLocationCode: query.origin,
          destinationLocationCode: query.destination,
          departureDate: query.departureDate,
          adults: String(query.adults),
          max: String(query.maxResults ?? 10),
        })
        if (query.cabin) params.append('travelClass', query.cabin.toUpperCase())
        if (query.currency) params.append('currencyCode', query.currency)
        params.append('nonStop', 'false')

        const url = `${this.config.baseUrl}/shopping/flight-offers?${params.toString()}`
        log('info', `Searching flight offers (attempt ${attempt})`, { origin: query.origin, destination: query.destination })

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `${tokenResult.token.tokenType} ${tokenResult.token.accessToken}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        const latency = Date.now() - start

        if (response.status === 401 && attempt === 1) {
          log('warn', 'Token expired, clearing and refreshing')
          this.oauthClient.clearToken()
          tokenRefreshed = true
          continue
        }

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          const error = mapHttpError(response.status, body)
          log('warn', `HTTP ${response.status} on attempt ${attempt}`, { latency, error: error.code })
          if (!error.retryable || attempt > this.config.maxRetries) {
            return { data: null, error, latency, attempts: attempt, tokenRefreshed }
          }
          continue
        }

        const data = await response.json() as AmadeusFlightOffersResponse
        const totalLatency = Date.now() - start
        log('info', 'Flight offers received', { latency: totalLatency, count: data.data?.length ?? 0 })
        return { data, error: null, latency: totalLatency, attempts: attempt, tokenRefreshed }
      } catch (err) {
        clearTimeout(timeoutId)
        const latency = Date.now() - start
        const error = mapNetworkError(err)
        log('error', `Request failed on attempt ${attempt}`, { latency, error: error.code })
        if (!error.retryable || attempt > this.config.maxRetries) {
          return { data: null, error, latency, attempts: attempt, tokenRefreshed }
        }
      }
    }

    return { data: null, error: null, latency: 0, attempts: this.config.maxRetries + 1, tokenRefreshed }
  }
}
