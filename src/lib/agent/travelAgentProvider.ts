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
      // Conversation-First — stream OpenAI dialogue deltas while planTurn runs.
      const progressQueue: AutonomousProgressEvent[] = []
      const dialogueQueue: Array<{ displayText: string; spokenText: string }> = []
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
      let streamedDisplay = ''
      let latestSpoken = ''

      const turnPromise = service.planTurn({
        conversationId: input.conversationId,
        messages: input.messages,
        signal: input.signal,
        onProgress: (event) => {
          progressQueue.push(event)
          notify()
        },
        onDialogueDelta: (partial) => {
          dialogueQueue.push(partial)
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

      while (!turnDone || progressQueue.length > 0 || dialogueQueue.length > 0) {
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
        while (dialogueQueue.length > 0) {
          const partial = dialogueQueue.shift()!
          latestSpoken = partial.spokenText || latestSpoken
          const nextDisplay = partial.displayText || ''
          let chunk = ''
          if (nextDisplay.startsWith(streamedDisplay)) {
            chunk = nextDisplay.slice(streamedDisplay.length)
            streamedDisplay = nextDisplay
          } else if (nextDisplay !== streamedDisplay) {
            // Model rewrote earlier text — replace by sending the full new display as a jump.
            chunk = nextDisplay
            streamedDisplay = nextDisplay
          }
          yield {
            type: 'delta',
            text: chunk,
            meta: {
              spokenText: latestSpoken || undefined,
              voicePhase: latestSpoken ? 'final' : undefined,
              streamingSource: 'openai',
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

      const spoken = turnResult.meta.spokenText?.trim() || latestSpoken || turnResult.reply
      const meta: AgentProviderMeta = {
        ...turnResult.meta,
        spokenText: spoken,
        voicePhase: 'final',
      }
      // Canonical traveler-facing body — chatService replaces accumulated stream with this
      // so sanitized booking replies (no "plan ready" / estimated totals) win.
      const doneMeta = {
        ...meta,
        displayText: turnResult.reply,
      }

      // If OpenAI already streamed the exact final display, only emit remainder.
      if (streamedDisplay && turnResult.reply.startsWith(streamedDisplay)) {
        const remainder = turnResult.reply.slice(streamedDisplay.length)
        if (remainder) {
          yield {
            type: 'delta',
            text: remainder,
            meta: {
              spokenText: spoken,
              voicePhase: 'final',
            },
          }
        }
        if (input.signal.aborted) {
          yield { type: 'error', error: 'cancelled' }
          return
        }
        yield { type: 'done', meta: doneMeta }
        return
      }

      // Stream diverged from the final sanitized reply (e.g. model said "plan ready"
      // before tools finished). Do NOT append — chatService will replace via displayText.
      if (streamedDisplay && streamedDisplay !== turnResult.reply) {
        if (input.signal.aborted) {
          yield { type: 'error', error: 'cancelled' }
          return
        }
        yield {
          type: 'delta',
          text: '',
          meta: {
            spokenText: spoken,
            voicePhase: 'final',
            displayText: turnResult.reply,
          },
        }
        yield { type: 'done', meta: doneMeta }
        return
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

      yield* streamText(turnResult.reply, input.signal, doneMeta)
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
