import { getFeatureRegistry } from '../../ai'

export const ITINERARY_REFINEMENT_FEATURE_ID = 'ai.itinerary_refinement' as const

export function isItineraryRefinementEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.itinerary_refinement')
}
