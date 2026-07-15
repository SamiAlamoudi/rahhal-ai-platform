/**
 * Phase AG — deterministic stage-based progress percentage.
 */

import type { TripPlannerStage } from '../models'

const STAGE_PROGRESS: Record<TripPlannerStage, number> = {
  Received: 5,
  Validating: 10,
  PreferencesPrepared: 25,
  RecommendationsGenerated: 45,
  ItineraryGenerated: 70,
  BookingPreviewGenerated: 90,
  Completed: 100,
  Failed: 0,
  Cancelled: 0,
}

export function progressForStage(
  stage: TripPlannerStage,
  options: {
    includeBookingPreview: boolean
    lastCompletedProgress?: number
  },
): number {
  if (stage === 'Completed') return 100
  if (stage === 'Failed' || stage === 'Cancelled') {
    return options.lastCompletedProgress ?? 0
  }
  if (!options.includeBookingPreview && stage === 'ItineraryGenerated') {
    return 100
  }
  return STAGE_PROGRESS[stage] ?? 0
}

export function progressFromTimeline(
  stages: TripPlannerStage[],
  includeBookingPreview: boolean,
): number {
  let lastGood = 0
  for (const stage of stages) {
    if (stage === 'Failed' || stage === 'Cancelled') {
      return lastGood
    }
    lastGood = Math.max(
      lastGood,
      progressForStage(stage, {
        includeBookingPreview,
        lastCompletedProgress: lastGood,
      }),
    )
  }
  return lastGood
}
