import { AmadeusFlightApiClient } from '../../../../../integrations/providers/amadeus/amadeusFlightApiClient'
import { buildAmadeusFlightSearchQuery } from '../../../../../integrations/providers/amadeus/flightSearchModule'
import { normalizeAmadeusResponse } from '../../../../../integrations/providers/amadeus/flightNormalization'
import { createProviderAdapter } from '../../baseAdapter'
import { normalizeProviderError, statusFromErrorCode } from '../../errors'
import type { AggregationQuery, ProviderAdapter, ProviderFetchResult } from '../../types'
import { createAmadeusAuthClient, type AmadeusAuthClient } from './auth'
import {
  isAmadeusConfigured,
  resolveAmadeusProviderConfig,
  type AmadeusProviderConfig,
} from './config'
import { flightOffersToNormalizedOffers } from './normalizeToOffer'
import type { TravelSearchRequest } from '../../../../../utils/travelSearchRequest'

export interface CreateAmadeusProviderAdapterOptions {
  config?: Partial<AmadeusProviderConfig>
  /** Injectable fetch dependencies for tests. */
  deps?: {
    search?: (query: AggregationQuery, config: AmadeusProviderConfig) => Promise<ProviderFetchResult>
  }
}

/**
 * Real Amadeus flights ProviderAdapter for the agent aggregation layer.
 * TravelAgentService never imports this — only the Provider Registry does.
 */
export function createAmadeusProviderAdapter(
  options: CreateAmadeusProviderAdapterOptions = {},
): ProviderAdapter {
  const config = resolveAmadeusProviderConfig(options.config)
  let auth: AmadeusAuthClient | null = null
  let api: AmadeusFlightApiClient | null = null

  const ensureClients = () => {
    if (!isAmadeusConfigured(config)) {
      throw new Error('Amadeus provider is not configured')
    }
    if (!auth) auth = createAmadeusAuthClient(config)
    if (!api) {
      api = new AmadeusFlightApiClient(
        {
          baseUrl: config.baseUrl,
          timeout: config.timeoutMs,
          maxRetries: config.maxRetries,
        },
        auth as unknown as ConstructorParameters<typeof AmadeusFlightApiClient>[1],
      )
    }
    return { auth, api }
  }

  return createProviderAdapter({
    metadata: {
      id: 'amadeus',
      displayName: `Amadeus Flights (${config.environment})`,
      domains: ['flights'],
      priority: 95,
      reliability: 0.93,
      mocked: false,
      futureSlot: false,
    },
    isAvailable: () => isAmadeusConfigured(config),
    capabilities: {
      features: [
        'search',
        'offer_normalize',
        'oauth',
        'token_refresh',
        config.environment,
        config.clientId ? 'client_credentials' : 'token_proxy',
      ],
      supportsSearch: true,
      supportsRealtime: true,
      rateLimitPerMinute: 40,
      mocked: false,
      futureSlot: false,
    },
    async fetch(query) {
      if (options.deps?.search) {
        return options.deps.search(query, config)
      }
      return searchAmadeusFlights(query, ensureClients)
    },
  })
}

async function searchAmadeusFlights(
  query: AggregationQuery,
  ensureClients: () => { auth: AmadeusAuthClient; api: AmadeusFlightApiClient },
): Promise<ProviderFetchResult> {
  const started = Date.now()
  const providerId = 'amadeus'

  try {
    const { api } = ensureClients()
    const search = aggregationInputToTravelSearch(query.input)
    const built = await buildAmadeusFlightSearchQuery(api, search, { allowRemoteLookup: true })
    if (!built.query) {
      const message = built.errors[0]?.message || 'Could not resolve airports for Amadeus search'
      return {
        providerId,
        status: 'error',
        items: [],
        error: message,
        errorCode: 'invalid_input',
        durationMs: Date.now() - started,
      }
    }

    const result = await api.searchFlightOffers(built.query)
    if (result.error || !result.data) {
      const message = result.error?.message || 'Amadeus returned no flight data'
      const code = mapAmadeusErrorCode(result.error?.code, result.error?.category)
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

    const flightOffers = normalizeAmadeusResponse(result.data, providerId)
    const items = flightOffersToNormalizedOffers(flightOffers, providerId)
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

function aggregationInputToTravelSearch(input: Record<string, unknown>): TravelSearchRequest {
  const destination = String(input.destination ?? '')
  const origin = String(input.origin ?? 'RUH')
  const travelers = Math.max(1, Number(input.travelers ?? 1))
  const startDate = input.startDate ? String(input.startDate) : defaultDepartureDate()
  // Only fields consumed by buildAmadeusFlightSearchQuery are required here.
  return {
    destination,
    departureCity: origin,
    departureDate: startDate,
    returnDate: input.endDate ? String(input.endDate) : '',
    travelers: {
      adults: travelers,
      children: 0,
      infants: 0,
      total: travelers,
      type: travelers === 1 ? 'solo' : 'group',
    },
    preferredCabin: 'economy',
    budgetCurrency: String(input.currency ?? 'USD'),
  } as TravelSearchRequest
}

function defaultDepartureDate(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 14)
  return d.toISOString().slice(0, 10)
}

function mapAmadeusErrorCode(
  code: string | undefined,
  category: string | undefined,
): import('../../types').ProviderErrorCode {
  if (code?.includes('RATE') || category === 'rate-limit') return 'rate_limited'
  if (code?.includes('TIMEOUT') || category === 'timeout') return 'timeout'
  if (code?.includes('CREDENTIAL') || category === 'auth') return 'unavailable'
  return 'upstream_error'
}
