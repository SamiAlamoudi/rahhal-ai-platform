/**
 * Sprint 115 — PipelineContext
 * Mutable shared state across isolated stages.
 */

import type {
  PipelineInput,
  PipelineStageId,
  PipelineStageResult,
  PipelineTripHints,
} from './PipelineStages'

export interface PipelineFeatureFlagSnapshot {
  executionPipeline: boolean
  memory: boolean | null
  flightSearch: boolean | null
  hotelSearch: boolean | null
  tripBuilder: boolean | null
  itinerary: boolean | null
  responseComposer: boolean | null
  concierge: boolean | null
}

export class PipelineContext {
  readonly conversationId: string
  readonly userId: string | null
  readonly startedAt: string
  trip: PipelineTripHints
  flights: Array<Record<string, unknown>>
  hotels: Array<Record<string, unknown>>
  stageResults: PipelineStageResult[] = []
  warnings: string[] = []
  errors: string[] = []
  logs: string[] = []
  confidence = 0.5
  memoryPresent = false
  earlyExit = false
  featureFlags: PipelineFeatureFlagSnapshot
  timing: Partial<Record<PipelineStageId, number>> = {}
  artifacts: Record<string, Record<string, unknown> | null> = {}

  constructor(input: PipelineInput, executionPipelineEnabled: boolean) {
    this.conversationId = input.conversationId?.trim() || `pipe_${Date.now()}`
    this.userId = input.userId?.trim() || null
    this.startedAt = new Date().toISOString()
    this.trip = { ...input.trip }
    this.flights = (input.flights ?? []).slice()
    this.hotels = (input.hotels ?? []).slice()
    this.featureFlags = {
      executionPipeline: executionPipelineEnabled,
      memory: null,
      flightSearch: null,
      hotelSearch: null,
      tripBuilder: null,
      itinerary: null,
      responseComposer: null,
      concierge: null,
    }
    if (typeof input.decisionConfidence === 'number') {
      this.confidence = input.decisionConfidence
    }
  }

  addWarning(message: string): void {
    this.warnings.push(message)
  }

  addError(message: string): void {
    this.errors.push(message)
  }

  addLog(message: string): void {
    this.logs.push(message)
  }

  setConfidence(value: number): void {
    if (Number.isFinite(value)) {
      this.confidence = Math.max(0, Math.min(1, value))
    }
  }

  recordStage(result: PipelineStageResult): void {
    this.stageResults.push(result)
    this.timing[result.stageId] = result.durationMs
    this.artifacts[result.stageId] = result.artifact
    for (const w of result.warnings) this.warnings.push(`[${result.stageId}] ${w}`)
    for (const e of result.errors) this.errors.push(`[${result.stageId}] ${e}`)
    if (typeof result.confidence === 'number') {
      this.setConfidence(result.confidence)
    }
  }

  snapshot(): {
    conversationId: string
    userId: string | null
    startedAt: string
    memoryPresent: boolean
    earlyExit: boolean
    confidence: number
    featureFlags: PipelineFeatureFlagSnapshot
    flightCount: number
    hotelCount: number
    trip: PipelineTripHints
    warnings: string[]
    errors: string[]
    logs: string[]
  } {
    return {
      conversationId: this.conversationId,
      userId: this.userId,
      startedAt: this.startedAt,
      memoryPresent: this.memoryPresent,
      earlyExit: this.earlyExit,
      confidence: this.confidence,
      featureFlags: { ...this.featureFlags },
      flightCount: this.flights.length,
      hotelCount: this.hotels.length,
      trip: { ...this.trip },
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      logs: this.logs.slice(),
    }
  }
}

export function createPipelineContext(
  input: PipelineInput,
  enabled: boolean,
): PipelineContext {
  return new PipelineContext(input, enabled)
}
