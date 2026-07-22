/**
 * Sprint 101 — booking journey timeline (presentation only).
 */

import type { BookingAssistantComposeInput, BookingReadinessSection } from './BookingReadiness'

export type BookingTimelineStageId =
  | 'planning'
  | 'searching'
  | 'comparing'
  | 'optimizing'
  | 'booking_ready'
  | 'payment'
  | 'confirmation'

export interface BookingTimelineStage {
  id: BookingTimelineStageId
  label: string
  status: 'pending' | 'running' | 'completed' | 'skipped'
  message: string
  progressPercent: number
}

export interface BookingTimelineSection {
  id: 'timeline'
  currentStageId: BookingTimelineStageId
  stages: BookingTimelineStage[]
  progressPercent: number
}

const STAGE_DEFS: Array<{ id: BookingTimelineStageId; label: string }> = [
  { id: 'planning', label: 'Planning' },
  { id: 'searching', label: 'Searching' },
  { id: 'comparing', label: 'Comparing' },
  { id: 'optimizing', label: 'Optimizing' },
  { id: 'booking_ready', label: 'Booking Ready' },
  { id: 'payment', label: 'Payment' },
  { id: 'confirmation', label: 'Confirmation' },
]

function resolveCurrentStage(
  input: BookingAssistantComposeInput,
  readiness: BookingReadinessSection,
): BookingTimelineStageId {
  if (input.bookingConfirmed) return 'confirmation'
  if (input.paymentSessionActive) return 'payment'
  if (readiness.readyToBook) return 'booking_ready'

  const alphaIds = input.alpha?.sectionIds ?? []
  if (alphaIds.includes('package') || alphaIds.includes('price') || input.packageOffer) {
    return 'optimizing'
  }
  if (alphaIds.includes('alternatives') || (input.flight && input.hotel)) {
    return 'comparing'
  }
  if (input.flight || input.hotel || input.flightSelected || input.hotelSelected) {
    return 'searching'
  }
  return 'planning'
}

/**
 * Build timeline when any booking/planning signal exists; otherwise hide.
 */
export function buildBookingTimeline(
  input: BookingAssistantComposeInput,
  readiness: BookingReadinessSection,
): BookingTimelineSection | null {
  const hasSignal = Boolean(
    input.alpha?.enabled
    || input.destination
    || input.flight
    || input.hotel
    || input.packageOffer
    || input.bookingConfirmed
    || input.paymentSessionActive
    || readiness.status !== 'planning'
  )
  if (!hasSignal && readiness.status === 'planning' && !input.destination) {
    return null
  }

  const current = resolveCurrentStage(input, readiness)
  const currentIndex = STAGE_DEFS.findIndex((s) => s.id === current)

  const stages: BookingTimelineStage[] = STAGE_DEFS.map((def, index) => {
    let status: BookingTimelineStage['status'] = 'pending'
    if (index < currentIndex) status = 'completed'
    else if (index === currentIndex) status = 'running'
    const progressPercent = Math.round(((index + 1) / STAGE_DEFS.length) * 100)
    return {
      id: def.id,
      label: def.label,
      status,
      message: def.label,
      progressPercent,
    }
  })

  if (current === 'confirmation') {
    for (const stage of stages) stage.status = 'completed'
  }

  return {
    id: 'timeline',
    currentStageId: current,
    stages,
    progressPercent: stages[currentIndex]?.progressPercent
      ?? Math.round(((currentIndex + 1) / STAGE_DEFS.length) * 100),
  }
}
