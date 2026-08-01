/**
 * Sprint 85 — Cancellation token for tool execution.
 */

import type { CancellationToken } from './types'

export function createCancellationToken(): CancellationToken {
  const token: CancellationToken = {
    cancelled: false,
    reason: null,
    cancel(reason = 'cancelled') {
      token.cancelled = true
      token.reason = reason
    },
  }
  return token
}
