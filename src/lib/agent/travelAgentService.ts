/**
 * Single orchestration layer for Travel AI Agent planning.
 * Chat (text + voice) and Saved Trips integrate through this service only.
 */

import type { ChatMessage } from '../chat/chatTypes'
import { applyTripPlanEdits, buildTripPlan } from './buildItinerary'
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
import { createDefaultAgentToolRegistry } from './tools/stubs'
import type { AgentToolRegistry } from './tools/types'
import type { AgentMemory, AgentProviderMeta, TripPlan, TripRequirements } from './types'
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
  }): TripPlan
  editPlan(input: {
    conversationId: string
    plan: TripPlan
    patch: Partial<TripRequirements>
    locale: AgentMemory['locale']
  }): TripPlan
  savePlan(input: {
    conversationId: string
    tripPlan: TripPlan
    existingSavedTripId?: string | null
  }): Promise<{ id: string; title: string }>
}

function hasPlanningPatch(patch: Record<string, unknown>): boolean {
  return Object.keys(patch).some((key) => {
    const value = patch[key]
    if (Array.isArray(value)) return value.length > 0
    return value != null && value !== ''
  })
}

export function createTravelAgentService(
  options: TravelAgentServiceOptions = {},
): TravelAgentService {
  const tools = options.tools ?? createDefaultAgentToolRegistry()
  const llms = options.llms ?? createAgentLlmRegistry()
  const savePlanHook = options.savePlan

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

      await tools.runAvailable({
        requirements: memory.requirements,
        tripPlan: memory.tripPlan,
        itinerary: memory.tripPlan,
        locale: memory.locale,
        signal: input.signal,
      }, ['attractions', 'local_recommendations', 'weather', 'flights', 'hotels', 'maps', 'visa', 'currency'])

      const llm = llms.getActive()
      const llmResult = await llm.complete({
        conversationId: input.conversationId,
        messages: input.messages,
        memory,
        locale: memory.locale,
        signal: input.signal,
      })

      let reply = ''
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
      } else if (extracted.intent === 'edit' && !hasPlanningPatch(extracted.patch) && memory.tripPlan) {
        reply = buildEditAck(memory.locale)
        memory.phase = 'editing'
      } else if (
        (extracted.intent === 'regenerate' || extracted.intent === 'edit' || extracted.intent === 'plan' || extracted.intent === 'answer')
        && memory.missingFields.length === 0
      ) {
        let plan: TripPlan
        if (memory.tripPlan && extracted.intent === 'edit') {
          plan = service.editPlan({
            conversationId: input.conversationId,
            plan: memory.tripPlan,
            patch: extracted.patch,
            locale: memory.locale,
          })
        } else if (extracted.intent === 'regenerate' && memory.tripPlan) {
          plan = service.regeneratePlan({ conversationId: input.conversationId, memory })
        } else {
          plan = buildTripPlan({
            requirements: memory.requirements,
            conversationId: input.conversationId,
            locale: memory.locale,
          })
        }
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
      }

      return {
        reply,
        memory,
        tripPlan: memory.tripPlan,
        meta,
      }
    },

    regeneratePlan({ conversationId, memory }) {
      return buildTripPlan({
        requirements: memory.requirements,
        conversationId,
        locale: memory.locale,
        seed: `regen-${Date.now()}`,
      })
    },

    editPlan({ conversationId, plan, patch, locale }) {
      return applyTripPlanEdits({ ...plan, conversationId }, patch, locale)
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
