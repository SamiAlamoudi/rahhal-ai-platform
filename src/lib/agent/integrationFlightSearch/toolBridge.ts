/**
 * Integration Sprint 2 — flights tool entry that prefers live search when flagged.
 * Kept outside searchEngineBridge to avoid circular imports.
 */

import type { FlightSearchEngine } from '../flightSearchEngine'
import type { AgentToolContext } from '../tools/types'
import { runFlightSearchTool } from '../tools/searchEngineBridge'
import {
  adultsFromContext,
  childrenFromContext,
} from './criteriaFromContext'
import {
  conversationResultToToolData,
  tryConversationLiveFlightSearch,
  type ConversationFlightSearchDeps,
} from './conversationFlightSearch'

export async function runConversationAwareFlightSearch(
  engine: FlightSearchEngine,
  ctx: AgentToolContext,
  deps?: ConversationFlightSearchDeps,
): Promise<{ data: Record<string, unknown>; empty: boolean; gracefulMessage?: string }> {
  const live = await tryConversationLiveFlightSearch(ctx, { engine, ...deps })
  if (live) {
    const adults = adultsFromContext(ctx)
    if (adults == null) {
      throw new Error('search_blocked_travelers_unconfirmed')
    }
    const travelers = adults + childrenFromContext(ctx)
    return {
      data: conversationResultToToolData(live, travelers),
      empty: live.empty,
      gracefulMessage: live.gracefulMessage,
    }
  }
  return runFlightSearchTool(engine, ctx)
}
