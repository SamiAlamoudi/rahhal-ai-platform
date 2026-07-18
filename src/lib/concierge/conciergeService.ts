/**
 * Concierge turn orchestration — above the agent, never inside providers.
 *
 * Flow:
 *   decide policy → (optional) recommendation framing → consultant reply
 *   OR signal agent handoff (plan/search/refine) without naming suppliers.
 */

import type { AgentIntent, AgentLocale, AgentMemory, TripRequirements } from '../agent/types'
import { buildConsultantReply } from './consultantVoice'
import { buildConciergeRecommendations } from './recommendationBridge'
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
  /** Consultant reply when Concierge owns the turn; null when agent should speak. */
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

      if (handoff.shouldExecuteAgent) {
        // Agent owns the structured plan/search reply.
        return {
          decision,
          handoff,
          reply: null,
          state: decision.state,
        }
      }

      let optionLines: string[] | undefined
      if (decision.action === 'propose_options' || decision.action === 'advise') {
        const recs = buildConciergeRecommendations({
          locale: input.locale,
          requirements: input.requirements,
          softSignals: decision.state.softSignals,
        })
        optionLines = recs.optionLines
      }

      const reply = buildConsultantReply({
        locale: input.locale,
        decision,
        requirements: input.requirements,
        userText: input.userText,
        optionLines,
      })

      return {
        decision,
        handoff,
        reply,
        state: decision.state,
      }
    },
  }
}

export const conciergeService = createConciergeService()
