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
export { buildConsultantReply, type ConsultantVoiceInput } from './consultantVoice'
