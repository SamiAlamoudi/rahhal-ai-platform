/**
 * Bilamo Intelligence Layer gate.
 * Default ON — Bilamo is the product conversation brain.
 * Soft-fails inside planTurn; never surfaces errors to the traveler.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'

export const BILAMO_INTELLIGENCE_FEATURE_ID = 'ai.bilamo_intelligence' as const
export const BILAMO_INTELLIGENCE_FEATURE_VERSION = '1.0.0'

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

function envOverride(env: Record<string, string | undefined>): boolean | undefined {
  const raw = (env.VITE_BILAMO_INTELLIGENCE ?? env.BILAMO_INTELLIGENCE ?? '').toLowerCase()
  if (raw === '1' || raw === 'true' || raw === 'on') return true
  if (raw === '0' || raw === 'false' || raw === 'off') return false
  return undefined
}

export function isBilamoIntelligenceEnabled(options?: {
  enabled?: boolean
  env?: Record<string, string | undefined>
}): boolean {
  const env = readEnvBag(options?.env)
  const fromEnv = envOverride(env)
  if (typeof options?.enabled === 'boolean') return options.enabled
  if (typeof fromEnv === 'boolean') return fromEnv
  try {
    return getFeatureRegistry().isEnabled(BILAMO_INTELLIGENCE_FEATURE_ID)
  } catch {
    return false
  }
}
