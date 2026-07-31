/**
 * Sprint 80 P1-3 — Optional toolBridge entry for the unify layer.
 * Only used when `ai.conversational_provider_unify` is ON.
 */

import type { FlightSearchEngine } from '../flightSearchEngine'
import type { HotelSearchEngine } from '../hotelSearchEngine'
import type { ConversationFlightSearchDeps } from '../integrationFlightSearch/conversationFlightSearch'
import type { ConversationHotelSearchDeps } from '../integrationHotelSearch/conversationHotelSearch'
import type { AgentToolContext } from '../tools/types'
import { isConversationalProviderUnifyEnabled } from './feature'
import { runConversationalProviderToolSearch } from './search'
import type { ConversationalToolSearchResult } from './types'

export type UnifiedFlightBridgeDeps = ConversationFlightSearchDeps & {
  /** Override unify flag for tests. */
  unifyEnabled?: boolean
}

export type UnifiedHotelBridgeDeps = ConversationHotelSearchDeps & {
  unifyEnabled?: boolean
}

export function shouldUseConversationalProviderUnify(
  deps?: { unifyEnabled?: boolean; enabled?: boolean },
): boolean {
  return isConversationalProviderUnifyEnabled({ enabled: deps?.unifyEnabled })
}

export async function runUnifiedConversationFlightSearch(
  engine: FlightSearchEngine,
  ctx: AgentToolContext,
  deps?: UnifiedFlightBridgeDeps,
): Promise<ConversationalToolSearchResult> {
  return runConversationalProviderToolSearch({
    domain: 'flights',
    ctx,
    flightEngine: engine,
    flightDeps: deps,
    liveFlightEnabled: deps?.enabled,
  })
}

export async function runUnifiedConversationHotelSearch(
  engine: HotelSearchEngine,
  ctx: AgentToolContext,
  deps?: UnifiedHotelBridgeDeps,
): Promise<ConversationalToolSearchResult> {
  return runConversationalProviderToolSearch({
    domain: 'hotels',
    ctx,
    hotelEngine: engine,
    hotelDeps: deps,
    liveHotelEnabled: deps?.enabled,
  })
}
