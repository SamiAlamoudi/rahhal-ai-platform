/**
 * Phase 5 Stage 1 — Journey Timeline feature gate.
 * Flag `ui.journey_timeline` default OFF.
 */

import { getFeatureRegistry } from '../../lib/ai/featureFlags'

export const JOURNEY_TIMELINE_FEATURE_ID = 'ui.journey_timeline' as const

export function isJourneyTimelineEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(JOURNEY_TIMELINE_FEATURE_ID)
}

export const JourneyTimelineRegistry = {
  featureId: JOURNEY_TIMELINE_FEATURE_ID,
  isEnabled: isJourneyTimelineEnabled,
}
