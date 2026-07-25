/**
 * Integration Sprint 11 — `ai.integration_action_execution` (default OFF).
 * Distinct from `ai.booking_execution` / `ai.booking_execution_confirmation`.
 */

import { getFeatureRegistry } from '../../ai'

export const INTEGRATION_ACTION_EXECUTION_FEATURE_ID =
  'ai.integration_action_execution' as const

export function isIntegrationActionExecutionEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(INTEGRATION_ACTION_EXECUTION_FEATURE_ID)
}
