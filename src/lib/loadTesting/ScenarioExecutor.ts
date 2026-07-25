/**
 * Sprint 16 — ScenarioExecutor (single session simulation).
 * Does not invoke Conversation Brain / Journey / Planner / Action engines.
 */

import type { FailureInjector } from './FailureInjector'
import { ResilienceSimulator } from './ResilienceSimulator'
import type { SessionOutcome, SessionResult, StressProfile } from './types'

function sessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function worstOutcome(a: SessionOutcome, b: SessionOutcome): SessionOutcome {
  const rank: Record<SessionOutcome, number> = {
    ok: 0,
    retry_recovered: 1,
    degraded: 2,
    fallback: 3,
    circuit_open: 4,
    failed: 5,
  }
  return rank[a] >= rank[b] ? a : b
}

export class ScenarioExecutor {
  executeSession(
    profile: StressProfile,
    injector: FailureInjector,
    options?: { sessionIndex?: number; rng?: () => number },
  ): SessionResult {
    const rng = options?.rng ?? Math.random
    const sim = new ResilienceSimulator({
      maxRetries: 2,
      openAfterFailures: 4,
      halfOpenAfterMs: 20,
      baseLatencyMs: profile.providerCallsPerTurn >= 6 ? 3 : 2,
    })

    const steps = []
    let outcome: SessionOutcome = 'ok'
    let errorCount = 0
    let recoveryDurationMs: number | null = null
    const started = Date.now()

    for (let turn = 0; turn < profile.turnsPerSession; turn++) {
      const conv = sim.executeStep(`conversation.turn.${turn}`, injector, rng)
      steps.push(conv)
      outcome = worstOutcome(outcome, conv.outcome)
      if (conv.outcome === 'failed') errorCount += 1
      if (conv.retried && recoveryDurationMs == null) recoveryDurationMs = conv.durationMs

      for (let p = 0; p < profile.providerCallsPerTurn; p++) {
        const step = sim.executeStep(`provider.call.${turn}.${p}`, injector, rng)
        steps.push(step)
        outcome = worstOutcome(outcome, step.outcome)
        if (step.outcome === 'failed') errorCount += 1
        if (step.retried && recoveryDurationMs == null) recoveryDurationMs = step.durationMs
      }

      if (rng() < profile.bookingOrchestrationWeight) {
        const booking = sim.executeStep(`booking.orchestrate.${turn}`, injector, rng)
        steps.push(booking)
        outcome = worstOutcome(outcome, booking.outcome)
        if (booking.outcome === 'failed') errorCount += 1
      }

      if (profile.thinkTimeMs > 0) {
        const until = Date.now() + profile.thinkTimeMs
        while (Date.now() < until) {
          /* spin */
        }
      }
    }

    if (profile.mixed) {
      for (const name of ['maps.probe', 'flights.probe', 'hotels.probe']) {
        const step = sim.executeStep(name, injector, rng)
        steps.push(step)
        outcome = worstOutcome(outcome, step.outcome)
      }
    }

    const totalDurationMs = Math.max(1, Date.now() - started)
    const conversationContinued = outcome !== 'failed'

    return {
      sessionId: `${sessionId()}_${options?.sessionIndex ?? 0}`,
      scenarioId: profile.id,
      outcome,
      steps,
      totalDurationMs,
      conversationContinued,
      recoveryDurationMs,
      errorCount,
    }
  }
}

export function createScenarioExecutor(): ScenarioExecutor {
  return new ScenarioExecutor()
}
