/**
 * Sprint 114 — ItineraryEngine
 * Orchestrates day planning → transfers/check-in/meals/activities →
 * timeline → conflict resolution → scoring / explanation / metadata.
 *
 * Additive only. Feature flag `ai.itinerary_engine` default OFF.
 */

import { allocateActivities, planInterCityTransfer } from './ActivityAllocator'
import { planCheckInOut } from './CheckInPlanner'
import { resolveConflicts } from './ConflictResolver'
import {
  normalizeItineraryContext,
  planDays,
  type NormalizedItineraryContext,
} from './DayPlanner'
import { isItineraryEngineEnabled } from './feature'
import { explainItinerary } from './ItineraryExplainer'
import { buildItineraryMetadata } from './ItineraryMetadata'
import { scoreItinerary } from './ItineraryScorer'
import { planMeals } from './MealPlanner'
import { buildDayTimeline, flattenTimeline } from './TimelineBuilder'
import { planTransfers } from './TransferPlanner'
import {
  SPRINT114_ITINERARY_ENGINE_VERSION,
  type ItineraryEngineInput,
  type ItineraryEngineResult,
  type ItineraryExplanation,
  type ItineraryMetadata,
  type ItineraryScores,
  type ItineraryStructuredLogger,
  type ItineraryTimeBlock,
  createSilentItineraryLogger,
} from './types'

export interface ItineraryEngineOptions {
  enabled?: boolean
  logger?: ItineraryStructuredLogger
}

function emptyScores(): ItineraryScores {
  return {
    comfort: 0,
    walking: 0,
    travelEfficiency: 0,
    familyFriendliness: 0,
    businessSuitability: 0,
    overallQuality: 0,
  }
}

function emptyExplanation(): ItineraryExplanation {
  return {
    summary: '',
    activityReasons: [],
    orderingReasons: [],
    hotelFit: '',
    flightFit: '',
  }
}

function emptyMetadata(): ItineraryMetadata {
  return {
    totalTravelTimeMinutes: 0,
    hotelNights: 0,
    flightDurationMinutes: 0,
    walkingDurationMinutes: 0,
    transferDurationMinutes: 0,
    activityCount: 0,
    freeHours: 0,
    dayCount: 0,
    cityCount: 0,
    confidence: 0,
    style: 'leisure',
    conflictCount: 0,
    resolvedConflictCount: 0,
  }
}

function disabledResult(latencyMs: number, logs: string[]): ItineraryEngineResult {
  return {
    version: SPRINT114_ITINERARY_ENGINE_VERSION,
    enabled: false,
    ok: false,
    empty: true,
    days: [],
    timeline: [],
    conflicts: [],
    scores: emptyScores(),
    explanation: emptyExplanation(),
    metadata: emptyMetadata(),
    validationErrors: [],
    logs: [...logs, 'itinerary_engine_disabled'],
    latencyMs,
  }
}

function buildDayBlocks(
  day: ReturnType<typeof planDays>[number],
  ctx: NormalizedItineraryContext,
  previousCity: string | null,
): ItineraryTimeBlock[] {
  const arrivalMinutes =
    (ctx.flightArrivalMinutes ?? 14 * 60) + ctx.arrivalDelayMinutes

  const transfers = planTransfers({ day, ctx, arrivalMinutes })
  const checkInOut = planCheckInOut({ day, ctx, arrivalMinutes })
  const interCity = planInterCityTransfer({ day, previousCity })

  const occupied = [...transfers, ...checkInOut, ...interCity].map((b) => ({
    start: b.startMinutes,
    end: b.endMinutes,
  }))

  const meals = planMeals({ day, style: ctx.style, occupied })
  const occupiedWithMeals = [
    ...occupied,
    ...meals.map((b) => ({ start: b.startMinutes, end: b.endMinutes })),
  ]
  const activities = allocateActivities({
    day,
    ctx,
    occupied: occupiedWithMeals,
  })

  return [...transfers, ...checkInOut, ...interCity, ...meals, ...activities]
}

export function buildItineraryFromContext(
  ctx: NormalizedItineraryContext,
): Omit<ItineraryEngineResult, 'enabled' | 'version' | 'latencyMs' | 'logs' | 'validationErrors'> {
  const skeleton = planDays(ctx)
  let previousCity: string | null = null
  const filled = skeleton.map((day) => {
    const blocks = buildDayBlocks(day, ctx, previousCity)
    previousCity = day.city
    return buildDayTimeline(day, blocks)
  })

  const { days, conflicts } = resolveConflicts(filled)
  const resolvedConflictCount = conflicts.filter((c) => c.resolved).length
  const scores = scoreItinerary(days, ctx)
  const explanation = explainItinerary(days, ctx, resolvedConflictCount)
  const metadata = buildItineraryMetadata(
    days,
    ctx,
    scores,
    conflicts.length,
    resolvedConflictCount,
  )

  return {
    ok: days.length > 0,
    empty: days.length === 0,
    days,
    timeline: flattenTimeline(days),
    conflicts,
    scores,
    explanation,
    metadata,
  }
}

export function runItineraryEngine(
  input: ItineraryEngineInput,
  options?: ItineraryEngineOptions,
): ItineraryEngineResult {
  const started = Date.now()
  const logger = options?.logger ?? createSilentItineraryLogger()
  const logs: string[] = []

  const enabled = isItineraryEngineEnabled({ enabled: options?.enabled })
  if (!enabled) {
    logger({
      at: new Date().toISOString(),
      level: 'info',
      message: 'itinerary_engine_disabled',
    })
    return disabledResult(Date.now() - started, logs)
  }

  logs.push('itinerary_engine_enabled')
  const normalized = normalizeItineraryContext(input)
  if (!normalized.ok) {
    logger({
      at: new Date().toISOString(),
      level: 'warn',
      message: 'itinerary_validation_failed',
      meta: { errors: normalized.errors },
    })
    return {
      version: SPRINT114_ITINERARY_ENGINE_VERSION,
      enabled: true,
      ok: false,
      empty: true,
      days: [],
      timeline: [],
      conflicts: [],
      scores: emptyScores(),
      explanation: emptyExplanation(),
      metadata: emptyMetadata(),
      validationErrors: normalized.errors,
      logs: [...logs, 'itinerary_validation_failed'],
      latencyMs: Date.now() - started,
    }
  }

  const built = buildItineraryFromContext(normalized.ctx)
  logs.push(`itinerary_days_${built.days.length}`)
  logs.push(`itinerary_confidence_${built.metadata.confidence}`)

  logger({
    at: new Date().toISOString(),
    level: 'info',
    message: 'itinerary_built',
    meta: {
      dayCount: built.days.length,
      confidence: built.metadata.confidence,
      conflicts: built.conflicts.length,
    },
  })

  return {
    version: SPRINT114_ITINERARY_ENGINE_VERSION,
    enabled: true,
    ...built,
    validationErrors: [],
    logs,
    latencyMs: Date.now() - started,
  }
}

export class ItineraryEngine {
  private readonly options: ItineraryEngineOptions

  constructor(options?: ItineraryEngineOptions) {
    this.options = options ?? {}
  }

  run(input: ItineraryEngineInput): ItineraryEngineResult {
    return runItineraryEngine(input, this.options)
  }
}

export function createItineraryEngine(
  options?: ItineraryEngineOptions,
): ItineraryEngine {
  return new ItineraryEngine(options)
}

export function createItineraryRunner(options?: ItineraryEngineOptions) {
  return (input: ItineraryEngineInput) => runItineraryEngine(input, options)
}
