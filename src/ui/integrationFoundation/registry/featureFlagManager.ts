/**
 * Feature flag manager — presentation wrapper over the registry.
 * Local overrides are UI-only; they do not persist and are not production wiring.
 */

import { getFeatureRegistry } from '../../../lib/ai/featureFlags'
import type { FeatureId } from '../../../lib/ai/featureFlags/types'
import type { IntegrationModuleStatus } from '../types'
import { INTEGRATION_MODULES } from './moduleRegistry'

export function listModuleFeatureIds(): string[] {
  return INTEGRATION_MODULES.map((m) => m.featureId)
}

export function readModuleFlagEnabled(
  featureId: string,
  localOverrides?: Partial<Record<string, boolean>>,
): boolean {
  if (typeof localOverrides?.[featureId] === 'boolean') {
    return localOverrides[featureId] as boolean
  }
  try {
    return getFeatureRegistry().isEnabled(featureId as FeatureId)
  } catch {
    return false
  }
}

export function listModuleStatuses(
  localOverrides?: Partial<Record<string, boolean>>,
): IntegrationModuleStatus[] {
  const registry = getFeatureRegistry()
  return INTEGRATION_MODULES.map((mod) => {
    const def = registry.get(mod.featureId as FeatureId)
    return {
      id: mod.id,
      featureId: mod.featureId,
      registered: Boolean(def),
      flagEnabled: readModuleFlagEnabled(mod.featureId, localOverrides),
      presentationOnly: true,
      dependsOn: mod.dependsOn,
    }
  })
}

export function applyLocalFlagOverride(
  current: Partial<Record<string, boolean>>,
  featureId: string,
  enabled: boolean,
): Partial<Record<string, boolean>> {
  return { ...current, [featureId]: enabled }
}

export const FeatureFlagManager = {
  listModuleFeatureIds,
  readModuleFlagEnabled,
  listModuleStatuses,
  applyLocalFlagOverride,
}
