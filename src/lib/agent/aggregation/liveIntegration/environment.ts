/**
 * Phase W — environment switching helpers (sandbox ↔ production).
 */

import {
  PRODUCTION_HOST,
  resolveAmadeusEnvironment,
  SANDBOX_HOST,
  type AmadeusEnvironment,
} from '../providers/amadeus/config'
import type { ProviderFeatureFlags } from './featureFlags'

export interface LiveProviderEnvironment {
  amadeus: AmadeusEnvironment
  amadeusBaseUrl: string
}

/**
 * Resolve Amadeus sandbox/production host from feature flags + AMADEUS_BASE_URL.
 */
export function resolveLiveProviderEnvironment(
  flags: ProviderFeatureFlags,
  baseUrlOverride?: string | null,
): LiveProviderEnvironment {
  if (flags.amadeusEnvironment === 'sandbox') {
    return { amadeus: 'sandbox', amadeusBaseUrl: SANDBOX_HOST }
  }
  if (flags.amadeusEnvironment === 'production') {
    return { amadeus: 'production', amadeusBaseUrl: PRODUCTION_HOST }
  }
  const base = baseUrlOverride || SANDBOX_HOST
  const env = resolveAmadeusEnvironment(base)
  return {
    amadeus: env,
    amadeusBaseUrl: env === 'production' ? PRODUCTION_HOST : SANDBOX_HOST,
  }
}

export { SANDBOX_HOST, PRODUCTION_HOST }
