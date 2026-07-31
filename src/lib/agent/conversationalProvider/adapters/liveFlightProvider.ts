/**
 * Sprint 80 P1-3 — Live flights adapter (wraps Integration Sprint 2 live path).
 */

import type { FlightSearchEngine } from '../../flightSearchEngine'
import {
  adultsFromContext,
  childrenFromContext,
} from '../../integrationFlightSearch/criteriaFromContext'
import {
  conversationResultToToolData,
  tryConversationLiveFlightSearch,
  type ConversationFlightSearchDeps,
} from '../../integrationFlightSearch/conversationFlightSearch'
import { isLiveFlightSearchEnabled } from '../../liveFlightSearch/feature'
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

export type LiveFlightProviderDeps = {
  engine?: FlightSearchEngine
  getContext: () => AgentToolContext
  searchDeps?: ConversationFlightSearchDeps
  liveEnabled?: boolean
}

export function createLiveFlightConversationalProvider(
  deps: LiveFlightProviderDeps,
): ConversationalTravelProvider {
  return {
    providerId: 'live-flights',
    domain: 'flights',
    displayName: 'Live Flight Search',
    capabilities: () => ({ domain: 'flights', search: true, live: true }),
    isAvailable: (options) =>
      isLiveFlightSearchEnabled({
        enabled: options?.enabled ?? deps.liveEnabled ?? deps.searchDeps?.enabled,
      }),
    async search(request: UnifiedProviderRequest): Promise<UnifiedProviderSearchResult> {
      const started = Date.now()
      const ctx = deps.getContext()
      try {
        const live = await tryConversationLiveFlightSearch(ctx, {
          engine: deps.engine,
          enabled: true,
          ...deps.searchDeps,
        })
        if (!live) {
          return {
            ok: false,
            domain: 'flights',
            providerId: 'live-flights',
            mode: 'unavailable',
            offers: [],
            empty: true,
            latencyMs: Date.now() - started,
            toolData: { offers: [] },
            error: 'Live flight search unavailable',
            errorCode: 'PROVIDER_UNAVAILABLE',
            gracefulMessage: GRACEFUL_CONVERSATIONAL_PROVIDER_MESSAGE,
          }
        }
        const adults = adultsFromContext(ctx)
        if (adults == null) {
          throw new Error('search_blocked_travelers_unconfirmed')
        }
        const travelers = adults + childrenFromContext(ctx)
        const tool = {
          data: conversationResultToToolData(live, travelers),
          empty: live.empty,
          gracefulMessage: live.gracefulMessage,
        }
        return normalizeToUnifiedSearchResult({
          domain: 'flights',
          providerId: 'live-flights',
          mode: live.usedLive ? 'live' : 'mock',
          tool,
          latencyMs: Date.now() - started,
          ok: true,
        })
      } catch (err) {
        const classified = classifyConversationalProviderFailure('live-flights', err)
        return {
          ok: false,
          domain: 'flights',
          providerId: 'live-flights',
          mode: 'live',
          offers: [],
          empty: true,
          latencyMs: Date.now() - started,
          toolData: {
            offers: [],
            conversationalProvider: {
              providerId: 'live-flights',
              domain: 'flights',
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
