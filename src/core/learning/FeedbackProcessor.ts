/**
 * Sprint 80 — process explicit/implicit feedback into preference signals.
 */

import type { LearningSource } from '../profile/TravelerProfile'
import type { InferredPreferenceSignal } from './PreferenceInference'

export interface FeedbackInput {
  type:
    | 'accepted_recommendation'
    | 'rejected_recommendation'
    | 'booking_selection'
    | 'trip_completion'
    | 'user_correction'
    | 'search_history'
  airline?: string | null
  hotelBrand?: string | null
  seat?: string | null
  cabin?: string | null
  roomType?: string | null
  walkMinutes?: number | null
  expensiveRejected?: boolean
  destination?: string | null
  liked?: boolean
}

export function processFeedback(feedback: FeedbackInput): InferredPreferenceSignal[] {
  const source = feedback.type as LearningSource
  const signals: InferredPreferenceSignal[] = []
  const polarity = feedback.type === 'rejected_recommendation' || feedback.liked === false
    ? 'avoid'
    : 'prefer'

  if (feedback.airline) {
    signals.push({ kind: 'airline', value: feedback.airline.toLowerCase(), polarity, source })
  }
  if (feedback.hotelBrand) {
    signals.push({ kind: 'hotel_brand', value: feedback.hotelBrand.toLowerCase(), polarity, source })
  }
  if (feedback.seat) {
    signals.push({ kind: 'seat', value: feedback.seat.toLowerCase(), polarity: 'prefer', source })
  }
  if (feedback.cabin) {
    signals.push({ kind: 'cabin', value: feedback.cabin.toLowerCase(), polarity: 'prefer', source })
  }
  if (feedback.roomType) {
    signals.push({ kind: 'room_type', value: feedback.roomType.toLowerCase(), polarity: 'prefer', source })
  }
  if (feedback.walkMinutes != null && feedback.walkMinutes <= 15 && polarity === 'prefer') {
    signals.push({ kind: 'walkability', value: 'high', polarity: 'prefer', source })
  }
  if (feedback.expensiveRejected) {
    signals.push({ kind: 'luxury_vs_value', value: 'luxury', polarity: 'avoid', source })
    signals.push({ kind: 'hotel_budget_style', value: 'value', polarity: 'prefer', source })
  }
  if (feedback.destination) {
    signals.push({
      kind: polarity === 'avoid' ? 'disliked_destination' : 'favorite_destination',
      value: feedback.destination.toLowerCase(),
      polarity,
      source,
    })
  }
  return signals
}
