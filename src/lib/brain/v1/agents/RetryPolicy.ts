/**
 * Sprint 83 — Agent retry / fallback / recovery helpers.
 */

import {
  DEFAULT_AGENT_RETRY_POLICY,
  type BrainAgentDefinition,
  type BrainAgentFailureKind,
  type BrainAgentRetryPolicy,
} from './types'

export function resolveRetryPolicy(agent: BrainAgentDefinition): BrainAgentRetryPolicy {
  return {
    ...DEFAULT_AGENT_RETRY_POLICY,
    ...agent.retryPolicy,
    retryOn: agent.retryPolicy?.retryOn ?? DEFAULT_AGENT_RETRY_POLICY.retryOn,
  }
}

export function shouldRetry(
  policy: BrainAgentRetryPolicy,
  kind: BrainAgentFailureKind,
  attempt: number,
): boolean {
  if (attempt >= policy.maxAttempts) return false
  return policy.retryOn.includes(kind)
}

export async function withTimeout<T>(
  work: () => Promise<T> | T,
  timeoutMs: number,
): Promise<T> {
  if (timeoutMs <= 0) return work()

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(new Error('timeout'), { failureKind: 'timeout' as const }))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function classifyError(err: unknown): BrainAgentFailureKind {
  if (err && typeof err === 'object') {
    const e = err as { failureKind?: BrainAgentFailureKind; message?: string }
    if (e.failureKind) return e.failureKind
    const msg = (e.message ?? '').toLowerCase()
    if (msg.includes('timeout')) return 'timeout'
    if (msg.includes('unavailable')) return 'provider_unavailable'
    if (msg.includes('temporary')) return 'temporary_failure'
  }
  return 'unknown'
}

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}
