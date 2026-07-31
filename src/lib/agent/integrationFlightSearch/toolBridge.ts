/**
 * Integration Sprint 2 — flights tool entry that prefers live search when flagged.
 * Kept outside searchEngineBridge to avoid circular imports.
 *
 * Sprint 80 P1-4: when `ai.live_flight_provider_pilot` is ON, routes through the
 * unified provider resolver (Amadeus LiveFlightProvider) with silent legacy
 * fallback. Default OFF — production path unchanged.
 *
 * Sprint 80 P1-3: when `ai.conversational_provider_unify` is ON, routes through the
 * unified conversational provider layer (same mock/live backends). Default OFF —
 * legacy path below is unchanged.
 */

import type { FlightSearchEngine } from '../flightSearchEngine'
import {
  runUnifiedConversationFlightSearch,
  shouldUseConversationalProviderUnify,
  type UnifiedFlightBridgeDeps,
} from '../conversationalProvider/bridge'
import {
  runLiveFlightProviderPilot,
  shouldUseLiveFlightProviderPilot,
  type LiveFlightProviderPilotDeps,
} from '../conversationalProvider/flightPilot'
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
  deps?: ConversationFlightSearchDeps
    & Pick<UnifiedFlightBridgeDeps, 'unifyEnabled'>
    & Pick<LiveFlightProviderPilotDeps, 'pilotEnabled' | 'runLive' | 'telemetry'>,
): Promise<{ data: Record<string, unknown>; empty: boolean; gracefulMessage?: string }> {
  // P1-4 pilot — flights only; hotels remain on their existing bridge.
  if (shouldUseLiveFlightProviderPilot(deps)) {
    return runLiveFlightProviderPilot(engine, ctx, deps)
  }

  if (shouldUseConversationalProviderUnify(deps)) {
    return runUnifiedConversationFlightSearch(engine, ctx, deps)
  }

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
