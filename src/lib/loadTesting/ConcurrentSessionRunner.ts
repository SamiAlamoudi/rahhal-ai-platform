/**
 * Sprint 16 — ConcurrentSessionRunner (batched concurrent session execution).
 */

import { createFailureInjector, type FailureInjector } from './FailureInjector'
import { ScenarioExecutor } from './ScenarioExecutor'
import type { FailureInjectionConfig, SessionResult, StressProfile } from './types'

export interface ConcurrentRunOptions {
  profile: StressProfile
  failures?: FailureInjectionConfig[]
  /** Shared injector (optional). */
  injector?: FailureInjector
  batchSize?: number
  rng?: () => number
}

export class ConcurrentSessionRunner {
  private readonly executor = new ScenarioExecutor()

  /**
   * Runs N sessions in batches to approximate concurrency without blocking the event loop forever.
   * Each batch executes sessions sequentially in-process (deterministic CI); concurrency is modeled
   * by session count + aggregated throughput.
   */
  run(options: ConcurrentRunOptions): SessionResult[] {
    const injector = options.injector ?? createFailureInjector(options.failures ?? [])
    const batchSize = Math.max(1, options.batchSize ?? 50)
    const results: SessionResult[] = []
    const total = options.profile.concurrentUsers

    for (let offset = 0; offset < total; offset += batchSize) {
      const end = Math.min(total, offset + batchSize)
      for (let i = offset; i < end; i++) {
        results.push(
          this.executor.executeSession(options.profile, injector, {
            sessionIndex: i,
            rng: options.rng,
          }),
        )
      }
    }

    return results
  }
}

export function createConcurrentSessionRunner(): ConcurrentSessionRunner {
  return new ConcurrentSessionRunner()
}
