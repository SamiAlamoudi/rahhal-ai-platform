/**
 * Phase 6 Stage 4 — AI Decision Engine barrel.
 *
 * Architecture / contracts / types only.
 * Gated by `brain.decision_engine` (default OFF).
 * No decision execution, LLM, Runtime, or production wiring.
 */

import { DECISION_ENGINE_ISOLATION as DE_ISOLATION } from './types'
import { DECISION_PIPELINE_STAGES } from './types'

export {
  BRAIN_DECISION_ENGINE_FEATURE_ID,
  isBrainDecisionEngineEnabled,
  listDecisionRegistry,
  listDecisionModuleHints,
  DecisionRegistry,
  DECISION_REGISTRY,
} from './registry'

export type {
  DecisionLocale,
  DecisionStateId,
  DecisionEventKind,
  DecisionConfidenceBand,
  DecisionModuleHint,
  DecisionPipelineStageId,
  DecisionEngineContract,
  DecisionPipelineContract,
  DecisionContextContract,
  DecisionSessionContract,
  DecisionRegistryEntry,
  DecisionEventContract,
  DecisionStateTransition,
  DecisionStateMachineContract,
  AlternativeEvaluatorContract,
  RankingEngineContract,
  ScoringEngineContract,
  ConfidenceCalculatorContract,
  ConstraintValidatorContract,
  PreferenceMatcherContract,
  TradeoffAnalyzerContract,
  CostOptimizerContract,
  RiskEvaluatorContract,
  ExplainabilityLayerContract,
  RecommendationBuilderContract,
  DecisionAnalyticsContract,
  DecisionAuditEntry,
  DecisionAuditTrailContract,
  DecisionEngineBlueprint,
} from './types'

export {
  DECISION_ENGINE_ISOLATION,
  DECISION_PIPELINE_STAGES,
  DECISION_STATE_IDS,
  DECISION_MODULE_HINTS,
} from './types'

export {
  buildDecisionEngine,
  buildDecisionPipeline,
  buildDecisionContext,
  buildDecisionSession,
  buildDecisionStateMachine,
  buildAlternativeEvaluator,
  buildRankingEngine,
  buildScoringEngine,
  buildConfidenceCalculator,
  buildConstraintValidator,
  buildPreferenceMatcher,
  buildTradeoffAnalyzer,
  buildCostOptimizer,
  buildRiskEvaluator,
  buildExplainabilityLayer,
  buildRecommendationBuilder,
  buildDecisionEvent,
  buildDecisionAnalytics,
  buildDecisionAuditTrail,
} from './pipelines'

export {
  DecisionEngine,
  buildDecisionEngineBlueprint,
  tryBuildDecisionEngineBlueprint,
  assertDecisionEngineIsolation,
} from './engine'
export type { BuildDecisionBlueprintOptions } from './engine'

export const DECISION_ENGINE_ARCHITECTURE = {
  version: '6.4.0-decision-engine',
  featureId: 'brain.decision_engine' as const,
  architectureOnly: true,
  components: [
    'decision_engine',
    'decision_pipeline',
    'decision_context',
    'decision_session',
    'decision_registry',
    'decision_events',
    'decision_state_machine',
    'alternative_evaluator',
    'ranking_engine',
    'scoring_engine',
    'confidence_calculator',
    'constraint_validator',
    'preference_matcher',
    'tradeoff_analyzer',
    'cost_optimizer',
    'risk_evaluator',
    'explainability_layer',
    'recommendation_builder',
    'decision_analytics',
    'decision_audit_trail',
  ] as const,
  pipelineStages: DECISION_PIPELINE_STAGES,
  ...DE_ISOLATION,
} as const
