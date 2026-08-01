/**
 * Sprint 86 — Brain Router (safe pilot).
 *
 * IF preview flag OFF → current planner
 * IF preview flag ON  → Brain v1 Conversation Manager orchestration
 * IF Brain throws     → automatic fallback to current planner (no user-facing errors)
 *
 * Orchestration only — reuses AssumptionEngine / ValueFirstPlanner /
 * ClarificationPolicy / ConversationMemory / TravelReasoner via ConversationManager.
 */

import type { AgentMemory, AgentProviderMeta } from '../../../agent/types'
import type { TravelAgentTurnResult } from '../../../agent/travelAgentService'
import type { ChatMessage } from '../../../chat/chatTypes'
import { runConversationManagerTurn } from '../conversation'
import type { ConversationSession } from '../conversation/types'
import {
  BRAIN_V1_PREVIEW_VERSION,
  isBrainV1PreviewEnabled,
} from './feature'
import { extractBrainPreviewSession } from './sessionStore'

export type BrainRouterPath = 'current' | 'brain' | 'fallback'

export type BrainRouterDecision =
  | { path: 'current' }
  | { path: 'fallback'; reason: string }
  | { path: 'brain'; result: TravelAgentTurnResult }

export type BrainRouterInput = {
  userText: string
  locale: 'ar' | 'en'
  conversationId: string
  messages: ChatMessage[]
  memory: AgentMemory
  /** Explicit override (tests / service options). */
  enabled?: boolean
  bypassDeployGateForTests?: boolean
  /** Injected for unit tests to force Brain failures. */
  runBrain?: typeof runConversationManagerTurn
}

function mergeSlotsIntoMemory(
  memory: AgentMemory,
  knownSlots: NonNullable<ReturnType<typeof runConversationManagerTurn>['knownSlots']>,
): AgentMemory {
  const req = { ...memory.requirements }
  // Destination refinements overwrite (Morocco → Agadir).
  if (knownSlots.destination) {
    req.destination = knownSlots.destination
    req.destinations = [knownSlots.destination]
  }
  if (knownSlots.origin) req.origin = knownSlots.origin
  if (knownSlots.dates.start) req.startDate = knownSlots.dates.start
  if (knownSlots.dates.end) req.endDate = knownSlots.dates.end
  if (knownSlots.adults != null) {
    req.travelers = knownSlots.adults + (knownSlots.children ?? 0)
  }
  if (knownSlots.children != null) req.children = knownSlots.children
  if (knownSlots.budget != null) req.budgetAmount = knownSlots.budget
  if (knownSlots.cabin) req.cabinPreference = knownSlots.cabin
  if (knownSlots.currency) req.budgetCurrency = knownSlots.currency
  if (knownSlots.hotelPreference) req.hotelPreference = knownSlots.hotelPreference
  if (knownSlots.activities.length) {
    req.interests = [...new Set([...req.interests, ...knownSlots.activities])]
  }
  if (knownSlots.specialRequests) {
    req.notes = knownSlots.specialRequests
    if (/tripStyle=business/i.test(knownSlots.specialRequests)) req.tripPurpose = 'business'
    else if (/tripStyle=family/i.test(knownSlots.specialRequests)) req.tripPurpose = 'family'
    else if (/tripStyle=weekend|tripStyle=leisure|tripStyle=solo/i.test(knownSlots.specialRequests)) {
      req.tripPurpose = req.tripPurpose ?? 'leisure'
    }
  }
  if (knownSlots.flexibleDates) req.datesFlexible = true
  return { ...memory, requirements: req }
}

function buildBrainResult(input: {
  memory: AgentMemory
  reply: string
  session: ConversationSession
  questionCount: number
  providedValue: boolean
  intent: string | null
}): TravelAgentTurnResult {
  const memory = input.memory
  const meta: AgentProviderMeta = {
    kind: 'travel_agent',
    version: 2,
    memory,
    tripPlan: memory.tripPlan,
    itinerary: memory.tripPlan,
    spokenText: input.reply,
    voicePhase: 'final',
    brainV1Preview: {
      active: true,
      path: 'brain',
      version: BRAIN_V1_PREVIEW_VERSION,
      questionCount: input.questionCount,
      providedValue: input.providedValue,
      intent: input.intent,
      session: input.session,
    },
  }
  return {
    reply: input.reply,
    memory,
    tripPlan: memory.tripPlan,
    meta,
    toolBatch: null,
  }
}

/**
 * Route a turn. Never throws to the caller.
 * Returns `current` when the preview flag is OFF.
 * Returns `brain` when ConversationManager produced a usable reply.
 * Returns `fallback` when Brain fails or returns a disabled/empty result.
 */
export function routeBrainPreviewTurn(input: BrainRouterInput): BrainRouterDecision {
  const enabled = isBrainV1PreviewEnabled({
    enabled: input.enabled,
    bypassDeployGateForTests: input.bypassDeployGateForTests,
  })
  if (!enabled) return { path: 'current' }

  try {
    const run = input.runBrain ?? runConversationManagerTurn
    const priorSession = extractBrainPreviewSession(input.messages)
    const req = input.memory.requirements
    const brain = run(
      {
        text: input.userText,
        locale: input.locale,
        priorSession,
        preferenceMemory: {
          preferredAirlines: req.preferredAirline ? [req.preferredAirline] : [],
          typicalBudget: req.budgetAmount,
          cabinClass: req.cabinPreference,
          currency: req.budgetCurrency,
          hotelStarMin: null,
          maxStops: null,
          refundablePreferred: false,
        },
      },
      { enabled: true },
    )

    if (!brain.enabled || !brain.response || !brain.session) {
      return { path: 'fallback', reason: 'brain_disabled_or_empty' }
    }

    const reply = brain.response[input.locale] || brain.response.ar || brain.response.en
    if (!reply.trim()) {
      return { path: 'fallback', reason: 'empty_reply' }
    }

    let memory = input.memory
    if (brain.knownSlots) {
      memory = mergeSlotsIntoMemory(memory, brain.knownSlots)
    }

    return {
      path: 'brain',
      result: buildBrainResult({
        memory,
        reply,
        session: brain.session,
        questionCount: brain.response.questionCount,
        providedValue: brain.response.providedValue,
        intent: brain.intent,
      }),
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'brain_exception'
    return { path: 'fallback', reason: `exception:${reason}` }
  }
}

/**
 * Convenience for planTurn: returns a turn result when Brain handled the turn,
 * otherwise null (caller continues with the current planner). Never throws.
 */
export function tryBrainV1PreviewTurn(
  input: BrainRouterInput,
): TravelAgentTurnResult | null {
  const decision = routeBrainPreviewTurn(input)
  if (decision.path === 'brain') return decision.result
  return null
}
