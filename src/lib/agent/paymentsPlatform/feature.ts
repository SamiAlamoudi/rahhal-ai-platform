import { getFeatureRegistry } from '../../ai/featureFlags'

export const PAYMENTS_FEATURE_ID = 'ai.payments' as const
export const TICKETING_FEATURE_ID = 'ai.ticketing' as const
export const REFUNDS_FEATURE_ID = 'ai.refunds' as const

export function isPaymentsEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.payments')
}

export function isTicketingEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  if (!isPaymentsEnabled()) return false
  return getFeatureRegistry().isEnabled('ai.ticketing')
}

export function isRefundsEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  if (!isPaymentsEnabled()) return false
  return getFeatureRegistry().isEnabled('ai.refunds')
}
