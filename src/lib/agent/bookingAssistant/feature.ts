import { getFeatureRegistry } from '../../ai'

export const BOOKING_ASSISTANT_FEATURE_ID = 'ai.booking_assistant' as const

export function isBookingAssistantEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.booking_assistant')
}
