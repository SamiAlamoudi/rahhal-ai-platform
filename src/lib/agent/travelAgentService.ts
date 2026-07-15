/**
 * Single orchestration layer for Travel AI Agent planning.
 * Chat (text + voice) and Saved Trips integrate through this service only.
 */

import type { ChatMessage } from '../chat/chatTypes'
import { applyTripPlanEdits, buildTripPlan, regenerateTripDay } from './buildItinerary'
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
  AgentMemory,
  AgentProviderMeta,
  AgentToolRunSummary,
  TripPlan,
  TripRequirements,
} from './types'
import { withTripPlan } from './types'

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
    const plan = mergeToolResultsIntoPlan(base, batch.results)
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
        const day = extracted.patch.regenerateDay
          ?? memory.requirements.regenerateDay
          ?? 1
        const plan = regenerateTripDay(memory.tripPlan, day, memory.locale)
        memory = withTripPlan({ ...memory, phase: 'editing', missingFields: [] }, plan)
        reply = formatTripPlanReply(plan, memory.locale)
      } else if (extracted.intent === 'edit' && !hasPlanningPatch(extracted.patch) && memory.tripPlan) {
        reply = buildEditAck(memory.locale)
        memory.phase = 'editing'
      } else if (
        (extracted.intent === 'regenerate' || extracted.intent === 'edit' || extracted.intent === 'plan' || extracted.intent === 'answer')
        && memory.missingFields.length === 0
      ) {
        const basePlan = memory.tripPlan && extracted.intent === 'edit'
          ? applyTripPlanEdits(memory.tripPlan, extracted.patch, memory.locale)
          : undefined
        const seed = extracted.intent === 'regenerate' ? `regen-${Date.now()}` : undefined
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
      }

      return {
        reply,
        memory,
        tripPlan: memory.tripPlan,
        meta,
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

    async regenerateDay({ plan, day, locale }) {
      return regenerateTripDay(plan, day, locale)
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
