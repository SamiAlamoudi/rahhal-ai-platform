/**
 * Phase AF — pipeline-level confidence aggregation.
 * Does not replace per-engine confidence values.
 */

import type { Itinerary } from '../itinerary/models'
import type { Recommendation } from '../recommendations/models'
import type {
  BookingPreview,
  PipelineConfidence,
  PipelineNormalizedPreferences,
  TripPlannerConstraints,
} from './models'

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function avg(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function calculatePipelineConfidence(input: {
  recommendations: Recommendation[]
  recommendationOverall?: number | null
  itinerary: Itinerary | null
  preferences: PipelineNormalizedPreferences | null
  bookingPreview: BookingPreview | null
  includeBookingPreview: boolean
  constraints?: TripPlannerConstraints | null
  hasBudget: boolean
  hasDates: boolean
}): PipelineConfidence {
  const recommendation =
    input.recommendationOverall ??
    avg(input.recommendations.map((r) => r.confidence))

  const itinerary = input.itinerary?.explanation.confidence ?? 0

  let dataCompleteness = 0.4
  if (input.preferences) dataCompleteness += 0.15
  if (input.hasBudget) dataCompleteness += 0.15
  if (input.hasDates) dataCompleteness += 0.1
  if (input.recommendations.length > 0) dataCompleteness += 0.1
  if (input.itinerary) dataCompleteness += 0.1
  dataCompleteness = clamp01(dataCompleteness)

  let constraintSatisfaction = 0.8
  const notes: string[] = []
  const constraints = input.constraints
  if (constraints?.preferDirectFlights && input.itinerary) {
    const allDirect = input.itinerary.flights.every((f) => f.direct)
    if (!allDirect) {
      constraintSatisfaction -= 0.15
      notes.push('Some flights are not direct despite preference')
    }
  }
  if (constraints?.mustAvoid?.length && input.itinerary) {
    const blob = JSON.stringify(input.itinerary).toLowerCase()
    for (const avoid of constraints.mustAvoid) {
      if (avoid && blob.includes(avoid.toLowerCase())) {
        constraintSatisfaction -= 0.2
        notes.push(`Constraint conflict: avoided term "${avoid}" appears in itinerary`)
      }
    }
  }
  constraintSatisfaction = clamp01(constraintSatisfaction)

  let bookingPreviewReadiness: number | null = null
  if (input.includeBookingPreview) {
    if (!input.bookingPreview) {
      bookingPreviewReadiness = 0
      notes.push('Booking preview was requested but not produced')
    } else {
      bookingPreviewReadiness = clamp01(
        (input.bookingPreview.validated ? 0.5 : 0) +
          (input.bookingPreview.reservationReady ? 0.5 : 0),
      )
    }
  }

  const parts = [
    recommendation * 0.3,
    itinerary * 0.3,
    dataCompleteness * 0.2,
    constraintSatisfaction * 0.2,
  ]
  if (bookingPreviewReadiness != null) {
    parts.push(bookingPreviewReadiness * 0.15)
  }
  const weight = bookingPreviewReadiness != null ? 1.15 : 1
  const overall = clamp01(parts.reduce((a, b) => a + b, 0) / weight)

  return {
    overall: Number(overall.toFixed(4)),
    recommendation: Number(clamp01(recommendation).toFixed(4)),
    itinerary: Number(clamp01(itinerary).toFixed(4)),
    dataCompleteness: Number(dataCompleteness.toFixed(4)),
    constraintSatisfaction: Number(constraintSatisfaction.toFixed(4)),
    bookingPreviewReadiness:
      bookingPreviewReadiness == null
        ? null
        : Number(bookingPreviewReadiness.toFixed(4)),
    notes,
  }
}
