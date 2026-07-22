/**
 * Sprint 116 — StreamingRunner
 * Wraps Execution Pipeline via injectable adapters (no pipeline code changes).
 * Emits started / progress / completed / warning / error for each stage.
 */

import {
  createDefaultStageAdapters,
  runUnifiedExecutionPipeline,
  type PipelineInput,
  type PipelineResult,
  type PipelineStageAdapters,
  type PipelineStageHandler,
  type PipelineStageId,
  type PipelineRunnerOptions,
} from '../pipeline'
import { createStreamingEvent, type StreamingEvent, type StreamingEventBus, createStreamingEventBus } from './StreamingEvents'
import { createStreamingProgressTracker, type StreamingProgressTracker } from './StreamingProgress'
import { getStreamingStageDefinition, streamingStageOrder } from './StreamingStage'
import type { StreamingProgressPercent } from './StreamingStatus'
import { STREAMING_PROGRESS_STEPS } from './StreamingStatus'
import { createStreamingTimeline, type StreamingTimeline } from './StreamingTimeline'

export interface StreamingRunnerOptions {
  /** Outer streaming feature gate (caller / feature flag). */
  enabled?: boolean
  /** Forwarded to Execution Pipeline (forced ON when streaming wraps). */
  pipelineOptions?: Omit<PipelineRunnerOptions, 'adapters'>
  /** Extra / override stage adapters (composed under streaming wrappers). */
  adapters?: PipelineStageAdapters
  /** Progress ticks emitted during each stage (default full 0–100 ladder). */
  progressSteps?: readonly StreamingProgressPercent[]
  onEvent?: (event: StreamingEvent) => void
  /** Optional delay between progress ticks (tests / slow providers). */
  progressTickMs?: number
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function wrapAdaptersWithStreaming(input: {
  base: PipelineStageAdapters
  overrides?: PipelineStageAdapters
  bus: StreamingEventBus
  progress: StreamingProgressTracker
  timeline: StreamingTimeline
  progressSteps: readonly StreamingProgressPercent[]
  progressTickMs: number
  onEvent?: (event: StreamingEvent) => void
}): PipelineStageAdapters {
  const merged: PipelineStageAdapters = { ...input.base, ...input.overrides }
  const wrapped: PipelineStageAdapters = {}

  const emit = (event: StreamingEvent) => {
    input.timeline.append(event)
    input.bus.emit(event)
    input.onEvent?.(event)
  }

  for (const stageId of streamingStageOrder()) {
    const handler = merged[stageId]
    if (!handler) continue

    wrapped[stageId] = (async (pipelineInput, ctx) => {
      const def = getStreamingStageDefinition(stageId)
      const startedAt = Date.now()

      input.progress.markStarted(stageId)
      emit(
        createStreamingEvent({
          stage: stageId,
          kind: 'started',
          status: 'running',
          message: def.startedMessage,
          progressPercent: 0,
          confidence: ctx.confidence,
          metadata: { phase: 'started' },
        }),
      )

      // Emit in-flight progress ticks before the real handler (visual ladder).
      for (const step of input.progressSteps) {
        if (step === 0 || step === 100) continue
        await sleep(input.progressTickMs)
        input.progress.markProgress(stageId, step)
        emit(
          createStreamingEvent({
            stage: stageId,
            kind: 'progress',
            status: 'running',
            message: `${def.label} ${step}%`,
            progressPercent: step,
            confidence: ctx.confidence,
            metadata: { phase: 'progress', step },
          }),
        )
      }

      try {
        const result = await Promise.resolve(handler(pipelineInput, ctx))
        const durationMs = result.durationMs || Date.now() - startedAt

        for (const w of result.warnings) {
          emit(
            createStreamingEvent({
              stage: stageId,
              kind: 'warning',
              status: 'warning',
              message: w,
              progressPercent: 75,
              durationMs,
              confidence: result.confidence ?? ctx.confidence,
              metadata: { ...result.metadata },
              warning: w,
            }),
          )
        }
        for (const err of result.errors) {
          emit(
            createStreamingEvent({
              stage: stageId,
              kind: 'error',
              status: 'error',
              message: err,
              progressPercent: 75,
              durationMs,
              confidence: result.confidence ?? ctx.confidence,
              metadata: { ...result.metadata },
              error: err,
            }),
          )
        }

        if (result.status === 'skipped') {
          input.progress.markSkipped(stageId)
          emit(
            createStreamingEvent({
              stage: stageId,
              kind: 'skipped',
              status: 'skipped',
              message: def.completedMessage,
              progressPercent: 100,
              durationMs,
              confidence: result.confidence,
              metadata: { ...result.metadata, pipelineStatus: result.status },
            }),
          )
        } else if (
          result.status === 'failed'
          || result.status === 'timed_out'
        ) {
          input.progress.markCompleted(stageId, durationMs)
          emit(
            createStreamingEvent({
              stage: stageId,
              kind: 'error',
              status: result.status === 'timed_out' ? 'timed_out' : 'error',
              message: result.errors[0] ?? `${stageId} failed`,
              progressPercent: 100,
              durationMs,
              confidence: result.confidence,
              metadata: { ...result.metadata, pipelineStatus: result.status },
              error: result.errors[0] ?? `${stageId} failed`,
            }),
          )
        } else {
          // completed | recovered
          input.progress.markCompleted(stageId, durationMs)
          emit(
            createStreamingEvent({
              stage: stageId,
              kind: 'completed',
              status: 'completed',
              message: def.completedMessage,
              progressPercent: 100,
              durationMs,
              confidence: result.confidence ?? ctx.confidence,
              metadata: {
                ...result.metadata,
                pipelineStatus: result.status,
              },
            }),
          )
        }

        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const durationMs = Date.now() - startedAt
        input.progress.markCompleted(stageId, durationMs)
        emit(
          createStreamingEvent({
            stage: stageId,
            kind: 'error',
            status: 'error',
            message,
            progressPercent: 100,
            durationMs,
            confidence: ctx.confidence,
            metadata: {},
            error: message,
          }),
        )
        throw err
      }
    }) as PipelineStageHandler
  }

  return wrapped
}

export class StreamingRunner {
  private readonly options: StreamingRunnerOptions
  readonly bus: StreamingEventBus
  readonly timeline: StreamingTimeline
  readonly progress: StreamingProgressTracker

  constructor(options: StreamingRunnerOptions = {}) {
    this.options = options
    this.bus = createStreamingEventBus()
    this.timeline = createStreamingTimeline()
    this.progress = createStreamingProgressTracker()
    if (options.onEvent) {
      this.bus.subscribe(options.onEvent)
    }
  }

  getEvents(): readonly StreamingEvent[] {
    return this.bus.getEvents()
  }

  async run(input: PipelineInput): Promise<{
    pipeline: PipelineResult
    events: StreamingEvent[]
  }> {
    const progressSteps =
      this.options.progressSteps ?? STREAMING_PROGRESS_STEPS
    const progressTickMs = this.options.progressTickMs ?? 0

    const adapters = wrapAdaptersWithStreaming({
      base: createDefaultStageAdapters(),
      overrides: this.options.adapters,
      bus: this.bus,
      progress: this.progress,
      timeline: this.timeline,
      progressSteps,
      progressTickMs,
    })

    // Streaming wraps the pipeline — force pipeline enabled for the wrapped run.
    // Does not mutate pipeline feature-flag defaults.
    const pipeline = await runUnifiedExecutionPipeline(input, {
      ...this.options.pipelineOptions,
      enabled: true,
      adapters,
    })

    return {
      pipeline,
      events: this.bus.getEvents().slice(),
    }
  }
}

export function createStreamingRunner(
  options?: StreamingRunnerOptions,
): StreamingRunner {
  return new StreamingRunner(options)
}

export type { PipelineStageId }
