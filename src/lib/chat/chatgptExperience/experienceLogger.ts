/**
 * Sprint 44 — structured experience logging with timing metrics.
 */

import { getCorrelationId } from '../../ops/logging/correlation'
import { logChat } from '../chatLogger'
import type { ChatGptExperienceState } from './types'

export type ExperienceLogStage =
  | 'microphone'
  | 'stt'
  | 'intent'
  | 'planning'
  | 'tool_routing'
  | 'tool_execution'
  | 'llm_request'
  | 'streaming'
  | 'tts'
  | 'persistence'
  | 'memory'
  | 'error'
  | 'state'

export function logExperience(input: {
  stage: ExperienceLogStage
  event: string
  durationMs?: number
  state?: ChatGptExperienceState
  meta?: Record<string, unknown>
  level?: 'debug' | 'warn' | 'error'
}): void {
  const level = input.level ?? (input.stage === 'error' ? 'error' : 'debug')
  logChat(level, `chatgpt.${input.stage}`, input.event, {
    requestId: getCorrelationId(),
    durationMs: input.durationMs,
    state: input.state,
    at: new Date().toISOString(),
    ...input.meta,
  })
}

export function createTimingTracker(): {
  mark: (key: string) => void
  measure: (key: string) => number
  snapshot: () => Record<string, number>
} {
  const marks = new Map<string, number>()
  const measures: Record<string, number> = {}
  return {
    mark(key) {
      marks.set(key, Date.now())
    },
    measure(key) {
      const start = marks.get(key) ?? Date.now()
      const ms = Math.max(0, Date.now() - start)
      measures[key] = ms
      return ms
    },
    snapshot: () => ({ ...measures }),
  }
}
