import { getFeatureRegistry } from '../../ai/featureFlags'

export const BOOKING_EXECUTION_FEATURE_ID = 'ai.booking_execution' as const
export const TRANSACTION_MANAGER_FEATURE_ID = 'ai.transaction_manager' as const
export const BOOKING_RESUME_FEATURE_ID = 'ai.booking_resume' as const

export function isBookingExecutionEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.booking_execution')
}

export function isTransactionManagerEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  if (!isBookingExecutionEnabled()) return false
  return getFeatureRegistry().isEnabled('ai.transaction_manager')
}

export function isBookingResumeEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  if (!isBookingExecutionEnabled()) return false
  return getFeatureRegistry().isEnabled('ai.booking_resume')
}
