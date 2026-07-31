/**
 * Sprint 80 P1-3 — Mock hotels adapter (wraps Hotel Search Engine tool path).
 */

import type { HotelSearchEngine } from '../../hotelSearchEngine'
import { runHotelSearchTool } from '../../tools/searchEngineBridge'
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

export type MockHotelProviderDeps = {
  engine: HotelSearchEngine
  getContext: () => AgentToolContext
}

export function createMockHotelConversationalProvider(
  deps: MockHotelProviderDeps,
): ConversationalTravelProvider {
  return {
    providerId: 'mock-hotels',
    domain: 'hotels',
    displayName: 'Mock Hotel Search Engine',
    capabilities: () => ({ domain: 'hotels', search: true, live: false }),
    isAvailable: () => true,
    async search(request: UnifiedProviderRequest): Promise<UnifiedProviderSearchResult> {
      const started = Date.now()
      try {
        const tool = await runHotelSearchTool(deps.engine, deps.getContext())
        return normalizeToUnifiedSearchResult({
          domain: 'hotels',
          providerId: 'mock-hotels',
          mode: 'mock',
          tool,
          latencyMs: Date.now() - started,
          ok: true,
        })
      } catch (err) {
        const classified = classifyConversationalProviderFailure('mock-hotels', err)
        return {
          ok: false,
          domain: 'hotels',
          providerId: 'mock-hotels',
          mode: 'mock',
          offers: [],
          empty: true,
          latencyMs: Date.now() - started,
          toolData: {
            stays: [],
            conversationalProvider: {
              providerId: 'mock-hotels',
              domain: 'hotels',
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
