/**
 * Sprint 44 — error recovery for tool / stream failures.
 */

import { naturalToolFailureMessage } from './naturalLanguage'
import { logExperience } from './experienceLogger'

export async function withToolRetry<T>(input: {
  label: string
  attempts?: number
  locale?: 'ar' | 'en'
  run: () => Promise<T>
}): Promise<{ ok: true; value: T; attempts: number } | { ok: false; message: string; attempts: number; error: unknown }> {
  const max = input.attempts ?? 2
  let lastError: unknown
  for (let i = 1; i <= max; i += 1) {
    try {
      const value = await input.run()
      if (i > 1) {
        logExperience({
          stage: 'tool_execution',
          event: 'retry_succeeded',
          meta: { label: input.label, attempts: i },
        })
      }
      return { ok: true, value, attempts: i }
    } catch (error) {
      lastError = error
      logExperience({
        stage: 'error',
        event: 'tool_attempt_failed',
        level: 'warn',
        meta: {
          label: input.label,
          attempt: i,
          message: error instanceof Error ? error.message : String(error),
        },
      })
    }
  }
  const detail = lastError instanceof Error ? lastError.message : undefined
  return {
    ok: false,
    message: naturalToolFailureMessage(input.locale ?? 'en', detail),
    attempts: max,
    error: lastError,
  }
}
