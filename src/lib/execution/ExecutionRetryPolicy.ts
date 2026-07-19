/**
 * Sprint 33 — Retry policy for booking execution pipeline.
 */

export interface ExecutionRetryPolicyConfig {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
}

export const DEFAULT_EXECUTION_RETRY_POLICY: ExecutionRetryPolicyConfig = {
  maxAttempts: 2,
  baseDelayMs: 20,
  maxDelayMs: 200,
}

export class ExecutionRetryPolicy {
  readonly config: ExecutionRetryPolicyConfig

  constructor(config: Partial<ExecutionRetryPolicyConfig> = {}) {
    this.config = { ...DEFAULT_EXECUTION_RETRY_POLICY, ...config }
  }

  shouldRetry(attempt: number, retryable: boolean): boolean {
    return retryable && attempt < this.config.maxAttempts
  }

  delayMs(attempt: number): number {
    const exp = this.config.baseDelayMs * 2 ** Math.max(0, attempt - 1)
    return Math.min(this.config.maxDelayMs, exp)
  }
}
