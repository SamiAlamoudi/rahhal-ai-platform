/**
 * Phase AH — frontend trip-planner flow (API consumption only).
 * Handles plan → poll → cancel without duplicating TripPlannerService logic.
 */

import type { TripPlannerApiClient } from '../../../../integrations/api/tripPlannerApiClient'
import type { TripPlannerRequest, TripPlannerResult, TripPlannerStage } from '../models'

export interface TripPlannerFlowOptions {
  client: TripPlannerApiClient
  request: TripPlannerRequest
  signal?: AbortSignal
  /** Poll interval for async completion (ms). */
  pollIntervalMs?: number
  /** Max poll attempts after initial plan. */
  maxPollAttempts?: number
  onStage?: (stage: TripPlannerStage | 'Polling', message: string) => void
}

export interface TripPlannerFlowSuccess {
  ok: true
  result: TripPlannerResult
  polls: number
}

export interface TripPlannerFlowFailure {
  ok: false
  status: number
  code: string
  error: string
  result: TripPlannerResult | null
  polls: number
}

export type TripPlannerFlowOutcome = TripPlannerFlowSuccess | TripPlannerFlowFailure

function isTerminalResult(result: TripPlannerResult): boolean {
  return (
    result.stage === 'Completed' ||
    result.stage === 'Failed' ||
    result.stage === 'Cancelled' ||
    result.status === 'completed' ||
    result.status === 'failed' ||
    result.status === 'cancelled' ||
    result.status === 'partial'
  )
}

function isRetryableTransport(code: string, status: number): boolean {
  return (
    status === 503 ||
    status === 429 ||
    code === 'handler_host_required' ||
    code === 'timeout' ||
    code === 'rate_limited'
  )
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const t = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function pollForResult(
  options: TripPlannerFlowOptions,
  pollsStart: number,
): Promise<{ result: TripPlannerResult | null; polls: number; cancelled: boolean }> {
  const pollIntervalMs = options.pollIntervalMs ?? 150
  const maxPollAttempts = options.maxPollAttempts ?? 20
  let polls = pollsStart
  let result: TripPlannerResult | null = null

  while (polls < maxPollAttempts) {
    if (options.signal?.aborted) {
      return { result, polls, cancelled: true }
    }
    options.onStage?.('Polling', 'Waiting for planning completion')
    await sleep(pollIntervalMs, options.signal)
    polls += 1
    const got = await options.client.getResult({
      idempotencyKey: options.request.idempotencyKey,
      requestId: options.request.requestId,
      userId: options.request.userId,
    })
    if (got.ok && got.result) {
      result = got.result
      options.onStage?.(
        result.stage,
        result.pipelineTimeline[result.pipelineTimeline.length - 1]?.message ?? result.stage,
      )
      if (isTerminalResult(result)) {
        return { result, polls, cancelled: false }
      }
    }
  }
  return { result, polls, cancelled: false }
}

export async function runTripPlannerFlow(
  options: TripPlannerFlowOptions,
): Promise<TripPlannerFlowOutcome> {
  let polls = 0
  options.onStage?.('Received', 'Submitting plan request')

  if (options.signal?.aborted) {
    return {
      ok: false,
      status: 499,
      code: 'cancelled',
      error: 'cancelled',
      result: null,
      polls,
    }
  }

  const planned = await options.client.plan(options.request)

  if (planned.ok && planned.result) {
    const result = planned.result
    options.onStage?.(
      result.stage,
      result.pipelineTimeline[result.pipelineTimeline.length - 1]?.message ?? result.stage,
    )
    if (isTerminalResult(result)) {
      return { ok: true, result, polls }
    }
    const polled = await pollForResult(options, polls)
    polls = polled.polls
    if (polled.cancelled) {
      return {
        ok: false,
        status: 499,
        code: 'cancelled',
        error: 'cancelled',
        result: polled.result ?? result,
        polls,
      }
    }
    if (polled.result) return { ok: true, result: polled.result, polls }
    return { ok: true, result, polls }
  }

  // Retryable transport (async edge / rate limit): poll getResult
  if (isRetryableTransport(planned.error?.code ?? '', planned.status)) {
    const polled = await pollForResult(options, polls)
    polls = polled.polls
    if (polled.cancelled) {
      return {
        ok: false,
        status: 499,
        code: 'cancelled',
        error: 'cancelled',
        result: polled.result,
        polls,
      }
    }
    if (polled.result) return { ok: true, result: polled.result, polls }
  }

  return {
    ok: false,
    status: planned.status,
    code: planned.error?.code ?? 'api_error',
    error: planned.error?.error ?? 'Trip planner API request failed.',
    result: null,
    polls,
  }
}
