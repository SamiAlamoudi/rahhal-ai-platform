/**
 * Sprint 16 — FailureInjector (simulated faults; no engine rewrites).
 */

import type { FailureInjectionConfig, FailureInjectionKind } from './types'

export interface InjectionDecision {
  injected: boolean
  kind: FailureInjectionKind | null
  latencyMs: number
  shouldFail: boolean
  partial: boolean
}

export class FailureInjector {
  private readonly configs: FailureInjectionConfig[]
  private failureCount = 0
  private memoryPressure = false
  private cpuSpike = false

  constructor(configs: FailureInjectionConfig[] = []) {
    this.configs = configs.map((c) => ({ ...c }))
  }

  setMemoryPressure(on: boolean): void {
    this.memoryPressure = on
  }

  setCpuSpike(on: boolean): void {
    this.cpuSpike = on
  }

  getFailureCount(): number {
    return this.failureCount
  }

  decide(rng: () => number = Math.random): InjectionDecision {
    if (this.memoryPressure) {
      return {
        injected: true,
        kind: 'memory_pressure',
        latencyMs: 5,
        shouldFail: false,
        partial: true,
      }
    }
    if (this.cpuSpike) {
      return {
        injected: true,
        kind: 'cpu_spike',
        latencyMs: 8,
        shouldFail: false,
        partial: false,
      }
    }

    for (const cfg of this.configs) {
      if (rng() > cfg.probability) continue
      this.failureCount += 1
      switch (cfg.kind) {
        case 'provider_timeout':
          return {
            injected: true,
            kind: cfg.kind,
            latencyMs: cfg.latencyMs ?? 50,
            shouldFail: true,
            partial: false,
          }
        case 'provider_unavailable':
          return {
            injected: true,
            kind: cfg.kind,
            latencyMs: cfg.latencyMs ?? 1,
            shouldFail: true,
            partial: false,
          }
        case 'network_latency':
        case 'slow_response':
          return {
            injected: true,
            kind: cfg.kind,
            latencyMs: cfg.latencyMs ?? 25,
            shouldFail: false,
            partial: false,
          }
        case 'partial_failure':
          return {
            injected: true,
            kind: cfg.kind,
            latencyMs: cfg.latencyMs ?? 10,
            shouldFail: true,
            partial: true,
          }
        case 'memory_pressure':
          this.memoryPressure = true
          return {
            injected: true,
            kind: cfg.kind,
            latencyMs: 5,
            shouldFail: false,
            partial: true,
          }
        case 'cpu_spike':
          this.cpuSpike = true
          return {
            injected: true,
            kind: cfg.kind,
            latencyMs: 8,
            shouldFail: false,
            partial: false,
          }
        default:
          break
      }
    }

    return {
      injected: false,
      kind: null,
      latencyMs: 0,
      shouldFail: false,
      partial: false,
    }
  }

  reset(): void {
    this.failureCount = 0
    this.memoryPressure = false
    this.cpuSpike = false
  }
}

export function createFailureInjector(configs?: FailureInjectionConfig[]): FailureInjector {
  return new FailureInjector(configs)
}
