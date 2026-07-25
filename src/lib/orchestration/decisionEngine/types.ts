/**
 * Phase 6 Stage 4 — AI Decision Engine contracts.
 * Architecture / interfaces / types only. No LLM, decision execution, or APIs.
 */

export type DecisionLocale = 'ar' | 'en'

export type DecisionStateId =
  | 'idle'
  | 'loading_context'
  | 'evaluating_alternatives'
  | 'scoring'
  | 'ranking'
  | 'validating'
  | 'explaining'
  | 'recommending'
  | 'ready'
  | 'closed'

export type DecisionEventKind =
  | 'session_started'
  | 'context_attached'
  | 'alternatives_evaluated'
  | 'scores_computed'
  | 'ranking_ready'
  | 'constraints_validated'
  | 'tradeoffs_analyzed'
  | 'recommendation_built'
  | 'confidence_scored'
  | 'audit_appended'
  | 'state_transition'
  | 'session_ended'

export type DecisionConfidenceBand = 'low' | 'medium' | 'high'

export type DecisionModuleHint =
  | 'decision_center'
  | 'insights_center'
  | 'travel_workspace'
  | 'journey_timeline'
  | 'booking_hub'
  | 'traveler_profile'
  | 'memory_center'
  | 'conversation_center'

export type DecisionPipelineStageId =
  | 'attach_context'
  | 'load_alternatives'
  | 'match_preferences'
  | 'validate_constraints'
  | 'evaluate_alternatives'
  | 'score_alternatives'
  | 'analyze_tradeoffs'
  | 'optimize_cost'
  | 'evaluate_risk'
  | 'rank_alternatives'
  | 'build_explanation'
  | 'build_recommendation'
  | 'score_confidence'
  | 'append_audit'

export interface DecisionEngineContract {
  kind: 'decision_engine'
  version: '6.4.0-decision-engine'
  execution: 'none'
}

export interface DecisionPipelineContract {
  kind: 'decision_pipeline'
  stages: readonly DecisionPipelineStageId[]
  execution: 'none'
}

export interface DecisionContextContract {
  kind: 'decision_context'
  sessionId: string
  locale: DecisionLocale
  alternativeIds: readonly string[]
  criteriaHints: readonly string[]
  preferenceHints: readonly string[]
  constraintHints: readonly string[]
  moduleHints: readonly DecisionModuleHint[]
}

export interface DecisionSessionContract {
  kind: 'decision_session'
  sessionId: string
  locale: DecisionLocale
  openedAtIso: string
  stateId: DecisionStateId
}

export interface DecisionRegistryEntry {
  id: string
  component:
    | 'alternative_evaluator'
    | 'ranking_engine'
    | 'scoring_engine'
    | 'confidence_calculator'
    | 'constraint_validator'
    | 'preference_matcher'
    | 'tradeoff_analyzer'
    | 'cost_optimizer'
    | 'risk_evaluator'
    | 'explainability_layer'
    | 'recommendation_builder'
  moduleHints: readonly DecisionModuleHint[]
}

export interface DecisionEventContract {
  kind: 'decision_event'
  eventId: string
  eventKind: DecisionEventKind
  sessionId: string
  atIso: string
  payloadSummary: string
}

export interface DecisionStateTransition {
  from: DecisionStateId
  to: DecisionStateId
  reason: string
}

export interface DecisionStateMachineContract {
  kind: 'decision_state_machine'
  current: DecisionStateId
  allowed: readonly DecisionStateId[]
  lastTransition: DecisionStateTransition | null
  execution: 'none'
}

export interface AlternativeEvaluatorContract {
  kind: 'alternative_evaluator'
  alternatives: readonly {
    id: string
    label: string
    attributes: readonly string[]
  }[]
  execution: 'none'
}

export interface RankingEngineContract {
  kind: 'ranking_engine'
  rankedIds: readonly string[]
  methodHint: string
  execution: 'none'
}

export interface ScoringEngineContract {
  kind: 'scoring_engine'
  scores: readonly {
    alternativeId: string
    score: number
    dimensions: readonly { id: string; value: number }[]
  }[]
  execution: 'none'
}

export interface ConfidenceCalculatorContract {
  kind: 'confidence_calculator'
  score: number
  band: DecisionConfidenceBand
  factors: readonly string[]
  execution: 'none'
}

export interface ConstraintValidatorContract {
  kind: 'constraint_validator'
  hard: readonly string[]
  soft: readonly string[]
  violations: readonly string[]
  execution: 'none'
}

export interface PreferenceMatcherContract {
  kind: 'preference_matcher'
  matched: readonly string[]
  unmatched: readonly string[]
  execution: 'none'
}

export interface TradeoffAnalyzerContract {
  kind: 'tradeoff_analyzer'
  tradeoffs: readonly {
    id: string
    between: readonly string[]
    summary: string
  }[]
  execution: 'none'
}

export interface CostOptimizerContract {
  kind: 'cost_optimizer'
  currencyHint: string
  candidates: readonly {
    alternativeId: string
    costHint: string
  }[]
  execution: 'none'
}

export interface RiskEvaluatorContract {
  kind: 'risk_evaluator'
  risks: readonly {
    id: string
    alternativeId: string
    severity: 'low' | 'medium' | 'high'
    label: string
  }[]
  execution: 'none'
}

export interface ExplainabilityLayerContract {
  kind: 'explainability_layer'
  explanations: readonly {
    alternativeId: string
    reasons: readonly string[]
  }[]
  execution: 'none'
}

export interface RecommendationBuilderContract {
  kind: 'recommendation_builder'
  primaryId: string | null
  runnerUpIds: readonly string[]
  summary: string
  execution: 'none'
}

export interface DecisionAnalyticsContract {
  kind: 'decision_analytics'
  sessionId: string
  alternativeCount: number
  stageCount: number
  averageConfidence: number
  exported: false
}

export interface DecisionAuditEntry {
  id: string
  atIso: string
  action: string
  detail: string
}

export interface DecisionAuditTrailContract {
  kind: 'decision_audit_trail'
  entries: readonly DecisionAuditEntry[]
  persisted: false
}

export interface DecisionEngineBlueprint {
  version: '6.4.0-decision-engine'
  featureId: 'brain.decision_engine'
  architectureOnly: true
  engine: DecisionEngineContract
  pipeline: DecisionPipelineContract
  decisionContext: DecisionContextContract
  decisionSession: DecisionSessionContract
  registry: readonly DecisionRegistryEntry[]
  events: readonly DecisionEventContract[]
  stateMachine: DecisionStateMachineContract
  alternativeEvaluator: AlternativeEvaluatorContract
  rankingEngine: RankingEngineContract
  scoringEngine: ScoringEngineContract
  confidenceCalculator: ConfidenceCalculatorContract
  constraintValidator: ConstraintValidatorContract
  preferenceMatcher: PreferenceMatcherContract
  tradeoffAnalyzer: TradeoffAnalyzerContract
  costOptimizer: CostOptimizerContract
  riskEvaluator: RiskEvaluatorContract
  explainabilityLayer: ExplainabilityLayerContract
  recommendationBuilder: RecommendationBuilderContract
  analytics: DecisionAnalyticsContract
  auditTrail: DecisionAuditTrailContract
}

export const DECISION_ENGINE_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoOpenAi: false,
  wiredIntoClaude: false,
  wiredIntoGemini: false,
  wiredIntoLlms: false,
  wiredIntoBookingApis: false,
  wiredIntoAmadeus: false,
  wiredIntoMaps: false,
  wiredIntoWeather: false,
  wiredIntoPayments: false,
  wiredIntoFirebase: false,
  wiredIntoSupabase: false,
  wiredIntoRealtime: false,
  wiredIntoAuthentication: false,
  wiredIntoRuntime: false,
  wiredIntoDatabase: false,
  decisionExecution: false,
  llmImplementation: false,
  runtimeLogic: false,
  businessLogic: false,
} as const

export const DECISION_PIPELINE_STAGES: readonly DecisionPipelineStageId[] = [
  'attach_context',
  'load_alternatives',
  'match_preferences',
  'validate_constraints',
  'evaluate_alternatives',
  'score_alternatives',
  'analyze_tradeoffs',
  'optimize_cost',
  'evaluate_risk',
  'rank_alternatives',
  'build_explanation',
  'build_recommendation',
  'score_confidence',
  'append_audit',
] as const

export const DECISION_STATE_IDS: readonly DecisionStateId[] = [
  'idle',
  'loading_context',
  'evaluating_alternatives',
  'scoring',
  'ranking',
  'validating',
  'explaining',
  'recommending',
  'ready',
  'closed',
] as const

export const DECISION_MODULE_HINTS: readonly DecisionModuleHint[] = [
  'decision_center',
  'insights_center',
  'travel_workspace',
  'journey_timeline',
  'booking_hub',
  'traveler_profile',
  'memory_center',
  'conversation_center',
] as const
