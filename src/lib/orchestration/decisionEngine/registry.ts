/**
 * Decision Registry + feature gate.
 * Flag `brain.decision_engine` default OFF.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type { DecisionRegistryEntry } from './types'
import { DECISION_MODULE_HINTS } from './types'

export const BRAIN_DECISION_ENGINE_FEATURE_ID = 'brain.decision_engine' as const

export function isBrainDecisionEngineEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_DECISION_ENGINE_FEATURE_ID)
}

export const DECISION_REGISTRY: readonly DecisionRegistryEntry[] = [
  {
    id: 'dreg-eval',
    component: 'alternative_evaluator',
    moduleHints: ['decision_center', 'insights_center'],
  },
  {
    id: 'dreg-rank',
    component: 'ranking_engine',
    moduleHints: ['decision_center'],
  },
  {
    id: 'dreg-score',
    component: 'scoring_engine',
    moduleHints: ['decision_center', 'insights_center'],
  },
  {
    id: 'dreg-conf',
    component: 'confidence_calculator',
    moduleHints: ['decision_center'],
  },
  {
    id: 'dreg-constraint',
    component: 'constraint_validator',
    moduleHints: ['traveler_profile', 'memory_center'],
  },
  {
    id: 'dreg-pref',
    component: 'preference_matcher',
    moduleHints: ['traveler_profile', 'memory_center'],
  },
  {
    id: 'dreg-tradeoff',
    component: 'tradeoff_analyzer',
    moduleHints: ['decision_center', 'insights_center'],
  },
  {
    id: 'dreg-cost',
    component: 'cost_optimizer',
    moduleHints: ['insights_center', 'booking_hub'],
  },
  {
    id: 'dreg-risk',
    component: 'risk_evaluator',
    moduleHints: ['decision_center', 'insights_center'],
  },
  {
    id: 'dreg-explain',
    component: 'explainability_layer',
    moduleHints: ['decision_center', 'conversation_center'],
  },
  {
    id: 'dreg-rec',
    component: 'recommendation_builder',
    moduleHints: ['decision_center', 'travel_workspace'],
  },
] as const

export function listDecisionRegistry(): DecisionRegistryEntry[] {
  return DECISION_REGISTRY.map((entry) => ({
    ...entry,
    moduleHints: [...entry.moduleHints],
  }))
}

export function listDecisionModuleHints() {
  return DECISION_MODULE_HINTS
}

export const DecisionRegistry = {
  featureId: BRAIN_DECISION_ENGINE_FEATURE_ID,
  isEnabled: isBrainDecisionEngineEnabled,
  list: listDecisionRegistry,
  moduleHints: listDecisionModuleHints,
}
