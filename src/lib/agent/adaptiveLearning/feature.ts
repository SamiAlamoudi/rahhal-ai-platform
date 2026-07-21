import { getFeatureRegistry } from '../../ai'

export const ADAPTIVE_LEARNING_FEATURE_ID = 'ai.adaptive_learning' as const

export function isAdaptiveLearningEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.adaptive_learning')
}
