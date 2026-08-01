/**
 * Sprint 80 P1-4 / P2 — feature flag `ai.live_flight_provider_pilot` (default OFF).
 *
 * When OFF, runConversationAwareFlightSearch keeps the pre-pilot bridges.
 * When ON, flights route through the unified provider resolver (Amadeus) with
 * silent legacy fallback — **only** on development/staging/preview/beta.
 * Production is hard-blocked even if the registry flag is flipped.
 */

import { getFeatureRegistry } from '../../ai'
import { isProductionDeployTarget } from '../../../core/amadeusSandbox/config'
import { detectDeployProfile } from '../../ops/deployment/profiles'

export const LIVE_FLIGHT_PROVIDER_PILOT_FEATURE_ID =
  'ai.live_flight_provider_pilot' as const

function readEnvBag(
  env?: Record<string, string | undefined>,
): Record<string, string | undefined> {
  if (env) return env
  const out: Record<string, string | undefined> = {}
  try {
    const vite = (import.meta as { env?: Record<string, unknown> }).env ?? {}
    for (const [k, v] of Object.entries(vite)) {
      if (typeof v === 'string') out[k] = v
    }
  } catch {
    /* ignore */
  }
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    for (const [k, v] of Object.entries(proc?.env ?? {})) {
      if (typeof v === 'string' && out[k] === undefined) out[k] = v
    }
  } catch {
    /* ignore */
  }
  return out
}

/** Deploy-target gate shared with P2 validation (no import cycle). */
export function isPilotDeployTargetAllowed(options?: {
  env?: Record<string, string | undefined>
}): boolean {
  const env = readEnvBag(options?.env)
  if (isProductionDeployTarget(env)) return false
  const profile = detectDeployProfile({ env })
  if (profile.name === 'production') return false
  return profile.name === 'development'
    || profile.name === 'staging'
    || profile.name === 'beta'
}

export function isLiveFlightProviderPilotEnabled(options?: {
  enabled?: boolean
  env?: Record<string, string | undefined>
  /**
   * Unit-test / harness escape hatch for explicit `pilotEnabled: true` overrides.
   * Registry-driven enablement never bypasses the deploy-target gate.
   */
  bypassDeployGateForTests?: boolean
}): boolean {
  const flagOn = typeof options?.enabled === 'boolean'
    ? options.enabled
    : getFeatureRegistry().isEnabled(LIVE_FLIGHT_PROVIDER_PILOT_FEATURE_ID)

  if (!flagOn) return false
  if (options?.bypassDeployGateForTests) return true
  return isPilotDeployTargetAllowed({ env: options?.env })
}
