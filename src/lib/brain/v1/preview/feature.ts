/**
 * Sprint 86 — Brain v1 Preview Integration feature gate.
 *
 * Flag: `ai.brain.v1.preview` (default OFF, NOT recovery-frozen).
 * Foundation flag `ai.brain.v1` remains frozen OFF.
 *
 * When OFF → planTurn uses the current planner unchanged.
 * When ON (preview/dev/staging/beta only) → BrainRouter may orchestrate.
 * Production is hard-blocked even if the registry flag is flipped.
 */

import { getFeatureRegistry } from '../../../ai/featureFlags'
import { isProductionDeployTarget } from '../../../../core/amadeusSandbox/config'
import { detectDeployProfile } from '../../../ops/deployment/profiles'

export const BRAIN_V1_PREVIEW_FEATURE_ID = 'ai.brain.v1.preview' as const
export const BRAIN_V1_PREVIEW_VERSION = '1.1.0-live-brain-preview'

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

/** Optional Preview env override (never applied on production deploy targets). */
function envPreviewOverride(
  env: Record<string, string | undefined>,
): boolean | undefined {
  const raw = (env.VITE_BRAIN_V1_PREVIEW ?? env.BRAIN_V1_PREVIEW ?? '').toLowerCase()
  if (raw === '1' || raw === 'true' || raw === 'on') return true
  if (raw === '0' || raw === 'false' || raw === 'off') return false
  return undefined
}

/** Deploy-target gate: development / staging(preview) / beta only. */
export function isBrainPreviewDeployTargetAllowed(options?: {
  env?: Record<string, string | undefined>
}): boolean {
  const env = readEnvBag(options?.env)
  if (isProductionDeployTarget(env)) return false
  const profile = detectDeployProfile({ env })
  if (profile.name === 'production') return false
  return (
    profile.name === 'development'
    || profile.name === 'staging'
    || profile.name === 'beta'
  )
}

export function isBrainV1PreviewEnabled(options?: {
  enabled?: boolean
  env?: Record<string, string | undefined>
  /**
   * Unit-test escape hatch for explicit `enabled: true` overrides.
   * Registry/env enablement never bypasses the deploy-target gate unless set.
   */
  bypassDeployGateForTests?: boolean
}): boolean {
  const env = readEnvBag(options?.env)
  const envOverride = envPreviewOverride(env)
  const flagOn = typeof options?.enabled === 'boolean'
    ? options.enabled
    : (envOverride ?? getFeatureRegistry().isEnabled(BRAIN_V1_PREVIEW_FEATURE_ID))

  if (!flagOn) return false
  if (options?.bypassDeployGateForTests) return true
  return isBrainPreviewDeployTargetAllowed({ env })
}
