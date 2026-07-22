/**
 * Sprint 99 — Traveler journey / live conversation timeline assembly.
 */

import type {
  AlphaExperienceComposeInput,
  TravelerTimelineSection,
  TravelerTimelineStage,
} from './AlphaExperienceDTO'
import { priorityForSection } from './ExperiencePriority'

const DEFAULT_JOURNEY: Array<{ id: string; label: string }> = [
  { id: 'thinking', label: 'Thinking' },
  { id: 'searching', label: 'Searching' },
  { id: 'comparing', label: 'Comparing' },
  { id: 'optimizing', label: 'Optimizing' },
  { id: 'final_recommendation', label: 'Final recommendation' },
]

/**
 * Build timeline from concierge stages when present; otherwise derive a
 * completed journey when any recommendation signal exists. Hide when empty.
 */
export function buildTravelerJourneyTimeline(
  input: AlphaExperienceComposeInput,
): TravelerTimelineSection | null {
  const conciergeStages = input.concierge?.timeline?.stages
  if (conciergeStages && conciergeStages.length > 0) {
    const stages: TravelerTimelineStage[] = conciergeStages.map((s) => ({
      id: s.id,
      label: s.label,
      status: mapStatus(s.status),
      message: s.message,
      progressPercent: s.progressPercent,
    }))
    return {
      id: 'timeline',
      priority: priorityForSection('timeline'),
      currentStageId: input.concierge?.timeline?.currentStageId
        ?? stages[stages.length - 1]?.id
        ?? null,
      stages,
      progressPercent: input.concierge?.timeline?.progressPercent
        ?? stages[stages.length - 1]?.progressPercent
        ?? 0,
    }
  }

  const hasAnySignal = Boolean(
    input.packageSelected
    || input.flight
    || input.hotel
    || input.concierge?.enabled
    || input.decisionExplanation
    || input.priceOpportunity,
  )
  if (!hasAnySignal) return null

  const stages: TravelerTimelineStage[] = DEFAULT_JOURNEY.map((s, i) => ({
    id: s.id,
    label: s.label,
    status: 'completed',
    message: s.label,
    progressPercent: Math.round(((i + 1) / DEFAULT_JOURNEY.length) * 100),
  }))

  return {
    id: 'timeline',
    priority: priorityForSection('timeline'),
    currentStageId: 'final_recommendation',
    stages,
    progressPercent: 100,
  }
}

function mapStatus(status: string): TravelerTimelineStage['status'] {
  if (status === 'running' || status === 'pending' || status === 'skipped') return status
  return 'completed'
}
