/**
 * Sprint 86 — Brain Router (safe pilot).
 * Sprint 89 Phase 1 — Understanding enrichment (Intent/Entity/Reference/Memory/State).
 *
 * IF preview flag OFF → current planner
 * IF preview flag ON  → Understanding core + Conversation Manager orchestration
 * IF Brain throws     → automatic fallback to current planner (no user-facing errors)
 *
 * Still early-returns with toolBatch: null (no Search Handoff / provider execution).
 * Flags remain OFF by default; production hard-block unchanged.
 */

import type { AgentMemory, AgentProviderMeta } from '../../../agent/types'
import type { TravelAgentTurnResult } from '../../../agent/travelAgentService'
import type { ChatMessage } from '../../../chat/chatTypes'
import {
  PREVIEW_ORCHESTRATOR_CONTRACTS_VERSION,
  earlyReturnLockedHandoffHint,
  type PreviewConversationStage,
  type SearchHandoffHint,
} from '../contracts/previewContracts'
import { runConversationManagerTurn } from '../conversation'
import type { ConversationSession } from '../conversation/types'
import {
  createUnderstandingMemoryManager,
  understandTurn,
  type UnderstandingMemoryManager,
  type UnderstandingTurnResult,
} from '../understanding'
import {
  BRAIN_V1_PREVIEW_VERSION,
  isBrainV1PreviewEnabled,
} from './feature'
import { extractBrainPreviewSession } from './sessionStore'
import type { MemoryProvenanceMap } from './memory'

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
  /** Optional MemoryManager injection (tests). */
  memoryManager?: UnderstandingMemoryManager
  /** Disable understanding enrichment (tests / emergency). Default: enabled when preview runs. */
  skipUnderstanding?: boolean
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

function recentUserTexts(messages: ChatMessage[], limit = 6): string[] {
  const out: string[] = []
  for (let i = messages.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const m = messages[i]
    if (m?.role === 'user' && typeof m.content === 'string' && m.content.trim()) {
      out.push(m.content)
    }
  }
  return out.reverse()
}

function buildBrainResult(input: {
  memory: AgentMemory
  reply: string
  session: ConversationSession
  questionCount: number
  providedValue: boolean
  intent: string | null
  stage: PreviewConversationStage
  searchHandoffHint: SearchHandoffHint
  understanding?: UnderstandingTurnResult | null
  provenance?: MemoryProvenanceMap
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
      contractsVersion: PREVIEW_ORCHESTRATOR_CONTRACTS_VERSION,
      stage: input.stage,
      searchHandoffHint: input.searchHandoffHint,
      understanding: input.understanding
        ? {
            contractVersion: input.understanding.contractVersion,
            consultantIntent: input.understanding.summary.consultantIntent,
            legacyIntent: input.understanding.summary.legacyIntent,
            brainState: input.understanding.summary.brainState,
            entityFields: input.understanding.summary.entityFields,
            resolvedReferenceCount: input.understanding.summary.resolvedReferenceCount,
            ambiguousReferenceCount: input.understanding.summary.ambiguousReferenceCount,
            isCorrection: input.understanding.intent.isCorrection,
            isConfirmation: input.understanding.intent.isConfirmation,
          }
        : undefined,
      memoryProvenanceFields: input.provenance ? Object.keys(input.provenance) : undefined,
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
    const memoryManager = input.memoryManager ?? createUnderstandingMemoryManager()

    let memory = input.memory
    let understanding: UnderstandingTurnResult | null = null
    let provenance: MemoryProvenanceMap = {}

    if (!input.skipUnderstanding) {
      understanding = understandTurn({
        text: input.userText,
        locale: input.locale,
        conversationId: input.conversationId,
        source: 'text',
        priorEntities: {
          destination: memory.requirements.destination,
          origin: memory.requirements.origin,
          travelDates: {
            start: memory.requirements.startDate,
            end: memory.requirements.endDate,
          },
          adults: memory.requirements.travelers,
          children: memory.requirements.children,
          budget: memory.requirements.budgetAmount,
          currency: memory.requirements.budgetCurrency,
          cabinClass: memory.requirements.cabinPreference,
          preferredAirline: memory.requirements.preferredAirline,
          flexibleDates: memory.requirements.datesFlexible,
        },
        memoryHints: {
          destination: memory.requirements.destination,
          origin: memory.requirements.origin,
          budgetAmount: memory.requirements.budgetAmount,
          budgetCurrency: memory.requirements.budgetCurrency,
          hotelPreference: memory.requirements.hotelPreference,
          preferredAirline: memory.requirements.preferredAirline,
          recentTexts: recentUserTexts(input.messages),
        },
      })

      const applied = memoryManager.applyEntityFacts(memory, understanding.entities.facts, {
        planId: memory.tripPlan?.id ?? null,
      })
      memory = applied.memory
      provenance = applied.provenance
      // Soft defaults only fill empty slots; never overwrite user facts.
      memory = memoryManager.applyPreferenceDefaults(memory)
    }

    const req = memory.requirements
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

    if (brain.knownSlots) {
      memory = mergeSlotsIntoMemory(memory, brain.knownSlots)
    }

    const stage: PreviewConversationStage =
      understanding?.state.previewStage
      ?? (brain.session.stage === 'explore'
        ? 'exploring'
        : brain.session.stage === 'search'
          ? 'searching'
          : brain.session.stage === 'booking'
            ? 'ready_for_booking'
            : 'exploring')

    // Phase 1: Search Handoff remains decision-only / early-return locked.
    const searchHandoffHint = earlyReturnLockedHandoffHint()

    return {
      path: 'brain',
      result: buildBrainResult({
        memory,
        reply,
        session: brain.session,
        questionCount: brain.response.questionCount,
        providedValue: brain.response.providedValue,
        intent: understanding?.summary.consultantIntent ?? brain.intent,
        stage,
        searchHandoffHint,
        understanding,
        provenance,
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
