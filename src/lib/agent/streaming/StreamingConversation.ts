/**
 * Sprint 116 — StreamingConversation
 * Additive streaming conversation layer over the Execution Pipeline.
 */

import type { PipelineInput, PipelineResult } from '../pipeline'
import { isStreamingConversationEnabled } from './feature'
import type { StreamingEvent } from './StreamingEvents'
import {
  collectStreamingMetrics,
  emptyStreamingMetrics,
  type StreamingMetrics,
} from './StreamingMetrics'
import type { StreamingProgressSnapshot } from './StreamingProgress'
import { renderStreamingTranscript } from './StreamingRenderer'
import {
  createStreamingRunner,
  type StreamingRunnerOptions,
} from './StreamingRunner'
import {
  SPRINT116_STREAMING_CONVERSATION_VERSION,
  streamingStageOrder,
  type StreamingStageId,
} from './StreamingStage'
import type { StreamingTimelineEntry } from './StreamingTimeline'

export interface StreamingConversationInput extends PipelineInput {}

export interface StreamingConversationResult {
  version: string
  enabled: boolean
  ok: boolean
  empty: boolean
  currentStage: StreamingStageId | null
  completedStages: StreamingStageId[]
  remainingStages: StreamingStageId[]
  progressPercent: number
  estimatedRemainingTimeMs: number
  /** Alias for API wording in sprint brief. */
  estimatedRemainingTime: number
  timeline: StreamingTimelineEntry[]
  events: StreamingEvent[]
  transcript: string[]
  warnings: string[]
  confidence: number
  metadata: {
    conversationId: string | null
    stageCount: number
    eventCount: number
    pipelineEnabled: boolean
    style: string | null
    destination: string | null
    partial: boolean
  }
  metrics: StreamingMetrics
  progress: StreamingProgressSnapshot
  pipeline: PipelineResult | null
  logs: string[]
  latencyMs: number
}

export interface StreamingConversationOptions extends StreamingRunnerOptions {}

function disabledResult(latencyMs: number): StreamingConversationResult {
  return {
    version: SPRINT116_STREAMING_CONVERSATION_VERSION,
    enabled: false,
    ok: false,
    empty: true,
    currentStage: null,
    completedStages: [],
    remainingStages: streamingStageOrder().slice(),
    progressPercent: 0,
    estimatedRemainingTimeMs: 0,
    estimatedRemainingTime: 0,
    timeline: [],
    events: [],
    transcript: [],
    warnings: [],
    confidence: 0,
    metadata: {
      conversationId: null,
      stageCount: 0,
      eventCount: 0,
      pipelineEnabled: false,
      style: null,
      destination: null,
      partial: false,
    },
    metrics: emptyStreamingMetrics(),
    progress: {
      currentStage: null,
      completedStages: [],
      remainingStages: streamingStageOrder().slice(),
      progressPercent: 0,
      stageProgressPercent: 0,
      estimatedRemainingTimeMs: 0,
    },
    pipeline: null,
    logs: ['streaming_conversation_disabled'],
    latencyMs,
  }
}

export class StreamingConversation {
  private readonly options: StreamingConversationOptions

  constructor(options: StreamingConversationOptions = {}) {
    this.options = options
  }

  async run(
    input: StreamingConversationInput,
  ): Promise<StreamingConversationResult> {
    const started = Date.now()

    if (
      !isStreamingConversationEnabled({ enabled: this.options.enabled })
    ) {
      return disabledResult(Date.now() - started)
    }

    const runner = createStreamingRunner(this.options)
    const { pipeline, events } = await runner.run(input)
    const progress = runner.progress.snapshot()
    const timeline = runner.timeline.chronological()
    const latencyMs = Date.now() - started
    const confidence = pipeline.confidence || progress.progressPercent / 100

    // After full run, remaining should be empty and progress ~100 when all done.
    const completedStages = progress.completedStages
    const remainingStages = streamingStageOrder().filter(
      (id) => !completedStages.includes(id),
    )

    const metrics = collectStreamingMetrics({
      events,
      totalDurationMs: latencyMs,
      confidence,
    })

    return {
      version: SPRINT116_STREAMING_CONVERSATION_VERSION,
      enabled: true,
      ok: pipeline.ok,
      empty: pipeline.empty,
      currentStage: remainingStages.length === 0 ? null : progress.currentStage,
      completedStages,
      remainingStages,
      progressPercent:
        remainingStages.length === 0 ? 100 : progress.progressPercent,
      estimatedRemainingTimeMs: progress.estimatedRemainingTimeMs,
      estimatedRemainingTime: progress.estimatedRemainingTimeMs,
      timeline,
      events,
      transcript: renderStreamingTranscript(events),
      warnings: [
        ...pipeline.warnings,
        ...events
          .filter((e) => e.kind === 'warning')
          .map((e) => e.warning || e.message),
      ],
      confidence,
      metadata: {
        conversationId: pipeline.metadata.conversationId || input.conversationId || null,
        stageCount: completedStages.length,
        eventCount: events.length,
        pipelineEnabled: pipeline.enabled,
        style: pipeline.metadata.style,
        destination: pipeline.metadata.destination,
        partial: pipeline.partial,
      },
      metrics,
      progress: {
        ...progress,
        remainingStages,
        progressPercent:
          remainingStages.length === 0 ? 100 : progress.progressPercent,
        estimatedRemainingTimeMs:
          remainingStages.length === 0 ? 0 : progress.estimatedRemainingTimeMs,
      },
      pipeline,
      logs: ['streaming_conversation_enabled', ...pipeline.logs],
      latencyMs,
    }
  }
}

export function createStreamingConversation(
  options?: StreamingConversationOptions,
): StreamingConversation {
  return new StreamingConversation(options)
}

export async function runStreamingConversation(
  input: StreamingConversationInput,
  options?: StreamingConversationOptions,
): Promise<StreamingConversationResult> {
  return createStreamingConversation(options).run(input)
}
