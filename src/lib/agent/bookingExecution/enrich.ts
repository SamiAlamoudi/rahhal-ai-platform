/**
 * Build execution line items + optional post-intelligence enrichment — Sprint 57.
 */

import type { BookingIntelligenceResult } from '../bookingIntelligence/types'
import { getDefaultBookingProviderRegistry } from '../bookingIntelligence'
import type { AgentMemory, TripPlan } from '../types'
import {
  isBookingExecutionEnabled,
  isBookingResumeEnabled,
  isTransactionManagerEnabled,
} from './feature'
import { runBookingExecution } from './orchestrator'
import type {
  BookingExecutionLineItem,
  BookingExecutionResult,
  BookingTravelerInfo,
} from './types'
import { domainFromBookingProviderDomain } from './types'

export function lineItemsFromBookingIntelligence(
  result: BookingIntelligenceResult,
  options?: { maxItems?: number },
): BookingExecutionLineItem[] {
  const maxItems = options?.maxItems ?? 6
  const combination = result.combinations[0]
  const byId = new Map(result.ranked.map((o) => [o.id, o]))
  const items: BookingExecutionLineItem[] = []

  if (combination) {
    const ids = [
      combination.flightId,
      combination.hotelId,
      combination.transferId,
      combination.carRentalId,
      combination.insuranceId,
      ...combination.activityIds,
    ].filter(Boolean) as string[]
    for (const id of ids) {
      const offer = byId.get(id)
      if (!offer) continue
      const domain = domainFromBookingProviderDomain(offer.domain)
      if (!domain) continue
      items.push({
        domain,
        offerId: offer.id,
        providerId: offer.providerId,
        title: offer.title,
        price: offer.price,
        offer,
      })
    }
  }

  if (items.length === 0) {
    for (const offer of result.ranked.slice(0, maxItems)) {
      const domain = domainFromBookingProviderDomain(offer.domain)
      if (!domain) continue
      if (items.some((i) => i.domain === domain)) continue
      items.push({
        domain,
        offerId: offer.id,
        providerId: offer.providerId,
        title: offer.title,
        price: offer.price,
        offer,
      })
    }
  }

  return items.slice(0, maxItems)
}

export function shouldRunBookingExecution(input: {
  userText?: string | null
  intent?: string | null
  bookingReady?: boolean
}): boolean {
  if (!input.bookingReady) return false
  const intent = (input.intent || '').toLowerCase()
  if (
    intent === 'booking_confirmed'
    || intent === 'show_confirmation'
    || intent === 'show_checkout'
  ) {
    return true
  }
  const text = (input.userText || '').toLowerCase()
  if (!text) return false
  return (
    /أكد الحجز|تاكيد الحجز|تأكيد الحجز|احجز|نفّذ الحجز|نفذ الحجز/.test(text)
    || /\b(confirm booking|book (it|now)|complete booking|execute booking)\b/.test(text)
  )
}

export async function enrichWithBookingExecution(input: {
  memory: AgentMemory
  tripPlan: TripPlan
  userId: string
  bookingIntelligence: BookingIntelligenceResult | null
  userText?: string
  enabled?: boolean
  resumeEnabled?: boolean
  transactionEnabled?: boolean
  signal?: AbortSignal
}): Promise<{
  tripPlan: TripPlan
  bookingExecution: BookingExecutionResult | null
}> {
  if (!isBookingExecutionEnabled({ enabled: input.enabled })) {
    return { tripPlan: input.tripPlan, bookingExecution: null }
  }
  if (!input.bookingIntelligence?.readiness.bookingReady) {
    return { tripPlan: input.tripPlan, bookingExecution: null }
  }
  if (!shouldRunBookingExecution({
    userText: input.userText,
    intent: input.memory.lastIntent,
    bookingReady: true,
  })) {
    return { tripPlan: input.tripPlan, bookingExecution: null }
  }

  const items = lineItemsFromBookingIntelligence(input.bookingIntelligence)
  if (items.length === 0) {
    return { tripPlan: input.tripPlan, bookingExecution: null }
  }

  const travelers: BookingTravelerInfo[] = [
    {
      firstName: 'Bilamo',
      lastName: 'Traveler',
      email: null,
      phone: null,
    },
  ]

  const result = await runBookingExecution({
    userId: input.userId,
    items,
    travelers,
    registry: getDefaultBookingProviderRegistry(),
    signal: input.signal,
    resumeEnabled: isBookingResumeEnabled({ enabled: input.resumeEnabled }),
    transaction: {
      enabled: isTransactionManagerEnabled({ enabled: input.transactionEnabled }),
    },
    allOrNothing: false,
  })

  const notes = [
    ...input.tripPlan.notes,
    ...result.executionFacts.slice(0, 4).map((fact) => `Booking execution: ${fact}`),
  ]

  return {
    tripPlan: { ...input.tripPlan, notes },
    bookingExecution: result,
  }
}
