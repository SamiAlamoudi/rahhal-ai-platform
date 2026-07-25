/**
 * Full default provider set (live wrappers + mocks) for discovery / architecture tests.
 * Kept separate from `factory.ts` so mock-default aggregation does not import live adapters.
 */

import {
  createLiveIntegration,
  createLiveIntegrationEngine,
  createLiveProviderAdapters,
  createLiveProviderRegistry,
  resolveProviderFeatureFlags,
} from './liveIntegration'
import { createProviderRegistry } from './providerRegistry'
import type { ProviderAdapter, ProviderRegistry } from './types'

export function createDefaultProviderAdapters(): ProviderAdapter[] {
  const flags = resolveProviderFeatureFlags()
  return createLiveProviderAdapters(flags)
}

export function createDefaultProviderRegistry(
  adapters: ProviderAdapter[] = createDefaultProviderAdapters(),
): ProviderRegistry {
  return createProviderRegistry(adapters)
}

export {
  createLiveIntegration,
  createLiveIntegrationEngine,
  createLiveProviderRegistry,
  createLiveProviderAdapters,
}
