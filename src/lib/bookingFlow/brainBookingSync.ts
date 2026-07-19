/**
 * Sprint 25 — sync booking flow context into Brain conversation memory.
 * Reuses ConversationMemoryApi; no new brain engine.
 */

import {
  ConversationMemoryApi,
  type ConversationMemory,
} from '../brain'
import type { BookingFlowState } from './types'
import type { BookingSession } from '../booking/bookingTypes'

/**
 * Patch brain memory with the latest booking flow facts after every change.
 */
export function syncBrainMemoryFromBookingFlow(
  memory: ConversationMemory,
  flow: BookingFlowState,
  session: BookingSession | null,
): ConversationMemory {
  const flight = session?.items.find((i) => i.type === 'flight')
  const hotel = session?.items.find((i) => i.type === 'hotel')

  return ConversationMemoryApi.applyPatch(memory, {
    budget: {
      amount: flow.budget.amount,
      currency: flow.budget.currency ?? flow.currency,
      flexible: memory.budget.flexible,
    },
    travelDates: {
      startDate: flow.dates.startDate,
      endDate: flow.dates.endDate,
      durationDays: flow.dates.durationDays,
      flexible: memory.travelDates.flexible,
    },
    travelers: {
      count:
        (flow.travelers.adults ?? 0) +
          (flow.travelers.children ?? 0) +
          (flow.travelers.infants ?? 0) || memory.travelers.count,
      adults: flow.travelers.adults ?? memory.travelers.adults,
      children: flow.travelers.children ?? memory.travelers.children,
      infants: flow.travelers.infants ?? memory.travelers.infants,
    },
    currency: flow.currency || memory.currency,
    hotelPreferences: hotel
      ? Array.from(new Set([...(memory.hotelPreferences ?? []), hotel.title]))
      : memory.hotelPreferences,
    airlinePreferences: flight
      ? Array.from(
          new Set([
            ...(memory.airlinePreferences ?? []),
            String(flight.metadata.airline ?? flight.providerName),
          ]),
        )
      : memory.airlinePreferences,
    hotelRequirement: hotel ? true : memory.hotelRequirement,
  })
}

export function bookingFlowBrainContextSummary(
  flow: BookingFlowState,
  session: BookingSession | null,
): string {
  const parts = [
    `stage:${flow.stage}`,
    session ? `items:${session.items.length}` : 'items:0',
    session ? `total:${session.total}${session.currency}` : null,
    flow.lastEditedSection ? `edited:${flow.lastEditedSection}` : null,
  ]
  return parts.filter(Boolean).join(' · ')
}
