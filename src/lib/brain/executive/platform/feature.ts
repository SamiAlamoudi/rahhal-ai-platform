import { getFeatureRegistry } from '../../../ai/featureFlags'

export const EXECUTIVE_PLATFORM_FEATURE_ID = 'ai.executive_platform' as const

export function isExecutivePlatformEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(EXECUTIVE_PLATFORM_FEATURE_ID)
}
