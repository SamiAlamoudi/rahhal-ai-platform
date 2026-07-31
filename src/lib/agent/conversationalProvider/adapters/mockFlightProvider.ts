/**
 * Sprint 80 P1-3 — Mock flights adapter (wraps Flight Search Engine tool path).
 */

import type { FlightSearchEngine } from '../../flightSearchEngine'
import { runFlightSearchTool } from '../../tools/searchEngineBridge'
import type { AgentToolContext } from '../../tools/types'
import {
  classifyConversationalProviderFailure,
  GRACEFUL_CONVERSATIONAL_PROVIDER_MESSAGE,
} from '../errors'
import { normalizeToUnifiedSearchResult } from '../responseNormalizer'
import type {
  ConversationalTravelProvider,
  UnifiedProviderRequest,
  UnifiedProviderSearchResult,
} from '../types'

export type MockFlightProviderDeps = {
  engine: FlightSearchEngine
  /** Original tool context — required to reuse runFlightSearchTool unchanged. */
  getContext: () => AgentToolContext
}

export function createMockFlightConversationalProvider(
  deps: MockFlightProviderDeps,
): ConversationalTravelProvider {
  return {
    providerId: 'mock-flights',
    domain: 'flights',
    displayName: 'Mock Flight Search Engine',
    capabilities: () => ({ domain: 'flights', search: true, live: false }),
    isAvailable: () => true,
    async search(request: UnifiedProviderRequest): Promise<UnifiedProviderSearchResult> {
      const started = Date.now()
      try {
        const tool = await runFlightSearchTool(deps.engine, deps.getContext())
        return normalizeToUnifiedSearchResult({
          domain: 'flights',
          providerId: 'mock-flights',
          mode: 'mock',
          tool,
          latencyMs: Date.now() - started,
          ok: true,
        })
      } catch (err) {
        const classified = classifyConversationalProviderFailure('mock-flights', err)
        return {
          ok: false,
          domain: 'flights',
          providerId: 'mock-flights',
          mode: 'mock',
          offers: [],
          empty: true,
          latencyMs: Date.now() - started,
          toolData: {
            offers: [],
            conversationalProvider: {
              providerId: 'mock-flights',
              domain: 'flights',
              mode: 'mock',
              requestDomain: request.domain,
            },
          },
          gracefulMessage: GRACEFUL_CONVERSATIONAL_PROVIDER_MESSAGE,
          error: classified.message,
          errorCode: classified.code,
        }
      }
    },
  }
}
