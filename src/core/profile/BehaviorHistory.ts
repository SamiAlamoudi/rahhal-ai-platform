/**
 * Sprint 80 — behavior history helpers.
 */

import type { BehaviorEvent, LearningSource, TravelerProfile } from './TravelerProfile'

let seq = 0

export function appendBehavior(
  profile: TravelerProfile,
  type: BehaviorEvent['type'],
  payload: Record<string, unknown> = {},
  at = new Date().toISOString(),
): TravelerProfile {
  const event: BehaviorEvent = {
    id: `beh_${Date.now()}_${++seq}`,
    type,
    at,
    payload,
  }
  return {
    ...profile,
    behaviorHistory: [...profile.behaviorHistory.slice(-199), event],
    updatedAt: at,
  }
}

export function countBehaviorMatches(
  profile: TravelerProfile,
  predicate: (event: BehaviorEvent) => boolean,
): number {
  return profile.behaviorHistory.filter(predicate).length
}

export function recentSources(profile: TravelerProfile, limit = 20): LearningSource[] {
  return profile.behaviorHistory
    .slice(-limit)
    .map((e) => e.type)
    .filter((t): t is LearningSource =>
      [
        'conversation',
        'search_history',
        'accepted_recommendation',
        'rejected_recommendation',
        'booking_selection',
        'trip_completion',
        'user_correction',
        'explicit',
        'implicit',
        'repeated_behavior',
      ].includes(t),
    )
}
