/**
 * Phase 6 — Runtime ExecutionResult helper
 */

import type { AgentRuntimeResult } from './types'

export function buildRuntimeExecutionResult(
  partial: Omit<AgentRuntimeResult, 'enabled'>,
): AgentRuntimeResult {
  return { enabled: true, ...partial }
}

export const ExecutionResult = {
  build: buildRuntimeExecutionResult,
}
