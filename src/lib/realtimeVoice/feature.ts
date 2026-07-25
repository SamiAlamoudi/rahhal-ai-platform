/**
 * Phase 7 — Realtime voice feature gate.
 * Flag: `ai.realtime_voice` — production default OFF.
 * Development opt-in: VITE_REALTIME_VOICE_DEV=true in DEV builds.
 */

import { getFeatureRegistry } from '../ai/featureFlags'

export const REALTIME_VOICE_FEATURE_ID = 'ai.realtime_voice' as const

function envFlag(name: string): boolean {
  try {
    const value = (import.meta.env as Record<string, unknown>)[name]
    return value === true || value === 'true'
  } catch {
    return false
  }
}

function isDevBuild(): boolean {
  try {
    return Boolean(import.meta.env.DEV)
  } catch {
    return false
  }
}

/**
 * Live network sockets require explicit allow + feature enablement.
 * Never opens production APIs from defaults.
 */
export function isVoiceLiveNetworkAllowed(): boolean {
  return envFlag('VITE_VOICE_LIVE_ALLOW')
}

export function isRealtimeVoiceEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  if (getFeatureRegistry().isEnabled(REALTIME_VOICE_FEATURE_ID)) return true
  // Dev-only opt-in without flipping production registry default
  if (isDevBuild() && envFlag('VITE_REALTIME_VOICE_DEV')) return true
  return false
}
