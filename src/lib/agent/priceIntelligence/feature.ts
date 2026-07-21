import { getFeatureRegistry } from '../../ai'

export const PRICE_INTELLIGENCE_FEATURE_ID = 'ai.price_intelligence' as const

export function isPriceIntelligenceEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.price_intelligence')
}
