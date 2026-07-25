/**
 * Phase 4 Stage 6 — Executive Dashboard feature gate.
 * Flag `ui.executive_dashboard` default OFF.
 * Not wired into production / AI / Chat / Voice / Knowledge / Booking.
 */

import { getFeatureRegistry } from '../../lib/ai/featureFlags'

export const EXECUTIVE_DASHBOARD_FEATURE_ID = 'ui.executive_dashboard' as const

export function isExecutiveDashboardEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(EXECUTIVE_DASHBOARD_FEATURE_ID)
}

export const ExecutiveDashboardRegistry = {
  featureId: EXECUTIVE_DASHBOARD_FEATURE_ID,
  isEnabled: isExecutiveDashboardEnabled,
}
