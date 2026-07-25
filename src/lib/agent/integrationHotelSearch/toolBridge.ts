/**
 * Integration Sprint 3 — hotels tool entry (avoids circular imports with searchEngineBridge).
 */

import type { HotelSearchEngine } from '../hotelSearchEngine'
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
  deps?: ConversationHotelSearchDeps,
): Promise<{ data: Record<string, unknown>; empty: boolean; gracefulMessage?: string }> {
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
