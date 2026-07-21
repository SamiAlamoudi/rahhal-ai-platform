import { getFeatureRegistry } from '../../ai/featureFlags'

export const AUTONOMOUS_DECISION_FEATURE_ID = 'ai.autonomous_decision' as const

export function isAutonomousDecisionEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.autonomous_decision')
}
