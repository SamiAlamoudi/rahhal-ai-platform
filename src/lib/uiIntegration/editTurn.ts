/**
 * Sprint 120 — Editable conversation integration (Partial Execution).
 */

import {
  runConversationEditor,
  type ConversationEditInput,
  type ConversationEditorResult,
  type EditSnapshot,
  type ConversationEditorOptions,
} from '../agent/editing'
import type { PipelineResult } from '../agent/pipeline'
import {
  mapEditComparison,
  mapFlightsFromPipeline,
  mapHotelsFromPipeline,
  mapPackagesFromPipeline,
  mapRecommendationsFromPipeline,
  mapConfidenceFromPipeline,
  mapWarningsFromPipeline,
  mapItineraryDays,
} from './mappers'

export function buildEditSnapshotFromPipeline(
  pipeline: PipelineResult,
  cities?: string[] | null,
): EditSnapshot {
  return {
    trip: {
      ...pipeline.conversation?.trip,
    },
    flights: pipeline.flightOffers.slice(),
    hotels: pipeline.hotelOffers.slice(),
    confidence: pipeline.confidence,
    budget: pipeline.conversation?.trip.budget ?? null,
    pipelineResult: pipeline,
    cities: cities ?? null,
  }
}

export async function runProductionEditTurn(input: {
  editText: string
  snapshot: EditSnapshot
  conversationId?: string | null
  userId?: string | null
  useStreaming?: boolean
  options?: ConversationEditorOptions
}): Promise<{
  edit: ConversationEditorResult
  comparison: ReturnType<typeof mapEditComparison>
  flights: ReturnType<typeof mapFlightsFromPipeline>
  hotels: ReturnType<typeof mapHotelsFromPipeline>
  packages: ReturnType<typeof mapPackagesFromPipeline>
  recommendations: ReturnType<typeof mapRecommendationsFromPipeline>
  warnings: ReturnType<typeof mapWarningsFromPipeline>
  confidence: ReturnType<typeof mapConfidenceFromPipeline>
  itineraryDays: ReturnType<typeof mapItineraryDays>
}> {
  const editInput: ConversationEditInput = {
    conversationId: input.conversationId,
    userId: input.userId,
    editText: input.editText,
    snapshot: input.snapshot,
    useStreaming: input.useStreaming ?? false,
  }

  const edit = await runConversationEditor(editInput, {
    ...input.options,
    enabled: true,
  })

  const pipeline = edit.pipeline
  return {
    edit,
    comparison: mapEditComparison(edit),
    flights: mapFlightsFromPipeline(pipeline),
    hotels: mapHotelsFromPipeline(pipeline),
    packages: mapPackagesFromPipeline(pipeline),
    recommendations: mapRecommendationsFromPipeline(pipeline),
    warnings: mapWarningsFromPipeline(pipeline),
    confidence: mapConfidenceFromPipeline(pipeline),
    itineraryDays: mapItineraryDays(pipeline?.itinerary ?? null),
  }
}
