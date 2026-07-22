/**
 * Sprint 120 — Production UI integration feature flag.
 * `ui.production_integration` — default OFF.
 */

import { getFeatureRegistry } from '../ai'

export const UI_PRODUCTION_INTEGRATION_FEATURE_ID = 'ui.production_integration' as const

export const SPRINT120_PRODUCTION_INTEGRATION_VERSION = '1.0.0-production-integration'

export function isUiProductionIntegrationEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(UI_PRODUCTION_INTEGRATION_FEATURE_ID)
}
