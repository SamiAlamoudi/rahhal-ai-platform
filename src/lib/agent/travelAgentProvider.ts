import type { ChatCompletionRequest, ChatProvider, ChatStreamChunk } from '../chat/chatTypes'
import {
  createTravelAgentService,
  type TravelAgentService,
  type TravelAgentServiceOptions,
} from './travelAgentService'
import type { AgentProviderMeta, TripPlan } from './types'

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
      const result = await service.planTurn({
        conversationId: input.conversationId,
        messages: input.messages,
        signal: input.signal,
      })
      yield* streamText(result.reply, input.signal, result.meta)
    },
  }
}

export const travelAgentProvider = createTravelAgentProvider()

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
