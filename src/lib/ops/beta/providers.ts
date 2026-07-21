/**
 * Sprint 67 — feature-flag controlled live provider activation matrix.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import {
  isLiveProviderEnabled,
  isLiveProvidersEnabled,
} from '../../agent/liveProviders/feature'
import type { LiveProviderId } from '../../agent/liveProviders/types'
import type { BetaEnvironmentProfile, BetaProviderSlot } from './types'
import { hasProviderCredentials } from './secrets'

const CORE_PROVIDERS: Array<{
  id: LiveProviderId
  featureFlag: string
}> = [
  { id: 'amadeus', featureFlag: 'provider.amadeus' },
  { id: 'booking', featureFlag: 'provider.booking' },
  { id: 'duffel', featureFlag: 'provider.duffel' },
]

/**
 * Build provider activation slots for the beta environment.
 * Simulated mock is always available; live requires flags + secrets.
 */
export function buildBetaProviderMatrix(
  profile: BetaEnvironmentProfile,
): BetaProviderSlot[] {
  const registry = getFeatureRegistry()
  const masterOn = isLiveProvidersEnabled()
  const slots: BetaProviderSlot[] = [
    {
      providerId: 'mock',
      featureFlag: null,
      configured: true,
      flagEnabled: true,
      envEnabled: true,
      secretsPresent: true,
      mode: 'simulated',
      notes: 'Default simulated provider — always available for fallback',
    },
  ]

  for (const p of CORE_PROVIDERS) {
    const flagEnabled = registry.isEnabled(p.featureFlag as 'provider.amadeus')
    const envEnabled = isLiveProviderEnabled(p.id)
    const secretsPresent = hasProviderCredentials(p.id)
    let mode: BetaProviderSlot['mode'] = 'unavailable'
    let notes = ''

    if (!profile.liveProvidersAllowed) {
      mode = 'simulated'
      notes = 'Live providers not allowed for this environment profile'
    } else if (!masterOn || !flagEnabled) {
      mode = 'simulated'
      notes = 'Feature flag OFF — using simulated path'
    } else if (!secretsPresent) {
      mode = 'unavailable'
      notes = 'Flag ON but credentials missing — keep mock fallback'
    } else if (!envEnabled) {
      mode = 'simulated'
      notes = 'Provider env toggle OFF'
    } else {
      mode = 'live'
      notes = 'Live activation eligible (flags + secrets)'
    }

    slots.push({
      providerId: p.id,
      featureFlag: p.featureFlag,
      configured: secretsPresent,
      flagEnabled: masterOn && flagEnabled,
      envEnabled,
      secretsPresent,
      mode,
      notes,
    })
  }

  // Future provider registration placeholder — registry remains open.
  slots.push({
    providerId: 'future',
    featureFlag: null,
    configured: false,
    flagEnabled: false,
    envEnabled: false,
    secretsPresent: false,
    mode: 'unavailable',
    notes: 'Future providers register via liveProviders + FeatureRegistry without core changes',
  })

  return slots
}

/** Activate live provider flags for beta when secrets exist (opt-in helper). */
export function configureBetaLiveProviders(input?: {
  enableMaster?: boolean
  providers?: LiveProviderId[]
}): { enabled: string[]; skipped: string[] } {
  const registry = getFeatureRegistry()
  const enabled: string[] = []
  const skipped: string[] = []
  const wanted = input?.providers ?? (['amadeus', 'booking', 'duffel'] as LiveProviderId[])

  if (input?.enableMaster) {
    registry.setEnabled('ai.live_providers', true)
    enabled.push('ai.live_providers')
  }

  for (const id of wanted) {
    const flag =
      id === 'amadeus'
        ? 'provider.amadeus'
        : id === 'booking'
          ? 'provider.booking'
          : id === 'duffel'
            ? 'provider.duffel'
            : null
    if (!flag) {
      skipped.push(id)
      continue
    }
    if (!hasProviderCredentials(id)) {
      skipped.push(id)
      continue
    }
    registry.setEnabled(flag as 'provider.amadeus', true)
    enabled.push(flag)
  }

  return { enabled, skipped }
}
