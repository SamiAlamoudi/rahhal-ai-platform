/**
 * Sprint 92 — agent bridge for Amadeus Sandbox TravelProvider.
 */

export {
  AMADEUS_SANDBOX_FEATURE_ID,
  isAmadeusSandboxEnabled,
} from './feature'

export {
  createAmadeusSandboxProvider,
  registerAmadeusSandboxProvider,
  SPRINT92_AMADEUS_SANDBOX_VERSION,
  AMADEUS_SANDBOX_PROVIDER_ID,
  type AmadeusSandboxProvider,
  type AmadeusSandboxProviderOptions,
} from '../../../../core/amadeusSandbox'

import { createProviderRegistry, type ProviderRegistry } from '../../../../core/providers'
import {
  createAmadeusSandboxProvider,
  type AmadeusSandboxProviderOptions,
} from '../../../../core/amadeusSandbox'
import { isAmadeusSandboxEnabled } from './feature'

/**
 * Build a registry with Amadeus sandbox as primary when the feature flag allows it.
 * Always additive — callers may still register mocks as fallback.
 */
export function createAmadeusSandboxRegistry(
  options?: AmadeusSandboxProviderOptions & { enabled?: boolean },
): {
  registry: ProviderRegistry
  amadeus: ReturnType<typeof createAmadeusSandboxProvider> | null
  enabled: boolean
} {
  const registry = createProviderRegistry()
  const enabled = isAmadeusSandboxEnabled({ enabled: options?.enabled })
  if (!enabled) {
    return { registry, amadeus: null, enabled: false }
  }
  const amadeus = createAmadeusSandboxProvider(options)
  registry.register(amadeus, { tier: 'primary', rank: 0 })
  return { registry, amadeus, enabled: true }
}
