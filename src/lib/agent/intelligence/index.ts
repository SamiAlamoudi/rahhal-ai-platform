/**
 * Phase 3 Stage 4 — Travel Intelligence Layer barrel.
 *
 * Isolated evaluation package. Not wired into planTurn.
 */

export type {
  IntelligenceLocale,
  IntelligenceDimension,
  IntelligenceEvidence,
  TravelVoiceSummary,
  KnowledgeReference,
  IntelligenceMemoryAppend,
  TravelAlternative,
  DimensionScore,
  AlternativeComparison,
  TradeoffInsight,
  IntelligenceRankedRecommendation,
  IntelligenceContext,
  TravelIntelligenceInput,
  TravelIntelligenceResult,
  TravelIntelligenceMetaSnapshot,
} from './types'

export { clamp01, uniqueStrings, isoNow } from './types'

export {
  TRAVEL_INTELLIGENCE_FEATURE_ID,
  isTravelIntelligenceEnabled,
  INTELLIGENCE_DIMENSIONS,
  DEFAULT_MAX_ALTERNATIVES,
  IntelligenceRegistry,
} from './intelligenceRegistry'

export {
  generateTravelAlternatives,
  buildIntelligenceContext,
  AlternativeGenerator,
} from './alternativeGenerator'

export {
  scoreAlternativeDimensions,
  compareTravelAlternatives,
  TravelComparator,
} from './travelComparator'

export {
  resolveDecisionWeights,
  scoreTravelDecision,
  scoreAllDecisions,
  DecisionScoring,
} from './decisionScoring'

export {
  calculateIntelligenceConfidence,
  ConfidenceEngine,
} from './confidenceEngine'
export type { IntelligenceConfidenceResult } from './confidenceEngine'

export {
  analyzeTravelTradeoffs,
  TradeoffAnalyzer,
} from './tradeoffAnalyzer'

export {
  rankTravelAlternatives,
  RankingEngine,
} from './rankingEngine'

export {
  buildAlternativeJustifications,
  buildIntelligenceExplanation,
  buildTravelVoiceSummary,
  buildKnowledgeReferences,
  buildIntelligenceMemoryAppend,
  ExplanationBuilder,
} from './explanationBuilder'

export {
  runTravelIntelligence,
  tryRunTravelIntelligence,
  enrichTurnWithTravelIntelligence,
  TravelIntelligence,
} from './travelIntelligence'
export type {
  IntelligenceTurnLike,
  IntelligenceTurnOptions,
} from './travelIntelligence'
