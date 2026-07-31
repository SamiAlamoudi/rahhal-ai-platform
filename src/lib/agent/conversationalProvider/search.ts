/**
 * Sprint 80 P1-3 — Unified conversational search orchestrator.
 * Registry → Resolver → Request Mapper → Provider.search → Response Normalizer.
 */

import type { FlightSearchEngine } from '../flightSearchEngine'
import type { HotelSearchEngine } from '../hotelSearchEngine'
import type { AgentToolContext } from '../tools/types'
import { createLiveFlightConversationalProvider } from './adapters/liveFlightProvider'
import { createLiveHotelConversationalProvider } from './adapters/liveHotelProvider'
import { createMockFlightConversationalProvider } from './adapters/mockFlightProvider'
import { createMockHotelConversationalProvider } from './adapters/mockHotelProvider'
import {
  ConversationalProviderError,
  GRACEFUL_CONVERSATIONAL_PROVIDER_MESSAGE,
  isRetryableConversationalProviderCode,
} from './errors'
import { createConversationalProviderRegistry, type ConversationalProviderRegistry } from './registry'
import { mapConversationalProviderRequest } from './requestMapper'
import {
  filterAvailableProviders,
  resolveConversationalProviders,
} from './resolver'
import { unifiedResultToToolSearchResult } from './responseNormalizer'
import type {
  ConversationalProviderDomain,
  ConversationalToolSearchResult,
  UnifiedProviderSearchResult,
} from './types'
import type { ConversationFlightSearchDeps } from '../integrationFlightSearch/conversationFlightSearch'
import type { ConversationHotelSearchDeps } from '../integrationHotelSearch/conversationHotelSearch'

export type RunConversationalProviderSearchOptions = {
  domain: ConversationalProviderDomain
  ctx: AgentToolContext
  flightEngine?: FlightSearchEngine
  hotelEngine?: HotelSearchEngine
  registry?: ConversationalProviderRegistry
  flightDeps?: ConversationFlightSearchDeps
  hotelDeps?: ConversationHotelSearchDeps
  liveFlightEnabled?: boolean
  liveHotelEnabled?: boolean
  preferLive?: boolean
  signal?: AbortSignal
}

export function buildDefaultConversationalProviderRegistry(input: {
  ctx: AgentToolContext
  flightEngine?: FlightSearchEngine
  hotelEngine?: HotelSearchEngine
  flightDeps?: ConversationFlightSearchDeps
  hotelDeps?: ConversationHotelSearchDeps
  liveFlightEnabled?: boolean
  liveHotelEnabled?: boolean
}): ConversationalProviderRegistry {
  const getContext = () => input.ctx
  const providers = []

  if (input.flightEngine) {
    providers.push(
      createMockFlightConversationalProvider({
        engine: input.flightEngine,
        getContext,
      }),
      createLiveFlightConversationalProvider({
        engine: input.flightEngine,
        getContext,
        searchDeps: input.flightDeps,
        liveEnabled: input.liveFlightEnabled,
      }),
    )
  }

  if (input.hotelEngine) {
    providers.push(
      createMockHotelConversationalProvider({
        engine: input.hotelEngine,
        getContext,
      }),
      createLiveHotelConversationalProvider({
        engine: input.hotelEngine,
        getContext,
        searchDeps: input.hotelDeps,
        liveEnabled: input.liveHotelEnabled,
      }),
    )
  }

  return createConversationalProviderRegistry(providers)
}

/**
 * Run a domain search through the unified provider layer.
 * Existing engines / live bridges remain the backends — no inventory changes.
 */
export async function runConversationalProviderSearch(
  options: RunConversationalProviderSearchOptions,
): Promise<UnifiedProviderSearchResult> {
  const registry =
    options.registry
    ?? buildDefaultConversationalProviderRegistry({
      ctx: options.ctx,
      flightEngine: options.flightEngine,
      hotelEngine: options.hotelEngine,
      flightDeps: options.flightDeps,
      hotelDeps: options.hotelDeps,
      liveFlightEnabled: options.liveFlightEnabled,
      liveHotelEnabled: options.liveHotelEnabled,
    })

  const request = mapConversationalProviderRequest({
    domain: options.domain,
    ctx: options.ctx,
    signal: options.signal,
  })

  const resolved = resolveConversationalProviders({
    domain: options.domain,
    registry,
    preferLive: options.preferLive,
    liveFlightEnabled: options.liveFlightEnabled ?? options.flightDeps?.enabled,
    liveHotelEnabled: options.liveHotelEnabled ?? options.hotelDeps?.enabled,
  })

  const available = await filterAvailableProviders(resolved.providers)
  if (available.length === 0) {
    throw new ConversationalProviderError({
      code: 'PROVIDER_UNAVAILABLE',
      message: `No conversational providers available for domain: ${options.domain}`,
      providerId: `resolver-${options.domain}`,
      retryable: true,
    })
  }

  let lastFailure: UnifiedProviderSearchResult | null = null

  for (const provider of available) {
    const result = await provider.search(request)
    if (result.ok) return result

    lastFailure = result
    const code = result.errorCode ?? 'UNKNOWN'
    if (!isRetryableConversationalProviderCode(code)) {
      return result
    }
  }

  return (
    lastFailure ?? {
      ok: false,
      domain: options.domain,
      providerId: available[0]?.providerId ?? `resolver-${options.domain}`,
      mode: 'unavailable',
      offers: [],
      empty: true,
      latencyMs: 0,
      toolData: {},
      error: 'All conversational providers failed',
      errorCode: 'PROVIDER_UNAVAILABLE',
      gracefulMessage: GRACEFUL_CONVERSATIONAL_PROVIDER_MESSAGE,
    }
  )
}

/** Tool-bridge shaped helper used when unify flag is ON. */
export async function runConversationalProviderToolSearch(
  options: RunConversationalProviderSearchOptions,
): Promise<ConversationalToolSearchResult> {
  const result = await runConversationalProviderSearch(options)
  return unifiedResultToToolSearchResult(result)
}
