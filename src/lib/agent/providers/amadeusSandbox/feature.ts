/**
 * Sprint 92 — feature flag `providers.amadeus.enabled`
 * Default: true in sandbox / non-production, false in production.
 */

import { getFeatureRegistry } from '../../../ai/featureFlags'
import {
  isProductionDeployTarget,
  parseBoolEnv,
  readAmadeusBaseUrl,
} from '../../../../core/amadeusSandbox'

export const AMADEUS_SANDBOX_FEATURE_ID = 'providers.amadeus.enabled' as const

function readEnv(key: string): string | null {
  try {
    const vite = (import.meta as { env?: Record<string, unknown> }).env?.[key]
    if (vite !== undefined && vite !== null && String(vite) !== '') return String(vite)
  } catch {
    /* ignore */
  }
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    const value = proc?.env?.[key]
    if (value !== undefined && value !== null && value !== '') return String(value)
  } catch {
    /* ignore */
  }
  return null
}

export function isAmadeusSandboxEnabled(options?: {
  enabled?: boolean
  env?: Record<string, string | undefined>
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled

  const env = options?.env ?? {}
  const explicit = env.PROVIDERS_AMADEUS_ENABLED
    ?? env.VITE_PROVIDERS_AMADEUS_ENABLED
    ?? readEnv('PROVIDERS_AMADEUS_ENABLED')
    ?? readEnv('VITE_PROVIDERS_AMADEUS_ENABLED')

  if (explicit != null && explicit !== '') {
    return parseBoolEnv(explicit, false)
  }

  if (isProductionDeployTarget(env)) {
    return false
  }

  if (!getFeatureRegistry().isEnabled(AMADEUS_SANDBOX_FEATURE_ID)) {
    return false
  }

  const baseUrl = readAmadeusBaseUrl(env).toLowerCase()
  if (baseUrl.includes('api.amadeus.com') && !baseUrl.includes('test.api.amadeus.com')) {
    return false
  }

  return true
}
