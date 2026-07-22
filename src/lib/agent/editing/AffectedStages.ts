/**
 * Sprint 118 — AffectedStages
 * Maps edit kinds → stages to rerun / skip.
 */

import type { PipelineStageId, PipelineStageOverrides } from '../pipeline'
import { PIPELINE_STAGE_ORDER } from '../pipeline'
import type { AnalyzedEdit, EditKind } from './EditAnalyzer'

/** Typical durations (ms) for ETA — mirrors streaming hints, not duplicated logic. */
const STAGE_ETA_MS: Record<PipelineStageId, number> = {
  conversation: 40,
  memory: 80,
  preference_resolution: 40,
  search_planning: 50,
  flight_search: 350,
  hotel_search: 350,
  decision: 70,
  trip_builder: 120,
  itinerary: 150,
  response_composer: 90,
  concierge: 80,
  final: 30,
}

/** Core stages always lightly touched for conversation understanding of the edit. */
const ALWAYS_RERUN: PipelineStageId[] = ['conversation', 'final']

function unique(ids: PipelineStageId[]): PipelineStageId[] {
  return [...new Set(ids)]
}

export function coreStagesForEdit(kind: EditKind): PipelineStageId[] {
  switch (kind) {
    case 'change_hotel':
    case 'hotel_only':
      return [
        'conversation',
        'search_planning',
        'hotel_search',
        'decision',
        'trip_builder',
        'itinerary',
        'response_composer',
        'concierge',
        'final',
      ]
    case 'flight_only':
    case 'change_cabin':
      return [
        'conversation',
        'search_planning',
        'flight_search',
        'decision',
        'trip_builder',
        'itinerary',
        'response_composer',
        'concierge',
        'final',
      ]
    case 'change_budget':
      return [
        'conversation',
        'preference_resolution',
        'decision',
        'trip_builder',
        'itinerary',
        'response_composer',
        'concierge',
        'final',
      ]
    case 'change_destination':
    case 'change_travelers':
      return [
        'conversation',
        'memory',
        'preference_resolution',
        'search_planning',
        'flight_search',
        'hotel_search',
        'decision',
        'trip_builder',
        'itinerary',
        'response_composer',
        'concierge',
        'final',
      ]
    case 'extend_trip':
    case 'shorten_trip':
      return [
        'conversation',
        'hotel_search',
        'decision',
        'trip_builder',
        'itinerary',
        'response_composer',
        'concierge',
        'final',
      ]
    case 'remove_city':
    case 'add_city':
      return [
        'conversation',
        'trip_builder',
        'itinerary',
        'response_composer',
        'concierge',
        'final',
      ]
    default:
      return [
        'conversation',
        'search_planning',
        'flight_search',
        'hotel_search',
        'decision',
        'trip_builder',
        'itinerary',
        'response_composer',
        'concierge',
        'final',
      ]
  }
}

export interface AffectedStagesPlan {
  affectedStages: PipelineStageId[]
  stagesToRerun: PipelineStageId[]
  stagesToSkip: PipelineStageId[]
  estimatedExecutionTimeMs: number
  stageOverrides: PipelineStageOverrides
}

export function planAffectedStages(edit: AnalyzedEdit): AffectedStagesPlan {
  const stagesToRerun = unique([...ALWAYS_RERUN, ...coreStagesForEdit(edit.kind)])
  const rerunSet = new Set(stagesToRerun)
  const stagesToSkip = PIPELINE_STAGE_ORDER.filter((id) => !rerunSet.has(id))
  const estimatedExecutionTimeMs = stagesToRerun.reduce(
    (s, id) => s + (STAGE_ETA_MS[id] ?? 100),
    0,
  )

  const stageOverrides: PipelineStageOverrides = {
    skipMemory: stagesToSkip.includes('memory'),
    skipSearchPlanning: stagesToSkip.includes('search_planning'),
    skipFlightSearch: stagesToSkip.includes('flight_search'),
    skipHotelSearch: stagesToSkip.includes('hotel_search'),
    skipDecision: stagesToSkip.includes('decision'),
    skipTripBuilder: stagesToSkip.includes('trip_builder'),
    skipItinerary: stagesToSkip.includes('itinerary'),
    skipResponseComposer: stagesToSkip.includes('response_composer'),
    skipConcierge: stagesToSkip.includes('concierge'),
  }

  return {
    affectedStages: stagesToRerun.slice(),
    stagesToRerun,
    stagesToSkip,
    estimatedExecutionTimeMs,
    stageOverrides,
  }
}

export class AffectedStages {
  plan(edit: AnalyzedEdit): AffectedStagesPlan {
    return planAffectedStages(edit)
  }
}

export function createAffectedStages(): AffectedStages {
  return new AffectedStages()
}
