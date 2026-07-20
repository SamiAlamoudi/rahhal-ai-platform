import { getFeatureRegistry } from '../../../ai/featureFlags'

export const EXECUTIVE_OS_FEATURE_ID = 'ai.executive_os' as const

export function isExecutiveOsEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(EXECUTIVE_OS_FEATURE_ID)
}
