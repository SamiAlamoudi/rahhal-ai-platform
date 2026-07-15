/**
 * Phase AF — Unified AI Trip Planner Pipeline v1.
 *
 * Coordinates PreferenceEngine → RecommendationEngine → ItineraryEngine →
 * optional BookingOrchestrator preview. Does not duplicate engine domain logic.
 */

import { createCorrelationId, setCorrelationId } from '../../ops/logging/correlation'
import { maskMetadata } from '../../ops/logging/mask'
import {
  BookingOrchestrator,
  createBookingOrchestrator,
  resetBookingOrchestratorCounters,
} from '../booking/bookingOrchestrator'
import { createItineraryEngine, ItineraryEngine } from '../itinerary/itineraryEngine'
import type { ExplicitPreferences, InferredPreferences } from '../preferences/preferenceEngine'
import {
  InMemoryPreferenceEngine,
  type PreferenceEngine,
} from '../preferences/preferenceEngine'
import type { TravelStyle } from '../preferences/types'
import {
  createRecommendationEngine,
  RecommendationEngine,
} from '../recommendations/recommendationEngine'
import { buildRecommendationCandidates } from './candidates'
import { calculatePipelineConfidence } from './confidence'
import {
  DEFAULT_TRIP_PLANNER_TIMEOUTS,
  type BookingPreview,
  type PipelineNormalizedPreferences,
  type PreferenceSourceRecord,
  type TripPlannerFailure,
  type TripPlannerPipelineEvent,
  type TripPlannerRequest,
  type TripPlannerResult,
  type TripPlannerStage,
  type TripPlannerTimeouts,
} from './models'
import {
  getTripPlannerMetrics,
  resetTripPlannerMetrics,
  type TripPlannerMetrics,
} from './metrics'
import {
  InMemoryTripPlannerEventRepository,
  InMemoryTripPlannerExecutionRepository,
  InMemoryTripPlannerResultRepository,
  type PipelineExecutionState,
  type TripPlannerEventRepository,
  type TripPlannerExecutionRepository,
  type TripPlannerResultRepository,
} from './repository'
import {
  resolveCurrency,
  resolveDurationDays,
  validateTripPlannerRequest,
} from './validation'

let executionSeq = 0
let eventSeq = 0

export function resetTripPlannerCounters(): void {
  executionSeq = 0
  eventSeq = 0
}

function nextExecutionId(): string {
  executionSeq += 1
  return `tpex_${String(executionSeq).padStart(4, '0')}`
}

function nextEventId(): string {
  eventSeq += 1
  return `tpev_${String(eventSeq).padStart(4, '0')}`
}

export type TripPlannerFailStage =
  | 'preferences'
  | 'recommendations'
  | 'itinerary'
  | 'bookingPreview'

export interface TripPlannerServiceOptions {
  preferenceEngine?: PreferenceEngine
  recommendationEngine?: RecommendationEngine
  itineraryEngine?: ItineraryEngine
  bookingOrchestrator?: BookingOrchestrator
  executionRepository?: TripPlannerExecutionRepository
  eventRepository?: TripPlannerEventRepository
  resultRepository?: TripPlannerResultRepository
  metrics?: TripPlannerMetrics
  timeouts?: Partial<TripPlannerTimeouts>
  /** Deterministic clock start (ms). Advances 1ms per event. */
  clockStartMs?: number
  /** Test hook: force a stage failure. */
  failStage?: TripPlannerFailStage | null
  /** Test hook: force a timeout at a pipeline stage. */
  forceTimeoutStage?: TripPlannerStage | null
  /** Optional wall-clock for timeout budgets (defaults to Date.now). */
  wallClock?: () => number
  /** Test hook: await after Received stage (concurrency / cancel tests). */
  afterReceived?: () => Promise<void>
}

class PipelineCancelledError extends Error {
  constructor(message = 'Pipeline cancelled') {
    super(message)
    this.name = 'PipelineCancelledError'
  }
}

class PipelineTimeoutError extends Error {
  readonly stage: TripPlannerStage
  constructor(stage: TripPlannerStage, message: string) {
    super(message)
    this.name = 'PipelineTimeoutError'
    this.stage = stage
  }
}


const TRAVEL_STYLES: TravelStyle[] = [
  'relaxed',
  'balanced',
  'packed',
  'adventure',
  'cultural',
  'luxury_focus',
  'budget_focus',
]

function coerceTravelStyle(value: string | null | undefined): TravelStyle | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return (TRAVEL_STYLES as string[]).includes(normalized)
    ? (normalized as TravelStyle)
    : null
}

function mapHotelCategories(
  values?: Array<'budget' | 'midrange' | 'boutique' | 'luxury'> | null,
): ExplicitPreferences['hotelCategories'] | undefined {
  if (!values?.length) return undefined
  const mapped: NonNullable<ExplicitPreferences['hotelCategories']> = []
  for (const value of values) {
    if (value === 'boutique') mapped.push('boutique')
    else if (value === 'luxury') mapped.push('resort')
    else if (value === 'budget' || value === 'midrange') mapped.push('hotel')
  }
  return mapped.length ? [...new Set(mapped)] : undefined
}

function mapPace(
  pace?: 'relaxed' | 'balanced' | 'packed' | null,
): ExplicitPreferences['pace'] {
  if (pace === 'relaxed') return 'slow'
  if (pace === 'packed') return 'fast'
  if (pace === 'balanced') return 'balanced'
  return null
}

export class TripPlannerService {
  private readonly preferences: PreferenceEngine
  private readonly recommendations: RecommendationEngine
  private readonly itineraryEngine: ItineraryEngine
  private readonly booking: BookingOrchestrator
  private readonly executions: TripPlannerExecutionRepository
  private readonly events: TripPlannerEventRepository
  private readonly results: TripPlannerResultRepository
  private readonly metrics: TripPlannerMetrics
  private readonly timeouts: TripPlannerTimeouts
  private readonly failStage: TripPlannerFailStage | null
  private readonly forceTimeoutStage: TripPlannerStage | null
  private readonly wallClock: () => number
  private readonly afterReceived: (() => Promise<void>) | null
  private clockMs: number

  constructor(options: TripPlannerServiceOptions = {}) {
    this.preferences = options.preferenceEngine ?? new InMemoryPreferenceEngine()
    this.recommendations =
      options.recommendationEngine ?? createRecommendationEngine()
    this.itineraryEngine = options.itineraryEngine ?? createItineraryEngine()
    this.booking = options.bookingOrchestrator ?? createBookingOrchestrator({
      clockStartMs: options.clockStartMs ?? Date.UTC(2026, 6, 15, 14, 0, 0),
    })
    this.executions =
      options.executionRepository ?? new InMemoryTripPlannerExecutionRepository()
    this.events = options.eventRepository ?? new InMemoryTripPlannerEventRepository()
    this.results =
      options.resultRepository ?? new InMemoryTripPlannerResultRepository()
    this.metrics = options.metrics ?? getTripPlannerMetrics()
    this.timeouts = { ...DEFAULT_TRIP_PLANNER_TIMEOUTS, ...options.timeouts }
    this.failStage = options.failStage ?? null
    this.forceTimeoutStage = options.forceTimeoutStage ?? null
    this.wallClock = options.wallClock ?? (() => Date.now())
    this.afterReceived = options.afterReceived ?? null
    this.clockMs = options.clockStartMs ?? Date.UTC(2026, 6, 15, 14, 0, 0)
  }

  clear(): void {
    this.executions.clear()
    this.events.clear()
    this.results.clear()
  }

  getStoredResult(idempotencyKey: string): TripPlannerResult | null {
    return this.results.getByIdempotencyKey(idempotencyKey)
  }

  async plan(
    request: TripPlannerRequest,
    options: { signal?: AbortSignal } = {},
  ): Promise<TripPlannerResult> {
    const correlationId = createCorrelationId()
    const previous = null
    setCorrelationId(correlationId)
    try {
      return await this.planWithCorrelation(request, correlationId, options.signal)
    } finally {
      void previous
      // Leave correlation id set for caller diagnostics; deterministic per request.
    }
  }

  private async planWithCorrelation(
    request: TripPlannerRequest,
    correlationId: string,
    signal?: AbortSignal,
  ): Promise<TripPlannerResult> {
    const pipelineStarted = this.wallNow()

    // Idempotency: return stored terminal result
    const existingResult = this.results.getByIdempotencyKey(request.idempotencyKey)
    if (existingResult) {
      this.metrics.incr('trip_planner.idempotency_hits', { outcome: 'result' })
      return existingResult
    }

    const existingExec = this.executions.getByIdempotencyKey(request.idempotencyKey)
    if (existingExec && existingExec.status === 'running') {
      this.metrics.incr('trip_planner.idempotency_hits', { outcome: 'in_flight' })
      // Deterministic in-memory phase: treat in-flight as duplicate prevention
      return this.buildSkeletonResult(request, correlationId, {
        status: 'failed',
        stage: 'Failed',
        failure: {
          stage: 'Received',
          code: 'duplicate_request',
          message: 'A planning request with this idempotency key is already in progress.',
          retryable: true,
          correlationId,
        },
        warnings: ['Duplicate in-flight request blocked by idempotency key'],
      })
    }

    const executionId = nextExecutionId()
    const timeline: TripPlannerPipelineEvent[] = []
    const state: PipelineExecutionState = {
      executionId,
      requestId: request.requestId,
      idempotencyKey: request.idempotencyKey,
      correlationId,
      stage: 'Received',
      status: 'running',
      createdAt: this.tick(),
      updatedAt: this.tick(),
      cancelled: false,
    }
    this.executions.save(state)

    const push = (
      stage: TripPlannerStage,
      message: string,
      ok: boolean,
      durationMs?: number,
      details?: Record<string, unknown>,
    ): void => {
      const event: TripPlannerPipelineEvent = {
        id: nextEventId(),
        stage,
        at: this.tick(),
        message,
        ok,
        durationMs: durationMs ?? null,
        details: details ? (maskMetadata(details) as Record<string, unknown>) : undefined,
      }
      timeline.push(event)
      this.events.append(executionId, event)
      state.stage = stage
      state.updatedAt = event.at
      this.executions.save(state)
      if (durationMs != null) {
        this.metrics.observeDuration('trip_planner.stage_duration_ms', durationMs, {
          stage,
        })
      }
    }

    push('Received', 'Trip planning request received', true, undefined, {
      requestId: request.requestId,
      destinations: request.destinations.length,
      includeBookingPreview: request.includeBookingPreview === true,
      preferredLanguage: request.preferredLanguage ?? 'en',
    })

    let normalizedPreferences: PipelineNormalizedPreferences | null = null
    let recommendations: TripPlannerResult['recommendations'] = []
    let itinerary: TripPlannerResult['itinerary'] = null
    let bookingPreview: BookingPreview | null = null
    let recommendationOverall = 0
    const warnings: string[] = []
    const assumptions: string[] = []
    const currency = resolveCurrency(request)

    const throwIfAborted = (stage: TripPlannerStage): void => {
      if (signal?.aborted || state.cancelled) {
        throw new PipelineCancelledError(`Cancelled at stage ${stage}`)
      }
      const elapsed = this.wallNow() - pipelineStarted
      if (elapsed > this.timeouts.totalMs) {
        throw new PipelineTimeoutError(stage, `Total pipeline timeout exceeded at ${stage}`)
      }
    }

    const runTimed = async <T>(
      stage: TripPlannerStage,
      budgetMs: number,
      work: () => Promise<T> | T,
    ): Promise<T> => {
      throwIfAborted(stage)
      if (this.forceTimeoutStage === stage) {
        throw new PipelineTimeoutError(stage, `Stage timeout exceeded for ${stage}`)
      }
      const started = this.wallNow()
      const result = await work()
      const duration = this.wallNow() - started
      if (duration > budgetMs) {
        throw new PipelineTimeoutError(stage, `Stage timeout exceeded for ${stage}`)
      }
      return result
    }

    try {
      if (this.afterReceived) {
        await this.afterReceived()
        throwIfAborted('Received')
      }

      // —— Validating ——
      const validationErrors = await runTimed('Validating', this.timeouts.validatingMs, () =>
        validateTripPlannerRequest(request, this.wallNow()),
      )
      if (validationErrors.length > 0) {
        push('Validating', 'Validation failed', false, undefined, {
          errorCount: validationErrors.length,
        })
        this.metrics.incr('trip_planner.stage_failures', { stage: 'Validating' })
        const result = this.finalize({
          request,
          correlationId,
          status: 'failed',
          stage: 'Failed',
          normalizedPreferences,
          recommendations,
          itinerary,
          bookingPreview,
          currency,
          warnings,
          assumptions,
          timeline,
          failure: {
            stage: 'Validating',
            code: validationErrors[0]!.code,
            message: validationErrors[0]!.message,
            retryable: false,
            correlationId,
          },
          validationErrors,
          partial: false,
          recommendationOverall,
        })
        state.status = 'failed'
        this.executions.save(state)
        this.results.save(request.idempotencyKey, result)
        this.recordPipelineDuration(pipelineStarted)
        return result
      }
      push('Validating', 'Request validated', true)

      // —— Preferences ——
      normalizedPreferences = await runTimed(
        'PreferencesPrepared',
        this.timeouts.preferencesMs,
        () => {
          if (this.failStage === 'preferences') {
            throw new Error('Forced preference failure')
          }
          return this.preparePreferences(request)
        },
      )
      push('PreferencesPrepared', 'Preferences normalized', true, undefined, {
        interestCount: normalizedPreferences.interests.length,
        travelStyle: normalizedPreferences.travelStyle,
      })

      // —— Recommendations ——
      const recResult = await runTimed(
        'RecommendationsGenerated',
        this.timeouts.recommendationsMs,
        () => {
          if (this.failStage === 'recommendations') {
            throw new Error('Forced recommendation failure')
          }
          return this.generateRecommendations(request, normalizedPreferences!)
        },
      )
      recommendations = recResult.recommendations
      recommendationOverall = recResult.overallConfidence
      push(
        'RecommendationsGenerated',
        `Generated ${recommendations.length} recommendations`,
        true,
        undefined,
        { overallConfidence: recommendationOverall },
      )

      // —— Itinerary ——
      itinerary = await runTimed('ItineraryGenerated', this.timeouts.itineraryMs, () => {
        if (this.failStage === 'itinerary') {
          throw new Error('Forced itinerary failure')
        }
        return this.generateItinerary(request, normalizedPreferences!, recommendations)
      })
      assumptions.push(...(itinerary.explanation.assumptions ?? []))
      warnings.push(
        ...(itinerary.explanation.unmatchedPreferences ?? []).map(
          (p) => `Unmatched preference: ${p}`,
        ),
      )
      push('ItineraryGenerated', 'Itinerary generated', true, undefined, {
        days: itinerary.durationDays,
        total: itinerary.costs.total,
      })

      // —— Booking preview (optional; never pays/confirms) ——
      if (request.includeBookingPreview === true) {
        bookingPreview = await runTimed(
          'BookingPreviewGenerated',
          this.timeouts.bookingPreviewMs,
          async () => {
            if (this.failStage === 'bookingPreview') {
              throw new Error('Forced booking preview failure')
            }
            return this.buildBookingPreview(request, itinerary!)
          },
        )
        this.metrics.incr('trip_planner.booking_preview_usage', { used: 'true' })
        push('BookingPreviewGenerated', 'Mock booking preview prepared', true, undefined, {
          bookingId: bookingPreview.bookingId,
          validated: bookingPreview.validated,
          reservationReady: bookingPreview.reservationReady,
          paymentCaptured: false,
        })
      } else {
        this.metrics.incr('trip_planner.booking_preview_usage', { used: 'false' })
      }

      throwIfAborted('Completed')
      push('Completed', 'Trip planning completed', true)

      const result = this.finalize({
        request,
        correlationId,
        status: 'completed',
        stage: 'Completed',
        normalizedPreferences,
        recommendations,
        itinerary,
        bookingPreview,
        currency,
        warnings,
        assumptions,
        timeline,
        failure: null,
        validationErrors: [],
        partial: false,
        recommendationOverall,
      })
      state.status = 'completed'
      this.executions.save(state)
      this.results.save(request.idempotencyKey, result)
      this.metrics.observeConfidence(result.overallConfidence, { status: 'completed' })
      this.recordPipelineDuration(pipelineStarted)
      return result
    } catch (error) {
      return this.handleFailure({
        error,
        request,
        correlationId,
        state,
        timeline,
        push,
        pipelineStarted,
        normalizedPreferences,
        recommendations,
        itinerary,
        bookingPreview,
        currency,
        warnings,
        assumptions,
        recommendationOverall,
      })
    }
  }

  private preparePreferences(request: TripPlannerRequest): PipelineNormalizedPreferences {
    const explicit: ExplicitPreferences = {
      travelerType:
        request.explicitPreferences?.travelerType ??
        request.travelers.travelerType ??
        null,
      interests: request.explicitPreferences?.interests ?? [],
      budgetStyle: request.explicitPreferences?.budgetStyle ?? null,
      budgetAmount: request.budget?.amount ?? null,
      budgetCurrency: resolveCurrency(request),
      travelStyle: coerceTravelStyle(
        request.explicitPreferences?.travelStyle ?? request.travelStyle ?? null,
      ),
      pace: mapPace(request.explicitPreferences?.pace),
      preferDirectFlights:
        request.explicitPreferences?.preferDirectFlights ??
        request.constraints?.preferDirectFlights,
      preferCentralHotels:
        request.explicitPreferences?.preferCentralHotels ??
        request.constraints?.preferCentralHotels,
      preferBreakfast: request.explicitPreferences?.preferBreakfast,
      preferredAirlines: request.explicitPreferences?.preferredAirlines,
      // Map trip-planner hotel style labels into PreferenceEngine categories when possible.
      hotelCategories: mapHotelCategories(request.explicitPreferences?.hotelCategories),
    }

    const inferred: InferredPreferences = {
      frequentDestinations: request.inferredPreferences?.frequentDestinations ?? [],
      interestSignals: request.inferredPreferences?.interestSignals ?? [],
      typicalSpend: request.inferredPreferences?.typicalSpend ?? null,
    }

    // Avoid storing unnecessary PII — only preference signals + userId key
    this.preferences.setExplicitPreferences(request.userId, explicit)
    this.preferences.setInferredPreferences(request.userId, inferred)
    const normalized = this.preferences.normalizePreferences(request.userId)
    const weights = this.preferences.calculateWeights(request.userId)

    const preferenceSources: PreferenceSourceRecord[] = []
    for (const interest of explicit.interests ?? []) {
      preferenceSources.push({ key: `interest:${interest}`, source: 'explicit' })
    }
    for (const interest of inferred.interestSignals ?? []) {
      if (!(explicit.interests ?? []).map((i) => i.toLowerCase()).includes(interest.toLowerCase())) {
        preferenceSources.push({ key: `interest:${interest}`, source: 'inferred' })
      }
    }
    if (explicit.travelStyle) {
      preferenceSources.push({ key: `style:${explicit.travelStyle}`, source: 'explicit' })
    } else {
      preferenceSources.push({ key: `style:${normalized.travelStyle}`, source: 'default' })
    }
    if (explicit.budgetStyle) {
      preferenceSources.push({ key: `budgetStyle:${explicit.budgetStyle}`, source: 'explicit' })
    }
    if (explicit.preferDirectFlights != null) {
      preferenceSources.push({ key: 'preferDirectFlights', source: 'explicit' })
    }

    return {
      ...normalized,
      weights,
      preferenceSources,
    }
  }

  private generateRecommendations(
    request: TripPlannerRequest,
    prefs: PipelineNormalizedPreferences,
  ) {
    const durationDays = resolveDurationDays(request)
    const locale = request.preferredLanguage === 'ar' ? 'ar' : 'en'
    const month = request.startDate
      ? Number(request.startDate.slice(5, 7)) || null
      : null

    this.recommendations.setProfile(this.preferences.getProfile(request.userId))

    return this.recommendations.recommendV1({
      context: {
        destination: request.destinations[0]!,
        destinations: request.destinations,
        locale,
        tripDurationDays: durationDays,
        travelMonth: month,
        season: null,
        budgetAmount: request.budget?.amount ?? prefs.budgetAmount,
        budgetCurrency: resolveCurrency(request),
        travelerType: (request.travelers.travelerType ??
          prefs.travelerType) as 'solo' | 'couple' | 'family' | 'friends' | 'business' | null,
        travelStyle: prefs.travelStyle,
        interests: prefs.interests,
        popularDestinations: request.destinations,
      },
      candidates: buildRecommendationCandidates(request),
      maxResults: 5,
      explicitPreferences: prefs.preferenceSources
        .filter((s) => s.source === 'explicit')
        .map((s) => s.key),
      inferredPreferences: prefs.preferenceSources
        .filter((s) => s.source === 'inferred')
        .map((s) => s.key),
    })
  }

  private generateItinerary(
    request: TripPlannerRequest,
    prefs: PipelineNormalizedPreferences,
    recommendations: TripPlannerResult['recommendations'],
  ) {
    const durationDays = resolveDurationDays(request)
    return this.itineraryEngine.generate({
      destination: request.destinations[0]!,
      destinations: request.destinations,
      locale: request.preferredLanguage === 'ar' ? 'ar' : 'en',
      startDate: request.startDate ?? null,
      endDate: request.endDate ?? null,
      durationDays,
      budgetAmount: request.budget?.amount ?? prefs.budgetAmount,
      budgetCurrency: resolveCurrency(request),
      origin: request.origin ?? null,
      travelerType: (request.travelers.travelerType ??
        null) as 'solo' | 'couple' | 'family' | 'friends' | 'business' | null,
      travelStyle: prefs.travelStyle,
      interests: prefs.interests,
      constraints: {
        mustAvoid: request.constraints?.mustAvoid,
        maxActivitiesPerDay: request.constraints?.maxActivitiesPerDay,
        preferDirectFlights:
          request.constraints?.preferDirectFlights ?? prefs.preferDirectFlights,
        preferCentralHotels:
          request.constraints?.preferCentralHotels ?? prefs.preferCentralHotels,
      },
      optimizationGoal: request.constraints?.preferRelaxedPace
        ? 'minimum_travel_time'
        : prefs.budgetStyle === 'budget'
          ? 'budget_fit'
          : 'preference_score',
      recommendations: recommendations.map((r) => ({
        id: r.id,
        title: r.title,
        kind: r.kind,
        score: r.score.overall,
        confidence: r.confidence,
        matchedPreferences: r.matchedPreferences,
        tags: r.reasons.map((x) => x.category),
        estimatedCost: null,
      })),
      profile: {
        interests: prefs.interests,
        travelStyle: prefs.travelStyle,
        preferDirectFlights: prefs.preferDirectFlights,
        preferCentralHotels: prefs.preferCentralHotels,
        budgetStyle: prefs.budgetStyle,
      },
    })
  }

  private async buildBookingPreview(
    request: TripPlannerRequest,
    itinerary: NonNullable<TripPlannerResult['itinerary']>,
  ): Promise<BookingPreview> {
    const booking = this.booking.createDraftFromItinerary(
      request.userId,
      itinerary,
      `preview_${request.idempotencyKey}`,
    )
    const validation = this.booking.validateItinerary(booking)
    let reservationReady = false
    if (validation.ok) {
      reservationReady = await this.booking.reserveResources(booking)
    }
    // Intentionally do NOT call simulatePayment / confirmBooking / runPipeline.
    const fresh = this.booking.getBooking(booking.id) ?? booking
    return {
      bookingId: fresh.id,
      state: fresh.state,
      validated: validation.ok,
      reservationReady,
      paymentCaptured: false,
      bookingConfirmed: false,
      liveProvidersUsed: false,
      summary: this.booking.getSummary(fresh.id),
      timeline: this.booking.getTimeline(fresh.id),
    }
  }

  private handleFailure(input: {
    error: unknown
    request: TripPlannerRequest
    correlationId: string
    state: PipelineExecutionState
    timeline: TripPlannerPipelineEvent[]
    push: (
      stage: TripPlannerStage,
      message: string,
      ok: boolean,
      durationMs?: number,
      details?: Record<string, unknown>,
    ) => void
    pipelineStarted: number
    normalizedPreferences: PipelineNormalizedPreferences | null
    recommendations: TripPlannerResult['recommendations']
    itinerary: TripPlannerResult['itinerary']
    bookingPreview: BookingPreview | null
    currency: string
    warnings: string[]
    assumptions: string[]
    recommendationOverall: number
  }): TripPlannerResult {
    const {
      error,
      request,
      correlationId,
      state,
      timeline,
      push,
      pipelineStarted,
      normalizedPreferences,
      recommendations,
      itinerary,
      bookingPreview,
      currency,
      warnings,
      assumptions,
      recommendationOverall,
    } = input

    const isCancelled =
      error instanceof PipelineCancelledError ||
      (error instanceof Error && error.name === 'PipelineCancelledError')
    if (isCancelled) {
      push('Cancelled', 'Pipeline cancelled', false)
      this.metrics.incr('trip_planner.cancellations', { reason: 'abort' })
      state.status = 'cancelled'
      state.cancelled = true
      this.executions.save(state)
      const result = this.finalize({
        request,
        correlationId,
        status: 'cancelled',
        stage: 'Cancelled',
        normalizedPreferences,
        recommendations,
        itinerary: null, // clean cancellation — drop incomplete booking side effects
        bookingPreview: null,
        currency,
        warnings: [...warnings, 'Request was cancelled'],
        assumptions,
        timeline,
        failure: {
          stage: 'Cancelled',
          code: 'cancelled',
          message: 'Trip planning was cancelled.',
          retryable: true,
          correlationId,
        },
        validationErrors: [],
        partial: Boolean(normalizedPreferences || recommendations.length),
        recommendationOverall,
      })
      this.results.save(request.idempotencyKey, result)
      this.recordPipelineDuration(pipelineStarted)
      return result
    }

    let failedStage: TripPlannerStage = 'Failed'
    let code = 'pipeline_error'
    let message = 'Trip planning failed.'
    let retryable = false

    if (error instanceof PipelineTimeoutError) {
      failedStage = error.stage
      code = 'timeout'
      message = 'Trip planning timed out. Please retry.'
      retryable = true
      this.metrics.incr('trip_planner.cancellations', { reason: 'timeout' })
    } else if (error instanceof Error) {
      if (error.message.includes('preference')) {
        failedStage = 'PreferencesPrepared'
        code = 'preference_failure'
        message = 'We could not prepare travel preferences for this request.'
      } else if (error.message.includes('recommendation')) {
        failedStage = 'RecommendationsGenerated'
        code = 'recommendation_failure'
        message = 'We could not generate recommendations for this trip.'
        retryable = true
      } else if (error.message.includes('itinerary')) {
        failedStage = 'ItineraryGenerated'
        code = 'itinerary_failure'
        message = 'We could not generate an itinerary for this trip.'
        retryable = true
      } else if (error.message.includes('booking preview')) {
        failedStage = 'BookingPreviewGenerated'
        code = 'booking_preview_failure'
        message = 'We could not prepare a booking preview for this trip.'
        retryable = true
      } else {
        // Keep message user-safe — do not expose stack/secrets
        message = 'Trip planning failed due to an unexpected error.'
        retryable = true
      }
    }

    push('Failed', message, false, undefined, {
      failedStage,
      code,
    })
    this.metrics.incr('trip_planner.stage_failures', { stage: failedStage })

    // Preserve completed prior-stage results when safe; booking preview never kept on its own failure
    const keepItinerary =
      failedStage !== 'ItineraryGenerated' &&
      failedStage !== 'PreferencesPrepared' &&
      failedStage !== 'RecommendationsGenerated'
    const keepRecommendations =
      failedStage !== 'PreferencesPrepared' && failedStage !== 'RecommendationsGenerated'
    const keepPrefs = failedStage !== 'PreferencesPrepared'
    const keepBooking =
      failedStage !== 'BookingPreviewGenerated' &&
      failedStage !== 'Cancelled' &&
      bookingPreview != null

    const partial =
      (keepPrefs && normalizedPreferences != null) ||
      (keepRecommendations && recommendations.length > 0) ||
      (keepItinerary && itinerary != null)

    if (partial) {
      this.metrics.incr('trip_planner.partial_results', { stage: failedStage })
    }

    const failure: TripPlannerFailure = {
      stage: failedStage,
      code,
      message,
      retryable,
      correlationId,
    }

    state.status = 'failed'
    this.executions.save(state)

    const result = this.finalize({
      request,
      correlationId,
      status: partial ? 'partial' : 'failed',
      stage: 'Failed',
      normalizedPreferences: keepPrefs ? normalizedPreferences : null,
      recommendations: keepRecommendations ? recommendations : [],
      itinerary: keepItinerary ? itinerary : null,
      bookingPreview: keepBooking ? bookingPreview : null,
      currency,
      warnings: [...warnings, message],
      assumptions,
      timeline,
      failure,
      validationErrors: [],
      partial,
      recommendationOverall,
    })
    this.results.save(request.idempotencyKey, result)
    this.recordPipelineDuration(pipelineStarted)
    return result
  }

  private finalize(input: {
    request: TripPlannerRequest
    correlationId: string
    status: TripPlannerResult['status']
    stage: TripPlannerStage
    normalizedPreferences: PipelineNormalizedPreferences | null
    recommendations: TripPlannerResult['recommendations']
    itinerary: TripPlannerResult['itinerary']
    bookingPreview: BookingPreview | null
    currency: string
    warnings: string[]
    assumptions: string[]
    timeline: TripPlannerPipelineEvent[]
    failure: TripPlannerFailure | null
    validationErrors: TripPlannerResult['validationErrors']
    partial: boolean
    recommendationOverall: number
  }): TripPlannerResult {
    const confidence =
      input.status === 'failed' && !input.partial && !input.itinerary
        ? null
        : calculatePipelineConfidence({
            recommendations: input.recommendations,
            recommendationOverall: input.recommendationOverall,
            itinerary: input.itinerary,
            preferences: input.normalizedPreferences,
            bookingPreview: input.bookingPreview,
            includeBookingPreview: input.request.includeBookingPreview === true,
            constraints: input.request.constraints,
            hasBudget: input.request.budget != null,
            hasDates: Boolean(input.request.startDate && input.request.endDate) ||
              input.request.flexibleDates === true,
          })

    return {
      requestId: input.request.requestId,
      correlationId: input.correlationId,
      status: input.status,
      stage: input.stage,
      normalizedPreferences: input.normalizedPreferences,
      recommendations: input.recommendations,
      itinerary: input.itinerary,
      bookingPreview: input.bookingPreview,
      totalEstimatedCost: input.itinerary?.costs.total ?? null,
      currency: input.currency,
      overallConfidence: confidence?.overall ?? 0,
      confidence,
      warnings: input.warnings,
      assumptions: input.assumptions,
      pipelineTimeline: structuredClone(input.timeline),
      failure: input.failure,
      validationErrors: input.validationErrors,
      partial: input.partial,
      generatedAt: this.tick(),
      version: 1,
    }
  }

  private buildSkeletonResult(
    request: TripPlannerRequest,
    correlationId: string,
    overrides: Partial<TripPlannerResult> & {
      status: TripPlannerResult['status']
      stage: TripPlannerStage
    },
  ): TripPlannerResult {
    return {
      requestId: request.requestId,
      correlationId,
      status: overrides.status,
      stage: overrides.stage,
      normalizedPreferences: null,
      recommendations: [],
      itinerary: null,
      bookingPreview: null,
      totalEstimatedCost: null,
      currency: resolveCurrency(request),
      overallConfidence: 0,
      confidence: null,
      warnings: overrides.warnings ?? [],
      assumptions: [],
      pipelineTimeline: overrides.pipelineTimeline ?? [],
      failure: overrides.failure ?? null,
      validationErrors: overrides.validationErrors ?? [],
      partial: overrides.partial ?? false,
      generatedAt: this.tick(),
      version: 1,
    }
  }

  private recordPipelineDuration(startedMs: number): void {
    this.metrics.observeDuration(
      'trip_planner.pipeline_duration_ms',
      this.wallNow() - startedMs,
    )
  }

  private tick(): string {
    const iso = new Date(this.clockMs).toISOString()
    this.clockMs += 1
    return iso
  }

  private wallNow(): number {
    return this.wallClock()
  }
}

export function createTripPlannerService(
  options?: TripPlannerServiceOptions,
): TripPlannerService {
  return new TripPlannerService(options)
}

/** Test helper — resets booking counters used by preview drafts. */
export function resetTripPlannerTestSingletons(): void {
  resetTripPlannerCounters()
  resetBookingOrchestratorCounters()
  resetTripPlannerMetrics()
}

