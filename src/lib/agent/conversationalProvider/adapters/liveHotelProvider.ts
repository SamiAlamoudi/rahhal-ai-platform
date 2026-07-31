/**
 * Sprint 80 P1-3 — Live hotels adapter (wraps Integration Sprint 3 live path).
 */

import type { HotelSearchEngine } from '../../hotelSearchEngine'
import { nightsFromHotelContext } from '../../integrationHotelSearch/criteriaFromContext'
import {
  conversationHotelResultToToolData,
  tryConversationLiveHotelSearch,
  type ConversationHotelSearchDeps,
} from '../../integrationHotelSearch/conversationHotelSearch'
import { isLiveHotelSearchEnabled } from '../../liveHotelSearch/feature'
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

export type LiveHotelProviderDeps = {
  engine?: HotelSearchEngine
  getContext: () => AgentToolContext
  searchDeps?: ConversationHotelSearchDeps
  liveEnabled?: boolean
}

export function createLiveHotelConversationalProvider(
  deps: LiveHotelProviderDeps,
): ConversationalTravelProvider {
  return {
    providerId: 'live-hotels',
    domain: 'hotels',
    displayName: 'Live Hotel Search',
    capabilities: () => ({ domain: 'hotels', search: true, live: true }),
    isAvailable: (options) =>
      isLiveHotelSearchEnabled({
        enabled: options?.enabled ?? deps.liveEnabled ?? deps.searchDeps?.enabled,
      }),
    async search(request: UnifiedProviderRequest): Promise<UnifiedProviderSearchResult> {
      const started = Date.now()
      const ctx = deps.getContext()
      try {
        const live = await tryConversationLiveHotelSearch(ctx, {
          engine: deps.engine,
          enabled: true,
          ...deps.searchDeps,
        })
        if (!live) {
          return {
            ok: false,
            domain: 'hotels',
            providerId: 'live-hotels',
            mode: 'unavailable',
            offers: [],
            empty: true,
            latencyMs: Date.now() - started,
            toolData: { stays: [] },
            error: 'Live hotel search unavailable',
            errorCode: 'PROVIDER_UNAVAILABLE',
            gracefulMessage: GRACEFUL_CONVERSATIONAL_PROVIDER_MESSAGE,
          }
        }
        const tool = {
          data: conversationHotelResultToToolData(live, nightsFromHotelContext(ctx)),
          empty: live.empty,
          gracefulMessage: live.gracefulMessage,
        }
        return normalizeToUnifiedSearchResult({
          domain: 'hotels',
          providerId: 'live-hotels',
          mode: live.usedLive ? 'live' : 'mock',
          tool,
          latencyMs: Date.now() - started,
          ok: true,
        })
      } catch (err) {
        const classified = classifyConversationalProviderFailure('live-hotels', err)
        return {
          ok: false,
          domain: 'hotels',
          providerId: 'live-hotels',
          mode: 'live',
          offers: [],
          empty: true,
          latencyMs: Date.now() - started,
          toolData: {
            stays: [],
            conversationalProvider: {
              providerId: 'live-hotels',
              domain: 'hotels',
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
