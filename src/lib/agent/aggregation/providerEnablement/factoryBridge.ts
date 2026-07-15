/**
 * Phase AJ — bridge enablement flags into Phase W ProviderFeatureFlags.
 * Factory continues to select mock by default; live only when ready.
 */

import {
  resolveProviderFeatureFlags,
  type LiveProviderFlagKey,
  type ProviderFeatureFlags,
} from '../liveIntegration/featureFlags'
import {
  isCapabilityLiveEnabled,
  resolveProviderEnablementFlags,
} from './flags'
import { selectProviderForCapability } from './selection'
import type { ProviderEnablementFlags } from './types'

export function toPhaseWFeatureFlags(
  enablement: ProviderEnablementFlags = resolveProviderEnablementFlags(),
  overrides: Partial<ProviderFeatureFlags> & {
    providers?: Partial<Record<LiveProviderFlagKey, boolean>>
  } = {},
  env?: Record<string, string | undefined>,
): ProviderFeatureFlags {
  const base = resolveProviderFeatureFlags(overrides)

  const decisions = {
    amadeus: selectProviderForCapability('flights', { flags: enablement, env }),
    booking_com: selectProviderForCapability('hotels', { flags: enablement, env }),
    google_maps: selectProviderForCapability('maps', { flags: enablement, env }),
    openweather: selectProviderForCapability('weather', { flags: enablement, env }),
  }

  const providers: Record<LiveProviderFlagKey, boolean> = {
    amadeus:
      overrides.providers?.amadeus ??
      (decisions.amadeus.outcome === 'live_selected' &&
        isCapabilityLiveEnabled(enablement, 'flights')),
    booking_com:
      overrides.providers?.booking_com ??
      (decisions.booking_com.outcome === 'live_selected' &&
        isCapabilityLiveEnabled(enablement, 'hotels')),
    google_maps:
      overrides.providers?.google_maps ??
      (decisions.google_maps.outcome === 'live_selected' &&
        isCapabilityLiveEnabled(enablement, 'maps')),
    openweather:
      overrides.providers?.openweather ??
      (decisions.openweather.outcome === 'live_selected' &&
        isCapabilityLiveEnabled(enablement, 'weather')),
  }

  return {
    // Master must be on for any live provider; defaults keep this false.
    liveIntegrationEnabled: overrides.liveIntegrationEnabled ?? enablement.masterLive,
    mockFallbackEnabled: overrides.mockFallbackEnabled ?? enablement.mockFallbackEnabled,
    providers,
    amadeusEnvironment: overrides.amadeusEnvironment ?? base.amadeusEnvironment,
  }
}

/**
 * Resolve Phase W flags with Phase AJ enablement applied.
 * Safe default: everything OFF / mock.
 */
export function resolveEnablementAwareFeatureFlags(
  env?: Record<string, string | undefined>,
  overrides: Partial<ProviderFeatureFlags> & {
    providers?: Partial<Record<LiveProviderFlagKey, boolean>>
  } = {},
): ProviderFeatureFlags {
  const enablement = resolveProviderEnablementFlags(env)
  return toPhaseWFeatureFlags(enablement, overrides, env)
}
