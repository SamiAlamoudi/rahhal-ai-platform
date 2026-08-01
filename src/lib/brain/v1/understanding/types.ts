/**
 * Sprint 89 Phase 1 — Understanding-core shared types.
 * Model-agnostic; aligns with docs/AI_CONTRACTS_v1.md (A–E, I–K subset).
 * No search / provider / booking / payment behavior.
 */

import type { BrainV1Entities, BrainV1Intent } from '../types'
import type { PreviewConversationStage } from '../contracts/previewContracts'
import type { MemoryFactProvenance, MemoryProvenanceMap } from '../preview/memory'

export const UNDERSTANDING_CONTRACT_VERSION = 'sprint89-phase1-understanding-1' as const

/** Brain Spec §3 cognitive states (internal only — never user-facing). */
export type BrainCognitiveState =
  | 'Idle'
  | 'Listening'
  | 'Understanding'
  | 'Reasoning'
  | 'Clarifying'
  | 'Searching'
  | 'Comparing'
  | 'Planning'
  | 'Advising'
  | 'Waiting'
  | 'Finished'
  | 'Recovery'

/** AI Contracts confidence levels (normative labels). */
export type UnderstandingConfidenceLevel =
  | 'confirmed'
  | 'high_confidence_inferred'
  | 'medium_confidence_inferred'
  | 'assumption'
  | 'unknown'
  | 'conflicting'
  | 'stale'

export type UnderstandingConfidence = {
  level: UnderstandingConfidenceLevel
  /** Optional 0–1 companion; level wins on conflict. */
  score: number | null
}

/** Consultant intents (AI Contracts IntentExtractor) — additive to BrainV1Intent. */
export type ConsultantIntent =
  | 'plan_trip'
  | 'refine_trip'
  | 'compare'
  | 'advise'
  | 'correct'
  | 'confirm'
  | 'abort'
  | 'explore_destination'
  | 'small_talk'
  | 'visa_guidance'
  | 'domain_flight'
  | 'domain_hotel'
  | 'domain_activity'
  | 'domain_car'
  | 'unknown'

export type EntityFactKind =
  | 'user_provided'
  | 'inferred'
  | 'assumption'
  | 'provider_result'
  | 'stale'
  | 'corrected'

export type ExtractedEntityFact = {
  field: string
  value: unknown
  kind: EntityFactKind
  confidence: UnderstandingConfidence
  /** Evidence snippet / cue — not chain-of-thought. */
  evidence: string | null
}

export type ReferenceKind =
  | 'destination'
  | 'origin'
  | 'date'
  | 'hotel'
  | 'budget'
  | 'airline'
  | 'person'
  | 'offer'
  | 'other'

export type ResolvedReference = {
  phrase: string
  field: string
  resolvesTo: string
  kind: ReferenceKind
  confidence: UnderstandingConfidence
  ambiguous: boolean
}

export type IntentExtractorResult = {
  contractVersion: typeof UNDERSTANDING_CONTRACT_VERSION
  primaryIntent: ConsultantIntent
  secondaryIntents: ConsultantIntent[]
  /** Compatibility mapping onto foundation BrainV1Intent. */
  legacyIntent: BrainV1Intent
  isCorrection: boolean
  isConfirmation: boolean
  confidence: UnderstandingConfidence
}

export type EntityExtractorResult = {
  contractVersion: typeof UNDERSTANDING_CONTRACT_VERSION
  entities: BrainV1Entities
  facts: ExtractedEntityFact[]
  /** Fields changed this turn vs prior. */
  revisedFields: string[]
}

export type ReferenceResolverResult = {
  contractVersion: typeof UNDERSTANDING_CONTRACT_VERSION
  resolved: ResolvedReference[]
  ambiguous: ResolvedReference[]
}

export type ConversationStateSnapshot = {
  contractVersion: typeof UNDERSTANDING_CONTRACT_VERSION
  brainState: BrainCognitiveState
  previewStage: PreviewConversationStage
  conversationId: string
  turnIndex: number
  pendingClarification: boolean
  activeTripId: string | null
  locale: 'ar' | 'en'
  lastConsultantIntent: ConsultantIntent | null
}

export type UnderstandingTurnInput = {
  text: string
  locale: 'ar' | 'en'
  conversationId: string
  turnId?: string
  source?: 'text' | 'voice_transcript' | 'system' | 'eval'
  priorEntities?: Partial<BrainV1Entities>
  priorState?: ConversationStateSnapshot | null
  /** Destination / origin / offer hints from memory for reference resolution. */
  memoryHints?: {
    destination?: string | null
    origin?: string | null
    budgetAmount?: number | null
    budgetCurrency?: string | null
    hotelPreference?: string | null
    preferredAirline?: string | null
    shortlistLabels?: string[]
    recentTexts?: string[]
  }
}

export type UnderstandingTurnResult = {
  contractVersion: typeof UNDERSTANDING_CONTRACT_VERSION
  intent: IntentExtractorResult
  entities: EntityExtractorResult
  references: ReferenceResolverResult
  state: ConversationStateSnapshot
  /** Proposed working-memory patch keys only — applied by MemoryManager. */
  memoryProposals: MemoryFactProvenance[]
  provenance: MemoryProvenanceMap
  /** Structured summary for eval/telemetry — never user-facing CoT. */
  summary: {
    consultantIntent: ConsultantIntent
    legacyIntent: BrainV1Intent
    entityFields: string[]
    resolvedReferenceCount: number
    ambiguousReferenceCount: number
    brainState: BrainCognitiveState
  }
}
