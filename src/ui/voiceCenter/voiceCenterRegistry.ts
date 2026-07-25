/**
 * Phase 4 Stage 3 — Voice Center feature gate.
 * Flag `ui.voice_center` default OFF.
 * Not wired into production routes / AI / TTS / STT / Runtime Coordinator / Orchestrator.
 */

import { getFeatureRegistry } from '../../lib/ai/featureFlags'

export const VOICE_CENTER_FEATURE_ID = 'ui.voice_center' as const

export function isVoiceCenterEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(VOICE_CENTER_FEATURE_ID)
}

export const VoiceCenterRegistry = {
  featureId: VOICE_CENTER_FEATURE_ID,
  isEnabled: isVoiceCenterEnabled,
}
