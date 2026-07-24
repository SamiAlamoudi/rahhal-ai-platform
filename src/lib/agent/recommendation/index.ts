/**
 * Evolution Sprint 6 — Recommendation Intelligence Layer (additive).
 * Default OFF via `ai.recommendation_intelligence`. Not wired into planTurn.
 */

export type {
  RecommendationLocale,
  RecommendationAction,
  RecommendationCandidate,
  RecommendationEvidenceItem,
  ImpactAssessment,
  ScoredDimensions,
  RecommendationPackage,
  ExecutiveRecommendation,
  ShortRecommendation,
  DetailedRecommendation,
  ConsultantExplanation,
  RecommendationFormats,
  RecommendationEngineResult,
  RecommendationEngineInput,
} from './recommendationTypes'

export {
  isoNow,
  newId,
  clamp01,
  clampScore,
  uniqueStrings,
} from './recommendationTypes'

export {
  RECOMMENDATION_INTELLIGENCE_FEATURE_ID,
  isRecommendationIntelligenceEnabled,
} from './recommendationFeature'

export {
  RecommendationEvidence,
  collectEvidence,
  evidenceTexts,
} from './recommendationEvidence'

export {
  RecommendationScorer,
  ValueAnalyzer,
  RiskEvaluator,
  BenefitEvaluator,
  TradeoffEvaluator,
  OpportunityCostAnalyzer,
  scoreCandidate,
  analyzeValue,
  evaluateRisk,
  evaluateBenefits,
  evaluateTradeoffs,
  analyzeOpportunityCost,
} from './recommendationScorer'

export { ImpactAnalyzer, assessImpacts } from './impactAnalyzer'
export { AlternativeGenerator, generateAlternatives } from './alternativeGenerator'
export {
  DecisionJustifier,
  ConfidenceExplainer,
  justifyDecision,
  explainConfidence,
  challengeAssumptions,
  questionsForMissing,
} from './decisionJustifier'

export { RecommendationBuilder, buildRecommendationPackage } from './recommendationBuilder'
export {
  RecommendationNarrative,
  buildFormats,
  buildExecutive,
  buildShort,
  buildDetailed,
  buildConsultantExplanation,
} from './recommendationNarrative'
export { RecommendationComparator, compareCandidates, comparePackages } from './recommendationComparator'
export { RecommendationRevision, reviseRecommendation } from './recommendationRevision'
export { RecommendationSummary, summarizeRecommendation } from './recommendationSummary'
export {
  RecommendationEngine,
  runRecommendationEngine,
  tryRunRecommendationEngine,
} from './recommendationEngine'
