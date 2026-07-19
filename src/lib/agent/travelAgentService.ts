/**
 * Single orchestration layer for Travel AI Agent planning.
 * Chat (text + voice) and Saved Trips integrate through this service only.
 */

import type { ChatMessage } from '../chat/chatTypes'
import { getFeatureRegistry } from '../ai'
import {
  createConciergeService,
  type ConciergeService,
  type ConciergeState,
} from '../concierge'
import { rebuildConciergeStateFromMessages } from '../concierge/meta'
import { applyTripPlanEdits, buildTripPlan, regenerateTripDay } from './buildItinerary'
import { applyIntelligentDecisions } from './decision'
import { extractFromUserText } from './extractRequirements'
import {
  buildEditAck,
  buildFollowUpQuestion,
  buildSaveAck,
  formatTripPlanReply,
} from './formatReply'
import { createAgentLlmRegistry } from './llm/factory'
import type { AgentLlmRegistry } from './llm/types'
import {
  mergeRequirements,
  missingRequirementFields,
  rebuildMemoryFromMessages,
} from './memory'
import { saveGeneratedItinerary } from './itineraryPersistence'
import { createToolExecutor } from './tools/executor'
import { mergeToolResultsIntoPlan } from './tools/mergeToolResults'
import { selectToolsForTurn } from './tools/selectTools'
import { createDefaultAgentToolRegistry } from './tools/stubs'
import type { AgentToolRegistry, AgentToolResult, ToolExecutionBatch } from './tools/types'
import type {
  AgentIntent,
  AgentMemory,
  AgentProviderMeta,
  AgentToolRunSummary,
  RegenerateScope,
  TripPlan,
  TripRequirements,
} from './types'
import { withTripPlan } from './types'
import {
  buildBookingHistoryConciergeReply,
  findLatestBookingRecord,
  getBookingHistoryUserId,
  getBookingOrchestrator,
  loadUserBookingRecords,
  type BookingHistoryIntent,
  type BookingRecord,
} from '../booking'
import {
  buildConfirmationConciergeReply,
  confirmationStateFromSession,
  type ConfirmationConciergeIntent,
} from '../bookingConfirmation'
import {
  buildOrderConciergeReply,
  findManagedOrderBySessionId,
  type OrderConciergeIntent,
} from '../orderManagement'
import {
  buildSmartItineraryConciergeReply,
  type SmartItineraryConciergeIntent,
} from '../smartItinerary'
import {
  brainMemoryToRequirementsPatch,
  isBrainAgentHandoffEnabled,
  isBrainConciergeIntegrationEnabled,
  isBrainTravelEngineEnabled,
  runIntegratedBrainTurn,
  toMetaBrain,
  withBrainMeta,
  type BrainMetaSnapshot,
} from '../brain/integration'

const BOOKING_HISTORY_INTENTS = new Set<AgentIntent>([
  'show_trips',
  'show_latest_booking',
  'show_booking_details',
  'summarize_itinerary',
])

const CONFIRMATION_INTENTS = new Set<AgentIntent>([
  'booking_confirmed',
  'show_confirmation',
  'booking_reference',
  'booking_status',
])

const ORDER_PAYMENT_INTENTS = new Set<AgentIntent>([
  'how_much_will_i_pay',
  'is_order_ready',
  'show_checkout',
  'what_is_payment_status',
])

const SMART_ITINERARY_INTENTS = new Set<AgentIntent>([
  'show_my_itinerary',
  'whats_todays_plan',
  'when_leave_for_airport',
  'summarize_my_trip',
])

export interface TravelAgentTurnInput {
  conversationId: string
  messages: ChatMessage[]
  signal?: AbortSignal
}

export interface TravelAgentTurnResult {
  reply: string
  memory: AgentMemory
  tripPlan: TripPlan | null
  meta: AgentProviderMeta
  toolBatch: ToolExecutionBatch | null
}

export interface TravelAgentServiceOptions {
  tools?: AgentToolRegistry
  llms?: AgentLlmRegistry
  savePlan?: (input: {
    conversationId: string
    tripPlan: TripPlan
  }) => Promise<{ title: string } | null>
  /**
   * Sprint 9 Concierge. Default: FeatureRegistry `ai.concierge`.
   * Pass `false` to disable; pass a service to inject.
   * Concierge is provider-agnostic and only signals agent handoff.
   */
  concierge?: ConciergeService | false
  /** Explicit override for the `ai.concierge` feature flag. */
  conciergeEnabled?: boolean
  /**
   * Sprint 20 — Brain ↔ Concierge integration.
   * Default: FeatureRegistry `brain.enabled` + `brain.concierge` (both OFF).
   * Pass `false` to force off; `true` to force on in tests.
   */
  brainEnabled?: boolean
  /** When true (or flag `brain.agent_handoff`), merge brain slots into agent requirements. */
  brainHandoffEnabled?: boolean
  /**
   * Sprint 21 — Real Travel Conversation Engine.
   * Default: FeatureRegistry `brain.travel_engine` (OFF). Requires brain.concierge chain.
   */
  brainTravelEngineEnabled?: boolean
  /**
   * Sprint 13 — inject booking records for My Trips / history intents.
   * Defaults to loading the signed-in user's BookingSession projections.
   */
  listBookingRecords?: () => Promise<BookingRecord[]>
}

export interface TravelAgentService {
  planTurn(input: TravelAgentTurnInput): Promise<TravelAgentTurnResult>
  regeneratePlan(input: {
    conversationId: string
    memory: AgentMemory
    signal?: AbortSignal
  }): Promise<TripPlan>
  regenerateDay(input: {
    conversationId: string
    plan: TripPlan
    day: number
    locale: AgentMemory['locale']
    signal?: AbortSignal
  }): Promise<TripPlan>
  regenerateScoped(input: {
    conversationId: string
    memory: AgentMemory
    scope: Exclude<RegenerateScope, 'day' | 'whole'>
    signal?: AbortSignal
  }): Promise<TripPlan>
  editPlan(input: {
    conversationId: string
    plan: TripPlan
    patch: Partial<TripRequirements>
    locale: AgentMemory['locale']
    signal?: AbortSignal
  }): Promise<TripPlan>
  savePlan(input: {
    conversationId: string
    tripPlan: TripPlan
    existingSavedTripId?: string | null
  }): Promise<{ id: string; title: string }>
}

function hasPlanningPatch(patch: Record<string, unknown>): boolean {
  return Object.keys(patch).some((key) => {
    if (key === 'regenerateDay') return false
    const value = patch[key]
    if (Array.isArray(value)) return value.length > 0
    return value != null && value !== ''
  })
}

function toMetaConcierge(state: ConciergeState): NonNullable<AgentProviderMeta['concierge']> {
  return {
    phase: state.phase,
    softSignals: {
      pace: state.softSignals.pace,
      mustHaves: state.softSignals.mustHaves,
      dealBreakers: state.softSignals.dealBreakers,
      flexibleDimensions: state.softSignals.flexibleDimensions,
      tradeoffs: state.softSignals.tradeoffs,
      notes: state.softSignals.notes,
    },
    lastAction: state.lastAction,
    heardSummary: [...state.heardSummary],
    turnCount: state.turnCount,
  }
}

function toToolSummaries(results: AgentToolResult[]): AgentToolRunSummary[] {
  return results.map((result) => ({
    tool: result.tool,
    status: result.status,
    summary: result.summary,
    providerId: result.meta?.providerId,
    durationMs: result.meta?.durationMs,
  }))
}

export function createTravelAgentService(
  options: TravelAgentServiceOptions = {},
): TravelAgentService {
  const tools = options.tools ?? createDefaultAgentToolRegistry()
  const executor = createToolExecutor(tools)
  const llms = options.llms ?? createAgentLlmRegistry()
  const savePlanHook = options.savePlan
  const conciergeService = options.concierge === false
    ? null
    : (options.concierge ?? createConciergeService())

  const isConciergeEnabled = (): boolean => {
    if (options.concierge === false) return false
    if (typeof options.conciergeEnabled === 'boolean') return options.conciergeEnabled
    return getFeatureRegistry().isEnabled('ai.concierge')
  }

  const isBookingHistoryEnabled = (): boolean =>
    getFeatureRegistry().isEnabled('ui.booking_history')

  const isBookingConfirmationEnabled = (): boolean =>
    getFeatureRegistry().isEnabled('ui.booking_confirmation')

  const isOrderManagementEnabled = (): boolean =>
    getFeatureRegistry().isEnabled('ui.order_management')

  const isSmartItineraryEnabled = (): boolean =>
    getFeatureRegistry().isEnabled('ui.smart_itinerary')

  const isBrainEnabled = (): boolean =>
    isBrainConciergeIntegrationEnabled({ brainEnabled: options.brainEnabled })

  const isBrainHandoffEnabled = (): boolean =>
    isBrainAgentHandoffEnabled({ brainHandoffEnabled: options.brainHandoffEnabled })

  const isTravelEngineEnabled = (): boolean =>
    isBrainTravelEngineEnabled({
      brainTravelEngineEnabled: options.brainTravelEngineEnabled,
    })

  const listBookingRecords = async (): Promise<BookingRecord[]> => {
    if (options.listBookingRecords) return options.listBookingRecords()
    const userId = getBookingHistoryUserId()
    if (!userId) return []
    return loadUserBookingRecords(userId)
  }

  const runToolsForPlan = async (input: {
    memory: AgentMemory
    conversationId: string
    signal?: AbortSignal
    seed?: string
    basePlan?: TripPlan
  }): Promise<{ plan: TripPlan; batch: ToolExecutionBatch }> => {
    const selected = selectToolsForTurn({
      requirements: input.memory.requirements,
      intent: input.memory.lastIntent,
      missingFields: input.memory.missingFields,
    })

    const batch = selected.length > 0
      ? await executor.execute({
        names: selected,
        ctx: {
          requirements: input.memory.requirements,
          tripPlan: input.memory.tripPlan,
          itinerary: input.memory.tripPlan,
          locale: input.memory.locale,
          signal: input.signal,
        },
      })
      : {
        results: [],
        selected: [],
        okCount: 0,
        failedCount: 0,
        durationMs: 0,
      }

    const base = input.basePlan ?? buildTripPlan({
      requirements: input.memory.requirements,
      conversationId: input.conversationId,
      locale: input.memory.locale,
      seed: input.seed,
    })
    const merged = mergeToolResultsIntoPlan(base, batch.results)
    const plan = applyIntelligentDecisions(merged, batch.results, input.memory.requirements)
    return { plan, batch }
  }

  const service: TravelAgentService = {
    async planTurn(input) {
      const lastUser = [...input.messages].reverse().find((m) => m.role === 'user')
      const userText = lastUser?.content ?? ''
      const prior = rebuildMemoryFromMessages(input.messages.slice(0, -1))
      const extracted = extractFromUserText(userText, prior.locale)

      let memory: AgentMemory = {
        ...prior,
        locale: extracted.locale || prior.locale,
        lastIntent: extracted.intent,
        requirements: mergeRequirements(prior.requirements, extracted.patch),
      }
      memory.missingFields = missingRequirementFields(memory.requirements)
      memory = withTripPlan(memory, memory.tripPlan ?? memory.itinerary)

      // Sprint 20/21 — every user message through Brain (memory → intent → context → planner)
      // when flags are on. Produces BrainResponsePlan before assistant reply paths.
      let brainMeta: BrainMetaSnapshot | undefined
      const travelEngineOn = isTravelEngineEnabled()
      if (isBrainEnabled() && userText.trim()) {
        const brainResult = runIntegratedBrainTurn({
          conversationId: input.conversationId,
          userText,
          locale: memory.locale,
          requirements: memory.requirements,
          travelEngine: travelEngineOn,
        })
        brainMeta = toMetaBrain(brainResult)

        if (isBrainHandoffEnabled() || travelEngineOn) {
          memory = {
            ...memory,
            requirements: mergeRequirements(
              memory.requirements,
              brainMemoryToRequirementsPatch(brainResult.context.memory),
            ),
          }
          memory.missingFields = missingRequirementFields(memory.requirements)
          memory = withTripPlan(memory, memory.tripPlan ?? memory.itinerary)
        }
      }

      const attachBrain = <T extends AgentProviderMeta>(meta: T): T =>
        withBrainMeta(meta, brainMeta)

      // Sprint 21 — contextual one-question follow-up (text + voice share this path).
      if (
        travelEngineOn
        && brainMeta?.action === 'ask_missing'
        && brainMeta.contextualReply
      ) {
        memory = withTripPlan({ ...memory, phase: 'collecting' }, memory.tripPlan)
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          toolResults: [],
        }
        return {
          reply: brainMeta.contextualReply,
          memory,
          tripPlan: memory.tripPlan,
          meta: attachBrain(meta),
          toolBatch: null,
        }
      }

      // Sprint 17 — smart itinerary intents (above order / confirmation / history).
      if (
        SMART_ITINERARY_INTENTS.has(extracted.intent)
        && isSmartItineraryEnabled()
      ) {
        const records = await listBookingRecords()
        const latest = findLatestBookingRecord(records)
        const reply = buildSmartItineraryConciergeReply({
          intent: extracted.intent as SmartItineraryConciergeIntent,
          record: latest,
          locale: memory.locale,
        })
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          toolResults: [],
        }
        return {
          reply,
          memory,
          tripPlan: memory.tripPlan,
          meta: attachBrain(meta),
          toolBatch: null,
        }
      }

      // Sprint 15 — order / payment intents (above confirmation / history).
      if (
        ORDER_PAYMENT_INTENTS.has(extracted.intent)
        && isOrderManagementEnabled()
      ) {
        const records = await listBookingRecords()
        const latest = findLatestBookingRecord(records)
        const customerId = getBookingHistoryUserId() ?? latest?.userId
        const order = latest
          ? findManagedOrderBySessionId(latest.sessionId)
          : null
        const reply = buildOrderConciergeReply(
          extracted.intent as OrderConciergeIntent,
          {
            bookingSessionId: latest?.sessionId,
            customerId: customerId ?? undefined,
            order,
          },
        )
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          toolResults: [],
        }
        return {
          reply,
          memory,
          tripPlan: memory.tripPlan,
          meta: attachBrain(meta),
          toolBatch: null,
        }
      }

      // Sprint 14 — confirmation intents (above history / concierge intake).
      if (
        CONFIRMATION_INTENTS.has(extracted.intent)
        && isBookingConfirmationEnabled()
      ) {
        const records = await listBookingRecords()
        const latest = findLatestBookingRecord(records)
        const session = latest
          ? getBookingOrchestrator().getBookingSession(latest.sessionId)
          : null
        const confirmationState = session ? confirmationStateFromSession(session) : null
        const reply = buildConfirmationConciergeReply({
          intent: extracted.intent as ConfirmationConciergeIntent,
          state: confirmationState,
          record: latest,
          locale: memory.locale,
        })
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          toolResults: [],
        }
        return {
          reply,
          memory,
          tripPlan: memory.tripPlan,
          meta: attachBrain(meta),
          toolBatch: null,
        }
      }

      // Sprint 13 — booking history intents (above concierge intake; no tools).
      if (
        BOOKING_HISTORY_INTENTS.has(extracted.intent)
        && isBookingHistoryEnabled()
      ) {
        const records = await listBookingRecords()
        const reply = buildBookingHistoryConciergeReply({
          intent: extracted.intent as BookingHistoryIntent,
          records,
          locale: memory.locale,
        })
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          toolResults: [],
        }
        return {
          reply,
          memory,
          tripPlan: memory.tripPlan,
          meta: attachBrain(meta),
          toolBatch: null,
        }
      }

      let conciergeState: ConciergeState | null = rebuildConciergeStateFromMessages(
        input.messages.slice(0, -1),
      )

      // Concierge sits above the agent: consultant dialogue or agent handoff.
      // It never selects providers — only whether the agent should execute.
      if (isConciergeEnabled() && conciergeService) {
        const conciergeResult = conciergeService.runTurn({
          locale: memory.locale,
          memory,
          userText,
          intent: extracted.intent,
          requirements: memory.requirements,
          missingFields: memory.missingFields,
          previous: conciergeState,
        })
        conciergeState = conciergeResult.state

        if (!conciergeResult.handoff.shouldExecuteAgent && conciergeResult.reply) {
          memory = withTripPlan({ ...memory, phase: 'collecting' }, memory.tripPlan)
          const meta: AgentProviderMeta = {
            kind: 'travel_agent',
            version: 2,
            memory,
            tripPlan: memory.tripPlan,
            itinerary: memory.tripPlan,
            toolResults: [],
            concierge: toMetaConcierge(conciergeState),
          }
          return {
            reply: conciergeResult.reply,
            memory,
            tripPlan: memory.tripPlan,
            meta: attachBrain(meta),
            toolBatch: null,
          }
        }
      }

      const llm = llms.getActive()
      const llmResult = await llm.complete({
        conversationId: input.conversationId,
        messages: input.messages,
        memory,
        locale: memory.locale,
        signal: input.signal,
      })

      let reply = ''
      let toolBatch: ToolExecutionBatch | null = null

      if (extracted.intent === 'save') {
        if (!memory.tripPlan) {
          reply = memory.locale === 'ar'
            ? 'لا توجد خطة جاهزة للحفظ بعد. أكمل التفاصيل وسأبنيها أولاً.'
            : 'There is no plan to save yet. Share the missing details and I will draft one first.'
          memory.phase = 'collecting'
        } else if (savePlanHook) {
          const saved = await savePlanHook({
            conversationId: input.conversationId,
            tripPlan: memory.tripPlan,
          })
          reply = buildSaveAck(memory.locale, saved?.title || memory.tripPlan.title)
          memory.phase = 'planned'
        } else {
          reply = memory.locale === 'ar'
            ? 'استخدم زر «حفظ الخطة» أسفل الرسالة لحفظها في الرحلات المحفوظة.'
            : 'Use the “Save plan” button under the message to store it in Saved Trips.'
          memory.phase = 'planned'
        }
      } else if (extracted.intent === 'regenerate_day' && memory.tripPlan) {
        const existingPlan = memory.tripPlan
        const day = extracted.patch.regenerateDay
          ?? memory.requirements.regenerateDay
          ?? 1
        memory = {
          ...memory,
          requirements: {
            ...memory.requirements,
            regenerateDay: day,
            regenerateScope: 'day',
          },
          lastIntent: 'regenerate_day',
          missingFields: [],
        }
        const refreshedDay = regenerateTripDay(existingPlan, day, memory.locale)
        const ran = await runToolsForPlan({
          memory,
          conversationId: input.conversationId,
          signal: input.signal,
          basePlan: refreshedDay,
        })
        toolBatch = ran.batch
        memory = withTripPlan({ ...memory, phase: 'editing', missingFields: [] }, ran.plan)
        reply = formatTripPlanReply(ran.plan, memory.locale)
      } else if (extracted.intent === 'edit' && !hasPlanningPatch(extracted.patch) && memory.tripPlan) {
        reply = buildEditAck(memory.locale)
        memory.phase = 'editing'
      } else if (
        (extracted.intent === 'regenerate' || extracted.intent === 'edit' || extracted.intent === 'plan' || extracted.intent === 'answer')
        && memory.missingFields.length === 0
      ) {
        const scope = memory.requirements.regenerateScope
          ?? extracted.patch.regenerateScope
          ?? (extracted.intent === 'regenerate' ? 'whole' : null)
        memory = {
          ...memory,
          requirements: {
            ...memory.requirements,
            regenerateScope: scope,
          },
        }
        const scoped = scope === 'flight' || scope === 'hotel' || scope === 'activities'
        const basePlan = memory.tripPlan && extracted.intent === 'edit'
          ? applyTripPlanEdits(memory.tripPlan, extracted.patch, memory.locale)
          : (scoped && memory.tripPlan ? memory.tripPlan : undefined)
        const seed = extracted.intent === 'regenerate' && (!scope || scope === 'whole')
          ? `regen-${Date.now()}`
          : undefined
        const ran = await runToolsForPlan({
          memory,
          conversationId: input.conversationId,
          signal: input.signal,
          seed,
          basePlan,
        })
        let plan = ran.plan
        toolBatch = ran.batch
        if (llmResult.draft?.notes?.length) {
          plan = { ...plan, notes: [...plan.notes, ...llmResult.draft.notes] }
        }
        memory = withTripPlan({ ...memory, phase: 'planned', missingFields: [] }, plan)
        reply = formatTripPlanReply(plan, memory.locale)
      } else if (memory.missingFields.length > 0) {
        memory = withTripPlan({ ...memory, phase: 'collecting' }, memory.tripPlan)
        reply = buildFollowUpQuestion(memory, memory.missingFields)
      } else if (memory.tripPlan) {
        const existingPlan = memory.tripPlan
        memory = withTripPlan({ ...memory, phase: 'planned' }, existingPlan)
        reply = formatTripPlanReply(existingPlan, memory.locale)
      } else {
        reply = buildFollowUpQuestion(memory, memory.missingFields)
      }

      const meta: AgentProviderMeta = {
        kind: 'travel_agent',
        version: 2,
        memory,
        tripPlan: memory.tripPlan,
        itinerary: memory.tripPlan,
        toolResults: toolBatch ? toToolSummaries(toolBatch.results) : [],
        ...(conciergeState ? { concierge: toMetaConcierge(conciergeState) } : {}),
      }

      return {
        reply,
        memory,
        tripPlan: memory.tripPlan,
        meta: attachBrain(meta),
        toolBatch,
      }
    },

    async regeneratePlan({ conversationId, memory, signal }) {
      const ran = await runToolsForPlan({
        memory: { ...memory, lastIntent: 'regenerate', missingFields: [] },
        conversationId,
        signal,
        seed: `regen-${Date.now()}`,
      })
      return ran.plan
    },

    async regenerateDay({ conversationId, plan, day, locale, signal }) {
      const memory: AgentMemory = {
        locale,
        phase: 'editing',
        requirements: {
          ...plan.requirements,
          regenerateDay: day,
          regenerateScope: 'day',
        },
        tripPlan: plan,
        itinerary: plan,
        missingFields: [],
        lastIntent: 'regenerate_day',
      }
      const refreshedDay = regenerateTripDay(plan, day, locale)
      const ran = await runToolsForPlan({
        memory,
        conversationId,
        signal,
        basePlan: refreshedDay,
      })
      return ran.plan
    },

    async regenerateScoped({ conversationId, memory, scope, signal }) {
      const nextMemory: AgentMemory = {
        ...memory,
        lastIntent: 'regenerate',
        missingFields: [],
        requirements: {
          ...memory.requirements,
          regenerateScope: scope,
        },
      }
      const ran = await runToolsForPlan({
        memory: nextMemory,
        conversationId,
        signal,
        basePlan: memory.tripPlan ?? undefined,
      })
      return ran.plan
    },

    async editPlan({ conversationId, plan, patch, locale, signal }) {
      const requirements = {
        ...plan.requirements,
        ...patch,
        destinations: patch.destinations?.length
          ? patch.destinations
          : plan.requirements.destinations,
        interests: patch.interests?.length
          ? patch.interests
          : plan.requirements.interests,
        destination: patch.destination ?? plan.requirements.destination,
      }
      const memory: AgentMemory = {
        locale,
        phase: 'editing',
        requirements,
        tripPlan: plan,
        itinerary: plan,
        missingFields: [],
        lastIntent: 'edit',
      }
      const base = applyTripPlanEdits({ ...plan, conversationId }, patch, locale)
      const ran = await runToolsForPlan({
        memory,
        conversationId,
        signal,
        basePlan: base,
      })
      return ran.plan
    },

    async savePlan({ tripPlan, existingSavedTripId }) {
      const saved = await saveGeneratedItinerary({
        itinerary: tripPlan,
        existingSavedTripId,
      })
      return { id: saved.id, title: saved.title }
    },
  }

  return service
}

export const travelAgentService = createTravelAgentService()
