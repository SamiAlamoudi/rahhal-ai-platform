import { getFeatureRegistry } from '../../ai'

export const DYNAMIC_PACKAGES_FEATURE_ID = 'ai.dynamic_packages' as const

export function isDynamicPackagesEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.dynamic_packages')
}
