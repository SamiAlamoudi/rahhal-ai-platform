/**
 * Sprint 20–24 — Brain ↔ Agent / Concierge / Voice / Travel / Planning / Execution / Search.
 * Flag-gated; default OFF. No LLM providers or external APIs.
 */

import { getFeatureRegistry } from '../ai'
import type { AgentLocale, AgentProviderMeta, TripRequirements } from '../agent/types'
import type {
  BrainLocale,
  BrainResponsePlan,
  BrainTurnResult,
  ConversationMemory,
  TravelDomainBridge,
  TravelIntent,
  TravelPlan,
} from './types'
import { ConversationOrchestrator, type ConversationOrchestratorHandle } from './conversationOrchestrator'
import { ConversationMemoryApi } from './conversationMemory'
import {
  TripPlanningEngine,
  resetTripPlanningSessions,
  type TripPlanningEngineHandle,
  type TripPlanningTurnResult,
} from './tripPlanning'
import {
  TravelExecutionEngine,
  resetTravelExecutionSessions,
  type TravelExecutionEngineHandle,
  type TravelExecutionTurnResult,
} from './execution'
import { createExecutionProviders } from './execution/providers'
import {
  aggregateSearch,
  type SearchAggregationTurnResult,
} from './search'

const orchestrators = new Map<string, ConversationOrchestratorHandle>()
const planningEngines = new Map<string, TripPlanningEngineHandle>()
const executionEngines = new Map<string, TravelExecutionEngineHandle>()

export type BrainMetaSnapshot = {
  intent: TravelIntent
  confidence: number
  action: BrainResponsePlan['action']
  summary: string
  assistantGoal: string
  missingFields: BrainResponsePlan['missingFields']
  searchRequests: BrainResponsePlan['searchRequests']
  bookingRequests: BrainResponsePlan['bookingRequests']
  recommendations: BrainResponsePlan['recommendations']
  uiHints: BrainResponsePlan['uiHints']
  /** Sprint 21 */
  travelPlan?: TravelPlan | null
  domain?: TravelDomainBridge | null
  contextualReply?: string | null
  /** Sprint 22 */
  planning?: TripPlanningTurnResult | null
  clarificationQuestion?: string | null
  travelSummary?: TripPlanningTurnResult['travelSummary'] | null
  engineTripPlan?: TripPlanningTurnResult['tripPlan'] | null
  /** Sprint 23 */
  execution?: TravelExecutionTurnResult | null
  executionSummary?: TravelExecutionTurnResult['summary'] | null
  executionProgress?: TravelExecutionTurnResult['progress'] | null
  /** Sprint 24 */
  search?: SearchAggregationTurnResult | null
  searchRecommendation?: SearchAggregationTurnResult['recommendation'] | null
  searchCollection?: SearchAggregationTurnResult['collection'] | null
}

export function resetBrainIntegrationSessions(): void {
  orchestrators.clear()
  planningEngines.clear()
  executionEngines.clear()
  resetTripPlanningSessions()
  resetTravelExecutionSessions()
}

export function isBrainConciergeIntegrationEnabled(options?: {
  brainEnabled?: boolean
}): boolean {
  if (typeof options?.brainEnabled === 'boolean') return options.brainEnabled
  const registry = getFeatureRegistry()
  return registry.isEnabled('brain.enabled') && registry.isEnabled('brain.concierge')
}

export function isBrainAgentHandoffEnabled(options?: {
  brainHandoffEnabled?: boolean
}): boolean {
  if (typeof options?.brainHandoffEnabled === 'boolean') return options.brainHandoffEnabled
  const registry = getFeatureRegistry()
  return (
    registry.isEnabled('brain.enabled') &&
    registry.isEnabled('brain.concierge') &&
    registry.isEnabled('brain.agent_handoff')
  )
}

export function isBrainVoiceIntegrationEnabled(options?: {
  brainVoiceEnabled?: boolean
}): boolean {
  if (typeof options?.brainVoiceEnabled === 'boolean') return options.brainVoiceEnabled
  const registry = getFeatureRegistry()
  return (
    registry.isEnabled('brain.enabled') &&
    registry.isEnabled('brain.concierge') &&
    registry.isEnabled('brain.voice')
  )
}

/** Sprint 21 — Real Travel Conversation Engine. */
export function isBrainTravelEngineEnabled(options?: {
  brainTravelEngineEnabled?: boolean
}): boolean {
  if (typeof options?.brainTravelEngineEnabled === 'boolean') {
    return options.brainTravelEngineEnabled
  }
  const registry = getFeatureRegistry()
  return (
    registry.isEnabled('brain.enabled') &&
    registry.isEnabled('brain.concierge') &&
    registry.isEnabled('brain.travel_engine')
  )
}

/** Sprint 22 — Multi-Step Trip Planning Engine. */
export function isBrainTripPlanningEnabled(options?: {
  brainTripPlanningEnabled?: boolean
}): boolean {
  if (typeof options?.brainTripPlanningEnabled === 'boolean') {
    return options.brainTripPlanningEnabled
  }
  const registry = getFeatureRegistry()
  return (
    registry.isEnabled('brain.enabled') &&
    registry.isEnabled('brain.concierge') &&
    registry.isEnabled('brain.travel_engine') &&
    registry.isEnabled('brain.trip_planning')
  )
}

/** Sprint 23 — Travel Execution Engine. */
export function isBrainExecutionEnabled(options?: {
  brainExecutionEnabled?: boolean
}): boolean {
  if (typeof options?.brainExecutionEnabled === 'boolean') {
    return options.brainExecutionEnabled
  }
  const registry = getFeatureRegistry()
  return (
    registry.isEnabled('brain.enabled') &&
    registry.isEnabled('brain.concierge') &&
    registry.isEnabled('brain.travel_engine') &&
    registry.isEnabled('brain.trip_planning') &&
    registry.isEnabled('brain.execution')
  )
}

/** Sprint 24 — Search Aggregation Engine. */
export function isBrainSearchEnabled(options?: {
  brainSearchEnabled?: boolean
}): boolean {
  if (typeof options?.brainSearchEnabled === 'boolean') {
    return options.brainSearchEnabled
  }
  const registry = getFeatureRegistry()
  return (
    registry.isEnabled('brain.enabled') &&
    registry.isEnabled('brain.concierge') &&
    registry.isEnabled('brain.travel_engine') &&
    registry.isEnabled('brain.trip_planning') &&
    registry.isEnabled('brain.execution') &&
    registry.isEnabled('brain.search')
  )
}

/** Sprint 26 — Real provider adapters for execution (mocks remain default). */
export function isBrainRealProvidersEnabled(options?: {
  brainRealProvidersEnabled?: boolean
}): boolean {
  if (typeof options?.brainRealProvidersEnabled === 'boolean') {
    return options.brainRealProvidersEnabled
  }
  const registry = getFeatureRegistry()
  return (
    registry.isEnabled('brain.enabled') &&
    registry.isEnabled('brain.concierge') &&
    registry.isEnabled('brain.travel_engine') &&
    registry.isEnabled('brain.trip_planning') &&
    registry.isEnabled('brain.execution') &&
    registry.isEnabled('brain.real_providers')
  )
}

function toBrainLocale(locale: AgentLocale | BrainLocale | undefined): BrainLocale {
  return locale === 'en' ? 'en' : 'ar'
}

function orchestratorKey(conversationId: string, travelEngine: boolean): string {
  return travelEngine ? `${conversationId}::travel_engine` : conversationId
}

export function getOrCreateBrainOrchestrator(
  conversationId: string,
  locale: BrainLocale = 'ar',
  options?: { travelEngine?: boolean },
): ConversationOrchestratorHandle {
  const travelEngine = options?.travelEngine === true
  const key = orchestratorKey(conversationId, travelEngine)
  const existing = orchestrators.get(key)
  if (existing) return existing
  const created = ConversationOrchestrator({ conversationId, locale, travelEngine })
  orchestrators.set(key, created)
  return created
}

export function getOrCreateTripPlanningEngine(
  conversationId: string,
  locale: BrainLocale = 'ar',
): TripPlanningEngineHandle {
  const existing = planningEngines.get(conversationId)
  if (existing) return existing
  const created = TripPlanningEngine({ conversationId, locale })
  planningEngines.set(conversationId, created)
  return created
}

export function getOrCreateTravelExecutionEngine(
  conversationId: string,
): TravelExecutionEngineHandle {
  const existing = executionEngines.get(conversationId)
  if (existing) return existing

  const realOn = isBrainRealProvidersEnabled()
  const { providers } = createExecutionProviders({
    brainRealProvidersEnabled: realOn,
    mode: realOn ? 'mixed' : 'mock',
  })

  const created = TravelExecutionEngine({ conversationId, providers })
  executionEngines.set(conversationId, created)
  return created
}

/** Map agent TripRequirements into brain memory slots (seed / sync). */
export function seedBrainMemoryFromRequirements(
  memory: ConversationMemory,
  requirements: TripRequirements,
  locale: BrainLocale,
): ConversationMemory {
  return ConversationMemoryApi.applyPatch(memory, {
    destination: requirements.destination,
    destinations: requirements.destinations,
    origin: requirements.origin,
    budget: {
      amount: requirements.budgetAmount,
      currency: requirements.budgetCurrency,
      flexible: requirements.budgetFlexible === true,
    },
    travelDates: {
      startDate: requirements.startDate,
      endDate: requirements.endDate,
      durationDays: requirements.durationDays,
      flexible: false,
    },
    travelers: {
      count: requirements.travelers,
      adults: requirements.travelers,
      children: 0,
      infants: 0,
    },
    hotelPreferences: requirements.hotelPreference
      ? [requirements.hotelPreference]
      : [],
    hotelRequirement:
      requirements.packageScope === 'flights_only'
        ? false
        : requirements.hotelPreference
          ? true
          : null,
    activities: requirements.interests ?? [],
    conversationLanguage: locale,
    currency: requirements.budgetCurrency,
  })
}

/** Map brain extraction memory into a TripRequirements patch (handoff). */
export function brainMemoryToRequirementsPatch(
  memory: ConversationMemory,
): Partial<TripRequirements> {
  const patch: Partial<TripRequirements> = {}
  if (memory.destination) {
    patch.destination = memory.destination
    patch.destinations = memory.destinations.length
      ? memory.destinations
      : [memory.destination]
  }
  if (memory.origin) patch.origin = memory.origin
  if (memory.budget.amount != null || memory.budget.flexible) {
    patch.budgetAmount = memory.budget.amount
    patch.budgetCurrency = memory.budget.currency
    patch.budgetFlexible = memory.budget.flexible
  }
  if (memory.travelDates.durationDays != null) {
    patch.durationDays = memory.travelDates.durationDays
  }
  if (memory.travelDates.startDate) patch.startDate = memory.travelDates.startDate
  if (memory.travelDates.endDate) patch.endDate = memory.travelDates.endDate
  if (memory.travelers.count != null) patch.travelers = memory.travelers.count
  if (memory.hotelPreferences[0]) patch.hotelPreference = memory.hotelPreferences[0]
  if (memory.hotelRequirement === false) patch.packageScope = 'flights_only'
  if (memory.hotelRequirement === true && !memory.hotelPreferences[0]) {
    patch.packageScope = 'full_package'
  }
  if (memory.activities.length) patch.interests = memory.activities
  if (memory.currency || memory.budget.currency) {
    patch.budgetCurrency = memory.currency ?? memory.budget.currency
  }
  return patch
}

export function toMetaBrain(result: BrainTurnResult): BrainMetaSnapshot {
  const planning = (result.planning ?? null) as TripPlanningTurnResult | null
  const execution = (result.execution ?? null) as TravelExecutionTurnResult | null
  const search = (result.search ?? null) as SearchAggregationTurnResult | null
  return {
    intent: result.plan.intent,
    confidence: result.plan.confidence,
    action: result.plan.action,
    summary: result.plan.summary,
    assistantGoal: result.plan.assistantGoal,
    missingFields: result.plan.missingFields,
    searchRequests: result.plan.searchRequests,
    bookingRequests: result.plan.bookingRequests,
    recommendations: result.plan.recommendations,
    uiHints: result.plan.uiHints,
    travelPlan: result.plan.travelPlan,
    domain: result.domain,
    contextualReply: result.plan.uiHints.contextualReply,
    planning,
    clarificationQuestion: planning?.clarification.question ?? null,
    travelSummary: planning?.travelSummary ?? null,
    engineTripPlan: planning?.tripPlan ?? null,
    execution,
    executionSummary: execution?.summary ?? null,
    executionProgress: execution?.progress ?? null,
    search,
    searchRecommendation: search?.recommendation ?? null,
    searchCollection: search?.collection ?? null,
  }
}

export type RunIntegratedBrainTurnInput = {
  conversationId: string
  userText: string
  locale?: AgentLocale | BrainLocale
  /** Optional agent requirements used to seed brain memory before the turn. */
  requirements?: TripRequirements | null
  /** Sprint 21 — force travel engine on/off (otherwise FeatureRegistry). */
  travelEngine?: boolean
  /** Sprint 22 — force trip planning on/off (otherwise FeatureRegistry). */
  tripPlanning?: boolean
  /** Sprint 23 — force execution on/off (otherwise FeatureRegistry). */
  execution?: boolean
  /** Sprint 24 — force search aggregation on/off (otherwise FeatureRegistry). */
  search?: boolean
  signal?: AbortSignal
}

/**
 * Shared reasoning entrypoint for text + voice (sync planning path).
 * Always produces a BrainResponsePlan when called (caller must gate flags).
 * When trip planning is on, also runs TripPlanningEngine.
 * Execution is attached via `attachTravelExecution` / `runIntegratedBrainPipeline` (async).
 */
export function runIntegratedBrainTurn(
  input: RunIntegratedBrainTurnInput,
): BrainTurnResult {
  const locale = toBrainLocale(input.locale)
  const search =
    typeof input.search === 'boolean' ? input.search : isBrainSearchEnabled()
  const execution =
    typeof input.execution === 'boolean'
      ? input.execution
      : isBrainExecutionEnabled() || search
  const tripPlanning =
    typeof input.tripPlanning === 'boolean'
      ? input.tripPlanning
      : isBrainTripPlanningEnabled() || execution
  const travelEngine =
    typeof input.travelEngine === 'boolean'
      ? input.travelEngine
      : isBrainTravelEngineEnabled() || tripPlanning

  const orchestrator = getOrCreateBrainOrchestrator(input.conversationId, locale, {
    travelEngine,
  })

  if (input.requirements) {
    const ctx = orchestrator.getContext()
    const seeded = seedBrainMemoryFromRequirements(
      ctx.memory,
      input.requirements,
      locale,
    )
    orchestrator.setContext({ ...ctx, memory: seeded, locale })
  }

  const result = orchestrator.runTurn({
    conversationId: input.conversationId,
    userText: input.userText,
    locale,
  })

  if (!tripPlanning) {
    return { ...result, execution: null, search: null }
  }

  const engine = getOrCreateTripPlanningEngine(input.conversationId, locale)
  const planning = engine.runTurn({
    userText: input.userText,
    locale,
  })

  return {
    ...result,
    planning,
    execution: null,
    search: null,
  }
}

/**
 * Sprint 23 — run TravelExecutionEngine when TripPlan is complete.
 * Shared by text (planTurn) and voice (session) — same pipeline.
 */
export async function attachTravelExecution(input: {
  conversationId: string
  planning: TripPlanningTurnResult | null | unknown
  signal?: AbortSignal
  executionEnabled?: boolean
}): Promise<TravelExecutionTurnResult | null> {
  const enabled =
    typeof input.executionEnabled === 'boolean'
      ? input.executionEnabled
      : isBrainExecutionEnabled()
  if (!enabled) return null

  const planning = input.planning as TripPlanningTurnResult | null
  const tripPlan = planning?.tripPlan
  if (!tripPlan || tripPlan.status !== 'complete') return null

  const engine = getOrCreateTravelExecutionEngine(input.conversationId)
  return engine.execute({ tripPlan, signal: input.signal })
}

/**
 * Sprint 24 — aggregate execution results into ranked recommendations.
 * Shared by text and voice — same pipeline as execution.
 */
export function attachSearchAggregation(input: {
  conversationId: string
  planning: TripPlanningTurnResult | null | unknown
  execution: TravelExecutionTurnResult | null | unknown
  searchEnabled?: boolean
}): SearchAggregationTurnResult | null {
  const enabled =
    typeof input.searchEnabled === 'boolean'
      ? input.searchEnabled
      : isBrainSearchEnabled()
  if (!enabled) return null

  const execution = input.execution as TravelExecutionTurnResult | null
  if (!execution?.plan || !execution.results?.length) return null

  const planning = input.planning as TripPlanningTurnResult | null
  return aggregateSearch({
    conversationId: input.conversationId,
    executionPlan: execution.plan,
    executionResults: execution.results,
    executionTasks: execution.plan.tasks,
    tripPlan: planning?.tripPlan ?? null,
  })
}

/**
 * Full text/voice pipeline: Brain → TripPlanning → TravelExecution → SearchAggregation.
 */
export async function runIntegratedBrainPipeline(
  input: RunIntegratedBrainTurnInput,
): Promise<BrainTurnResult> {
  const searchEnabled =
    typeof input.search === 'boolean' ? input.search : isBrainSearchEnabled()
  const executionEnabled =
    typeof input.execution === 'boolean'
      ? input.execution
      : isBrainExecutionEnabled() || searchEnabled

  const result = runIntegratedBrainTurn({
    ...input,
    tripPlanning:
      typeof input.tripPlanning === 'boolean'
        ? input.tripPlanning
        : isBrainTripPlanningEnabled() || executionEnabled,
    execution: executionEnabled,
    search: searchEnabled,
  })

  const execution = await attachTravelExecution({
    conversationId: input.conversationId,
    planning: result.planning,
    signal: input.signal,
    executionEnabled,
  })

  const search = attachSearchAggregation({
    conversationId: input.conversationId,
    planning: result.planning,
    execution,
    searchEnabled,
  })

  return {
    ...result,
    execution,
    search,
  }
}

/**
 * Attach brain plan onto agent provider meta (additive).
 */
export function withBrainMeta<T extends AgentProviderMeta>(
  meta: T,
  brain: BrainMetaSnapshot | null | undefined,
): T {
  if (!brain) return meta
  const brainMeta: NonNullable<AgentProviderMeta['brain']> = {
    intent: brain.intent,
    confidence: brain.confidence,
    action: brain.action,
    summary: brain.summary,
    assistantGoal: brain.assistantGoal,
    missingFields: [...brain.missingFields],
    searchRequests: [...brain.searchRequests],
    bookingRequests: [...brain.bookingRequests],
    recommendations: [...brain.recommendations],
    uiHints: brain.uiHints,
    travelPlan: brain.travelPlan ?? null,
    domain: brain.domain ?? null,
    contextualReply: brain.contextualReply ?? null,
    planning: brain.planning ?? null,
    clarificationQuestion: brain.clarificationQuestion ?? null,
    travelSummary: brain.travelSummary ?? null,
    engineTripPlan: brain.engineTripPlan ?? null,
    execution: brain.execution ?? null,
    executionSummary: brain.executionSummary ?? null,
    executionProgress: brain.executionProgress ?? null,
    search: brain.search ?? null,
    searchRecommendation: brain.searchRecommendation ?? null,
    searchCollection: brain.searchCollection ?? null,
  }
  return { ...meta, brain: brainMeta }
}
