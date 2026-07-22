/**
 * Sprint 103 — single DTO pipeline from agent meta → booking execution compose.
 * Avoids duplicated mapping across UI entry points.
 */

import type { BookingExecutionComposeInput } from '../../core'
import type { AgentProviderMeta } from '../agent/types'
import { composeInputFromAssistantSnapshot } from '../bookingExecutionConfirmation'

function sectionRecord(sections: unknown[] | undefined, id: string): Record<string, unknown> | null {
  if (!Array.isArray(sections)) return null
  for (const raw of sections) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    if (row.id === id) return row
  }
  return null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Map existing agent turn meta into Booking Execution compose input.
 * Reads Alpha + Booking Assistant + package/dynamic snapshots already on meta.
 */
export function bookingComposeFromAgentMeta(
  meta: AgentProviderMeta | null | undefined,
): BookingExecutionComposeInput {
  const memory = meta?.memory
  const req = memory?.requirements
  const alpha = meta?.alphaTravelerExperience
  const assistant = meta?.bookingAssistant
  const alphaSections = alpha?.experience?.sections
  const flight = sectionRecord(alphaSections, 'flight')
  const hotel = sectionRecord(alphaSections, 'hotel')
  const pkg = sectionRecord(alphaSections, 'package')
  const price = sectionRecord(alphaSections, 'price')
  const packages = meta?.dynamicPackages as
    | { selected?: { id?: string; title?: string; totalPrice?: number; currency?: string } }
    | undefined

  const flightLabel = flight
    ? [str(flight.airline), str(flight.origin) && str(flight.destination)
      ? `${str(flight.origin)} → ${str(flight.destination)}`
      : null].filter(Boolean).join(' · ') || null
    : null

  const hotelLabel = hotel ? str(hotel.name) : null
  const packageLabel = pkg
    ? str(pkg.title)
    : str(packages?.selected?.title) ?? null

  const total = num(pkg?.totalPrice)
    ?? num(packages?.selected?.totalPrice)
    ?? (() => {
      const f = num(flight?.price)
      const h = num(hotel?.price)
      if (f == null && h == null) return null
      return (f ?? 0) + (h ?? 0)
    })()

  return composeInputFromAssistantSnapshot({
    conversationId: alpha?.conversationId
      ?? assistant?.conversationId
      ?? undefined,
    destination: req?.destination ?? null,
    origin: req?.origin ?? null,
    startDate: req?.startDate ?? null,
    endDate: req?.endDate ?? null,
    travelers: req?.travelers ?? null,
    flightLabel,
    hotelLabel,
    packageLabel,
    total,
    taxes: null,
    baseFare: null,
    fees: null,
    savings: null,
    currency: req?.budgetCurrency
      ?? str(pkg?.currency)
      ?? str(packages?.selected?.currency)
      ?? 'SAR',
    cancellationSummary: str(price?.note),
    refundable: null,
    flightId: str(flight?.flightId) ?? str(flight?.id),
    hotelId: str(hotel?.hotelId) ?? str(hotel?.id),
    packageId: str(pkg?.packageId) ?? str(pkg?.id) ?? str(packages?.selected?.id),
  })
}

export interface AlphaNextStep {
  stage: string
  path: string
  label: string
  state?: Record<string, unknown>
}

/**
 * Resolve the next traveler-facing step from existing meta + flags.
 */
export function resolveAlphaNextStep(input: {
  meta: AgentProviderMeta | null | undefined
  bookingExecutionEnabled: boolean
  myTripsEnabled: boolean
  locale?: 'ar' | 'en'
}): AlphaNextStep | null {
  const en = input.locale === 'en'
  const meta = input.meta
  if (!meta) return null

  const assistant = meta.bookingAssistant
  if (assistant?.readyToBook && input.bookingExecutionEnabled) {
    return {
      stage: 'booking_review',
      path: '/booking-assistant/review',
      label: en ? 'Review & book' : 'مراجعة والحجز',
      state: { compose: bookingComposeFromAgentMeta(meta) },
    }
  }

  if (assistant?.readyToBook && !input.bookingExecutionEnabled) {
    return {
      stage: 'booking_review',
      path: '/booking/review',
      label: en ? 'Continue booking' : 'متابعة الحجز',
    }
  }

  if (meta.bookingExecution && meta.bookingExecution.confirmedCount > 0 && input.myTripsEnabled) {
    return {
      stage: 'my_trips',
      path: '/my-trips',
      label: en ? 'Open My Trips' : 'رحلاتي',
    }
  }

  if (meta.bookingIntelligence && !meta.bookingIntelligence.bookingReady) {
    return null
  }

  return null
}
