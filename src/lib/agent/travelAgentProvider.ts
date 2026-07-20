import type { ChatCompletionRequest, ChatProvider, ChatStreamChunk } from '../chat/chatTypes'
import {
  createTravelAgentService,
  type TravelAgentService,
  type TravelAgentServiceOptions,
} from './travelAgentService'
import type { AgentProviderMeta, TripPlan } from './types'
import { buildThinkingBridge } from './formatReply'

export interface CreateTravelAgentProviderOptions extends TravelAgentServiceOptions {
  service?: TravelAgentService
  /** MVP-compatible alias for savePlan */
  saveItinerary?: (input: {
    conversationId: string
    itinerary: TripPlan
  }) => Promise<{ title: string } | null>
}

export function createTravelAgentProvider(
  options: CreateTravelAgentProviderOptions = {},
): ChatProvider {
  const savePlan = options.savePlan ?? (
    options.saveItinerary
      ? async (input: { conversationId: string; tripPlan: TripPlan }) =>
        options.saveItinerary!({
          conversationId: input.conversationId,
          itinerary: input.tripPlan,
        })
      : undefined
  )

  const service = options.service ?? createTravelAgentService({
    tools: options.tools,
    llms: options.llms,
    savePlan,
    concierge: options.concierge,
    conciergeEnabled: options.conciergeEnabled,
    listBookingRecords: options.listBookingRecords,
  })

  return {
    providerId: 'travel-agent',

    async *streamReply(input: ChatCompletionRequest): AsyncIterable<ChatStreamChunk> {
      const locale = inferLocale(input.messages)
      const bridge = buildThinkingBridge(locale)

      // Experience Sprint 1 — start the voice loop immediately (ChatGPT-Voice feel).
      // Bridge is spoken via meta; keep display calm with a short consultant line.
      yield {
        type: 'delta',
        text: `${bridge}\n\n`,
        meta: {
          spokenText: bridge,
          voicePhase: 'bridge',
        },
      }

      const result = await service.planTurn({
        conversationId: input.conversationId,
        messages: input.messages,
        signal: input.signal,
      })

      const spoken = result.meta.spokenText?.trim() || result.reply
      const meta: AgentProviderMeta = {
        ...result.meta,
        spokenText: spoken,
        voicePhase: 'final',
      }

      // Stream the real reply after the bridge. Avoid duplicating the bridge if the
      // final reply already opens with the same consulting line.
      let body = result.reply
      if (body.startsWith(bridge)) {
        body = body.slice(bridge.length).replace(/^\s*\n+/, '')
      }

      yield* streamText(body, input.signal, meta)
    },
  }
}

export const travelAgentProvider = createTravelAgentProvider()

function inferLocale(messages: ChatCompletionRequest['messages']): 'ar' | 'en' {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const content = messages[i]?.content ?? ''
    if (/[\u0600-\u06FF]/.test(content)) return 'ar'
    if (/[A-Za-z]/.test(content)) return 'en'
  }
  return 'ar'
}

async function* streamText(
  text: string,
  signal: AbortSignal,
  meta: AgentProviderMeta,
  chunkSize = 36,
  delayMs = 4,
): AsyncGenerator<ChatStreamChunk> {
  let index = 0
  while (index < text.length) {
    if (signal.aborted) {
      yield { type: 'error', error: 'cancelled' }
      return
    }
    const next = text.slice(index, index + chunkSize)
    index += chunkSize
    yield {
      type: 'delta',
      text: next,
      meta: {
        spokenText: meta.spokenText,
        voicePhase: 'final',
      },
    }
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
