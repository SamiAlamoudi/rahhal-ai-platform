/**
 * Integration Sprint 4 — TripOrchestrator
 *
 * Coordinates WHEN/HOW to use flight & hotel providers.
 * Does not replace providers. Flag OFF → disabled result.
 */

import { createFlightSearchEngine } from '../flightSearchEngine'
import { createHotelSearchEngine } from '../hotelSearchEngine'
import { runConversationAwareFlightSearch } from '../integrationFlightSearch'
import { runConversationAwareHotelSearch } from '../integrationHotelSearch'
import type { AgentMemory, TripPlan, TripRequirements } from '../types'
import type { AgentToolContext } from '../tools/types'
import { buildOrchestratorBudget } from './budget'
import { buildTripConsultantSummary } from './consultantSummary'
import { detectOrchestratorConflicts, missingOrchestratorFields } from './conflicts'
import { isIntegrationTripOrchestratorEnabled } from './feature'
import { buildOrchestratorItinerary } from './itinerary'
import { detectTripScenario, learnOrchestratorPreferences, seedOrchestratorRequirements } from './memory'
import {
  INTEGRATION_TRIP_ORCHESTRATOR_VERSION,
  type OrchestratorExecutionPlan,
  type OrchestratorRecommendation,
  type OrchestratorStep,
  type TripOrchestratorResult,
} from './types'

export type TripOrchestratorDeps = {
  enabled?: boolean
  runFlights?: typeof runConversationAwareFlightSearch
  runHotels?: typeof runConversationAwareHotelSearch
  /** Pre-fetched tool offers (skip live re-search when present). */
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
  now?: () => number
}

function step(
  id: OrchestratorStep['id'],
  label: string,
  status: OrchestratorStep['status'],
  parallelGroup: number | null = null,
  detail: string | null = null,
): OrchestratorStep {
  return { id, label, status, parallelGroup, detail }
}

function buildPlan(skipHotels: boolean): OrchestratorExecutionPlan {
  const steps: OrchestratorStep[] = [
    step('extract', 'Extract trip goals', 'pending'),
    step('budget', 'Allocate budget', 'pending'),
    step('search_flights', 'Search flights', 'pending', 1),
    skipHotels
      ? step('search_hotels', 'Search hotels', 'skipped', null, 'flights_only')
      : step('search_hotels', 'Search hotels', 'pending', 1),
    step('compare', 'Compare combinations', 'pending'),
    step('recommend', 'Recommend best trip', 'pending'),
    step('itinerary', 'Build itinerary', 'pending'),
    step('summarize', 'Consultant summary', 'pending'),
  ]
  return { steps, parallelGroups: skipHotels ? [] : [1] }
}

function mark(
  plan: OrchestratorExecutionPlan,
  id: OrchestratorStep['id'],
  status: OrchestratorStep['status'],
  detail?: string | null,
): void {
  const s = plan.steps.find((x) => x.id === id)
  if (!s) return
  s.status = status
  if (detail != null) s.detail = detail
}

function pickBestOffer(
  offers: Array<Record<string, unknown>>,
): Record<string, unknown> | null {
  if (!offers.length) return null
  return [...offers].sort((a, b) => {
    const sa = typeof a.score === 'number' ? a.score : 0
    const sb = typeof b.score === 'number' ? b.score : 0
    if (sb !== sa) return sb - sa
    const pa = typeof a.price === 'number' ? a.price : typeof a.nightly === 'number' ? a.nightly : Infinity
    const pb = typeof b.price === 'number' ? b.price : typeof b.nightly === 'number' ? b.nightly : Infinity
    return pa - pb
  })[0] ?? null
}

function nightsFrom(req: TripRequirements): number {
  if (req.startDate && req.endDate) {
    const a = Date.parse(`${req.startDate}T00:00:00Z`)
    const b = Date.parse(`${req.endDate}T00:00:00Z`)
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
      return Math.max(1, Math.round((b - a) / 86_400_000))
    }
  }
  return Math.max(1, (req.durationDays ?? 4) - 1)
}

function toToolContext(
  memory: AgentMemory,
  requirements: TripRequirements,
  signal?: AbortSignal,
): AgentToolContext {
  return {
    requirements,
    tripPlan: memory.tripPlan,
    itinerary: memory.itinerary,
    locale: memory.locale,
    signal,
    input: {},
  }
}

function buildRecommendation(
  flight: Record<string, unknown> | null,
  hotel: Record<string, unknown> | null,
  currency: string,
): OrchestratorRecommendation {
  const whyFlightAr = flight
    ? String(flight.whyAr ?? flight.why ?? 'خيار متوازن للطيران')
    : 'لا رحلة مختارة بعد'
  const whyFlightEn = flight
    ? String(flight.why ?? flight.whyEn ?? 'Balanced flight option')
    : 'No flight selected yet'
  const whyHotelAr = hotel
    ? String(hotel.whyAr ?? hotel.why ?? 'خيار متوازن للإقامة')
    : 'لا فندق مختار بعد'
  const whyHotelEn = hotel
    ? String(hotel.why ?? hotel.whyEn ?? 'Balanced hotel option')
    : 'No hotel selected yet'

  const flightPrice = typeof flight?.price === 'number' ? flight.price : null
  const hotelTotal = typeof hotel?.total === 'number'
    ? hotel.total
    : typeof hotel?.nightly === 'number' && typeof hotel?.nights === 'number'
      ? hotel.nightly * hotel.nights
      : typeof hotel?.nightly === 'number'
        ? hotel.nightly
        : null
  const estimatedTotal =
    flightPrice != null || hotelTotal != null
      ? (flightPrice ?? 0) + (hotelTotal ?? 0)
      : null

  return {
    flight,
    hotel,
    whyFlightAr,
    whyFlightEn,
    whyHotelAr,
    whyHotelEn,
    whyComboAr: flight && hotel
      ? 'الطيران والإقامة متوافقان زمنياً وضمن أولوياتك، مع توازن بين الراحة والسعر.'
      : 'نحتاج طيران وفندق لإكمال التوصية.',
    whyComboEn: flight && hotel
      ? 'Flight and stay align on timing and your priorities — a balance of comfort and price.'
      : 'We need both a flight and a hotel to complete the recommendation.',
    tradeOffsAr: flight && hotel
      ? 'قد يوجد خيار أرخص بتوقف إضافي، أو فندق أبعد بسعر أقل.'
      : 'أكمل البيانات لنوضح المقايضات.',
    tradeOffsEn: flight && hotel
      ? 'A cheaper flight may add a stop; a cheaper hotel may be farther from the center.'
      : 'Share more details so we can clarify trade-offs.',
    estimatedTotal,
    currency,
  }
}

function disabledResult(): TripOrchestratorResult {
  return {
    version: INTEGRATION_TRIP_ORCHESTRATOR_VERSION,
    enabled: false,
    ok: false,
    incomplete: true,
    missingFields: [],
    executionPlan: { steps: [], parallelGroups: [] },
    budget: null,
    conflicts: [],
    recommendation: null,
    itinerary: null,
    consultantSummaryAr: '',
    consultantSummaryEn: '',
    usedLiveFlights: false,
    usedLiveHotels: false,
    parallelMs: 0,
    latencyMs: 0,
    scenario: null,
    logs: ['integration_trip_orchestrator_disabled'],
  }
}

export async function runTripOrchestrator(input: {
  memory: AgentMemory
  tripPlan?: TripPlan | null
  userId?: string | null
  signal?: AbortSignal
  deps?: TripOrchestratorDeps
}): Promise<TripOrchestratorResult> {
  const deps = input.deps ?? {}
  if (!isIntegrationTripOrchestratorEnabled({ enabled: deps.enabled })) {
    return disabledResult()
  }

  const now = deps.now ?? (() => Date.now())
  const started = now()
  const logs: string[] = []
  let requirements = seedOrchestratorRequirements(
    { ...input.memory.requirements },
    input.userId,
  )
  const skipHotels = requirements.packageScope === 'flights_only'
  const plan = buildPlan(skipHotels)
  const scenario = detectTripScenario(requirements)

  mark(plan, 'extract', 'done', scenario)
  logs.push(`scenario=${scenario}`)

  const missing = missingOrchestratorFields(requirements)
  if (missing.includes('destination')) {
    mark(plan, 'budget', 'skipped')
    mark(plan, 'search_flights', 'skipped')
    mark(plan, 'search_hotels', 'skipped')
    mark(plan, 'compare', 'skipped')
    mark(plan, 'recommend', 'skipped')
    mark(plan, 'itinerary', 'skipped')
    const summary = buildTripConsultantSummary({
      destination: '',
      recommendation: null,
      budget: null,
      itinerary: null,
      conflicts: detectOrchestratorConflicts({
        requirements,
        budget: null,
        flight: null,
        hotel: null,
        flightsEmpty: false,
        hotelsEmpty: false,
        skipHotels,
      }),
      incomplete: true,
      missingFields: missing,
    })
    mark(plan, 'summarize', 'done')
    return {
      version: INTEGRATION_TRIP_ORCHESTRATOR_VERSION,
      enabled: true,
      ok: false,
      incomplete: true,
      missingFields: missing,
      executionPlan: plan,
      budget: null,
      conflicts: detectOrchestratorConflicts({
        requirements,
        budget: null,
        flight: null,
        hotel: null,
        flightsEmpty: false,
        hotelsEmpty: false,
        skipHotels,
      }),
      recommendation: null,
      itinerary: null,
      consultantSummaryAr: summary.ar,
      consultantSummaryEn: summary.en,
      usedLiveFlights: false,
      usedLiveHotels: false,
      parallelMs: 0,
      latencyMs: now() - started,
      scenario,
      logs,
    }
  }

  const nights = nightsFrom(requirements)
  const budget = buildOrchestratorBudget(requirements, nights)
  mark(plan, 'budget', budget ? 'done' : 'skipped', budget ? `${budget.total} ${budget.currency}` : 'no_budget')

  const ctx = toToolContext(input.memory, requirements, input.signal)
  const runFlights = deps.runFlights ?? runConversationAwareFlightSearch
  const runHotels = deps.runHotels ?? runConversationAwareHotelSearch

  let flightOffers = deps.flightOffers ? [...deps.flightOffers] : []
  let hotelStays = deps.hotelStays ? [...deps.hotelStays] : []
  let usedLiveFlights = false
  let usedLiveHotels = false
  let parallelMs = 0

  const needSearch = flightOffers.length === 0 || (!skipHotels && hotelStays.length === 0)
  if (needSearch) {
    mark(plan, 'search_flights', 'running')
    if (!skipHotels) mark(plan, 'search_hotels', 'running')
    const parallelStarted = now()
    const flightEngine = createFlightSearchEngine({ forceMock: true })
    const hotelEngine = createHotelSearchEngine({ forceMock: true })

    const flightPromise = flightOffers.length
      ? Promise.resolve({ data: { offers: flightOffers, usedLive: false }, empty: false })
      : runFlights(flightEngine, ctx)

    const hotelPromise = skipHotels
      ? Promise.resolve({ data: { stays: [], usedLive: false }, empty: false })
      : hotelStays.length
        ? Promise.resolve({ data: { stays: hotelStays, usedLive: false }, empty: false })
        : runHotels(hotelEngine, ctx)

    const [flightRes, hotelRes] = await Promise.all([flightPromise, hotelPromise])
    parallelMs = now() - parallelStarted

    flightOffers = Array.isArray(flightRes.data.offers)
      ? (flightRes.data.offers as Array<Record<string, unknown>>)
      : flightOffers
    hotelStays = Array.isArray(hotelRes.data.stays)
      ? (hotelRes.data.stays as Array<Record<string, unknown>>)
      : hotelStays
    usedLiveFlights = flightRes.data.usedLive === true
    usedLiveHotels = hotelRes.data.usedLive === true

    mark(plan, 'search_flights', flightRes.empty ? 'failed' : 'done', `${flightOffers.length} offers`)
    if (!skipHotels) {
      mark(plan, 'search_hotels', hotelRes.empty ? 'failed' : 'done', `${hotelStays.length} stays`)
    }
    logs.push(`parallel_ms=${parallelMs}`)
  } else {
    mark(plan, 'search_flights', 'done', 'from_tools')
    if (!skipHotels) mark(plan, 'search_hotels', 'done', 'from_tools')
  }

  mark(plan, 'compare', 'running')
  const flight = pickBestOffer(flightOffers)
  const hotel = skipHotels ? null : pickBestOffer(hotelStays)
  mark(plan, 'compare', 'done')

  const conflicts = detectOrchestratorConflicts({
    requirements,
    budget,
    flight,
    hotel,
    flightsEmpty: flightOffers.length === 0,
    hotelsEmpty: !skipHotels && hotelStays.length === 0,
    skipHotels,
  })

  mark(plan, 'recommend', 'running')
  const currency = budget?.currency
    ?? String(flight?.currency ?? hotel?.currency ?? requirements.budgetCurrency ?? 'SAR')
  const recommendation = buildRecommendation(flight, hotel, currency)
  mark(plan, 'recommend', recommendation.flight || recommendation.hotel ? 'done' : 'failed')

  mark(plan, 'itinerary', 'running')
  const itinerary = buildOrchestratorItinerary({ requirements, flight, hotel })
  mark(plan, 'itinerary', 'done', `${itinerary.days.length} days`)

  const incomplete = missing.length > 0 && !recommendation.flight
  const summary = buildTripConsultantSummary({
    destination: requirements.destination ?? requirements.destinations[0] ?? '',
    recommendation,
    budget,
    itinerary,
    conflicts,
    incomplete: Boolean(incomplete && !recommendation.flight),
    missingFields: missing,
  })
  mark(plan, 'summarize', 'done')

  learnOrchestratorPreferences(requirements, input.userId)

  return {
    version: INTEGRATION_TRIP_ORCHESTRATOR_VERSION,
    enabled: true,
    ok: Boolean(recommendation.flight || recommendation.hotel) && !conflicts.some((c) => c.severity === 'blocker'),
    incomplete: missing.length > 0 && !recommendation.flight,
    missingFields: missing,
    executionPlan: plan,
    budget,
    conflicts,
    recommendation,
    itinerary,
    consultantSummaryAr: summary.ar,
    consultantSummaryEn: summary.en,
    usedLiveFlights,
    usedLiveHotels,
    parallelMs,
    latencyMs: now() - started,
    scenario,
    logs,
  }
}
