/**
 * Agent handoff helpers.
 *
 * Concierge may request that the *agent* plan or fulfill a search-shaped
 * request. It never calls provider registries, aggregation engines, or
 * named suppliers. The agent layer owns tools/providers/fallback.
 */

import type { ConciergeAction, ConciergeTurnDecision } from './types'

/** What the Concierge asks the agent to do — not which supplier. */
export type AgentHandoffMode = 'plan' | 'search' | 'refine' | 'none'

export interface AgentHandoffRequest {
  mode: AgentHandoffMode
  /** True when travelAgentService should run its existing execute path. */
  shouldExecuteAgent: boolean
  action: ConciergeAction
  rationale: string
}

export function resolveAgentHandoff(decision: ConciergeTurnDecision): AgentHandoffRequest {
  if (!decision.shouldExecuteAgent) {
    return {
      mode: 'none',
      shouldExecuteAgent: false,
      action: decision.action,
      rationale: decision.rationale,
    }
  }

  let mode: AgentHandoffMode = 'plan'
  if (decision.action === 'search') mode = 'search'
  else if (decision.action === 'refine') mode = 'refine'
  else if (decision.action === 'plan') mode = 'plan'

  return {
    mode,
    shouldExecuteAgent: true,
    action: decision.action,
    rationale: decision.rationale,
  }
}

/**
 * Guard: Concierge handoff payloads must not carry provider identifiers.
 * Used in tests and as a runtime sanity check before agent execution.
 */
export function assertProviderAgnosticHandoff(request: AgentHandoffRequest): void {
  const blob = `${request.mode} ${request.action} ${request.rationale}`.toLowerCase()
  const banned = [
    'amadeus',
    'duffel',
    'travelport',
    'sabre',
    'expedia',
    'booking.com',
    'rentalcars',
  ]
  for (const name of banned) {
    if (blob.includes(name)) {
      throw new Error(`Concierge handoff must remain provider-agnostic (found "${name}")`)
    }
  }
}
