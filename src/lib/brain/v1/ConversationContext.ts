/**
 * Sprint 81 — ConversationContext (Brain v1).
 * Aggregates session + history + locale for planners.
 */

import type { ConversationHistory } from './ConversationHistory'
import type { SessionState } from './SessionState'
import type { BrainV1Entities, BrainV1Intent } from './types'

export type BrainV1ConversationContextSnapshot = {
  sessionId: string
  locale: 'ar' | 'en'
  intent: BrainV1Intent | null
  entities: BrainV1Entities
  turnCount: number
  lastUserText: string | null
}

export class ConversationContext {
  private readonly session: SessionState
  private readonly history: ConversationHistory
  private readonly locale: 'ar' | 'en'

  constructor(
    session: SessionState,
    history: ConversationHistory,
    locale: 'ar' | 'en' = 'ar',
  ) {
    this.session = session
    this.history = history
    this.locale = locale
  }

  snapshot(intent?: BrainV1Intent | null): BrainV1ConversationContextSnapshot {
    const session = this.session.getSnapshot()
    return {
      sessionId: session.sessionId,
      locale: this.locale,
      intent: intent ?? session.lastIntent,
      entities: session.entities,
      turnCount: this.history.turnCount(),
      lastUserText: this.history.lastUserText(),
    }
  }
}

export function createConversationContext(
  session: SessionState,
  history: ConversationHistory,
  locale: 'ar' | 'en' = 'ar',
): ConversationContext {
  return new ConversationContext(session, history, locale)
}
