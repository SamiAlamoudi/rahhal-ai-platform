/**
 * Phase 4 Stage 5 — Travel Workspace feature gate.
 * Flag `ui.travel_workspace` default OFF.
 * Not wired into production routes / AI / planning / booking / prior centers.
 */

import { getFeatureRegistry } from '../../lib/ai/featureFlags'

export const TRAVEL_WORKSPACE_FEATURE_ID = 'ui.travel_workspace' as const

export function isTravelWorkspaceEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(TRAVEL_WORKSPACE_FEATURE_ID)
}

export const TravelWorkspaceRegistry = {
  featureId: TRAVEL_WORKSPACE_FEATURE_ID,
  isEnabled: isTravelWorkspaceEnabled,
}
