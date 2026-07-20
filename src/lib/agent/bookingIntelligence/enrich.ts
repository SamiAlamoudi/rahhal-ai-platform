/**
 * Shared post-tool enrichment — booking intelligence after plan merge/decision.
 */

import type { AgentMemory, TripPlan } from '../types'
import { isBookingIntelligenceEnabled } from './feature'
import { runBookingIntelligence } from './orchestrator'
import type { BookingIntelligenceResult, BookingProviderRegistry } from './types'

export async function enrichWithBookingIntelligence(input: {
  memory: AgentMemory
  tripPlan: TripPlan
  userId: string
  enabled?: boolean
  registry?: BookingProviderRegistry
  signal?: AbortSignal
}): Promise<{
  tripPlan: TripPlan
  bookingIntelligence: BookingIntelligenceResult | null
}> {
  if (!isBookingIntelligenceEnabled({ enabled: input.enabled })) {
    return { tripPlan: input.tripPlan, bookingIntelligence: null }
  }

  const result = await runBookingIntelligence({
    memory: input.memory,
    userId: input.userId,
    registry: input.registry,
    signal: input.signal,
  })

  const notes = [
    ...input.tripPlan.notes,
    ...result.recommendationFacts.slice(0, 3).map((fact) => `Booking intelligence: ${fact}`),
  ]

  return {
    tripPlan: {
      ...input.tripPlan,
      notes,
    },
    bookingIntelligence: result,
  }
}
