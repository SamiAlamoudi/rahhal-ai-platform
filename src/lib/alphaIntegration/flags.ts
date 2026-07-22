/**
 * Sprint 103 — feature flag inventory for Alpha traveler journey.
 */

import { getFeatureRegistry } from '../ai'
import type { AlphaIntegrationFlagReport } from './types'

/** Product flags required for the Alpha E2E journey (aliases included). */
export const ALPHA_INTEGRATION_FLAG_IDS = [
  'ai.concierge',
  'ai.live_conversation',
  'ai.alpha_experience',
  'ai.booking_assistant',
  'ai.booking_execution_confirmation',
  'ai.my_trips_dashboard',
  'ui.my_trips',
  'ai.concierge_experience',
] as const

export function reportAlphaIntegrationFlags(): AlphaIntegrationFlagReport[] {
  const registry = getFeatureRegistry()
  const legacy: Record<string, string> = {
    'ai.concierge': 'Legacy consultant dialogue off — agent proceeds without concierge handoff gate',
    'ai.live_conversation': 'Falls back to standard conversation experience (ui.conversation_experience)',
    'ai.alpha_experience': 'Alpha assembly skipped — no alphaTravelerExperience meta',
    'ai.booking_assistant': 'Booking assistant meta omitted — legacy booking path only',
    'ai.booking_execution_confirmation': 'Assistant routes redirect to legacy /booking/*',
    'ai.my_trips_dashboard': 'Alias off follows ui.my_trips — My Trips hidden when ui.my_trips off',
    'ui.my_trips': 'My Trips page unavailable',
    'ai.concierge_experience': 'Concierge experience meta omitted',
  }

  return ALPHA_INTEGRATION_FLAG_IDS.map((id) => {
    const enabled = registry.isEnabled(id)
    return {
      id,
      enabled,
      legacyWhenOff: legacy[id] ?? 'Preserve prior behavior',
    }
  })
}

export function isAlphaIntegrationFlagEnabled(id: (typeof ALPHA_INTEGRATION_FLAG_IDS)[number]): boolean {
  return getFeatureRegistry().isEnabled(id)
}
