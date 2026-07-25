/**
 * Sprint 16 — LoadRunner (orchestrates profiles, concurrency, aggregation).
 */

import { ConcurrentSessionRunner } from './ConcurrentSessionRunner'
import { createFailureInjector } from './FailureInjector'
import { isLoadTestingPlatformEnabled } from './feature'
import { ResultAggregator } from './ResultAggregator'
import { getStressProfile, scaleProfileForTests } from './StressProfile'
import type {
  FailureInjectionConfig,
  LoadRunReport,
  ResilienceValidation,
  StressScenarioId,
} from './types'

export interface LoadRunOptions {
  scenarioId: StressScenarioId
  enabled?: boolean
  /** Scale down for unit tests / CI (default true in vitest). */
  scaleForTests?: boolean
  maxUsers?: number
  failures?: FailureInjectionConfig[]
  batchSize?: number
  rng?: () => number
}

export class LoadRunner {
  private readonly concurrent = new ConcurrentSessionRunner()
  private readonly aggregator = new ResultAggregator()
  private lastReport: LoadRunReport | null = null

  isEnabled(options?: { enabled?: boolean }): boolean {
    return isLoadTestingPlatformEnabled({ enabled: options?.enabled })
  }

  run(options: LoadRunOptions): LoadRunReport | null {
    if (!this.isEnabled({ enabled: options.enabled })) return null

    let profile = getStressProfile(options.scenarioId)
    const scale = options.scaleForTests ?? isVitest()
    if (scale) {
      profile = scaleProfileForTests(profile, options.maxUsers ?? 20)
    }

    const injector = createFailureInjector(options.failures ?? [])
    const startedAt = new Date().toISOString()
    const sessions = this.concurrent.run({
      profile,
      injector,
      batchSize: options.batchSize,
      rng: options.rng,
    })
    const endedAt = new Date().toISOString()

    const report = this.aggregator.buildReport({
      profile,
      sessions,
      startedAt,
      endedAt,
    })
    this.lastReport = report
    return report
  }

  validateResilience(report?: LoadRunReport | null): ResilienceValidation | null {
    const r = report ?? this.lastReport
    if (!r) return null
    return this.aggregator.validateResilience(r)
  }

  getLastReport(): LoadRunReport | null {
    return this.lastReport
  }
}

function isVitest(): boolean {
  try {
    return Boolean((globalThis as { process?: { env?: { VITEST?: string } } }).process?.env?.VITEST)
  } catch {
    return false
  }
}

export function createLoadRunner(): LoadRunner {
  return new LoadRunner()
}

let shared: LoadRunner | null = null

export function getLoadRunner(): LoadRunner {
  if (!shared) shared = new LoadRunner()
  return shared
}

export function resetLoadRunnerForTests(): void {
  shared = null
}
