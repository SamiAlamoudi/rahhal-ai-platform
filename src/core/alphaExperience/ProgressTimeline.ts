/**
 * Sprint 91 — reusable AI thinking timeline.
 */

import type {
  AlphaProgressTimeline,
  AlphaTimelineStage,
  AlphaTimelineStageId,
  AlphaTimelineStatus,
} from './types'

const STAGE_ORDER: Array<{ id: AlphaTimelineStageId; label: string; weight: number }> = [
  { id: 'analyzing_request', label: 'Analyzing request', weight: 5 },
  { id: 'understanding_intent', label: 'Understanding traveler intent', weight: 8 },
  { id: 'constitution_check', label: 'Validating travel principles', weight: 5 },
  { id: 'search_planning', label: 'Planning search strategies', weight: 8 },
  { id: 'searching_flights', label: 'Searching flights', weight: 12 },
  { id: 'searching_hotels', label: 'Searching hotels', weight: 12 },
  { id: 'comparing_options', label: 'Comparing options', weight: 8 },
  { id: 'building_package', label: 'Building package', weight: 12 },
  { id: 'optimizing_itinerary', label: 'Optimizing itinerary', weight: 10 },
  { id: 'decision', label: 'Selecting best option', weight: 8 },
  { id: 'generating_alternatives', label: 'Generating alternatives', weight: 6 },
  { id: 'preparing_recommendation', label: 'Preparing recommendation', weight: 4 },
  { id: 'completed', label: 'Completed', weight: 2 },
]

function nowIso(): string {
  return new Date().toISOString()
}

function cumulativePercent(upToIndex: number): number {
  const total = STAGE_ORDER.reduce((s, x) => s + x.weight, 0)
  let sum = 0
  for (let i = 0; i <= upToIndex && i < STAGE_ORDER.length; i++) {
    sum += STAGE_ORDER[i]!.weight
  }
  return Math.min(100, Math.round((sum / total) * 100))
}

export function createProgressTimeline(): AlphaProgressTimeline {
  const startedAt = nowIso()
  return {
    stages: STAGE_ORDER.map((s) => ({
      id: s.id,
      label: s.label,
      status: 'pending' as AlphaTimelineStatus,
      startedAt: null,
      completedAt: null,
      durationMs: 0,
      progressPercent: 0,
      message: null,
      recoverable: false,
      errorMessage: null,
    })),
    currentStageId: null,
    progressPercent: 0,
    startedAt,
    completedAt: null,
    durationMs: 0,
    hasRecoverableFailure: false,
  }
}

export class ProgressTimelineTracker {
  readonly timeline: AlphaProgressTimeline

  constructor(timeline?: AlphaProgressTimeline) {
    this.timeline = timeline ?? createProgressTimeline()
  }

  private indexOf(id: AlphaTimelineStageId): number {
    return this.timeline.stages.findIndex((s) => s.id === id)
  }

  private stage(id: AlphaTimelineStageId): AlphaTimelineStage {
    const idx = this.indexOf(id)
    if (idx < 0) throw new Error(`Unknown timeline stage: ${id}`)
    return this.timeline.stages[idx]!
  }

  start(id: AlphaTimelineStageId, message?: string): void {
    const stage = this.stage(id)
    stage.status = 'running'
    stage.startedAt = nowIso()
    stage.message = message ?? null
    this.timeline.currentStageId = id
  }

  complete(id: AlphaTimelineStageId, message?: string): void {
    const stage = this.stage(id)
    const idx = this.indexOf(id)
    const end = nowIso()
    if (!stage.startedAt) stage.startedAt = end
    stage.completedAt = end
    stage.status = 'completed'
    stage.durationMs = Math.max(
      0,
      Date.parse(end) - Date.parse(stage.startedAt),
    )
    if (message) stage.message = message
    stage.progressPercent = cumulativePercent(idx)
    this.timeline.progressPercent = stage.progressPercent
  }

  skip(id: AlphaTimelineStageId, message?: string): void {
    const stage = this.stage(id)
    const idx = this.indexOf(id)
    stage.status = 'skipped'
    stage.completedAt = nowIso()
    stage.message = message ?? 'Skipped'
    stage.progressPercent = cumulativePercent(idx)
    this.timeline.progressPercent = stage.progressPercent
  }

  failRecoverable(id: AlphaTimelineStageId, technical: string, travelerMessage: string): void {
    const stage = this.stage(id)
    const idx = this.indexOf(id)
    const end = nowIso()
    if (!stage.startedAt) stage.startedAt = end
    stage.completedAt = end
    stage.status = 'recovered'
    stage.recoverable = true
    stage.errorMessage = technical
    stage.message = travelerMessage
    stage.durationMs = Math.max(0, Date.parse(end) - Date.parse(stage.startedAt))
    stage.progressPercent = cumulativePercent(idx)
    this.timeline.progressPercent = stage.progressPercent
    this.timeline.hasRecoverableFailure = true
  }

  fail(id: AlphaTimelineStageId, technical: string, travelerMessage: string): void {
    const stage = this.stage(id)
    const end = nowIso()
    if (!stage.startedAt) stage.startedAt = end
    stage.completedAt = end
    stage.status = 'failed'
    stage.recoverable = false
    stage.errorMessage = technical
    stage.message = travelerMessage
    stage.durationMs = Math.max(0, Date.parse(end) - Date.parse(stage.startedAt))
    this.timeline.hasRecoverableFailure = false
  }

  finish(): AlphaProgressTimeline {
    const end = nowIso()
    this.timeline.completedAt = end
    this.timeline.durationMs = Math.max(
      0,
      Date.parse(end) - Date.parse(this.timeline.startedAt),
    )
    this.timeline.progressPercent = 100
    const completed = this.timeline.stages.find((s) => s.id === 'completed')
    if (completed && completed.status === 'pending') {
      this.start('completed')
      this.complete('completed', 'Recommendation ready')
    }
    this.timeline.currentStageId = 'completed'
    return this.timeline
  }
}
