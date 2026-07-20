import type { ChatCompletionRequest, ChatProvider, ChatStreamChunk } from '../chat/chatTypes'
import {
  createTravelAgentService,
  type TravelAgentService,
  type TravelAgentServiceOptions,
  type TravelAgentTurnResult,
} from './travelAgentService'
import type { AutonomousProgressEvent } from './autonomous'
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
    autonomousAgentEnabled: options.autonomousAgentEnabled,
    listBookingRecords: options.listBookingRecords,
  })

  return {
    providerId: 'travel-agent',

    async *streamReply(input: ChatCompletionRequest): AsyncIterable<ChatStreamChunk> {
      // Experience Sprint 2 — no scripted bridge. Conversation Brain authors the full reply.
      // Sprint 54 — stream structured autonomous progress while planTurn runs.
      const progressQueue: AutonomousProgressEvent[] = []
      let wake: (() => void) | null = null
      const waitForProgress = () => new Promise<void>((resolve) => {
        wake = resolve
      })
      const notify = () => {
        const fn = wake
        wake = null
        fn?.()
      }

      let turnResult: TravelAgentTurnResult | undefined
      let turnError: unknown
      let turnDone = false

      const turnPromise = service.planTurn({
        conversationId: input.conversationId,
        messages: input.messages,
        signal: input.signal,
        onProgress: (event) => {
          progressQueue.push(event)
          notify()
        },
      }).then((value) => {
        turnResult = value
        turnDone = true
        notify()
      }).catch((error) => {
        turnError = error
        turnDone = true
        notify()
      })

      while (!turnDone || progressQueue.length > 0) {
        while (progressQueue.length > 0) {
          const event = progressQueue.shift()!
          yield {
            type: 'delta',
            text: '',
            meta: {
              autonomousProgress: {
                phase: event.phase,
                state: event.state,
                message: event.message,
                activeTaskKind: event.activeTaskKind,
                providerId: event.providerId,
                retryCount: event.retryCount,
              },
            },
          }
        }
        if (!turnDone) {
          await Promise.race([waitForProgress(), turnPromise.then(() => undefined, () => undefined)])
        }
      }

      if (turnError) {
        const message = turnError instanceof Error ? turnError.message : String(turnError ?? 'turn_failed')
        yield { type: 'error', error: message }
        return
      }
      if (!turnResult) {
        yield { type: 'error', error: 'empty_turn_result' }
        return
      }

      const spoken = turnResult.meta.spokenText?.trim() || turnResult.reply
      const meta: AgentProviderMeta = {
        ...turnResult.meta,
        spokenText: spoken,
        voicePhase: 'final',
      }

      // Emit spokenText on the first content delta so voice can start ASAP.
      yield {
        type: 'delta',
        text: '',
        meta: {
          spokenText: spoken,
          voicePhase: 'final',
          ...(meta.autonomous ? { autonomous: meta.autonomous } : {}),
        },
      }

      yield* streamText(turnResult.reply, input.signal, meta)
    },
  }
}

export const travelAgentProvider = createTravelAgentProvider()

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
