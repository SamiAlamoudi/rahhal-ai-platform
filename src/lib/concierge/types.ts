/**
 * AI Concierge — Conversation Intelligence domain model.
 *
 * Architectural rule: Concierge is provider-agnostic.
 * It may only depend on agent abstractions (`TripRequirements`, `AgentMemory`,
 * `AgentIntent`, `TripPlan`). It must never import or name travel suppliers
 * (Amadeus, Duffel, Travelport, Sabre, Booking, Expedia, etc.).
 * Provider selection, orchestration, ranking, retries, and fallbacks stay
 * exclusively in the existing provider / aggregation layer.
 */

import type { AgentIntent, AgentLocale, AgentMemory, TripRequirements } from '../agent/types'

/** High-level consultant dialogue phases (above agent collect/plan/edit). */
export type ConciergePhase =
  | 'greeting'
  | 'discovery'
  | 'deepening'
  | 'advising'
  | 'confirming'
  | 'executing'
  | 'refining'

/** What the Concierge decides to do on a turn. */
export type ConciergeAction =
  | 'greet'
  | 'ask'
  | 'clarify'
  | 'advise'
  | 'propose_options'
  | 'confirm'
  | 'plan'
  | 'search'
  | 'refine'

/** Soft conversational signals — never used for provider routing. */
export interface ConciergeSoftSignals {
  /** Desired trip pace: relaxed / balanced / packed. */
  pace: 'relaxed' | 'balanced' | 'packed' | null
  /** Explicit must-haves from free text. */
  mustHaves: string[]
  /** Explicit deal-breakers / avoid list. */
  dealBreakers: string[]
  /** Open preferences the user left flexible. */
  flexibleDimensions: string[]
  /** Tradeoff hints the consultant may surface. */
  tradeoffs: string[]
  /** Free-form notes the consultant should remember. */
  notes: string[]
}

export interface ConciergeState {
  phase: ConciergePhase
  softSignals: ConciergeSoftSignals
  /** Last action taken by the Concierge. */
  lastAction: ConciergeAction | null
  /** Short acknowledgements of what the consultant has heard. */
  heardSummary: string[]
  /** Turn counter within this conversation (for greeting → discovery). */
  turnCount: number
}

export interface ConciergeTurnContext {
  locale: AgentLocale
  memory: AgentMemory
  userText: string
  intent: AgentIntent
  requirements: TripRequirements
  missingFields: Array<keyof TripRequirements>
  previous: ConciergeState | null
}

export interface ConciergeTurnDecision {
  action: ConciergeAction
  phase: ConciergePhase
  state: ConciergeState
  /** Fields the consultant should ask about next (may be empty). */
  askFields: Array<keyof TripRequirements>
  /** Whether the agent planning/search path should run this turn. */
  shouldExecuteAgent: boolean
  /** Optional consultant rationale (for tests / meta; not provider-related). */
  rationale: string
}

export function emptySoftSignals(): ConciergeSoftSignals {
  return {
    pace: null,
    mustHaves: [],
    dealBreakers: [],
    flexibleDimensions: [],
    tradeoffs: [],
    notes: [],
  }
}

export function emptyConciergeState(): ConciergeState {
  return {
    phase: 'greeting',
    softSignals: emptySoftSignals(),
    lastAction: null,
    heardSummary: [],
    turnCount: 0,
  }
}
