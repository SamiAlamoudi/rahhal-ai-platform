/**
 * Integration Sprint 9 — `ai.integration_budget_pricing` (default OFF).
 * Distinct from Sprint 75 `ai.budget_intelligence`.
 */

import { getFeatureRegistry } from '../../ai'

export const INTEGRATION_BUDGET_PRICING_FEATURE_ID =
  'ai.integration_budget_pricing' as const

export function isIntegrationBudgetPricingEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(INTEGRATION_BUDGET_PRICING_FEATURE_ID)
}
