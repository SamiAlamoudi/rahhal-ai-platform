/**
 * Sprint 31 — UnifiedTravelPlanner
 * End-to-end coordinator: orchestrator + memory + flight/hotel foundations + aggregation scoring.
 * Additive only — does not replace TripPlanningEngine / AITripOrchestrator / SearchAggregation.
 */

import type { TravelIntent } from '../types'
import type { SearchRecommendation } from '../search/types'
import { isBrainContextMemoryEnabled } from '../memory/feature'
import { isHotelProviderFoundationEnabled } from '../../hotels'
import {
  contextFromMemoryLike,
  emptyUnifiedContext,
  extractContextFromUserText,
  mergeUnifiedContext,
} from './context'
import { estimateTripCost } from './cost'
import { isUnifiedTravelPlannerEnabled } from './feature'
import { buildUnifiedFollowUps, detectMissingUnifiedFields } from './missingInfo'
import { pairFlightsAndHotels, scoreAndRankPlans } from './optimize'
import { searchUnifiedFlights, searchUnifiedHotels } from './providers'
import type {
  UnifiedTravelPlanResult,
  UnifiedTravelPlannerOptions,
  UnifiedTravelPlannerRunInput,
  UnifiedTravelPlannerContext,
  UnifiedFlightLeg,
  UnifiedHotelStay,
} from './types'

export type UnifiedTravelPlannerHandle = {
  planTrip(input: UnifiedTravelPlannerRunInput): Promise<UnifiedTravelPlanResult>
  options(): {
    maxPlans: number
    hotelFoundation: boolean
    contextMemory: boolean
  }
}

const DEFAULT_MAX_PLANS = 5

export function UnifiedTravelPlanner(
  options: UnifiedTravelPlannerOptions = {},
): UnifiedTravelPlannerHandle {
  const maxPlans = options.maxPlans ?? DEFAULT_MAX_PLANS

  return {
    options() {
      return {
        maxPlans,
        hotelFoundation: resolveHotelFoundation(options),
        contextMemory: resolveContextMemory(options),
      }
    },

    async planTrip(input: UnifiedTravelPlannerRunInput): Promise<UnifiedTravelPlanResult> {
      const started = Date.now()
      const locale = input.locale === 'en' ? 'en' : 'ar'
      const enabled =
        typeof options.enabled === 'boolean'
          ? options.enabled
          : isUnifiedTravelPlannerEnabled()

      if (!enabled) {
        return disabledResult(input.conversationId, started)
      }

      let orchestratorSnapshot: unknown | null = null
      let memorySnapshot: unknown | null = null
      let intent: TravelIntent = 'AskRecommendation'
      let recommendation: SearchRecommendation | null = null
      let fromOrchestrator = false

      // 1) Conversation context from user text + overrides
      let ctx = mergeUnifiedContext(
        emptyUnifiedContext(locale),
        extractContextFromUserText(input.userText, locale),
        input.contextOverrides,
      )

      // 2) Optional AITripOrchestrator (planning + execution + search + memory)
      if (!options.skipOrchestrator) {
        try {
          const runOrchestrator = options.runOrchestrator ?? defaultOrchestratorRunner
          const orch = await runOrchestrator({
            conversationId: input.conversationId,
            userText: input.userText,
            locale,
            userId: input.userId,
            signal: input.signal,
          })
          orchestratorSnapshot = orch
          fromOrchestrator = true
          const parsed = parseOrchestratorSnapshot(orch)
          intent = parsed.intent
          recommendation = parsed.recommendation
          memorySnapshot = parsed.memory
          ctx = mergeUnifiedContext(ctx, parsed.context)
        } catch {
          // Planner remains usable with local extraction + provider search.
        }
      } else if (resolveContextMemory(options)) {
        // Memory-only path when orchestrator skipped but memory requested.
        memorySnapshot = null
      }

      if (memorySnapshot) {
        ctx = mergeUnifiedContext(ctx, contextFromMemoryLike(memorySnapshot))
      }

      const missingFields = detectMissingUnifiedFields(ctx)
      const followUps = buildUnifiedFollowUps(missingFields, locale)

      // Core slots missing → clarify before searching (minimal questions).
      if (missingFields.includes('destination')) {
        return {
          conversationId: input.conversationId,
          stage: 'clarifying',
          intent,
          headline:
            locale === 'ar'
              ? 'نحتاج وجهة لإكمال خطة السفر'
              : 'We need a destination to complete your travel plan',
          plans: [],
          topPlan: null,
          alternatives: [],
          followUps,
          missingFields,
          recommendation,
          confidenceScore: 0,
          reasoning: [
            locale === 'ar'
              ? 'سؤال متابعة واحد فقط قبل البحث'
              : 'One follow-up before searching',
          ],
          costSummary: null,
          providers: {
            flightsUsed: 0,
            hotelsUsed: 0,
            hotelProviderId: null,
            flightProviderIds: [],
            fromHotelFoundation: false,
            fromOrchestrator,
          },
          durationMs: Date.now() - started,
          error: null,
          orchestrator: orchestratorSnapshot,
          memory: memorySnapshot,
        }
      }

      // 3) Multi-provider search (flights + hotels)
      const flights = options.searchFlights
        ? await options.searchFlights(ctx)
        : await searchUnifiedFlights(ctx)

      let hotels: UnifiedHotelStay[] = []
      let hotelProviderId: string | null = null
      let fromHotelFoundation = false

      if (options.searchHotels) {
        hotels = await options.searchHotels(ctx)
      } else {
        // Default: Hotel Provider Foundation sandbox chain (Sprint 30).
        const hotelResult = await searchUnifiedHotels(ctx)
        hotels = hotelResult.stays
        hotelProviderId = hotelResult.providerId
        fromHotelFoundation = resolveHotelFoundation(options)
      }

      // Soft preference boost already applied inside searchUnifiedHotels.
      const preferredFlight = preferFlights(flights, ctx)
      const preferredHotels = preferHotels(hotels, ctx)

      // 4) Match flights ↔ hotels, optimize, rank
      const candidates = pairFlightsAndHotels(preferredFlight, preferredHotels)
      const plans = scoreAndRankPlans({
        candidates,
        ctx,
        maxPlans,
      })

      const topPlan = plans[0] ?? null
      const alternatives = plans.slice(1)
      const confidenceScore = topPlan?.confidence
        ?? recommendation?.confidenceScore
        ?? 0

      const costSummary = topPlan?.cost
        ?? estimateTripCost({ flight: preferredFlight[0] ?? null, hotel: preferredHotels[0] ?? null, ctx })

      const reasoning = [
        ...(topPlan?.reasons ?? []),
        ...(recommendation?.reasoning?.slice(0, 2) ?? []),
        `Ranked ${plans.length} itinerary option(s)`,
        fromHotelFoundation ? 'Hotels via Sprint 30 provider foundation' : 'Hotels via injected search',
      ]

      return {
        conversationId: input.conversationId,
        stage: plans.length ? 'complete' : 'failed',
        intent,
        headline: buildHeadline(topPlan, locale),
        plans,
        topPlan,
        alternatives,
        followUps: followUps.filter((f) => !f.required || missingFields.includes(f.field)),
        missingFields,
        recommendation,
        confidenceScore,
        reasoning,
        costSummary,
        providers: {
          flightsUsed: preferredFlight.length,
          hotelsUsed: preferredHotels.length,
          hotelProviderId,
          flightProviderIds: [...new Set(preferredFlight.map((f) => f.providerId))],
          fromHotelFoundation,
          fromOrchestrator,
        },
        durationMs: Date.now() - started,
        error: plans.length ? null : 'No travel plan options could be produced',
        orchestrator: orchestratorSnapshot,
        memory: memorySnapshot,
      }
    },
  }
}

let sharedPlanner: UnifiedTravelPlannerHandle | null = null

export function getOrCreateUnifiedTravelPlanner(
  _key?: string,
  options?: UnifiedTravelPlannerOptions,
): UnifiedTravelPlannerHandle {
  if (!sharedPlanner) sharedPlanner = UnifiedTravelPlanner(options)
  return sharedPlanner
}

export function resetUnifiedTravelPlanner(): void {
  sharedPlanner = null
}

async function defaultOrchestratorRunner(input: {
  conversationId: string
  userText: string
  locale?: 'ar' | 'en'
  userId?: string
  signal?: AbortSignal
}): Promise<unknown> {
  const { getOrCreateAITripOrchestrator } = await import('../orchestrator/aiTripOrchestrator')
  const orchestrator = getOrCreateAITripOrchestrator(input.conversationId, {
    contextMemory: isBrainContextMemoryEnabled(),
  })
  return orchestrator.runTurn({
    conversationId: input.conversationId,
    userText: input.userText,
    locale: input.locale,
    userId: input.userId,
    signal: input.signal,
  })
}

function parseOrchestratorSnapshot(orch: unknown): {
  intent: TravelIntent
  recommendation: SearchRecommendation | null
  memory: unknown | null
  context: Partial<UnifiedTravelPlannerContext>
} {
  if (!orch || typeof orch !== 'object') {
    return {
      intent: 'AskRecommendation',
      recommendation: null,
      memory: null,
      context: {},
    }
  }
  const o = orch as Record<string, unknown>
  const intent = (o.intent as TravelIntent) || 'AskRecommendation'
  const memory = o.memory ?? null
  const brain = o.brain as Record<string, unknown> | null | undefined
  const search = brain?.search as {
    recommendation?: SearchRecommendation
  } | null | undefined
  const planning = brain?.planning as {
    tripPlan?: Record<string, unknown>
  } | null | undefined
  const trip = planning?.tripPlan

  const context: Partial<UnifiedTravelPlannerContext> = {
    ...contextFromMemoryLike(memory),
  }
  if (trip) {
    context.destination = str(trip.destination) ?? context.destination
    context.origin = str(trip.departureCity) ?? context.origin
    const dates = trip.travelDates as Record<string, unknown> | undefined
    context.startDate = str(dates?.startDate) ?? context.startDate
    context.endDate = str(dates?.endDate) ?? context.endDate
    context.adults = num(trip.adults) ?? context.adults
    context.children = num(trip.children) ?? context.children
    context.preferredAirlines = arr(trip.airlinePreferences).length
      ? arr(trip.airlinePreferences)
      : context.preferredAirlines
    context.preferredHotels = arr(trip.hotelPreferences).length
      ? arr(trip.hotelPreferences)
      : context.preferredHotels
    const budget = trip.budget as Record<string, unknown> | undefined
    context.budgetAmount = num(budget?.amount) ?? context.budgetAmount
    context.currency = str(budget?.currency) ?? context.currency
    context.cabinClass = str(trip.cabinClass) ?? context.cabinClass
    context.activities = arr(trip.activities).length ? arr(trip.activities) : context.activities
  }

  return {
    intent,
    recommendation: search?.recommendation ?? null,
    memory,
    context,
  }
}

function preferFlights(
  flights: UnifiedFlightLeg[],
  ctx: UnifiedTravelPlannerContext,
): UnifiedFlightLeg[] {
  if (!ctx.preferredAirlines.length) return flights
  const prefs = ctx.preferredAirlines.map((p) => p.toLowerCase())
  return [...flights].sort((a, b) => {
    const aHit = prefs.some((p) => a.airline.toLowerCase().includes(p)) ? 1 : 0
    const bHit = prefs.some((p) => b.airline.toLowerCase().includes(p)) ? 1 : 0
    return bHit - aHit
  })
}

function preferHotels(
  hotels: UnifiedHotelStay[],
  ctx: UnifiedTravelPlannerContext,
): UnifiedHotelStay[] {
  if (!ctx.preferredHotels.length) return hotels
  const prefs = ctx.preferredHotels.map((p) => p.toLowerCase())
  return [...hotels].sort((a, b) => {
    const aHit = prefs.some((p) => a.name.toLowerCase().includes(p)) ? 1 : 0
    const bHit = prefs.some((p) => b.name.toLowerCase().includes(p)) ? 1 : 0
    return bHit - aHit
  })
}

function buildHeadline(
  top: UnifiedTravelPlanResult['topPlan'],
  locale: 'ar' | 'en',
): string {
  if (!top) {
    return locale === 'ar' ? 'تعذر بناء خطة سفر' : 'Could not build a travel plan'
  }
  if (locale === 'ar') {
    return `أفضل خطة: ${top.title} — ثقة ${(top.confidence * 100).toFixed(0)}%`
  }
  return `Top plan: ${top.title} — ${(top.confidence * 100).toFixed(0)}% confidence`
}

function disabledResult(
  conversationId: string,
  started: number,
): UnifiedTravelPlanResult {
  return {
    conversationId,
    stage: 'failed',
    intent: 'GeneralConversation',
    headline: 'Unified travel planner is disabled',
    plans: [],
    topPlan: null,
    alternatives: [],
    followUps: [],
    missingFields: [],
    recommendation: null,
    confidenceScore: 0,
    reasoning: ['brain.unified_travel_planner is OFF'],
    costSummary: null,
    providers: {
      flightsUsed: 0,
      hotelsUsed: 0,
      hotelProviderId: null,
      flightProviderIds: [],
      fromHotelFoundation: false,
      fromOrchestrator: false,
    },
    durationMs: Date.now() - started,
    error: 'unified_travel_planner_disabled',
    orchestrator: null,
    memory: null,
  }
}

function resolveHotelFoundation(options: UnifiedTravelPlannerOptions): boolean {
  if (typeof options.hotelFoundation === 'boolean') return options.hotelFoundation
  try {
    return isHotelProviderFoundationEnabled() || isUnifiedTravelPlannerEnabled()
  } catch {
    return true
  }
}

function resolveContextMemory(options: UnifiedTravelPlannerOptions): boolean {
  if (typeof options.contextMemory === 'boolean') return options.contextMemory
  return isBrainContextMemoryEnabled()
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function arr(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}
