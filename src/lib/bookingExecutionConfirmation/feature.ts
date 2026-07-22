import { getFeatureRegistry } from '../ai'

export const BOOKING_EXECUTION_CONFIRMATION_FEATURE_ID =
  'ai.booking_execution_confirmation' as const

export function isBookingExecutionConfirmationEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.booking_execution_confirmation')
}
