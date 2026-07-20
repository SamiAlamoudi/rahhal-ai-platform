/**
 * Sprint 44 — ChatGPT Experience Orchestrator.
 * Intent → Plan → Tools? → Natural response, with memory + state machine.
 * Delegates tool work to existing conversation-ui / travel-agent providers.
 */

import type { ChatCompletionRequest, ChatProvider, ChatStreamChunk } from '../chatTypes'
import { createConversationChatProvider } from '../conversationExperience/conversationChatProvider'
import { createMemoryManager, type MemoryManagerHandle } from './memoryManager'
import { classifyChatIntent } from './intentUnderstanding'
import { buildResponsePlan, decideTools } from './responsePlanner'
import { composeNaturalReply } from './naturalLanguage'
import { createExperienceStateMachine } from './conversationStates'
import { withToolRetry } from './errorRecovery'
import { createTimingTracker, logExperience } from './experienceLogger'
import type {
  ChatGptExperienceState,
  ExperienceTurnContext,
  ExperienceTurnResult,
} from './types'

export type ChatGptExperienceOrchestrator = {
  prepareTurn: (input: ExperienceTurnContext) => {
    intent: ExperienceTurnResult['intent']
    plan: ExperienceTurnResult['plan']
    toolDecision: ExperienceTurnResult['toolDecision']
    memory: ExperienceTurnResult['memory']
    opener: string
    followUp: string | null
  }
  streamTurn: (input: ChatCompletionRequest & { locale?: 'ar' | 'en' }) => AsyncGenerator<ChatStreamChunk>
}

export function createChatGptExperienceOrchestrator(options?: {
  memory?: MemoryManagerHandle
  toolProvider?: ChatProvider
  enabled?: boolean
}): ChatGptExperienceOrchestrator {
  const memory = options?.memory ?? createMemoryManager({ enabled: true })
  const toolProvider = options?.toolProvider ?? createConversationChatProvider({
    conversationUiEnabled: true,
  })

  return {
    prepareTurn(input) {
      const history = input.history
      const snap = memory.absorbTurn({
        conversationId: input.conversationId,
        userText: input.userText,
        locale: input.locale,
        userId: input.userId,
        history,
      })
      const intentResult = classifyChatIntent({
        userText: input.userText,
        locale: input.locale,
        history,
      })
      const toolDecision = decideTools(intentResult.intent)
      const plan = buildResponsePlan({ intent: intentResult.intent, toolDecision })
      const natural = composeNaturalReply({
        intent: intentResult.intent,
        userText: input.userText,
        locale: input.locale,
        memory: snap,
      })
      return {
        intent: intentResult.intent,
        plan,
        toolDecision,
        memory: snap,
        opener: natural.text,
        followUp: natural.followUp,
      }
    },

    async *streamTurn(input) {
      const timing = createTimingTracker()
      timing.mark('turn')
      timing.mark('ttft')
      const locale = input.locale === 'ar' ? 'ar' : 'en'
      const states = createExperienceStateMachine('understanding')
      const emitState = (state: ChatGptExperienceState): ChatStreamChunk => {
        states.transition(state)
        return {
          type: 'delta',
          text: '',
          experienceState: state,
          meta: { chatgptExperience: true, experienceState: state },
        }
      }

      yield emitState('understanding')

      const lastUser = [...input.messages].reverse().find((m) => m.role === 'user')
      const userText = lastUser?.content?.trim() || ''
      if (!userText) {
        yield { type: 'error', error: 'empty_user_message' }
        return
      }

      const prepared = this.prepareTurn({
        conversationId: input.conversationId,
        userText,
        locale,
        history: input.messages.map((m) => ({ role: m.role, content: m.content })),
        signal: input.signal,
      })

      yield emitState('thinking')

      // Immediate first visible tokens (ChatGPT-like TTFT).
      const opener = prepared.opener
      if (opener) {
        yield { type: 'delta', text: opener.slice(0, Math.min(24, opener.length)) }
        logExperience({
          stage: 'streaming',
          event: 'first_token',
          durationMs: timing.measure('ttft'),
          state: 'responding',
        })
        yield emitState('responding')
        if (opener.length > 24) {
          yield* streamText(opener.slice(24), input.signal, 16, 4)
        }
      }

      let body = ''
      let usedTools = false
      let recovered = false
      let toolMeta: Record<string, unknown> = {}

      // Prefer a clarifying follow-up over tool calls when it improves the turn
      // (ChatGPT-style: ask tourism/business/family before searching).
      const deferToolsForClarification = Boolean(prepared.followUp) && (
        prepared.intent === 'create_itinerary'
        || prepared.intent === 'book_flight'
        || prepared.intent === 'search_hotels'
        || prepared.intent === 'visa_question'
      )

      if (prepared.toolDecision.useTools && !deferToolsForClarification) {
        yield emitState('using_tools')
        if (
          prepared.intent === 'book_flight'
          || prepared.intent === 'search_hotels'
          || prepared.intent === 'create_itinerary'
          || prepared.intent === 'pricing'
        ) {
          yield emitState('searching')
        }

        const toolRun = await withToolRetry({
          label: 'conversation_tools',
          locale,
          attempts: 2,
          run: async () => {
            usedTools = true
            timing.mark('tools')
            let collected = ''
            let meta: Record<string, unknown> = {}
            for await (const chunk of toolProvider.streamReply(input)) {
              if (input.signal?.aborted) throw new Error('cancelled')
              if (chunk.type === 'delta' && chunk.text) {
                collected += chunk.text
              } else if (chunk.type === 'done') {
                meta = chunk.meta ?? {}
              } else if (chunk.type === 'error') {
                throw new Error(chunk.error || 'tool_stream_error')
              }
            }
            logExperience({
              stage: 'tool_execution',
              event: 'tools_done',
              durationMs: timing.measure('tools'),
            })
            return { collected, meta }
          },
        })

        if (!toolRun.ok) {
          recovered = true
          body = `\n\n${toolRun.message}`
          yield* streamText(body, input.signal, 20, 3)
        } else {
          toolMeta = toolRun.value.meta
          const toolText = toolRun.value.collected.trim()
          // Avoid repeating the opener if the tool response already covers it.
          const remainder = stripRedundantPrefix(toolText, opener)
          if (remainder) {
            yield emitState('generating')
            const separator = opener ? '\n\n' : ''
            body = separator + remainder
            yield* streamText(body, input.signal, 22, 3)
            memory.rememberToolResult(
              input.conversationId,
              remainder.slice(0, 240),
            )
          }
          if (prepared.followUp) {
            const follow = `\n\n${prepared.followUp}`
            body += follow
            yield* streamText(follow, input.signal, 18, 4)
          }
        }
      } else if (prepared.followUp) {
        const follow = `\n\n${prepared.followUp}`
        body = follow
        yield* streamText(follow, input.signal, 18, 4)
      }

      yield emitState('done')
      const timings = timing.snapshot()
      timings.total = timing.measure('turn')

      logExperience({
        stage: 'streaming',
        event: 'turn_complete',
        durationMs: timings.total,
        meta: {
          intent: prepared.intent,
          usedTools,
          recovered,
          ttftMs: timings.ttft,
        },
      })

      yield {
        type: 'done',
        meta: {
          chatgptExperience: true,
          experienceState: 'done',
          intent: prepared.intent,
          // Never expose internal plan steps to users — keep in meta for diagnostics only.
          experienceDiagnostics: {
            planSteps: prepared.plan.steps,
            tools: prepared.toolDecision.toolIds,
            timings,
            states: states.history(),
          },
          memory: {
            destinations: prepared.memory.preferences.destinations,
            summary: prepared.memory.summary,
          },
          ...toolMeta,
        },
      }
    },
  }
}

async function* streamText(
  text: string,
  signal: AbortSignal | undefined,
  chunkSize: number,
  delayMs: number,
): AsyncGenerator<ChatStreamChunk> {
  let i = 0
  while (i < text.length) {
    if (signal?.aborted) {
      yield { type: 'error', error: 'cancelled' }
      return
    }
    const next = text.slice(i, i + chunkSize)
    i += chunkSize
    yield { type: 'delta', text: next }
    if (delayMs > 0) await sleep(delayMs, signal)
  }
}

function stripRedundantPrefix(full: string, opener: string): string {
  if (!opener) return full
  if (full.startsWith(opener)) return full.slice(opener.length).trim()
  return full
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      resolve()
    }, { once: true })
  })
}
