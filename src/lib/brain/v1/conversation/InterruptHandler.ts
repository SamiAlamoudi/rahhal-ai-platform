/**
 * Sprint 85 — Interrupt Handling.
 * Pause, resume, topic switching, return to previous goal.
 */

import type { ConversationLifecycleState, ConversationSession } from './types'

export type InterruptKind = 'none' | 'pause' | 'resume' | 'topic_switch' | 'return_previous'

export class InterruptHandler {
  detect(text: string, flags?: { pause?: boolean; resume?: boolean }): InterruptKind {
    if (flags?.pause) return 'pause'
    if (flags?.resume) return 'resume'
    const lower = text.trim().toLowerCase()
    if (/^(pause|انتظر|توقف|خلينا نوقف)/i.test(lower) || /pause|أوقف/.test(lower)) {
      return 'pause'
    }
    if (
      /^(resume|continue|continue please|نكمل|كمّل|كمل|تابع)/i.test(lower)
      || /resume|continue where/.test(lower)
    ) {
      return 'resume'
    }
    if (
      /actually (?:let'?s|i want)|instead|change (?:topic|subject)|بدل الموضوع|موضوع آخر|خلينا نتكلم عن/.test(lower)
      || /موضوع آخر|بدل الموضوع/.test(text)
    ) {
      return 'topic_switch'
    }
    if (
      /back to (?:my )?(?:previous|earlier)|return to|ارجع|عد للهدف|العودة للهدف/.test(lower)
      || /ارجع|عد إلى|العودة/.test(text)
    ) {
      return 'return_previous'
    }
    return 'none'
  }

  apply(
    session: ConversationSession,
    kind: InterruptKind,
    newGoalLabel?: string | null,
  ): { session: ConversationSession; state: ConversationLifecycleState } {
    const ts = new Date().toISOString()
    if (kind === 'pause') {
      return {
        state: 'paused',
        session: {
          ...session,
          state: 'paused',
          pausedGoalLabel: session.goal?.label ?? session.pausedGoalLabel,
          updatedAt: ts,
        },
      }
    }
    if (kind === 'resume') {
      return {
        state: 'resumed',
        session: {
          ...session,
          state: 'resumed',
          updatedAt: ts,
        },
      }
    }
    if (kind === 'topic_switch') {
      const previous = session.goal?.label ?? session.pausedGoalLabel
      const topicStack = previous
        ? [...session.topicStack, previous].slice(-5)
        : [...session.topicStack]
      return {
        state: 'topic_switch',
        session: {
          ...session,
          state: 'topic_switch',
          previousGoalLabel: previous,
          topicStack,
          pausedGoalLabel: previous,
          updatedAt: ts,
        },
      }
    }
    if (kind === 'return_previous') {
      const previous = session.previousGoalLabel ?? session.topicStack.at(-1) ?? null
      return {
        state: 'resumed',
        session: {
          ...session,
          state: 'resumed',
          previousGoalLabel: newGoalLabel ?? session.goal?.label ?? null,
          pausedGoalLabel: previous,
          updatedAt: ts,
        },
      }
    }
    return { session, state: session.state }
  }
}

export function createInterruptHandler(): InterruptHandler {
  return new InterruptHandler()
}
