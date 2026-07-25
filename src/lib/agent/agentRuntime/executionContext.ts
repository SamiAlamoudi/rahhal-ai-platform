/**
 * Phase 6 — Runtime ExecutionContext
 * Distinct from Sprint 113 orchestrator ExecutionContext.
 */

import type { LiveTravelMemory } from '../conversationIntelligence'
import { createEmptyLiveTravelMemory } from '../conversationIntelligence'
import type { ConversationStateSnapshot } from '../llmBrain'
import { createConversationState } from '../llmBrain'
import { ExecutionEvents } from './executionEvents'
import { ExecutionTrace } from './executionTrace'
import type { RuntimeLocale, VoiceRuntimeState } from './types'

export class RuntimeExecutionContext {
  readonly sessionId: string
  readonly events: ExecutionEvents
  readonly trace: ExecutionTrace
  locale: RuntimeLocale
  userText: string
  memory: LiveTravelMemory
  conversation: ConversationStateSnapshot
  voice: VoiceRuntimeState
  interrupted: boolean
  recentTexts: string[]

  constructor(input: {
    sessionId: string
    userText: string
    locale?: RuntimeLocale
    priorMemory?: LiveTravelMemory | null
    recentTexts?: string[]
    voiceState?: VoiceRuntimeState
  }) {
    this.sessionId = input.sessionId
    this.userText = input.userText
    this.locale = input.locale ?? (/[\u0600-\u06FF]/.test(input.userText) ? 'ar' : 'en')
    this.memory = input.priorMemory ?? createEmptyLiveTravelMemory()
    this.recentTexts = input.recentTexts ?? []
    this.voice = input.voiceState ?? 'thinking'
    this.interrupted = false
    this.events = new ExecutionEvents()
    this.trace = new ExecutionTrace()
    this.conversation = createConversationState({
      userText: input.userText,
      memory: this.memory,
      locale: this.locale,
    })
  }

  interrupt(reason = 'user_interrupt'): void {
    this.interrupted = true
    this.voice = 'interrupted'
    this.events.publish('Interrupted', reason)
    this.trace.mark('interrupt', reason)
  }

  resume(): void {
    this.interrupted = false
    this.voice = 'thinking'
    this.events.publish('Resumed', 'continue')
    this.trace.mark('resume', 'continue')
  }
}

/** Public alias matching requested module name (runtime-scoped). */
export { RuntimeExecutionContext as ExecutionContext }
