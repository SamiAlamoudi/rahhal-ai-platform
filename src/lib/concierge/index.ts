/**
 * AI Concierge — Conversation Intelligence layer.
 *
 * Sits above the travel agent / search engine. Provider-agnostic:
 * communicates only through agent abstractions.
 */

export {
  type ConciergePhase,
  type ConciergeAction,
  type ConciergeSoftSignals,
  type ConciergeState,
  type ConciergeTurnContext,
  type ConciergeTurnDecision,
  emptySoftSignals,
  emptyConciergeState,
} from './types'

export {
  mergeSoftSignals,
  hardMissingCount,
  hasSoftDepth,
  resolveConciergePhase,
  advanceConciergeState,
} from './dialogueState'

export { extractSoftSignals } from './softSignals'
export { decideConciergeTurn } from './turnPolicy'
export {
  evaluateConciergeValueOpportunity,
  shouldLeadWithValue,
  isBroadDestination,
  type ConciergeValueAssessment,
  type ConciergeValueConfidence,
  type ConciergeValueMode,
} from './decisionEngine'
export {
  recommendDestinationsForBudgetSeason,
  type BudgetSeasonRecommendation,
} from './budgetSeasonRecommendations'
export { buildConsultantReply, type ConsultantVoiceInput } from './consultantVoice'
export {
  buildConciergeRecommendations,
  type ConciergeRecommendationInput,
  type ConciergeRecommendationView,
} from './recommendationBridge'
export {
  resolveAgentHandoff,
  assertProviderAgnosticHandoff,
  type AgentHandoffMode,
  type AgentHandoffRequest,
} from './searchHandoff'
export {
  createConciergeService,
  conciergeService,
  type ConciergeService,
  type ConciergeServiceTurnInput,
  type ConciergeServiceTurnResult,
} from './conciergeService'
export {
  isConciergeState,
  conciergeStateFromMeta,
  rebuildConciergeStateFromMessages,
  withConciergeState,
} from './meta'
