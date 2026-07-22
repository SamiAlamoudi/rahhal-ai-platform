/**
 * Sprint 120 — Production conversation turn via Streaming + Pipeline.
 * Forces streaming enabled for the wrap call only (does not mutate flag defaults).
 */

import {
  runStreamingConversation,
  type StreamingConversationResult,
  type StreamingEvent,
  type StreamingConversationOptions,
} from '../agent/streaming'
import type { PipelineInput } from '../agent/pipeline'
import { buildPipelineInputFromMessage } from './tripHints'
import {
  mapConfidenceFromPipeline,
  mapFlightsFromPipeline,
  mapHotelsFromPipeline,
  mapPackagesFromPipeline,
  mapRecommendationsFromPipeline,
  mapStreamingProgress,
  mapWarningsFromPipeline,
  mapItineraryDays,
  type FlightCardModel,
  type HotelCardModel,
  type PackageCardModel,
  type RecommendationCardModel,
  type WarningCardModel,
  type ConfidenceCardModel,
  type PipelineProgressModel,
  type TimelineDayModel,
} from './mappers'

export interface ProductionTurnViewModel {
  streaming: StreamingConversationResult
  progress: PipelineProgressModel
  flights: FlightCardModel[]
  hotels: HotelCardModel[]
  packages: PackageCardModel[]
  recommendations: RecommendationCardModel[]
  warnings: WarningCardModel[]
  confidence: ConfidenceCardModel | null
  itineraryDays: TimelineDayModel[]
  headline: string
  executiveSummary: string
  narrative: string | null
  transcript: string[]
  events: StreamingEvent[]
}

export async function runProductionConversationTurn(input: {
  conversationId?: string | null
  userId?: string | null
  text: string
  flights?: Array<Record<string, unknown>> | null
  hotels?: Array<Record<string, unknown>> | null
  tripOverrides?: PipelineInput['trip']
  onEvent?: (event: StreamingEvent) => void
  streamingOptions?: Omit<StreamingConversationOptions, 'enabled' | 'onEvent'>
}): Promise<ProductionTurnViewModel> {
  const pipelineInput = buildPipelineInputFromMessage({
    conversationId: input.conversationId,
    userId: input.userId,
    text: input.text,
    flights: input.flights,
    hotels: input.hotels,
    tripOverrides: input.tripOverrides,
  })

  const liveEvents: StreamingEvent[] = []
  const streaming = await runStreamingConversation(pipelineInput, {
    ...input.streamingOptions,
    enabled: true,
    onEvent: (event) => {
      liveEvents.push(event)
      input.onEvent?.(event)
    },
  })

  const pipeline = streaming.pipeline
  return {
    streaming,
    progress: mapStreamingProgress(streaming, liveEvents),
    flights: mapFlightsFromPipeline(pipeline),
    hotels: mapHotelsFromPipeline(pipeline),
    packages: mapPackagesFromPipeline(pipeline),
    recommendations: mapRecommendationsFromPipeline(pipeline),
    warnings: mapWarningsFromPipeline(pipeline),
    confidence: mapConfidenceFromPipeline(pipeline, streaming.confidence),
    itineraryDays: mapItineraryDays(pipeline?.itinerary ?? null),
    headline: pipeline?.finalResponse?.headline || '',
    executiveSummary: pipeline?.finalResponse?.executiveSummary || '',
    narrative: pipeline?.finalResponse?.narrative ?? null,
    transcript: streaming.transcript,
    events: streaming.events,
  }
}
