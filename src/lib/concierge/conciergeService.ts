/**
 * Concierge turn orchestration — above the agent, never inside providers.
 *
 * Experience Sprint 2: Concierge returns policy/facts only.
 * Conversation Brain (LLM) writes every traveler-facing sentence.
 */

import type { AgentIntent, AgentLocale, AgentMemory, TripRequirements } from '../agent/types'
import {
  assertProviderAgnosticHandoff,
  resolveAgentHandoff,
  type AgentHandoffRequest,
} from './searchHandoff'
import { decideConciergeTurn } from './turnPolicy'
import type { ConciergeState, ConciergeTurnDecision } from './types'

export interface ConciergeServiceTurnInput {
  locale: AgentLocale
  memory: AgentMemory
  userText: string
  intent: AgentIntent
  requirements: TripRequirements
  missingFields: Array<keyof TripRequirements>
  previous: ConciergeState | null
}

export interface ConciergeServiceTurnResult {
  decision: ConciergeTurnDecision
  handoff: AgentHandoffRequest
  /**
   * Always null — Conversation Brain authors user-facing language.
   * Kept for API compatibility with older callers/tests.
   */
  reply: string | null
  state: ConciergeState
}

export interface ConciergeService {
  runTurn(input: ConciergeServiceTurnInput): ConciergeServiceTurnResult
}

export function createConciergeService(): ConciergeService {
  return {
    runTurn(input) {
      const decision = decideConciergeTurn({
        locale: input.locale,
        memory: input.memory,
        userText: input.userText,
        intent: input.intent,
        requirements: input.requirements,
        missingFields: input.missingFields,
        previous: input.previous,
      })

      const handoff = resolveAgentHandoff(decision)
      assertProviderAgnosticHandoff(handoff)

      return {
        decision,
        handoff,
        reply: null,
        state: decision.state,
      }
    },
  }
}

export const conciergeService = createConciergeService()
