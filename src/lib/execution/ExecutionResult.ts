/**
 * Sprint 33 — ExecutionResult helper.
 */

import type { BookingSessionRecord, ExecutionEvent, ExecutionResult } from './ExecutionTypes'
import { buildExecutionSummary } from './ExecutionSummary'

export function buildExecutionResult(
  session: BookingSessionRecord,
  events: ExecutionEvent[],
): ExecutionResult {
  return {
    session,
    summary: buildExecutionSummary(session),
    events: [...events],
  }
}

export type { ExecutionResult }
