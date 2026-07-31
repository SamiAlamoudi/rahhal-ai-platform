/**
 * Integration Sprint 3 — hotels tool entry (avoids circular imports with searchEngineBridge).
 *
 * Sprint 80 P1-3: when `ai.conversational_provider_unify` is ON, routes through the
 * unified conversational provider layer (same mock/live backends). Default OFF —
 * legacy path below is unchanged.
 */

import type { HotelSearchEngine } from '../hotelSearchEngine'
import {
  runUnifiedConversationHotelSearch,
  shouldUseConversationalProviderUnify,
  type UnifiedHotelBridgeDeps,
} from '../conversationalProvider/bridge'
import type { AgentToolContext } from '../tools/types'
import { runHotelSearchTool } from '../tools/searchEngineBridge'
import { nightsFromHotelContext } from './criteriaFromContext'
import {
  conversationHotelResultToToolData,
  tryConversationLiveHotelSearch,
  type ConversationHotelSearchDeps,
} from './conversationHotelSearch'

export async function runConversationAwareHotelSearch(
  engine: HotelSearchEngine,
  ctx: AgentToolContext,
  deps?: ConversationHotelSearchDeps & Pick<UnifiedHotelBridgeDeps, 'unifyEnabled'>,
): Promise<{ data: Record<string, unknown>; empty: boolean; gracefulMessage?: string }> {
  if (shouldUseConversationalProviderUnify(deps)) {
    return runUnifiedConversationHotelSearch(engine, ctx, deps)
  }

  const live = await tryConversationLiveHotelSearch(ctx, { engine, ...deps })
  if (live) {
    return {
      data: conversationHotelResultToToolData(live, nightsFromHotelContext(ctx)),
      empty: live.empty,
      gracefulMessage: live.gracefulMessage,
    }
  }
  return runHotelSearchTool(engine, ctx)
}
