/**
 * Sprint 80 P1-4 — Conversational flight live-provider pilot.
 *
 * Routes ONLY runConversationAwareFlightSearch through the unified provider
 * resolver using Amadeus LiveFlightProvider. On unavailable / timeout / auth /
 * parse failure, silently falls back to the legacy Flight Search Engine path.
 * Provider errors are never surfaced to the user.
 */

import type { FlightSearchEngine } from '../flightSearchEngine'
import type { ConversationFlightSearchDeps } from '../integrationFlightSearch/conversationFlightSearch'
import { runFlightSearchTool } from '../tools/searchEngineBridge'
import type { AgentToolContext } from '../tools/types'
import type { runLiveFlightSearch } from '../liveFlightSearch'
import {
  createAmadeusLiveFlightProvider,
  AMADEUS_LIVE_FLIGHT_PROVIDER_ID,
} from './adapters/amadeusLiveFlightProvider'
import { isLiveFlightProviderPilotEnabled } from './pilotFeature'
import { createConversationalProviderRegistry } from './registry'
import { mapConversationalProviderRequest } from './requestMapper'
import {
  filterAvailableProviders,
  resolveConversationalProviders,
} from './resolver'
import {
  createFlightPilotTelemetry,
  getFlightPilotTelemetry,
  type FlightPilotTelemetry,
} from './telemetry'
import type { ConversationalToolSearchResult, UnifiedProviderSearchResult } from './types'

export const LIVE_FLIGHT_PROVIDER_PILOT_VERSION = '1.0.0-live-flight-provider-pilot'

export type LiveFlightProviderPilotDeps = ConversationFlightSearchDeps & {
  /** Override pilot flag for tests. */
  pilotEnabled?: boolean
  /** Injectable Amadeus live runner. */
  runLive?: typeof runLiveFlightSearch
  telemetry?: FlightPilotTelemetry
}

const FALLBACK_ERROR_CODES = new Set([
  'PROVIDER_UNAVAILABLE',
  'TIMEOUT',
  'AUTH_FAILURE',
  'PARSE_FAILURE',
  'NETWORK_FAILURE',
  'RATE_LIMITED',
  'SERVER_ERROR',
  'DISABLED',
  'UNKNOWN',
])

export function shouldUseLiveFlightProviderPilot(
  deps?: { pilotEnabled?: boolean },
): boolean {
  return isLiveFlightProviderPilotEnabled({ enabled: deps?.pilotEnabled })
}

function stripProviderErrors(
  result: ConversationalToolSearchResult,
): ConversationalToolSearchResult {
  // Never expose provider / pilot internals in the tool payload.
  const data = { ...result.data }
  delete data.conversationalProvider
  delete data.pilotError
  delete data.providerError
  return {
    data,
    empty: result.empty,
    // Drop graceful messages that originated from provider failures.
    gracefulMessage: undefined,
  }
}

async function runLegacyFlightSearch(
  engine: FlightSearchEngine,
  ctx: AgentToolContext,
): Promise<ConversationalToolSearchResult> {
  const legacy = await runFlightSearchTool(engine, ctx)
  return {
    data: legacy.data,
    empty: legacy.empty,
    // Preserve engine diagnostics message only when it is not a live-provider leak.
    gracefulMessage: legacy.gracefulMessage,
  }
}

function shouldFallback(result: UnifiedProviderSearchResult): boolean {
  if (result.ok) return false
  const code = result.errorCode ?? 'UNKNOWN'
  // Invalid traveler/origin criteria should not soft-fallback into inventing inventory.
  if (code === 'INVALID_REQUEST') return false
  return FALLBACK_ERROR_CODES.has(code) || code === 'EMPTY_INVENTORY'
}

/**
 * Pilot entry used by runConversationAwareFlightSearch when the pilot flag is ON.
 */
export async function runLiveFlightProviderPilot(
  engine: FlightSearchEngine,
  ctx: AgentToolContext,
  deps?: LiveFlightProviderPilotDeps,
): Promise<ConversationalToolSearchResult> {
  const telemetry = deps?.telemetry ?? getFlightPilotTelemetry()
  const started = Date.now()
  const getContext = () => ctx

  const amadeus = createAmadeusLiveFlightProvider({
    getContext,
    runLive: deps?.runLive,
    available: true,
  })
  const registry = createConversationalProviderRegistry([amadeus])

  try {
    // Ensure request mapping uses the same builders as the unify layer.
    mapConversationalProviderRequest({ domain: 'flights', ctx })

    const resolved = resolveConversationalProviders({
      domain: 'flights',
      registry,
      preferLive: true,
      liveFlightEnabled: true,
      providerId: AMADEUS_LIVE_FLIGHT_PROVIDER_ID,
    })
    const available = await filterAvailableProviders(resolved.providers)
    const provider = available[0]

    if (!provider) {
      const legacy = await runLegacyFlightSearch(engine, ctx)
      telemetry.record({
        providerSelected: null,
        fallbackTriggered: true,
        latencyMs: Date.now() - started,
        ok: !legacy.empty,
        errorCode: 'PROVIDER_UNAVAILABLE',
        mode: 'legacy',
      })
      return stripProviderErrors(legacy)
    }

    const request = mapConversationalProviderRequest({ domain: 'flights', ctx })
    const liveResult = await provider.search(request)

    if (liveResult.ok) {
      telemetry.record({
        providerSelected: provider.providerId,
        fallbackTriggered: false,
        latencyMs: Date.now() - started,
        ok: true,
        errorCode: null,
        mode: 'live',
      })
      return stripProviderErrors({
        data: liveResult.toolData,
        empty: liveResult.empty,
        gracefulMessage: undefined,
      })
    }

    if (!shouldFallback(liveResult)) {
      // Blocked search (e.g. travelers unconfirmed) — rethrow via legacy semantics.
      telemetry.record({
        providerSelected: provider.providerId,
        fallbackTriggered: false,
        latencyMs: Date.now() - started,
        ok: false,
        errorCode: liveResult.errorCode ?? 'INVALID_REQUEST',
        mode: 'unavailable',
      })
      throw new Error(liveResult.error ?? 'search_blocked')
    }

    const legacy = await runLegacyFlightSearch(engine, ctx)
    telemetry.record({
      providerSelected: provider.providerId,
      fallbackTriggered: true,
      latencyMs: Date.now() - started,
      ok: !legacy.empty,
      errorCode: liveResult.errorCode ?? 'UNKNOWN',
      mode: 'legacy',
    })
    // Silent fallback — no provider error strings in the user-facing payload.
    return stripProviderErrors(legacy)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.startsWith('search_blocked_')) {
      telemetry.record({
        providerSelected: AMADEUS_LIVE_FLIGHT_PROVIDER_ID,
        fallbackTriggered: false,
        latencyMs: Date.now() - started,
        ok: false,
        errorCode: 'INVALID_REQUEST',
        mode: 'unavailable',
      })
      throw err
    }

    // Any unexpected pilot failure → silent legacy fallback.
    const legacy = await runLegacyFlightSearch(engine, ctx)
    telemetry.record({
      providerSelected: AMADEUS_LIVE_FLIGHT_PROVIDER_ID,
      fallbackTriggered: true,
      latencyMs: Date.now() - started,
      ok: !legacy.empty,
      errorCode: 'UNKNOWN',
      mode: 'legacy',
    })
    return stripProviderErrors(legacy)
  }
}

export { createFlightPilotTelemetry, getFlightPilotTelemetry }
