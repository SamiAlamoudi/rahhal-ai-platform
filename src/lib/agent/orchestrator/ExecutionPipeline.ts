/**
 * Sprint 113 — ExecutionPipeline
 * Runs planned stages via injectable adapters (defaults wrap public engine APIs).
 * Does not modify engines.
 */

import { runMemoryEngine } from '../memory/index'
import { runTripBuilder } from '../tripBuilder'
import { runResponseComposer } from '../responseComposer'
import { runConcierge, optionsFromResponseComposer } from '../concierge'
import type { RahhalFlightSearchOffer } from '../liveFlightSearch/types'
import type { HotelOffer } from '../liveHotelSearch/types'
import { estimateTokens } from './ExecutionPlanner'
import type { ExecutionContext } from './ExecutionContext'
import type {
  ExecutionPlan,
  OrchestratorFinalResponse,
  OrchestratorInput,
  OrchestratorStageId,
  OrchestratorStageRecord,
  OrchestratorStageStatus,
} from './types'

export interface StageAdapterResult {
  ok: boolean
  skipped?: boolean
  cached?: boolean
  durationMs: number
  confidence?: number | null
  error?: string | null
  artifact?: Record<string, unknown> | null
  /** Partial final response contributions */
  finalPatch?: Partial<OrchestratorFinalResponse> | null
}

export interface OrchestratorStageAdapters {
  memory?: (
    input: OrchestratorInput,
    ctx: ExecutionContext,
  ) => Promise<StageAdapterResult> | StageAdapterResult
  planner?: (
    input: OrchestratorInput,
    ctx: ExecutionContext,
    plan: ExecutionPlan,
  ) => Promise<StageAdapterResult> | StageAdapterResult
  providers?: (
    input: OrchestratorInput,
    ctx: ExecutionContext,
  ) => Promise<StageAdapterResult> | StageAdapterResult
  tripBuilder?: (
    input: OrchestratorInput,
    ctx: ExecutionContext,
    artifacts: PipelineArtifacts,
  ) => Promise<StageAdapterResult> | StageAdapterResult
  decision?: (
    input: OrchestratorInput,
    ctx: ExecutionContext,
    artifacts: PipelineArtifacts,
  ) => Promise<StageAdapterResult> | StageAdapterResult
  responseComposer?: (
    input: OrchestratorInput,
    ctx: ExecutionContext,
    artifacts: PipelineArtifacts,
  ) => Promise<StageAdapterResult> | StageAdapterResult
  concierge?: (
    input: OrchestratorInput,
    ctx: ExecutionContext,
    artifacts: PipelineArtifacts,
  ) => Promise<StageAdapterResult> | StageAdapterResult
}

export interface PipelineArtifacts {
  memory: Record<string, unknown> | null
  planner: Record<string, unknown> | null
  providers: Record<string, unknown> | null
  tripBuilder: Record<string, unknown> | null
  decision: Record<string, unknown> | null
  responseComposer: Record<string, unknown> | null
  concierge: Record<string, unknown> | null
  flights: Array<Record<string, unknown>>
  hotels: Array<Record<string, unknown>>
}

function stageRecord(
  id: OrchestratorStageId,
  status: OrchestratorStageStatus,
  durationMs: number,
  reason: string | null,
  error: string | null,
  confidence: number | null,
): OrchestratorStageRecord {
  const now = new Date().toISOString()
  return {
    id,
    status,
    startedAt: status === 'skipped' ? null : now,
    completedAt: now,
    durationMs,
    reason,
    error,
    confidence,
  }
}

function asFlightOffers(
  rows: Array<Record<string, unknown>>,
): RahhalFlightSearchOffer[] {
  return rows.map((r, i) => ({
    id: String(r.id ?? `flt_${i}`),
    providerId: String(r.providerId ?? 'orchestrator'),
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

function asHotelOffers(
  rows: Array<Record<string, unknown>>,
): HotelOffer[] {
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
    provider: String(r.provider ?? r.providerId ?? 'orchestrator'),
  }))
}

export function createDefaultStageAdapters(): OrchestratorStageAdapters {
  return {
    memory(input, ctx) {
      const started = Date.now()
      if (!ctx.userId) {
        return {
          ok: true,
          skipped: true,
          durationMs: 0,
          artifact: { reason: 'no_user_id' },
        }
      }
      const result = runMemoryEngine(
        {
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          messages: input.messages ?? [],
          explicit: {
            destination: input.trip?.destination ?? null,
            budget: input.trip?.budget ?? null,
            currency: input.trip?.currency ?? null,
            cabin: input.trip?.cabin ?? null,
          },
          search: input.trip
            ? {
              origin: input.trip.origin ?? null,
              destination: input.trip.destination ?? null,
              departureDate: input.trip.departureDate ?? null,
              returnDate: input.trip.returnDate ?? null,
              budget: input.trip.budget ?? null,
              currency: input.trip.currency ?? null,
            }
            : null,
        },
        { enabled: true },
      )
      ctx.featureFlags.memory = result.enabled
      ctx.userProfilePresent = Boolean(result.profile)
      ctx.memoryUsed = result.enabled && result.ok
      return {
        ok: result.ok || result.enabled === false,
        durationMs: Date.now() - started,
        confidence: result.metadata.confidence,
        artifact: {
          enabled: result.enabled,
          ok: result.ok,
          extractedCount: result.extracted.length,
          matchedPreferences: result.metadata.matchedPreferences,
          conciergeHints: result.conciergeHints,
          responseComposerNotes: result.responseComposerNotes,
        },
        finalPatch: {
          conciergeHints: result.conciergeHints,
        },
      }
    },

    planner(_input, _ctx, plan) {
      return {
        ok: true,
        durationMs: 0,
        artifact: {
          reasons: plan.reasons,
          stageOrder: plan.stageOrder,
          executeSearch: plan.executeSearch,
          earlyExit: plan.earlyExit,
        },
      }
    },

    providers(input, ctx) {
      const started = Date.now()
      // Additive orchestrator does not invent provider calls when offers exist or search skipped.
      // Real live search remains available to callers via liveFlightSearch / liveHotelSearch.
      const flights = (input.flights ?? []).slice()
      const hotels = (input.hotels ?? []).slice()
      if (flights.length === 0 && hotels.length === 0) {
        ctx.providerStatus = ctx.providerStatus === 'unknown' ? 'skipped' : ctx.providerStatus
        return {
          ok: true,
          skipped: true,
          durationMs: Date.now() - started,
          artifact: {
            reason: 'no_provider_invocation_without_offers_or_live_adapters',
            flightCount: 0,
            hotelCount: 0,
          },
        }
      }
      ctx.providerStatus = 'healthy'
      return {
        ok: true,
        durationMs: Date.now() - started,
        artifact: {
          flightCount: flights.length,
          hotelCount: hotels.length,
          reused: true,
        },
      }
    },

    tripBuilder(input, ctx, artifacts) {
      const started = Date.now()
      const destination = input.trip?.destination?.trim()
      const departureDate = input.trip?.departureDate?.trim()
      if (!destination || !departureDate) {
        return {
          ok: false,
          skipped: true,
          durationMs: Date.now() - started,
          error: 'trip builder requires destination and departureDate',
          artifact: null,
        }
      }
      const flights = asFlightOffers(
        artifacts.flights.length ? artifacts.flights : (input.flights ?? []),
      )
      const hotels = asHotelOffers(
        artifacts.hotels.length ? artifacts.hotels : (input.hotels ?? []),
      )
      const result = runTripBuilder(
        {
          flights,
          hotels,
          destination,
          departureDate,
          returnDate: input.trip?.returnDate ?? null,
          checkInDate: input.trip?.checkInDate ?? null,
          checkOutDate: input.trip?.checkOutDate ?? null,
          budget: input.trip?.budget ?? null,
          currency: input.trip?.currency ?? 'SAR',
          adults: input.trip?.adults ?? 1,
          children: input.trip?.children ?? 0,
          conversationId: ctx.conversationId,
        },
        { enabled: true },
      )
      ctx.featureFlags.tripBuilder = result.enabled
      return {
        ok: result.ok || !result.enabled,
        durationMs: Date.now() - started,
        confidence: result.confidence,
        artifact: {
          enabled: result.enabled,
          ok: result.ok,
          tripCount: result.trips.length,
          selectedId: result.selected?.id ?? null,
          responseComposerInput: result.responseComposerInput,
        },
      }
    },

    decision(input, ctx, artifacts) {
      const started = Date.now()
      // Decision Engine is not modified — orchestrator records a pass-through
      // confidence from trip builder / input without calling DE internals.
      const tb = artifacts.tripBuilder
      const confidence =
        input.decisionConfidence
        ?? (typeof tb?.confidence === 'number' ? tb.confidence : null)
        ?? 0.55
      ctx.setConfidence(confidence)
      return {
        ok: true,
        durationMs: Date.now() - started,
        confidence,
        artifact: {
          passThrough: true,
          confidence,
          explanation: input.decisionExplanation ?? null,
          note: 'Decision Engine not modified — confidence propagated from upstream artifacts',
        },
      }
    },

    responseComposer(input, ctx, artifacts) {
      const started = Date.now()
      const tb = artifacts.tripBuilder
      const rcInput =
        (tb?.responseComposerInput as Parameters<typeof runResponseComposer>[0] | undefined)
        ?? {
          conversationId: ctx.conversationId,
          trip: {
            origin: input.trip?.origin ?? null,
            destination: input.trip?.destination ?? null,
            departureDate: input.trip?.departureDate ?? null,
            returnDate: input.trip?.returnDate ?? null,
            currency: input.trip?.currency ?? null,
            travelers: input.trip?.adults ?? null,
          },
          flights: (input.flights ?? []).map((f, i) => ({
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

      const memoryNotes = Array.isArray(artifacts.memory?.responseComposerNotes)
        ? (artifacts.memory!.responseComposerNotes as string[])
        : []

      const result = runResponseComposer(rcInput, { enabled: true })
      ctx.featureFlags.responseComposer = result.enabled
      const confidence = result.confidence.overall || ctx.confidence
      ctx.setConfidence(confidence)

      const recommendations = result.recommendations.map((r) => ({
        id: r.optionId,
        title: r.title,
        price: r.price,
        currency: r.currency,
        reason: r.reason,
      }))

      return {
        ok: result.enabled ? !result.metadata.empty || recommendations.length >= 0 : true,
        durationMs: Date.now() - started,
        confidence,
        artifact: {
          enabled: result.enabled,
          empty: result.metadata.empty,
          offerCount: result.metadata.offerCount,
          recommendationCount: recommendations.length,
          result,
          memoryNotes,
        },
        finalPatch: {
          headline: result.summary.headline,
          executiveSummary: result.summary.executiveSummary,
          recommendations,
          warnings: result.warnings.map((w) => w.message),
          confidence,
        },
      }
    },

    concierge(input, ctx, artifacts) {
      const started = Date.now()
      const rcResult = artifacts.responseComposer?.result as
        | Parameters<typeof optionsFromResponseComposer>[0]
        | undefined
      const recommendations = rcResult
        ? optionsFromResponseComposer(rcResult)
        : []
      const memoryHints = Array.isArray(artifacts.memory?.conciergeHints)
        ? (artifacts.memory!.conciergeHints as string[])
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
          budget: input.trip?.budget ?? null,
          currency: input.trip?.currency ?? null,
          destination: input.trip?.destination ?? null,
        },
        { enabled: true },
      )
      ctx.featureFlags.concierge = result.enabled
      const narrative = result.narrative?.primary ?? null
      return {
        ok: result.enabled ? result.ok || result.empty : true,
        durationMs: Date.now() - started,
        confidence: result.metadata.confidence || ctx.confidence,
        artifact: {
          enabled: result.enabled,
          ok: result.ok,
          empty: result.empty,
          narrative,
          hints: memoryHints,
        },
        finalPatch: {
          narrative,
          conciergeHints: [
            ...memoryHints,
            ...(result.responseComposerAttachment.narrativeLines ?? []),
          ],
          confidence: result.metadata.confidence || ctx.confidence,
        },
      }
    },
  }
}

export interface PipelineRunResult {
  stages: OrchestratorStageRecord[]
  artifacts: PipelineArtifacts
  finalResponse: OrchestratorFinalResponse
  totalTokens: number
}

export async function runExecutionPipeline(input: {
  input: OrchestratorInput
  plan: ExecutionPlan
  ctx: ExecutionContext
  adapters?: OrchestratorStageAdapters
}): Promise<PipelineRunResult> {
  const adapters = {
    ...createDefaultStageAdapters(),
    ...input.adapters,
  }
  const stages: OrchestratorStageRecord[] = []
  const artifacts: PipelineArtifacts = {
    memory: null,
    planner: null,
    providers: null,
    tripBuilder: null,
    decision: null,
    responseComposer: null,
    concierge: null,
    flights: (input.input.flights ?? []).slice(),
    hotels: (input.input.hotels ?? []).slice(),
  }

  let finalResponse: OrchestratorFinalResponse = {
    headline: '',
    executiveSummary: '',
    recommendations: [],
    followUpQuestion: null,
    narrative: null,
    conciergeHints: [],
    warnings: [],
    confidence: 0,
    source: 'orchestrator',
  }

  const applyPatch = (patch?: Partial<OrchestratorFinalResponse> | null) => {
    if (!patch) return
    finalResponse = {
      ...finalResponse,
      ...patch,
      recommendations: patch.recommendations ?? finalResponse.recommendations,
      conciergeHints: patch.conciergeHints
        ? [...finalResponse.conciergeHints, ...patch.conciergeHints]
        : finalResponse.conciergeHints,
      warnings: patch.warnings
        ? [...finalResponse.warnings, ...patch.warnings]
        : finalResponse.warnings,
    }
  }

  const runStage = async (
    id: OrchestratorStageId,
    shouldRun: boolean,
    skipReason: string,
    exec: () => Promise<StageAdapterResult> | StageAdapterResult,
  ) => {
    if (!shouldRun) {
      stages.push(stageRecord(id, 'skipped', 0, skipReason, null, null))
      input.ctx.markTiming(id, 0)
      return
    }
    try {
      const result = await exec()
      input.ctx.markTiming(id, result.durationMs)
      if (result.confidence != null) input.ctx.setConfidence(result.confidence)
      if (result.error) input.ctx.addError(result.error)
      applyPatch(result.finalPatch)

      let status: OrchestratorStageStatus = 'completed'
      if (result.skipped) status = 'skipped'
      if (result.cached) status = 'cached'
      if (!result.ok && !result.skipped) status = 'failed'

      stages.push(
        stageRecord(
          id,
          status,
          result.durationMs,
          result.skipped ? skipReason : null,
          result.error ?? null,
          result.confidence ?? null,
        ),
      )
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      input.ctx.addError(message)
      input.ctx.markTiming(id, 0)
      stages.push(stageRecord(id, 'failed', 0, null, message, null))
      return null
    }
  }

  // Early cache reuse
  if (input.plan.reuseCache && input.input.cachedFinalResponse) {
    finalResponse = {
      ...input.input.cachedFinalResponse,
      source: 'cache',
    }
    stages.push(
      stageRecord('final', 'cached', 0, 'Cached final response reused', null, finalResponse.confidence),
    )
    // Still record skipped stages for ordering visibility
    for (const id of input.plan.stageOrder) {
      if (id === 'final') continue
      if (!stages.some((s) => s.id === id)) {
        stages.push(stageRecord(id, 'skipped', 0, 'cache reuse', null, null))
      }
    }
    return {
      stages,
      artifacts,
      finalResponse,
      totalTokens: estimateTokens(input.input),
    }
  }

  // Memory
  {
    const result = await runStage(
      'memory',
      input.plan.useMemory,
      'memory disabled by plan',
      () => adapters.memory!(input.input, input.ctx),
    )
    if (result?.artifact) artifacts.memory = result.artifact
  }

  // Planner (always record plan artifact when not early-only-cache)
  {
    const result = await runStage(
      'planner',
      true,
      'planner',
      () => adapters.planner!(input.input, input.ctx, input.plan),
    )
    if (result?.artifact) artifacts.planner = result.artifact
  }

  // Early exit for follow-up
  if (input.plan.earlyExit && input.plan.askFollowUp) {
    finalResponse = {
      headline: 'Need a bit more information',
      executiveSummary: input.plan.followUpQuestion ?? 'Please provide missing trip details.',
      recommendations: [],
      followUpQuestion: input.plan.followUpQuestion,
      narrative: input.plan.followUpQuestion,
      conciergeHints: finalResponse.conciergeHints,
      warnings: [],
      confidence: 0.2,
      source: 'early_exit',
    }
    for (const id of ['providers', 'trip_builder', 'decision', 'response_composer', 'concierge'] as OrchestratorStageId[]) {
      if (!stages.some((s) => s.id === id)) {
        stages.push(stageRecord(id, 'skipped', 0, 'early exit — follow-up', null, null))
      }
    }
    stages.push(stageRecord('final', 'completed', 0, 'early exit follow-up', null, 0.2))
    return {
      stages,
      artifacts,
      finalResponse,
      totalTokens: estimateTokens(input.input),
    }
  }

  // Providers
  {
    const result = await runStage(
      'providers',
      input.plan.executeSearch && !input.plan.skipProviders,
      input.plan.skipProviders ? 'providers skipped by plan' : 'search not required',
      () => adapters.providers!(input.input, input.ctx),
    )
    if (result?.artifact) {
      artifacts.providers = result.artifact
      if (Array.isArray(result.artifact.flights)) {
        artifacts.flights = result.artifact.flights as Array<Record<string, unknown>>
      }
      if (Array.isArray(result.artifact.hotels)) {
        artifacts.hotels = result.artifact.hotels as Array<Record<string, unknown>>
      }
    }
  }

  // Trip builder
  {
    const result = await runStage(
      'trip_builder',
      input.plan.runTripBuilder,
      'trip builder skipped by plan',
      () => adapters.tripBuilder!(input.input, input.ctx, artifacts),
    )
    if (result?.artifact) artifacts.tripBuilder = result.artifact
  }

  // Decision pass-through
  {
    const result = await runStage(
      'decision',
      input.plan.runDecision,
      'decision skipped by plan',
      () => adapters.decision!(input.input, input.ctx, artifacts),
    )
    if (result?.artifact) artifacts.decision = result.artifact
  }

  // Response composer
  {
    const result = await runStage(
      'response_composer',
      input.plan.runResponseComposer,
      'response composer skipped by plan',
      () => adapters.responseComposer!(input.input, input.ctx, artifacts),
    )
    if (result?.artifact) artifacts.responseComposer = result.artifact
  }

  // Concierge
  {
    const result = await runStage(
      'concierge',
      input.plan.runConcierge,
      'concierge skipped by plan',
      () => adapters.concierge!(input.input, input.ctx, artifacts),
    )
    if (result?.artifact) artifacts.concierge = result.artifact
  }

  finalResponse = {
    ...finalResponse,
    confidence: finalResponse.confidence || input.ctx.confidence,
    source: 'orchestrator',
  }
  stages.push(
    stageRecord(
      'final',
      'completed',
      0,
      'pipeline complete',
      null,
      finalResponse.confidence,
    ),
  )

  return {
    stages,
    artifacts,
    finalResponse,
    totalTokens: estimateTokens(input.input),
  }
}

export class ExecutionPipeline {
  async run(input: Parameters<typeof runExecutionPipeline>[0]) {
    return runExecutionPipeline(input)
  }
}

export function createExecutionPipeline(): ExecutionPipeline {
  return new ExecutionPipeline()
}
