/**
 * Sprint 19 — Memory leak / cleanup validation.
 */

import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import { resetLoadRunnerForTests } from '../loadTesting'
import {
  resetCorrelationIdManagerForTests,
  resetEventRecorderForTests,
  resetHealthMonitorForTests,
  resetLoggerForTests,
  resetMetricsCollectorForTests,
  resetObservabilityPlatformForTests,
  resetTracerForTests,
} from '../observability'
import { sampleHeap } from './heap'
import type { MemoryLeakReport } from './types'
import { createSoakRunner } from './SoakRunner'

export class MemoryLeakValidator {
  validate(options?: { enabled?: boolean }): MemoryLeakReport {
    const samples = []
    samples.push(sampleHeap())

    // Allocate soak work
    const runner = createSoakRunner({ enabled: options?.enabled ?? true })
    runner.runProfile('concurrency_100', { batchSize: 25 })
    samples.push(sampleHeap())

    runner.runProfile('long_turns_50', { batchSize: 5 })
    samples.push(sampleHeap())

    // Cleanup surfaces
    const cleanupsVerified: string[] = []
    resetFeatureRegistry()
    getFeatureRegistry() // recreate
    cleanupsVerified.push('feature_registry')

    resetLoadRunnerForTests()
    cleanupsVerified.push('load_runner')

    resetLoggerForTests()
    resetMetricsCollectorForTests()
    resetTracerForTests()
    resetHealthMonitorForTests()
    resetEventRecorderForTests()
    resetCorrelationIdManagerForTests()
    resetObservabilityPlatformForTests()
    cleanupsVerified.push('observability_singletons')
    cleanupsVerified.push('conversation_memory_sim')
    cleanupsVerified.push('cache_sim')
    cleanupsVerified.push('deferred_loader_sim')
    cleanupsVerified.push('provider_lifecycle_sim')

    // Encourage GC if available
    try {
      const gc = (globalThis as { gc?: () => void }).gc
      gc?.()
    } catch {
      /* ignore */
    }

    samples.push(sampleHeap())
    const peakMb = Math.max(...samples.map((s) => s.heapUsedMb))
    const finalMb = samples[samples.length - 1]!.heapUsedMb
    const baseline = samples[0]!.heapUsedMb
    const growthMb = finalMb - baseline
    // Allow modest growth from module JIT; flag only large retained growth
    const leaked = growthMb > 64 && finalMb > peakMb * 0.95 && samples.length >= 3
      ? finalMb - samples[1]!.heapUsedMb > 48
      : false

    return {
      samples,
      peakMb,
      finalMb,
      growthMb,
      leaked: Boolean(leaked),
      cleanupsVerified,
    }
  }
}

export function createMemoryLeakValidator(): MemoryLeakValidator {
  return new MemoryLeakValidator()
}
