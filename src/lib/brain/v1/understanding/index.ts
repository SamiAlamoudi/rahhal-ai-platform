/**
 * Sprint 89 Phase 1 — Understanding core public API.
 * Flags remain OFF; no search / provider / booking / payment.
 */

export {
  UNDERSTANDING_CONTRACT_VERSION,
  type BrainCognitiveState,
  type UnderstandingConfidenceLevel,
  type UnderstandingConfidence,
  type ConsultantIntent,
  type EntityFactKind,
  type ExtractedEntityFact,
  type ReferenceKind,
  type ResolvedReference,
  type IntentExtractorResult,
  type EntityExtractorResult,
  type ReferenceResolverResult,
  type ConversationStateSnapshot,
  type UnderstandingTurnInput,
  type UnderstandingTurnResult,
} from './types'

export { IntentExtractor, createIntentExtractor } from './IntentExtractor'
export {
  ProvenancedEntityExtractor,
  UnderstandingEntityExtractor,
  createProvenancedEntityExtractor,
} from './EntityExtractor'
export { ReferenceResolver, createReferenceResolver } from './ReferenceResolver'
export type { ReferenceResolverInput } from './ReferenceResolver'
export {
  mapLifecycleToBrainState,
  mapBrainStateToPreviewStage,
  mapPreviewStageToBrainState,
  createConversationStateSnapshot,
  advanceUnderstandingState,
} from './ConversationState'
export {
  UNDERSTANDING_MEMORY_MANAGER_VERSION,
  UnderstandingMemoryManager,
  createUnderstandingMemoryManager,
  type UnderstandingMemorySnapshot,
  type UnderstandingMemoryApplyResult,
} from './MemoryManager'
export {
  understandTurn,
  createUnderstandTurn,
  type UnderstandTurnDeps,
} from './understandTurn'
