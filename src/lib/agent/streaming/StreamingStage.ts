/**
 * Sprint 116 — StreamingStage
 * Maps Execution Pipeline stages to user-facing streaming labels.
 */

import type { PipelineStageId } from '../pipeline'
import { PIPELINE_STAGE_ORDER } from '../pipeline'

export const SPRINT116_STREAMING_CONVERSATION_VERSION = '1.0.0-streaming-conversation'

export type StreamingStageId = PipelineStageId

export interface StreamingStageDefinition {
  id: StreamingStageId
  label: string
  startedMessage: string
  completedMessage: string
  /** Typical duration hint (ms) for ETA estimates. */
  typicalDurationMs: number
}

export const STREAMING_STAGE_DEFINITIONS: readonly StreamingStageDefinition[] = [
  {
    id: 'conversation',
    label: 'Understanding',
    startedMessage: 'Understanding your request...',
    completedMessage: 'Request understood',
    typicalDurationMs: 80,
  },
  {
    id: 'memory',
    label: 'Preferences',
    startedMessage: 'Loading preferences...',
    completedMessage: 'Preferences loaded',
    typicalDurationMs: 120,
  },
  {
    id: 'preference_resolution',
    label: 'Preference resolution',
    startedMessage: 'Resolving preferences...',
    completedMessage: 'Preferences resolved',
    typicalDurationMs: 60,
  },
  {
    id: 'search_planning',
    label: 'Search planning',
    startedMessage: 'Planning search...',
    completedMessage: 'Search plan ready',
    typicalDurationMs: 70,
  },
  {
    id: 'flight_search',
    label: 'Flights',
    startedMessage: 'Searching flights...',
    completedMessage: 'Flights found',
    typicalDurationMs: 400,
  },
  {
    id: 'hotel_search',
    label: 'Hotels',
    startedMessage: 'Searching hotels...',
    completedMessage: 'Hotels ranked',
    typicalDurationMs: 400,
  },
  {
    id: 'decision',
    label: 'Decision',
    startedMessage: 'Ranking options...',
    completedMessage: 'Options ranked',
    typicalDurationMs: 90,
  },
  {
    id: 'trip_builder',
    label: 'Trip builder',
    startedMessage: 'Building trip packages...',
    completedMessage: 'Trip packages ready',
    typicalDurationMs: 150,
  },
  {
    id: 'itinerary',
    label: 'Itinerary',
    startedMessage: 'Building itinerary...',
    completedMessage: 'Itinerary completed',
    typicalDurationMs: 180,
  },
  {
    id: 'response_composer',
    label: 'Response',
    startedMessage: 'Preparing final recommendation...',
    completedMessage: 'Recommendation drafted',
    typicalDurationMs: 120,
  },
  {
    id: 'concierge',
    label: 'Concierge',
    startedMessage: 'Enriching with concierge...',
    completedMessage: 'Concierge enrichment done',
    typicalDurationMs: 100,
  },
  {
    id: 'final',
    label: 'Final',
    startedMessage: 'Finalizing...',
    completedMessage: 'Done',
    typicalDurationMs: 40,
  },
] as const

const BY_ID = new Map(
  STREAMING_STAGE_DEFINITIONS.map((d) => [d.id, d] as const),
)

export function getStreamingStageDefinition(
  id: StreamingStageId,
): StreamingStageDefinition {
  return (
    BY_ID.get(id) ?? {
      id,
      label: id,
      startedMessage: `Starting ${id}...`,
      completedMessage: `${id} completed`,
      typicalDurationMs: 100,
    }
  )
}

export function streamingStageOrder(): readonly StreamingStageId[] {
  return PIPELINE_STAGE_ORDER
}

export function remainingStagesAfter(
  current: StreamingStageId | null,
  completed: readonly StreamingStageId[],
): StreamingStageId[] {
  const done = new Set(completed)
  const order = streamingStageOrder()
  if (!current) {
    return order.filter((id) => !done.has(id))
  }
  const idx = order.indexOf(current)
  return order.filter((id, i) => i > idx && !done.has(id))
}
