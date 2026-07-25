/**
 * Sprint 45 — Autonomous Travel Reasoning Engine (production agent path).
 * Evolution Sprint 1 — Consultant Reasoning Layer (additive; default OFF).
 */

export type {
  ClimateBand,
  VisaEase,
  DestinationClimateProfile,
  DestinationCandidate,
  TravelReasoningResult,
  TravelReasoningInput,
  TravelReasoningSnapshot,
} from './types'

export { DESTINATION_CATALOG, findDestinationProfile } from './destinationCatalog'
export {
  detectOpenEndedDestination,
  climateFromPreference,
} from './openEndedDetector'
export {
  runTravelReasoning,
  toReasoningSnapshot,
  applyReasoningToRequirements,
  matchDestinationSelection,
} from './travelReasoningEngine'
export { formatReasoningReply } from './formatReasoningReply'
export {
  seedRequirementsFromPreferences,
  learnPreferencesFromRequirements,
  applyProfileToRequirements,
  isPreferenceMemoryEnabled,
} from './preferenceBridge'
export { isTravelReasoningEnabled } from './feature'
export { buildVisaGuidance } from './visaIntelligence'
export { buildTravelAdvisory } from './travelAdvisory'
export type { VisaGuidance } from './types'

/* ── Evolution Sprint 1: Consultant Reasoning Layer (additive) ── */

export type {
  ReasoningSlice,
  ConsultantLocale,
  ConsultantReasoningInput,
  TravelerIntentResult,
  TravelerProfileResult,
  ConstraintAnalyzerResult,
  DestinationReasonerResult,
  BudgetReasonerResult,
  RiskReasonerResult,
  ValueReasonerResult,
  RecommendationReasonerResult,
  ExplanationResult,
  ConsultantReasoningPipelineResult,
} from './consultantTypes'

export { emptySlice, clamp01, clampScore } from './consultantTypes'
export {
  CONSULTANT_REASONING_FEATURE_ID,
  isConsultantReasoningEnabled,
} from './consultantFeature'
export {
  analyzeTravelerIntent,
  TravelerIntentAnalyzer,
} from './travelerIntentAnalyzer'
export {
  buildTravelerProfile,
  TravelerProfileBuilder,
} from './travelerProfileBuilder'
export {
  analyzeConstraints,
  ConstraintAnalyzer,
} from './constraintAnalyzer'
export {
  reasonAboutDestination,
  DestinationReasoner,
} from './destinationReasoner'
export {
  reasonAboutBudget,
  BudgetReasoner,
} from './budgetReasoner'
export {
  reasonAboutRisk,
  RiskReasoner,
} from './riskReasoner'
export {
  reasonAboutValue,
  ValueReasoner,
} from './valueReasoner'
export {
  reasonAboutRecommendation,
  RecommendationReasoner,
} from './recommendationReasoner'
export {
  generateExplanation,
  formatConsultantAnswers,
  ExplanationGenerator,
} from './explanationGenerator'
export {
  runConsultantReasoningPipeline,
  tryRunConsultantReasoningPipeline,
  ReasoningPipeline,
} from './reasoningPipeline'
