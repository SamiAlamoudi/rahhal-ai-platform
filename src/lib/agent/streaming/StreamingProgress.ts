/**
 * Sprint 116 — StreamingProgress
 */

import {
  getStreamingStageDefinition,
  remainingStagesAfter,
  streamingStageOrder,
  type StreamingStageId,
} from './StreamingStage'
import type { StreamingProgressPercent } from './StreamingStatus'
import { normalizeProgress } from './StreamingStatus'

export interface StreamingProgressSnapshot {
  currentStage: StreamingStageId | null
  completedStages: StreamingStageId[]
  remainingStages: StreamingStageId[]
  /** Overall pipeline progress 0–100. */
  progressPercent: number
  /** In-stage progress (0/25/50/75/100). */
  stageProgressPercent: StreamingProgressPercent
  estimatedRemainingTimeMs: number
}

export class StreamingProgressTracker {
  currentStage: StreamingStageId | null = null
  completedStages: StreamingStageId[] = []
  stageProgressPercent: StreamingProgressPercent = 0
  private readonly stageDurations = new Map<StreamingStageId, number>()

  markStarted(stage: StreamingStageId): void {
    this.currentStage = stage
    this.stageProgressPercent = 0
  }

  markProgress(stage: StreamingStageId, percent: number): void {
    this.currentStage = stage
    this.stageProgressPercent = normalizeProgress(percent)
  }

  markCompleted(stage: StreamingStageId, durationMs: number | null): void {
    if (!this.completedStages.includes(stage)) {
      this.completedStages.push(stage)
    }
    if (durationMs != null) this.stageDurations.set(stage, durationMs)
    this.stageProgressPercent = 100
    if (this.currentStage === stage) {
      this.currentStage = null
    }
  }

  markSkipped(stage: StreamingStageId): void {
    if (!this.completedStages.includes(stage)) {
      this.completedStages.push(stage)
    }
    if (this.currentStage === stage) this.currentStage = null
    this.stageProgressPercent = 100
  }

  overallProgressPercent(): number {
    const order = streamingStageOrder()
    if (order.length === 0) return 0
    const completedWeight = this.completedStages.length
    const inFlight =
      this.currentStage && !this.completedStages.includes(this.currentStage)
        ? this.stageProgressPercent / 100
        : 0
    return Math.min(
      100,
      Math.round(((completedWeight + inFlight) / order.length) * 100),
    )
  }

  estimatedRemainingTimeMs(): number {
    const remaining = remainingStagesAfter(
      this.currentStage,
      this.completedStages,
    )
    let total = 0
    for (const id of remaining) {
      const observed = this.stageDurations.get(id)
      total += observed ?? getStreamingStageDefinition(id).typicalDurationMs
    }
    if (
      this.currentStage
      && !this.completedStages.includes(this.currentStage)
    ) {
      const def = getStreamingStageDefinition(this.currentStage)
      const remainingFrac = 1 - this.stageProgressPercent / 100
      total += Math.round(def.typicalDurationMs * remainingFrac)
    }
    return Math.max(0, total)
  }

  snapshot(): StreamingProgressSnapshot {
    return {
      currentStage: this.currentStage,
      completedStages: this.completedStages.slice(),
      remainingStages: remainingStagesAfter(
        this.currentStage,
        this.completedStages,
      ),
      progressPercent: this.overallProgressPercent(),
      stageProgressPercent: this.stageProgressPercent,
      estimatedRemainingTimeMs: this.estimatedRemainingTimeMs(),
    }
  }
}

export function createStreamingProgressTracker(): StreamingProgressTracker {
  return new StreamingProgressTracker()
}
