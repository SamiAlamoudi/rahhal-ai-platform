/**
 * Sprint 20 — Brain ↔ Agent / Concierge / Voice integration.
 * Flag-gated; default OFF. No LLM providers or external APIs.
 */

import { getFeatureRegistry } from '../ai'
import type { AgentLocale, TripRequirements } from '../agent/types'
import type {
  BrainLocale,
  BrainResponsePlan,
  BrainTurnResult,
  ConversationMemory,
  TravelIntent,
} from './types'
import { ConversationOrchestrator, type ConversationOrchestratorHandle } from './conversationOrchestrator'
import { ConversationMemoryApi } from './conversationMemory'

const orchestrators = new Map<string, ConversationOrchestratorHandle>()

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
}

export function resetBrainIntegrationSessions(): void {
  orchestrators.clear()
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

function toBrainLocale(locale: AgentLocale | BrainLocale | undefined): BrainLocale {
  return locale === 'en' ? 'en' : 'ar'
}

export function getOrCreateBrainOrchestrator(
  conversationId: string,
  locale: BrainLocale = 'ar',
): ConversationOrchestratorHandle {
  const existing = orchestrators.get(conversationId)
  if (existing) return existing
  const created = ConversationOrchestrator({ conversationId, locale })
  orchestrators.set(conversationId, created)
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
  if (memory.activities.length) patch.interests = memory.activities
  if (memory.currency || memory.budget.currency) {
    patch.budgetCurrency = memory.currency ?? memory.budget.currency
  }
  return patch
}

export function toMetaBrain(result: BrainTurnResult): BrainMetaSnapshot {
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
  }
}

export type RunIntegratedBrainTurnInput = {
  conversationId: string
  userText: string
  locale?: AgentLocale | BrainLocale
  /** Optional agent requirements used to seed brain memory before the turn. */
  requirements?: TripRequirements | null
}

/**
 * Shared reasoning entrypoint for text + voice.
 * Always produces a BrainResponsePlan when called (caller must gate flags).
 */
export function runIntegratedBrainTurn(
  input: RunIntegratedBrainTurnInput,
): BrainTurnResult {
  const locale = toBrainLocale(input.locale)
  const orchestrator = getOrCreateBrainOrchestrator(input.conversationId, locale)

  if (input.requirements) {
    const ctx = orchestrator.getContext()
    const seeded = seedBrainMemoryFromRequirements(
      ctx.memory,
      input.requirements,
      locale,
    )
    orchestrator.setContext({ ...ctx, memory: seeded, locale })
  }

  return orchestrator.runTurn({
    conversationId: input.conversationId,
    userText: input.userText,
    locale,
  })
}

/**
 * Attach brain plan onto agent provider meta (additive).
 */
export function withBrainMeta<T extends { brain?: BrainMetaSnapshot }>(
  meta: T,
  brain: BrainMetaSnapshot | null | undefined,
): T {
  if (!brain) return meta
  return { ...meta, brain }
}
