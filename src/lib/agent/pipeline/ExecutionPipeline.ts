/**
 * Sprint 115 — ExecutionPipeline
 * Sequential stage runner with timeout, retry hooks, and recoverable failures.
 * Default handlers call public engine APIs only — no engine rewrites.
 */

import { runMemoryEngine } from '../memory/index'
import { runItineraryEngine } from '../itinerary'
import { runTripBuilder } from '../tripBuilder'
import { runResponseComposer } from '../responseComposer'
import { runConcierge, optionsFromResponseComposer } from '../concierge'
import type { RahhalFlightSearchOffer } from '../liveFlightSearch/types'
import type { HotelOffer } from '../liveHotelSearch/types'
import type { PipelineContext } from './PipelineContext'
import type { PipelineLogger } from './PipelineLogger'
import {
  PIPELINE_STAGE_ORDER,
  createCompletedStageResult,
  createFailedStageResult,
  createSkippedStageResult,
  type PipelineInput,
  type PipelineStageHandler,
  type PipelineStageId,
  type PipelineStageResult,
} from './PipelineStages'

export type PipelineStageAdapters = Partial<
  Record<PipelineStageId, PipelineStageHandler>
>

function asFlightOffers(
  rows: Array<Record<string, unknown>>,
): RahhalFlightSearchOffer[] {
  return rows.map((r, i) => ({
    id: String(r.id ?? `flt_${i}`),
    providerId: String(r.providerId ?? 'pipeline'),
    airline: (r.airline as string | null) ?? null,
    carrierCode: (r.carrierCode as string | null) ?? null,
    price: typeof r.price === 'number' ? r.price : null,
    currency: String(r.currency ?? 'SAR'),
    durationMinutes: typeof r.durationMinutes === 'number' ? r.durationMinutes : null,
    stops: typeof r.stops === 'number' ? r.stops : null,
    cabin: (r.cabin as string | null) ?? null,
    origin: String(r.origin ?? ''),
    destination: String(r.destination ?? ''),
    departureAt: (r.departureAt as string | null) ?? null,
    arrivalAt: (r.arrivalAt as string | null) ?? null,
    refundable: r.refundable === true,
    seatsRemaining: typeof r.seatsRemaining === 'number' ? r.seatsRemaining : null,
    providerConfidence: typeof r.providerConfidence === 'number' ? r.providerConfidence : 0.8,
    availability: (r.availability as string | null) ?? null,
    title: String(r.title ?? r.id ?? `Flight ${i}`),
  }))
}

function asHotelOffers(rows: Array<Record<string, unknown>>): HotelOffer[] {
  return rows.map((r, i) => ({
    id: String(r.id ?? `htl_${i}`),
    hotelId: String(r.hotelId ?? r.id ?? `H${i}`),
    hotelName: String(r.hotelName ?? r.name ?? r.title ?? `Hotel ${i}`),
    city: (r.city as string | null) ?? null,
    country: (r.country as string | null) ?? null,
    latitude: typeof r.latitude === 'number' ? r.latitude : null,
    longitude: typeof r.longitude === 'number' ? r.longitude : null,
    roomType: (r.roomType as string | null) ?? null,
    boardType: (r.boardType as string | null) ?? null,
    rating: typeof r.rating === 'number' ? r.rating : null,
    stars: typeof r.stars === 'number' ? r.stars : null,
    price: typeof r.price === 'number' ? r.price : null,
    currency: String(r.currency ?? 'SAR'),
    taxes: typeof r.taxes === 'number' ? r.taxes : null,
    freeCancellation: r.freeCancellation === true || r.refundable === true,
    amenities: Array.isArray(r.amenities) ? r.amenities.map(String) : [],
    images: Array.isArray(r.images) ? r.images.map(String) : [],
    provider: String(r.provider ?? r.providerId ?? 'pipeline'),
  }))
}

function inferStyle(
  input: PipelineInput,
  children: number,
): 'leisure' | 'family' | 'business' | 'mixed' {
  if (input.trip?.style) return input.trip.style
  if (children > 0) return 'family'
  const text = (input.messages ?? []).map((m) => m.text).join(' ').toLowerCase()
  if (/business|اجتماع|عمل/.test(text)) return 'business'
  if (/family|عائلي|أطفال/.test(text)) return 'family'
  return 'leisure'
}

export function createDefaultStageAdapters(): PipelineStageAdapters {
  return {
    conversation(input, ctx) {
      const started = Date.now()
      const messages = input.messages ?? []
      const text = messages.map((m) => m.text).join(' ')
      // Light understanding: fill missing trip hints from message text when possible
      if (!ctx.trip.destination) {
        const m = text.match(/\b(?:to|in)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/)
        if (m?.[1]) ctx.trip.destination = m[1]
      }
      if (!ctx.trip.budget) {
        const m = text.match(/(?:SAR|sar)\s*([\d,]+)/) || text.match(/([\d,]+)\s*(?:SAR|sar)/)
        if (m?.[1]) ctx.trip.budget = Number(m[1].replace(/,/g, ''))
      }
      if (!ctx.trip.adults) {
        const m = text.match(/(\d+)\s*adult/i)
        if (m?.[1]) ctx.trip.adults = Number(m[1])
      }
      if (ctx.trip.children == null) {
        const m = text.match(/(\d+)\s*child/i)
        if (m?.[1]) ctx.trip.children = Number(m[1])
      }
      ctx.trip.style = inferStyle(input, ctx.trip.children ?? 0)
      if (input.stageOverrides?.earlyExit) ctx.earlyExit = true

      return createCompletedStageResult({
        stageId: 'conversation',
        durationMs: Date.now() - started,
        artifact: {
          messagesUnderstood: messages.length,
          destination: ctx.trip.destination ?? null,
          style: ctx.trip.style,
        },
        metadata: { messagesUnderstood: messages.length },
        confidence: messages.length > 0 ? 0.7 : 0.4,
      })
    },

    memory(input, ctx) {
      const started = Date.now()
      if (input.stageOverrides?.skipMemory) {
        return createSkippedStageResult('memory', 'stage_override_skip')
      }
      if (!ctx.userId) {
        ctx.memoryPresent = false
        return createSkippedStageResult('memory', 'no_user_id')
      }
      const result = runMemoryEngine(
        {
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          messages: input.messages ?? [],
          explicit: {
            destination: ctx.trip.destination ?? null,
            budget: ctx.trip.budget ?? null,
            currency: ctx.trip.currency ?? null,
            cabin: ctx.trip.cabin ?? null,
          },
          search: {
            origin: ctx.trip.origin ?? null,
            destination: ctx.trip.destination ?? null,
            departureDate: ctx.trip.departureDate ?? null,
            returnDate: ctx.trip.returnDate ?? null,
            budget: ctx.trip.budget ?? null,
            currency: ctx.trip.currency ?? null,
          },
        },
        { enabled: true },
      )
      ctx.featureFlags.memory = result.enabled
      ctx.memoryPresent = Boolean(result.profile) || result.extracted.length > 0
      return createCompletedStageResult({
        stageId: 'memory',
        durationMs: Date.now() - started,
        artifact: {
          enabled: result.enabled,
          ok: result.ok,
          memoryPresent: ctx.memoryPresent,
          extractedCount: result.extracted.length,
          conciergeHints: result.conciergeHints,
          responseComposerNotes: result.responseComposerNotes,
          matchedPreferences: result.metadata.matchedPreferences,
        },
        metadata: { memoryPresent: ctx.memoryPresent },
        confidence: result.metadata.confidence,
        warnings: result.enabled ? [] : ['memory_engine_disabled_upstream'],
      })
    },

    preference_resolution(_input, ctx) {
      const started = Date.now()
      const memory = ctx.artifacts.memory
      const matched = Array.isArray(memory?.matchedPreferences)
        ? (memory!.matchedPreferences as string[])
        : []
      return createCompletedStageResult({
        stageId: 'preference_resolution',
        durationMs: Date.now() - started,
        artifact: {
          memoryPresent: ctx.memoryPresent,
          matchedPreferences: matched,
          style: ctx.trip.style ?? 'leisure',
        },
        metadata: { resolved: matched.length },
        confidence: ctx.memoryPresent ? 0.75 : 0.55,
      })
    },

    search_planning(input, ctx) {
      const started = Date.now()
      if (input.stageOverrides?.skipSearchPlanning) {
        return createSkippedStageResult('search_planning', 'stage_override_skip')
      }
      const needsFlights = !input.stageOverrides?.skipFlightSearch
      const needsHotels = !input.stageOverrides?.skipHotelSearch
      const plan = {
        origin: ctx.trip.origin ?? null,
        destination: ctx.trip.destination ?? null,
        departureDate: ctx.trip.departureDate ?? null,
        returnDate: ctx.trip.returnDate ?? null,
        checkInDate: ctx.trip.checkInDate ?? ctx.trip.departureDate ?? null,
        checkOutDate: ctx.trip.checkOutDate ?? ctx.trip.returnDate ?? null,
        adults: ctx.trip.adults ?? 1,
        children: ctx.trip.children ?? 0,
        currency: ctx.trip.currency ?? 'SAR',
        searchFlights: needsFlights,
        searchHotels: needsHotels,
        reuseFlights: ctx.flights.length > 0,
        reuseHotels: ctx.hotels.length > 0,
      }
      return createCompletedStageResult({
        stageId: 'search_planning',
        durationMs: Date.now() - started,
        artifact: plan as unknown as Record<string, unknown>,
        metadata: {
          searchFlights: plan.searchFlights,
          searchHotels: plan.searchHotels,
        },
        confidence: plan.destination && plan.departureDate ? 0.8 : 0.45,
        warnings:
          !plan.destination || !plan.departureDate
            ? ['incomplete_search_criteria']
            : [],
      })
    },

    flight_search(input, ctx) {
      const started = Date.now()
      if (input.stageOverrides?.skipFlightSearch) {
        return createSkippedStageResult('flight_search', 'stage_override_skip')
      }
      if (ctx.flights.length > 0) {
        ctx.featureFlags.flightSearch = true
        return createCompletedStageResult({
          stageId: 'flight_search',
          durationMs: Date.now() - started,
          artifact: {
            reused: true,
            flightCount: ctx.flights.length,
            unavailable: false,
          },
          metadata: { flightCount: ctx.flights.length, reused: true },
          confidence: 0.85,
        })
      }
      // Default: do not invent live provider calls — callers inject adapters or offers.
      // Mark as skipped/unavailable so downstream can recover partially.
      ctx.addWarning('flight_search_unavailable_no_offers')
      return createCompletedStageResult({
        stageId: 'flight_search',
        durationMs: Date.now() - started,
        status: 'recovered',
        artifact: {
          reused: false,
          flightCount: 0,
          unavailable: true,
          reason: 'no_prefetched_offers_and_no_live_adapter',
        },
        metadata: { unavailable: true },
        warnings: ['flight_unavailable'],
        confidence: 0.3,
      })
    },

    hotel_search(input, ctx) {
      const started = Date.now()
      if (input.stageOverrides?.skipHotelSearch) {
        return createSkippedStageResult('hotel_search', 'stage_override_skip')
      }
      if (ctx.hotels.length > 0) {
        ctx.featureFlags.hotelSearch = true
        return createCompletedStageResult({
          stageId: 'hotel_search',
          durationMs: Date.now() - started,
          artifact: {
            reused: true,
            hotelCount: ctx.hotels.length,
            unavailable: false,
          },
          metadata: { hotelCount: ctx.hotels.length, reused: true },
          confidence: 0.85,
        })
      }
      ctx.addWarning('hotel_search_unavailable_no_offers')
      return createCompletedStageResult({
        stageId: 'hotel_search',
        durationMs: Date.now() - started,
        status: 'recovered',
        artifact: {
          reused: false,
          hotelCount: 0,
          unavailable: true,
          reason: 'no_prefetched_offers_and_no_live_adapter',
        },
        metadata: { unavailable: true },
        warnings: ['hotel_unavailable'],
        confidence: 0.3,
      })
    },

    decision(input, ctx) {
      const started = Date.now()
      if (input.stageOverrides?.skipDecision) {
        return createSkippedStageResult('decision', 'stage_override_skip')
      }
      // Decision Engine unchanged — pass-through confidence from upstream.
      const confidence =
        input.decisionConfidence
        ?? (ctx.flights.length > 0 && ctx.hotels.length > 0 ? 0.72 : 0.48)
      ctx.setConfidence(confidence)
      return createCompletedStageResult({
        stageId: 'decision',
        durationMs: Date.now() - started,
        artifact: {
          passThrough: true,
          confidence,
          explanation: input.decisionExplanation ?? null,
          flightCount: ctx.flights.length,
          hotelCount: ctx.hotels.length,
          note: 'Decision Engine not modified — confidence propagated',
        },
        metadata: { passThrough: true },
        confidence,
      })
    },

    trip_builder(input, ctx) {
      const started = Date.now()
      if (input.stageOverrides?.skipTripBuilder) {
        return createSkippedStageResult('trip_builder', 'stage_override_skip')
      }
      const destination = ctx.trip.destination?.trim()
      const departureDate = ctx.trip.departureDate?.trim()
      if (!destination || !departureDate) {
        return createSkippedStageResult(
          'trip_builder',
          'missing_destination_or_departureDate',
          Date.now() - started,
        )
      }
      if (ctx.flights.length === 0 || ctx.hotels.length === 0) {
        return createCompletedStageResult({
          stageId: 'trip_builder',
          durationMs: Date.now() - started,
          status: 'recovered',
          artifact: {
            ok: false,
            empty: true,
            tripCount: 0,
            reason: 'insufficient_offers',
          },
          warnings: ['trip_builder_partial_insufficient_offers'],
          confidence: 0.35,
        })
      }
      const result = runTripBuilder(
        {
          flights: asFlightOffers(ctx.flights),
          hotels: asHotelOffers(ctx.hotels),
          destination,
          departureDate,
          returnDate: ctx.trip.returnDate ?? null,
          checkInDate: ctx.trip.checkInDate ?? null,
          checkOutDate: ctx.trip.checkOutDate ?? null,
          budget: ctx.trip.budget ?? null,
          currency: ctx.trip.currency ?? 'SAR',
          adults: ctx.trip.adults ?? 1,
          children: ctx.trip.children ?? 0,
          conversationId: ctx.conversationId,
        },
        { enabled: true },
      )
      ctx.featureFlags.tripBuilder = result.enabled
      return createCompletedStageResult({
        stageId: 'trip_builder',
        durationMs: Date.now() - started,
        artifact: {
          enabled: result.enabled,
          ok: result.ok,
          tripCount: result.trips.length,
          selectedId: result.selected?.id ?? null,
          selected: result.selected
            ? (result.selected as unknown as Record<string, unknown>)
            : null,
          confidence: result.confidence,
          responseComposerInput: result.responseComposerInput as unknown as Record<
            string,
            unknown
          >,
        },
        metadata: { tripCount: result.trips.length },
        confidence: result.confidence,
      })
    },

    itinerary(input, ctx) {
      const started = Date.now()
      if (input.stageOverrides?.skipItinerary) {
        return createSkippedStageResult('itinerary', 'stage_override_skip')
      }
      const selected = ctx.artifacts.trip_builder?.selected as
        | Parameters<typeof runItineraryEngine>[0]['trip']
        | null
        | undefined
      const result = runItineraryEngine(
        {
          conversationId: ctx.conversationId,
          trip: selected ?? null,
          destination: ctx.trip.destination ?? null,
          departureDate: ctx.trip.departureDate ?? null,
          returnDate: ctx.trip.returnDate ?? null,
          checkInDate: ctx.trip.checkInDate ?? null,
          checkOutDate: ctx.trip.checkOutDate ?? null,
          style: ctx.trip.style ?? 'leisure',
          adults: ctx.trip.adults ?? 1,
          children: ctx.trip.children ?? 0,
          flights: asFlightOffers(ctx.flights),
          hotels: asHotelOffers(ctx.hotels),
        },
        { enabled: true },
      )
      ctx.featureFlags.itinerary = result.enabled
      return createCompletedStageResult({
        stageId: 'itinerary',
        durationMs: Date.now() - started,
        artifact: {
          enabled: result.enabled,
          ok: result.ok,
          empty: result.empty,
          dayCount: result.days.length,
          confidence: result.metadata.confidence,
          scores: result.scores as unknown as Record<string, unknown>,
        },
        metadata: { dayCount: result.days.length },
        confidence: result.metadata.confidence,
        warnings: result.empty ? ['itinerary_empty'] : [],
      })
    },

    response_composer(input, ctx) {
      const started = Date.now()
      if (input.stageOverrides?.skipResponseComposer) {
        return createSkippedStageResult('response_composer', 'stage_override_skip')
      }
      const tb = ctx.artifacts.trip_builder
      const rcInput =
        (tb?.responseComposerInput as Parameters<typeof runResponseComposer>[0] | undefined)
        ?? {
          conversationId: ctx.conversationId,
          trip: {
            origin: ctx.trip.origin ?? null,
            destination: ctx.trip.destination ?? null,
            departureDate: ctx.trip.departureDate ?? null,
            returnDate: ctx.trip.returnDate ?? null,
            currency: ctx.trip.currency ?? null,
            travelers: ctx.trip.adults ?? null,
          },
          flights: ctx.flights.map((f, i) => ({
            id: String(f.id ?? `f_${i}`),
            title: (f.title as string | null) ?? null,
            airline: (f.airline as string | null) ?? null,
            price: typeof f.price === 'number' ? f.price : null,
            currency: String(f.currency ?? 'SAR'),
            durationMinutes: typeof f.durationMinutes === 'number' ? f.durationMinutes : null,
            stops: typeof f.stops === 'number' ? f.stops : null,
            cabin: (f.cabin as string | null) ?? null,
          })),
          decisionConfidence: ctx.confidence,
          decisionExplanation: input.decisionExplanation ?? null,
        }

      const result = runResponseComposer(rcInput, { enabled: true })
      ctx.featureFlags.responseComposer = result.enabled
      const confidence = result.confidence.overall || ctx.confidence
      ctx.setConfidence(confidence)
      return createCompletedStageResult({
        stageId: 'response_composer',
        durationMs: Date.now() - started,
        artifact: {
          enabled: result.enabled,
          empty: result.metadata.empty,
          offerCount: result.metadata.offerCount,
          result: result as unknown as Record<string, unknown>,
          headline: result.summary.headline,
          executiveSummary: result.summary.executiveSummary,
          recommendations: result.recommendations.map((r) => ({
            id: r.optionId,
            title: r.title,
            price: r.price,
            currency: r.currency,
            reason: r.reason,
          })),
          warnings: result.warnings.map((w) => w.message),
        },
        metadata: { offerCount: result.metadata.offerCount },
        confidence,
      })
    },

    concierge(input, ctx) {
      const started = Date.now()
      if (input.stageOverrides?.skipConcierge) {
        return createSkippedStageResult('concierge', 'stage_override_skip')
      }
      const rcResult = ctx.artifacts.response_composer?.result as
        | Parameters<typeof optionsFromResponseComposer>[0]
        | undefined
      const recommendations = rcResult
        ? optionsFromResponseComposer(rcResult)
        : []
      const memoryHints = Array.isArray(ctx.artifacts.memory?.conciergeHints)
        ? (ctx.artifacts.memory!.conciergeHints as string[])
        : []

      const result = runConcierge(
        {
          conversationId: ctx.conversationId,
          recommendations,
          responseComposer: rcResult as never,
          decisionConfidence: ctx.confidence,
          decisionExplanation: [
            input.decisionExplanation,
            ...memoryHints,
          ]
            .filter(Boolean)
            .join(' '),
          budget: ctx.trip.budget ?? null,
          currency: ctx.trip.currency ?? null,
          destination: ctx.trip.destination ?? null,
        },
        { enabled: true },
      )
      ctx.featureFlags.concierge = result.enabled
      return createCompletedStageResult({
        stageId: 'concierge',
        durationMs: Date.now() - started,
        artifact: {
          enabled: result.enabled,
          ok: result.ok,
          empty: result.empty,
          narrative: result.narrative?.primary ?? null,
          hints: memoryHints,
          attachment: result.responseComposerAttachment as unknown as Record<
            string,
            unknown
          >,
        },
        metadata: { ok: result.ok },
        confidence: result.metadata.confidence || ctx.confidence,
      })
    },

    final(_input, ctx) {
      const started = Date.now()
      return createCompletedStageResult({
        stageId: 'final',
        durationMs: Date.now() - started,
        artifact: {
          confidence: ctx.confidence,
          warningCount: ctx.warnings.length,
          errorCount: ctx.errors.length,
          earlyExit: ctx.earlyExit,
        },
        metadata: { assembled: true },
        confidence: ctx.confidence,
      })
    },
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  stageId: PipelineStageId,
): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`stage_timeout:${stageId}`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export interface ExecutionPipelineOptions {
  adapters?: PipelineStageAdapters
  logger?: PipelineLogger
  stageTimeoutMs?: number
  maxRetries?: number
  continueOnWarning?: boolean
}

export async function runStageSequence(input: {
  input: PipelineInput
  ctx: PipelineContext
  adapters?: PipelineStageAdapters
  logger?: PipelineLogger
  stageTimeoutMs?: number
  maxRetries?: number
  continueOnWarning?: boolean
}): Promise<PipelineStageResult[]> {
  const defaults = createDefaultStageAdapters()
  const adapters: PipelineStageAdapters = { ...defaults, ...input.adapters }
  const timeoutMs = input.stageTimeoutMs
    ?? input.input.stageTimeoutMs
    ?? 15_000
  const maxRetries = input.maxRetries
    ?? input.input.maxRetries
    ?? 0
  const continueOnWarning =
    input.continueOnWarning
    ?? input.input.continueOnWarning
    ?? true

  const results: PipelineStageResult[] = []

  for (const stageId of PIPELINE_STAGE_ORDER) {
    if (input.ctx.earlyExit && stageId !== 'conversation' && stageId !== 'final') {
      const skipped = createSkippedStageResult(stageId, 'early_exit')
      results.push(skipped)
      input.ctx.recordStage(skipped)
      input.logger?.info('pipeline.stage_skipped', { stageId, reason: 'early_exit' })
      continue
    }

    const handler = adapters[stageId]
    if (!handler) {
      const skipped = createSkippedStageResult(stageId, 'no_handler')
      results.push(skipped)
      input.ctx.recordStage(skipped)
      continue
    }

    let attempt = 0
    let result: PipelineStageResult | null = null

    while (attempt <= maxRetries) {
      const started = Date.now()
      try {
        input.logger?.info('pipeline.stage_start', { stageId, attempt })
        const raw = await withTimeout(
          Promise.resolve(handler(input.input, input.ctx)),
          timeoutMs,
          stageId,
        )
        result = { ...raw, retried: attempt }
        if (
          result.status === 'failed'
          && result.metadata.recoverable !== false
          && attempt < maxRetries
        ) {
          attempt += 1
          input.logger?.warn('pipeline.stage_retry', {
            stageId,
            attempt,
            error: result.errors[0] ?? null,
          })
          continue
        }
        break
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const timedOut = message.startsWith('stage_timeout:')
        if (attempt < maxRetries) {
          attempt += 1
          input.logger?.warn('pipeline.stage_retry', { stageId, attempt, error: message })
          continue
        }
        result = {
          ...createFailedStageResult(
            stageId,
            message,
            Date.now() - started,
            true,
          ),
          status: timedOut ? 'timed_out' : 'failed',
          retried: attempt,
        }
        break
      }
    }

    if (!result) {
      result = createFailedStageResult(stageId, 'unknown_stage_failure', 0)
    }

    // Recovery: mark recoverable failures as recovered when continuing
    if (
      (result.status === 'failed' || result.status === 'timed_out')
      && continueOnWarning
      && result.metadata.recoverable !== false
    ) {
      result = {
        ...result,
        status: 'recovered',
        warnings: [
          ...result.warnings,
          `recovered_from_${result.status}`,
        ],
      }
      input.logger?.warn('pipeline.stage_recovered', {
        stageId,
        errors: result.errors,
      })
    }

    results.push(result)
    input.ctx.recordStage(result)
    input.logger?.info('pipeline.stage_done', {
      stageId,
      status: result.status,
      durationMs: result.durationMs,
    })

    if (
      (result.status === 'failed' || result.status === 'timed_out')
      && !continueOnWarning
    ) {
      input.logger?.error('pipeline.halted', { stageId })
      break
    }
  }

  return results
}

export class ExecutionPipeline {
  private readonly options: ExecutionPipelineOptions

  constructor(options: ExecutionPipelineOptions = {}) {
    this.options = options
  }

  run(input: {
    input: PipelineInput
    ctx: PipelineContext
  }): Promise<PipelineStageResult[]> {
    return runStageSequence({
      input: input.input,
      ctx: input.ctx,
      adapters: this.options.adapters,
      logger: this.options.logger,
      stageTimeoutMs: this.options.stageTimeoutMs,
      maxRetries: this.options.maxRetries,
      continueOnWarning: this.options.continueOnWarning,
    })
  }
}

export function createExecutionPipeline(
  options?: ExecutionPipelineOptions,
): ExecutionPipeline {
  return new ExecutionPipeline(options)
}
