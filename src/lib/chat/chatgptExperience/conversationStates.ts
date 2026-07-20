/**
 * Sprint 44 — conversation experience state machine.
 */

import type { ChatGptExperienceState } from './types'
import { logExperience } from './experienceLogger'

const TRANSITIONS: Record<ChatGptExperienceState, ChatGptExperienceState[]> = {
  idle: ['listening', 'understanding', 'thinking'],
  listening: ['understanding', 'thinking', 'idle', 'error'],
  understanding: ['thinking', 'using_tools', 'generating', 'error'],
  thinking: ['using_tools', 'searching', 'generating', 'responding', 'error'],
  using_tools: ['searching', 'generating', 'responding', 'error'],
  searching: ['generating', 'responding', 'error'],
  generating: ['responding', 'speaking', 'done', 'error'],
  responding: ['speaking', 'done', 'error'],
  speaking: ['listening', 'done', 'idle', 'error'],
  done: ['idle', 'listening', 'understanding'],
  error: ['idle', 'listening', 'understanding'],
}

export type ExperienceStateMachine = {
  get: () => ChatGptExperienceState
  history: () => ChatGptExperienceState[]
  transition: (next: ChatGptExperienceState) => ChatGptExperienceState
  reset: () => void
}

export function createExperienceStateMachine(
  initial: ChatGptExperienceState = 'idle',
): ExperienceStateMachine {
  let current = initial
  const seen: ChatGptExperienceState[] = [initial]

  return {
    get: () => current,
    history: () => [...seen],
    transition(next) {
      const allowed = TRANSITIONS[current] ?? ['idle']
      if (!allowed.includes(next) && next !== current) {
        // Soft allow for UX smoothness — log but still apply.
        logExperience({
          stage: 'state',
          event: 'soft_transition',
          state: next,
          meta: { from: current, to: next },
          level: 'warn',
        })
      }
      current = next
      seen.push(next)
      logExperience({ stage: 'state', event: 'transition', state: next })
      return current
    },
    reset() {
      current = 'idle'
      seen.length = 0
      seen.push('idle')
    },
  }
}
