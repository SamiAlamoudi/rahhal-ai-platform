import { getFeatureRegistry } from '../../ai/featureFlags'

export const BUDGET_INTELLIGENCE_FEATURE_ID = 'ai.budget_intelligence' as const

export function isBudgetIntelligenceEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.budget_intelligence')
}
