/**
 * Decision Engine facade — builds architecture blueprints only.
 * Never ranks, scores, or recommends via LLMs/Runtime/APIs.
 */

import { listDecisionRegistry } from './registry'
import { isBrainDecisionEngineEnabled } from './registry'
import {
  buildAlternativeEvaluator,
  buildConfidenceCalculator,
  buildConstraintValidator,
  buildCostOptimizer,
  buildDecisionAnalytics,
  buildDecisionAuditTrail,
  buildDecisionContext,
  buildDecisionEngine,
  buildDecisionEvent,
  buildDecisionPipeline,
  buildDecisionSession,
  buildDecisionStateMachine,
  buildExplainabilityLayer,
  buildPreferenceMatcher,
  buildRankingEngine,
  buildRecommendationBuilder,
  buildRiskEvaluator,
  buildScoringEngine,
  buildTradeoffAnalyzer,
} from './pipelines'
import type { DecisionEngineBlueprint, DecisionLocale } from './types'
import { DECISION_ENGINE_ISOLATION } from './types'

export interface BuildDecisionBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: DecisionLocale
}

export function buildDecisionEngineBlueprint(
  options: BuildDecisionBlueprintOptions = {},
): DecisionEngineBlueprint {
  const sessionId = options.sessionId ?? 'decision-session-architecture'
  const locale = options.locale ?? 'ar'

  return {
    version: '6.4.0-decision-engine',
    featureId: 'brain.decision_engine',
    architectureOnly: true,
    engine: buildDecisionEngine(),
    pipeline: buildDecisionPipeline(),
    decisionContext: buildDecisionContext(sessionId, locale),
    decisionSession: buildDecisionSession(sessionId, locale),
    registry: listDecisionRegistry(),
    events: [
      buildDecisionEvent(sessionId, 'session_started', 'architecture blueprint'),
      buildDecisionEvent(sessionId, 'context_attached', 'empty context'),
    ],
    stateMachine: buildDecisionStateMachine(),
    alternativeEvaluator: buildAlternativeEvaluator(),
    rankingEngine: buildRankingEngine(),
    scoringEngine: buildScoringEngine(),
    confidenceCalculator: buildConfidenceCalculator(0.5),
    constraintValidator: buildConstraintValidator(),
    preferenceMatcher: buildPreferenceMatcher(),
    tradeoffAnalyzer: buildTradeoffAnalyzer(),
    costOptimizer: buildCostOptimizer(),
    riskEvaluator: buildRiskEvaluator(),
    explainabilityLayer: buildExplainabilityLayer(),
    recommendationBuilder: buildRecommendationBuilder(),
    analytics: buildDecisionAnalytics(sessionId),
    auditTrail: buildDecisionAuditTrail(),
  }
}

export function tryBuildDecisionEngineBlueprint(
  options: BuildDecisionBlueprintOptions = {},
): DecisionEngineBlueprint | null {
  if (!isBrainDecisionEngineEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildDecisionEngineBlueprint(options)
}

export function assertDecisionEngineIsolation(): typeof DECISION_ENGINE_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
} {
  return {
    ...DECISION_ENGINE_ISOLATION,
    architectureOnly: true,
    registrySize: listDecisionRegistry().length,
  }
}

export const DecisionEngine = {
  buildBlueprint: buildDecisionEngineBlueprint,
  tryBuildBlueprint: tryBuildDecisionEngineBlueprint,
  assertIsolation: assertDecisionEngineIsolation,
}
