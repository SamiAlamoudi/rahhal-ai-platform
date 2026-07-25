/**
 * Sprint 16 — ResilienceSimulator (retry / circuit breaker / fallback).
 * Standalone simulation — does not modify Provider Runtime circuit breakers.
 */

import type { FailureInjector } from './FailureInjector'
import type { LoadStepResult, SessionOutcome } from './types'

export interface ResilienceSimulatorOptions {
  maxRetries?: number
  openAfterFailures?: number
  halfOpenAfterMs?: number
  baseLatencyMs?: number
}

export class ResilienceSimulator {
  private readonly maxRetries: number
  private readonly openAfterFailures: number
  private consecutiveFailures = 0
  private circuitOpen = false
  private openedAt: number | null = null
  private readonly halfOpenAfterMs: number
  private readonly baseLatencyMs: number
  private retryRecoveries = 0
  private fallbacks = 0
  private degradations = 0

  constructor(options: ResilienceSimulatorOptions = {}) {
    this.maxRetries = options.maxRetries ?? 2
    this.openAfterFailures = options.openAfterFailures ?? 5
    this.halfOpenAfterMs = options.halfOpenAfterMs ?? 50
    this.baseLatencyMs = options.baseLatencyMs ?? 2
  }

  isCircuitOpen(now = Date.now()): boolean {
    if (!this.circuitOpen) return false
    if (this.openedAt != null && now - this.openedAt >= this.halfOpenAfterMs) {
      // half-open probe window
      return false
    }
    return true
  }

  private maybeOpenCircuit(): void {
    if (this.consecutiveFailures >= this.openAfterFailures) {
      this.circuitOpen = true
      this.openedAt = Date.now()
    }
  }

  private closeCircuit(): void {
    this.circuitOpen = false
    this.openedAt = null
    this.consecutiveFailures = 0
  }

  /**
   * Execute one simulated provider/conversation step with resilience policies.
   * Pure CPU simulation (no network) — timing is synthetic for aggregation.
   */
  executeStep(
    name: string,
    injector: FailureInjector,
    rng: () => number = Math.random,
  ): LoadStepResult {
    const started = Date.now()
    let retried = false
    let fallbackUsed = false
    let failureInjected: LoadStepResult['failureInjected'] = null
    let outcome: SessionOutcome = 'ok'
    let durationMs = this.baseLatencyMs

    if (this.isCircuitOpen()) {
      this.fallbacks += 1
      this.degradations += 1
      return {
        name,
        durationMs: this.baseLatencyMs,
        outcome: 'circuit_open',
        retried: false,
        fallbackUsed: true,
        circuitOpen: true,
        failureInjected: null,
      }
    }

    let attempt = 0
    let succeeded = false
    while (attempt <= this.maxRetries && !succeeded) {
      if (attempt > 0) retried = true
      const decision = injector.decide(rng)
      failureInjected = decision.kind
      durationMs += this.baseLatencyMs + decision.latencyMs

      if (!decision.shouldFail) {
        succeeded = true
        this.closeCircuit()
        if (decision.partial || decision.kind === 'memory_pressure' || decision.kind === 'cpu_spike') {
          outcome = 'degraded'
          this.degradations += 1
        } else if (retried) {
          outcome = 'retry_recovered'
          this.retryRecoveries += 1
        } else {
          outcome = 'ok'
        }
        break
      }

      this.consecutiveFailures += 1
      this.maybeOpenCircuit()
      attempt += 1
    }

    if (!succeeded) {
      // Fallback path — conversation continues in degraded mode
      fallbackUsed = true
      this.fallbacks += 1
      this.degradations += 1
      outcome = this.circuitOpen ? 'circuit_open' : 'fallback'
      durationMs += this.baseLatencyMs
    }

    // Ensure non-zero wall clock for recovery metrics in fast envs
    const wall = Date.now() - started
    return {
      name,
      durationMs: Math.max(durationMs, wall),
      outcome,
      retried,
      fallbackUsed,
      circuitOpen: this.circuitOpen,
      failureInjected,
    }
  }

  stats() {
    return {
      retryRecoveries: this.retryRecoveries,
      fallbacks: this.fallbacks,
      degradations: this.degradations,
      circuitOpen: this.circuitOpen,
      consecutiveFailures: this.consecutiveFailures,
    }
  }

  reset(): void {
    this.consecutiveFailures = 0
    this.circuitOpen = false
    this.openedAt = null
    this.retryRecoveries = 0
    this.fallbacks = 0
    this.degradations = 0
  }
}

export function createResilienceSimulator(options?: ResilienceSimulatorOptions): ResilienceSimulator {
  return new ResilienceSimulator(options)
}
