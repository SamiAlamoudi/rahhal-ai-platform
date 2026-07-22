/**
 * Sprint 96 — AI Recommendation Timeline (Searching → Final recommendation).
 */

import type {
  ConciergeRecommendationTimeline,
  ConciergeTimelineStage,
  ConciergeTimelineStageId,
} from './types'

const STAGE_ORDER: Array<{ id: ConciergeTimelineStageId; label: string; weight: number }> = [
  { id: 'searching', label: 'Searching…', weight: 20 },
  { id: 'comparing', label: 'Comparing…', weight: 20 },
  { id: 'ranking', label: 'Ranking…', weight: 20 },
  { id: 'optimizing', label: 'Optimizing…', weight: 20 },
  { id: 'final_recommendation', label: 'Final recommendation', weight: 20 },
]

function nowIso(now: () => number): string {
  return new Date(now()).toISOString()
}

export class RecommendationTimelineTracker {
  private readonly stages: ConciergeTimelineStage[]
  private readonly startedAt: string
  private readonly startedMs: number
  private current: ConciergeTimelineStageId | null = null
  private cumulative = 0
  private readonly now: () => number

  constructor(now: () => number = Date.now) {
    this.now = now
    this.startedMs = now()
    this.startedAt = nowIso(now)
    this.stages = STAGE_ORDER.map((s) => ({
      id: s.id,
      label: s.label,
      status: 'pending',
      message: s.label,
      progressPercent: 0,
      startedAt: null,
      completedAt: null,
      durationMs: 0,
    }))
  }

  start(id: ConciergeTimelineStageId, message?: string): void {
    const stage = this.stages.find((s) => s.id === id)
    if (!stage) return
    this.current = id
    stage.status = 'running'
    stage.startedAt = nowIso(this.now)
    if (message) stage.message = message
  }

  complete(id: ConciergeTimelineStageId, message?: string): void {
    const meta = STAGE_ORDER.find((s) => s.id === id)
    const stage = this.stages.find((s) => s.id === id)
    if (!meta || !stage) return
    const completedAt = nowIso(this.now)
    const started = stage.startedAt ? Date.parse(stage.startedAt) : this.now()
    this.cumulative = Math.min(100, this.cumulative + meta.weight)
    stage.status = 'completed'
    stage.completedAt = completedAt
    stage.durationMs = Math.max(0, this.now() - started)
    stage.progressPercent = this.cumulative
    if (message) stage.message = message
    if (this.current === id) this.current = null
  }

  skip(id: ConciergeTimelineStageId, message?: string): void {
    const meta = STAGE_ORDER.find((s) => s.id === id)
    const stage = this.stages.find((s) => s.id === id)
    if (!meta || !stage) return
    this.cumulative = Math.min(100, this.cumulative + meta.weight)
    stage.status = 'skipped'
    stage.completedAt = nowIso(this.now)
    stage.progressPercent = this.cumulative
    if (message) stage.message = message
  }

  finish(): ConciergeRecommendationTimeline {
    return {
      stages: this.stages.map((s) => ({ ...s })),
      currentStageId: this.current,
      progressPercent: this.cumulative,
      startedAt: this.startedAt,
      completedAt: nowIso(this.now),
      durationMs: Math.max(0, this.now() - this.startedMs),
    }
  }
}

export function createRecommendationTimeline(
  now?: () => number,
): RecommendationTimelineTracker {
  return new RecommendationTimelineTracker(now)
}

/** Run the full product timeline with stage messages derived from trip context. */
export function runRecommendationTimeline(input: {
  destination?: string | null
  offerCount?: number
  now?: () => number
}): ConciergeRecommendationTimeline {
  const tracker = createRecommendationTimeline(input.now)
  const dest = input.destination?.trim() || 'your destination'
  const offers = input.offerCount ?? 0

  tracker.start('searching', `Searching live options for ${dest}…`)
  tracker.complete('searching', `Found ${Math.max(offers, 1)} candidate options for ${dest}.`)

  tracker.start('comparing', 'Comparing flights, hotels, and packages…')
  tracker.complete('comparing', 'Compared price, duration, comfort, and hotel quality.')

  tracker.start('ranking', 'Ranking options by value and fit…')
  tracker.complete('ranking', 'Ranked shortlist by overall traveler fit.')

  tracker.start('optimizing', 'Optimizing timing and package balance…')
  tracker.complete('optimizing', 'Optimized for budget, timing, and traveler preferences.')

  tracker.start('final_recommendation', 'Preparing your concierge recommendation…')
  tracker.complete('final_recommendation', 'Final recommendation ready.')

  return tracker.finish()
}
