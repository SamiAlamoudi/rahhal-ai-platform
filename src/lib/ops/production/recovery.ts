/**
 * Sprint 65 — Error recovery strategies (composes existing budgets / DLQ / booking resume).
 */

import { canRetry, consumeRetry, createRetryBudget, type RetryBudget } from '../reliability/budgets'
import { getDeadLetterQueue } from '../reliability/deadLetter'
import { shouldGracefullyDegrade } from '../reliability/gracefulShutdown'
import type { RecoveryAction, RecoveryPlan, RecoveryStrategyId } from './types'

export type RecoveryScenario =
  | 'provider_unavailable'
  | 'provider_degraded'
  | 'provider_timeout'
  | 'partial_booking_failure'
  | 'booking_interrupted'
  | 'document_missing'
  | 'document_corrupt'
  | 'trip_inconsistent'
  | 'rate_limited'
  | 'unknown_error'

function action(strategy: RecoveryStrategyId, applied: boolean, detail: string): RecoveryAction {
  return { strategy, applied, detail }
}

export function planRecovery(input: {
  scenario: RecoveryScenario
  retryBudget?: RetryBudget
  circuitOpen?: boolean
  failureRate?: number
}): RecoveryPlan {
  const budget = input.retryBudget ?? createRetryBudget(3)
  const actions: RecoveryAction[] = []

  switch (input.scenario) {
    case 'provider_unavailable':
      actions.push(action('circuit_open_fallback', true, 'Route to mock/priority_fallback provider'))
      actions.push(action('graceful_degrade', true, 'Continue search/booking with degraded results'))
      break
    case 'provider_degraded':
      actions.push(action('provider_degraded_cache', true, 'Prefer cached offers when TTL valid'))
      actions.push(
        action(
          'retry_with_budget',
          canRetry(budget),
          canRetry(budget) ? 'Retry with jittered backoff' : 'Retry budget exhausted',
        ),
      )
      break
    case 'provider_timeout':
      actions.push(
        action(
          'retry_with_budget',
          canRetry(budget),
          'Timeout — retry if budget remains',
        ),
      )
      if (!canRetry(budget)) {
        actions.push(action('dead_letter_enqueue', true, 'Enqueue timeout for ops review'))
      }
      break
    case 'partial_booking_failure':
      actions.push(action('partial_booking_rollback', true, 'TransactionManager rollback of successes'))
      actions.push(action('booking_session_resume', true, 'Persist cursor for resume when flag ON'))
      break
    case 'booking_interrupted':
      actions.push(action('booking_session_resume', true, 'Recover session via booking resume'))
      break
    case 'document_missing':
    case 'document_corrupt':
      actions.push(action('document_regenerate', true, 'Regenerate from booking snapshot / provider retrieve'))
      break
    case 'trip_inconsistent':
      actions.push(action('trip_repair', true, 'Re-aggregate status + append timeline; never wipe history'))
      break
    case 'rate_limited':
      actions.push(action('retry_with_budget', canRetry(budget), 'Backoff on rate limit'))
      actions.push(action('graceful_degrade', true, 'Serve cached/mock while limited'))
      break
    default:
      actions.push(action(
        'graceful_degrade',
        shouldGracefullyDegrade({
          providerFailures: Math.round((input.failureRate ?? 0.5) * 10),
          circuitOpen: Boolean(input.circuitOpen),
          envInvalid: false,
        }),
        'Generic degrade',
      ))
      actions.push(action('dead_letter_enqueue', true, 'Capture unknown failure'))
  }

  if (input.circuitOpen) {
    actions.unshift(action('circuit_open_fallback', true, 'Circuit open — skip live provider'))
  }

  const recoverable = actions.some((a) => a.applied)
  return { scenario: input.scenario, actions, recoverable }
}

/** Apply retry budget consumption when a retry is chosen. */
export function applyRetry(budget: RetryBudget): RetryBudget {
  if (canRetry(budget)) consumeRetry(budget)
  return budget
}

export function enqueueRecoveryFailure(input: {
  scenario: RecoveryScenario
  detail?: string
  payload?: Record<string, unknown>
}): void {
  getDeadLetterQueue().push({
    domain: 'production_recovery',
    operation: input.scenario,
    error: input.detail ?? input.scenario,
    payload: input.payload ?? {},
    attempts: 1,
  })
}
