/**
 * Decision pipeline & component contracts — pure builders, no execution.
 */

import type {
  AlternativeEvaluatorContract,
  ConfidenceCalculatorContract,
  ConstraintValidatorContract,
  CostOptimizerContract,
  DecisionAnalyticsContract,
  DecisionAuditTrailContract,
  DecisionContextContract,
  DecisionEngineContract,
  DecisionEventContract,
  DecisionLocale,
  DecisionPipelineContract,
  DecisionSessionContract,
  DecisionStateMachineContract,
  ExplainabilityLayerContract,
  PreferenceMatcherContract,
  RankingEngineContract,
  RecommendationBuilderContract,
  RiskEvaluatorContract,
  ScoringEngineContract,
  TradeoffAnalyzerContract,
} from './types'
import {
  DECISION_MODULE_HINTS,
  DECISION_PIPELINE_STAGES,
  DECISION_STATE_IDS,
} from './types'

const ISO = '2026-07-25T00:00:00.000Z'

export function buildDecisionEngine(): DecisionEngineContract {
  return {
    kind: 'decision_engine',
    version: '6.4.0-decision-engine',
    execution: 'none',
  }
}

export function buildDecisionPipeline(): DecisionPipelineContract {
  return {
    kind: 'decision_pipeline',
    stages: DECISION_PIPELINE_STAGES,
    execution: 'none',
  }
}

export function buildDecisionContext(
  sessionId: string,
  locale: DecisionLocale = 'ar',
): DecisionContextContract {
  return {
    kind: 'decision_context',
    sessionId,
    locale,
    alternativeIds: [],
    criteriaHints: [],
    preferenceHints: [],
    constraintHints: [],
    moduleHints: DECISION_MODULE_HINTS,
  }
}

export function buildDecisionSession(
  sessionId: string,
  locale: DecisionLocale = 'ar',
): DecisionSessionContract {
  return {
    kind: 'decision_session',
    sessionId,
    locale,
    openedAtIso: ISO,
    stateId: 'idle',
  }
}

export function buildDecisionStateMachine(): DecisionStateMachineContract {
  return {
    kind: 'decision_state_machine',
    current: 'idle',
    allowed: DECISION_STATE_IDS,
    lastTransition: null,
    execution: 'none',
  }
}

export function buildAlternativeEvaluator(): AlternativeEvaluatorContract {
  return {
    kind: 'alternative_evaluator',
    alternatives: [],
    execution: 'none',
  }
}

export function buildRankingEngine(): RankingEngineContract {
  return {
    kind: 'ranking_engine',
    rankedIds: [],
    methodHint: 'architecture_placeholder',
    execution: 'none',
  }
}

export function buildScoringEngine(): ScoringEngineContract {
  return {
    kind: 'scoring_engine',
    scores: [],
    execution: 'none',
  }
}

export function buildConfidenceCalculator(
  score = 0.5,
): ConfidenceCalculatorContract {
  const band = score >= 0.75 ? 'high' : score >= 0.4 ? 'medium' : 'low'
  return {
    kind: 'confidence_calculator',
    score,
    band,
    factors: ['architecture_placeholder'],
    execution: 'none',
  }
}

export function buildConstraintValidator(): ConstraintValidatorContract {
  return {
    kind: 'constraint_validator',
    hard: [],
    soft: [],
    violations: [],
    execution: 'none',
  }
}

export function buildPreferenceMatcher(): PreferenceMatcherContract {
  return {
    kind: 'preference_matcher',
    matched: [],
    unmatched: [],
    execution: 'none',
  }
}

export function buildTradeoffAnalyzer(): TradeoffAnalyzerContract {
  return {
    kind: 'tradeoff_analyzer',
    tradeoffs: [],
    execution: 'none',
  }
}

export function buildCostOptimizer(): CostOptimizerContract {
  return {
    kind: 'cost_optimizer',
    currencyHint: 'SAR',
    candidates: [],
    execution: 'none',
  }
}

export function buildRiskEvaluator(): RiskEvaluatorContract {
  return {
    kind: 'risk_evaluator',
    risks: [],
    execution: 'none',
  }
}

export function buildExplainabilityLayer(): ExplainabilityLayerContract {
  return {
    kind: 'explainability_layer',
    explanations: [],
    execution: 'none',
  }
}

export function buildRecommendationBuilder(): RecommendationBuilderContract {
  return {
    kind: 'recommendation_builder',
    primaryId: null,
    runnerUpIds: [],
    summary: 'Architecture recommendation placeholder — no execution.',
    execution: 'none',
  }
}

export function buildDecisionEvent(
  sessionId: string,
  eventKind: DecisionEventContract['eventKind'],
  payloadSummary: string,
): DecisionEventContract {
  return {
    kind: 'decision_event',
    eventId: `devt-${eventKind}`,
    eventKind,
    sessionId,
    atIso: ISO,
    payloadSummary,
  }
}

export function buildDecisionAnalytics(
  sessionId: string,
): DecisionAnalyticsContract {
  return {
    kind: 'decision_analytics',
    sessionId,
    alternativeCount: 0,
    stageCount: DECISION_PIPELINE_STAGES.length,
    averageConfidence: 0,
    exported: false,
  }
}

export function buildDecisionAuditTrail(): DecisionAuditTrailContract {
  return {
    kind: 'decision_audit_trail',
    entries: [
      {
        id: 'audit-open',
        atIso: ISO,
        action: 'session_started',
        detail: 'architecture blueprint',
      },
    ],
    persisted: false,
  }
}
