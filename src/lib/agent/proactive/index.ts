/**
 * Phase 3 Stage 3 — Proactive Travel Advisor barrel.
 */

export type {
  ProactiveLocale,
  ProactiveSignalKind,
  ProactiveEvidenceSource,
  ProactiveEvidence,
  ProactiveVoiceHint,
  ProactiveKnowledgeRef,
  ProactiveMemoryAppend,
  ProactiveRecommendation,
  ProactiveContextBag,
  ProactiveDetectedSignal,
  ProactiveAdvisorInput,
  ProactiveAdvisorResult,
  ProactiveAdvisorMetaSnapshot,
} from './types'

export { clamp01, isoNow, uniqueStrings } from './types'

export {
  PROACTIVE_ADVISOR_FEATURE_ID,
  isProactiveAdvisorEnabled,
  PROACTIVE_SIGNAL_CATALOG,
  DEFAULT_MAX_PROACTIVE_RECOMMENDATIONS,
  ProactiveRegistry,
} from './proactiveRegistry'

export {
  PROACTIVE_SIGNAL_DEFINITIONS,
  getSignalDefinition,
  ProactiveSignals,
} from './proactiveSignals'
export type { ProactiveSignalDefinition } from './proactiveSignals'

export { buildProactiveContext, ProactiveContext } from './proactiveContext'

export { detectProactiveSignals, ProactiveDetector } from './proactiveDetector'

export {
  scoreProactiveConfidence,
  ProactiveConfidence,
} from './proactiveConfidence'
export type { ProactiveConfidenceResult } from './proactiveConfidence'

export {
  compareProactivePriority,
  computeProactivePriority,
  rankProactiveRecommendations,
  ProactivePriority,
} from './proactivePriority'

export {
  buildProactiveRecommendation,
  buildProactiveRecommendations,
  ProactiveRecommendationBuilder,
} from './proactiveRecommendation'

export {
  runProactiveAdvisor,
  tryRunProactiveAdvisor,
  enrichTurnWithProactiveAdvisor,
  ProactiveAdvisor,
} from './proactiveAdvisor'
export type {
  ProactiveTurnLike,
  ProactiveTurnOptions,
} from './proactiveAdvisor'
