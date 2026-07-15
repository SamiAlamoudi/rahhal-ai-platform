import { BookingComAdapter } from '../../../../../integrations/providers/booking/bookingComAdapter'
import { createProviderAdapter } from '../../baseAdapter'
import { normalizeProviderError, statusFromErrorCode } from '../../errors'
import type { AggregationQuery, ProviderAdapter, ProviderFetchResult } from '../../types'
import type { TravelSearchRequest } from '../../../../../utils/travelSearchRequest'
import {
  isBookingComConfigured,
  resolveBookingComProviderConfig,
  type BookingComProviderConfig,
} from './config'
import { hotelOffersToNormalizedOffers } from './normalizeToOffer'

export interface CreateBookingComProviderAdapterOptions {
  config?: Partial<BookingComProviderConfig>
  /** Injectable fetch for unit tests (no live RapidAPI). */
  deps?: {
    search?: (query: AggregationQuery, config: BookingComProviderConfig) => Promise<ProviderFetchResult>
  }
}

/**
 * Real Booking.com hotels ProviderAdapter for the agent aggregation layer.
 * TravelAgentService never imports this — only the Provider Registry does.
 */
export function createBookingComProviderAdapter(
  options: CreateBookingComProviderAdapterOptions = {},
): ProviderAdapter {
  const config = resolveBookingComProviderConfig(options.config)
  let client: BookingComAdapter | null = null

  const ensureClient = () => {
    if (!isBookingComConfigured(config) || !config.apiKey) {
      throw new Error('Booking.com provider is not configured')
    }
    if (!client) {
      client = new BookingComAdapter({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        rapidApiHost: config.rapidApiHost,
        timeout: config.timeoutMs,
        maxRetries: config.maxRetries,
      })
    }
    return client
  }

  return createProviderAdapter({
    metadata: {
      id: 'booking_com',
      displayName: 'Booking.com Hotels',
      domains: ['hotels'],
      priority: 95,
      reliability: 0.91,
      mocked: false,
      futureSlot: false,
    },
    isAvailable: () => isBookingComConfigured(config),
    capabilities: {
      features: ['search', 'stay_normalize', 'rapidapi', 'destination_lookup'],
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
      return searchBookingHotels(query, ensureClient)
    },
  })
}

async function searchBookingHotels(
  query: AggregationQuery,
  ensureClient: () => BookingComAdapter,
): Promise<ProviderFetchResult> {
  const started = Date.now()
  const providerId = 'booking_com'

  try {
    const client = ensureClient()
    const nights = Math.max(1, Number(query.input.nights ?? 3))
    const search = aggregationInputToTravelSearch(query.input, nights)
    const result = await client.searchHotels({ search })

    if (result.errors.length > 0 || !result.data) {
      const first = result.errors[0]
      const message = first?.message || 'Booking.com returned no hotel data'
      const code = mapBookingErrorCode(first?.code, first?.category)
      if (code === 'rate_limited') {
        return {
          providerId,
          status: 'rate_limited',
          items: [],
          error: message,
          errorCode: 'rate_limited',
          durationMs: Date.now() - started,
          retryAfterMs: 2_000,
        }
      }
      return {
        providerId,
        status: statusFromErrorCode(code),
        items: [],
        error: message,
        errorCode: code,
        durationMs: Date.now() - started,
      }
    }

    const items = hotelOffersToNormalizedOffers(result.data, providerId, nights)
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
    return {
      providerId,
      status: statusFromErrorCode(normalized.code),
      items: [],
      error: normalized.message,
      errorCode: normalized.code,
      durationMs: Date.now() - started,
      retryAfterMs: normalized.retryAfterMs,
    }
  }
}

function aggregationInputToTravelSearch(
  input: Record<string, unknown>,
  nights: number,
): TravelSearchRequest {
  const destination = String(input.destination ?? '')
  const travelers = Math.max(1, Number(input.travelers ?? 2))
  const checkIn = input.checkIn
    ? String(input.checkIn)
    : (input.startDate ? String(input.startDate) : defaultCheckIn())
  const checkOut = deriveCheckOut(checkIn, nights)

  return {
    destination,
    departureCity: String(input.origin ?? 'RUH'),
    departureDate: checkIn,
    returnDate: checkOut,
    durationDays: nights,
    travelers: {
      adults: travelers,
      children: 0,
      infants: 0,
      total: travelers,
      type: travelers === 1 ? 'solo' : 'group',
    },
    preferredCabin: 'economy',
    budgetCurrency: String(input.currency ?? 'USD'),
    budgetAmount: Number(input.budgetAmount ?? 0),
  } as TravelSearchRequest
}

function defaultCheckIn(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 14)
  return d.toISOString().slice(0, 10)
}

function deriveCheckOut(checkIn: string, nights: number): string {
  const d = new Date(`${checkIn}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return defaultCheckIn()
  d.setUTCDate(d.getUTCDate() + Math.max(1, nights))
  return d.toISOString().slice(0, 10)
}

function mapBookingErrorCode(
  code: string | undefined,
  category: string | undefined,
): import('../../types').ProviderErrorCode {
  if (code?.includes('RATE') || category === 'rate-limit') return 'rate_limited'
  if (code?.includes('TIMEOUT') || category === 'timeout') return 'timeout'
  if (code?.includes('AUTH') || category === 'auth') return 'unavailable'
  if (code?.includes('DEST') || category === 'validation') return 'invalid_input'
  return 'upstream_error'
}
