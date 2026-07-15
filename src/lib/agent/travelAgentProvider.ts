import type { ChatCompletionRequest, ChatProvider, ChatStreamChunk } from '../chat/chatTypes'
import { applyItineraryEdits, buildTravelItinerary } from './buildItinerary'
import { extractFromUserText } from './extractRequirements'
import {
  buildEditAck,
  buildFollowUpQuestion,
  buildSaveAck,
  formatItineraryReply,
} from './formatReply'
import {
  mergeRequirements,
  missingRequirementFields,
  rebuildMemoryFromMessages,
} from './memory'
import type { AgentProviderMeta, AgentMemory } from './types'
import { createDefaultAgentToolRegistry } from './tools/stubs'
import type { AgentToolRegistry } from './tools/types'

export interface CreateTravelAgentProviderOptions {
  tools?: AgentToolRegistry
  /** Injected save hook for chat-driven "save" intents (UI save uses itineraryPersistence directly). */
  saveItinerary?: (input: {
    conversationId: string
    itinerary: NonNullable<AgentMemory['itinerary']>
  }) => Promise<{ title: string } | null>
}

export function createTravelAgentProvider(
  options: CreateTravelAgentProviderOptions = {},
): ChatProvider {
  const tools = options.tools ?? createDefaultAgentToolRegistry()

  return {
    providerId: 'travel-agent',

    async *streamReply(input: ChatCompletionRequest): AsyncIterable<ChatStreamChunk> {
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

      // Touch tool registry so future integrations stay on the hot path without vendor coupling.
      await tools.runAvailable({
        requirements: memory.requirements,
        itinerary: memory.itinerary,
        locale: memory.locale,
        signal: input.signal,
      }, ['local_recommendations', 'weather', 'flights', 'hotels'])

      let reply = ''
      if (extracted.intent === 'save') {
        if (!memory.itinerary) {
          reply = memory.locale === 'ar'
            ? 'لا توجد خطة جاهزة للحفظ بعد. أكمل التفاصيل وسأبنيها أولاً.'
            : 'There is no plan to save yet. Share the missing details and I will draft one first.'
          memory.phase = memory.itinerary ? 'planned' : 'collecting'
        } else if (options.saveItinerary) {
          const saved = await options.saveItinerary({
            conversationId: input.conversationId,
            itinerary: memory.itinerary,
          })
          reply = buildSaveAck(memory.locale, saved?.title || memory.itinerary.title)
          memory.phase = 'planned'
        } else {
          reply = memory.locale === 'ar'
            ? 'استخدم زر «حفظ الخطة» أسفل الرسالة لحفظها في الرحلات المحفوظة.'
            : 'Use the “Save plan” button under the message to store it in Saved Trips.'
          memory.phase = 'planned'
        }
      } else if (extracted.intent === 'edit' && !hasPlanningPatch(extracted.patch) && memory.itinerary) {
        reply = buildEditAck(memory.locale)
        memory.phase = 'editing'
      } else if (
        (extracted.intent === 'regenerate' || extracted.intent === 'edit' || extracted.intent === 'plan' || extracted.intent === 'answer')
        && memory.missingFields.length === 0
      ) {
        const seed = extracted.intent === 'regenerate' ? `regen-${Date.now()}` : undefined
        const itinerary = memory.itinerary && extracted.intent === 'edit'
          ? applyItineraryEdits(memory.itinerary, extracted.patch, memory.locale)
          : buildTravelItinerary({
            requirements: memory.requirements,
            conversationId: input.conversationId,
            locale: memory.locale,
            seed,
          })
        memory.itinerary = itinerary
        memory.phase = 'planned'
        memory.missingFields = []
        reply = formatItineraryReply(itinerary, memory.locale)
      } else if (memory.missingFields.length > 0) {
        memory.phase = 'collecting'
        memory.itinerary = memory.itinerary
        reply = buildFollowUpQuestion(memory, memory.missingFields)
      } else if (memory.itinerary) {
        memory.phase = 'planned'
        reply = formatItineraryReply(memory.itinerary, memory.locale)
      } else {
        reply = buildFollowUpQuestion(memory, memory.missingFields)
      }

      const meta: AgentProviderMeta = {
        kind: 'travel_agent',
        version: 1,
        memory,
        itinerary: memory.itinerary,
      }

      yield* streamText(reply, input.signal, meta)
    },
  }
}

export const travelAgentProvider = createTravelAgentProvider()

function hasPlanningPatch(patch: Record<string, unknown>): boolean {
  return Object.keys(patch).some((key) => {
    const value = patch[key]
    if (Array.isArray(value)) return value.length > 0
    return value != null && value !== ''
  })
}

async function* streamText(
  text: string,
  signal: AbortSignal,
  meta: AgentProviderMeta,
  chunkSize = 24,
  delayMs = 8,
): AsyncGenerator<ChatStreamChunk> {
  let index = 0
  while (index < text.length) {
    if (signal.aborted) {
      yield { type: 'error', error: 'cancelled' }
      return
    }
    const next = text.slice(index, index + chunkSize)
    index += chunkSize
    yield { type: 'delta', text: next }
    if (delayMs > 0) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, delayMs)
        const onAbort = () => {
          clearTimeout(timer)
          resolve()
        }
        if (signal.aborted) {
          clearTimeout(timer)
          resolve()
          return
        }
        signal.addEventListener('abort', onAbort, { once: true })
      })
    }
  }
  if (signal.aborted) {
    yield { type: 'error', error: 'cancelled' }
    return
  }
  yield { type: 'done', meta: { ...meta } }
}
