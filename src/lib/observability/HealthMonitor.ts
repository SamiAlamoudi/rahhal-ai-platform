/**
 * Sprint 15 — HealthMonitor (app / provider / db / cache / resources / queue).
 */

import { isObservabilityPlatformEnabled } from './feature'
import { getMetricsCollector } from './MetricsCollector'
import type { HealthCheckResult, HealthReport, HealthStatus } from './types'

function worst(a: HealthStatus, b: HealthStatus): HealthStatus {
  const rank: Record<HealthStatus, number> = {
    healthy: 0,
    unknown: 1,
    degraded: 2,
    unhealthy: 3,
  }
  return rank[a] >= rank[b] ? a : b
}

export class HealthMonitor {
  private readonly enabledOverride: boolean | undefined
  private providerStatuses = new Map<string, HealthStatus>()
  private lastRestartAt: string | null = null
  private memoryPressure = false

  constructor(options?: { enabled?: boolean }) {
    this.enabledOverride = options?.enabled
  }

  isEnabled(): boolean {
    return isObservabilityPlatformEnabled({ enabled: this.enabledOverride })
  }

  setProviderStatus(providerId: string, status: HealthStatus): void {
    this.providerStatuses.set(providerId, status)
  }

  markRestart(): void {
    this.lastRestartAt = new Date().toISOString()
  }

  setMemoryPressure(pressure: boolean): void {
    this.memoryPressure = pressure
  }

  private check(
    name: string,
    status: HealthStatus,
    detail: string,
    latencyMs: number | null = null,
    metrics?: Record<string, number>,
  ): HealthCheckResult {
    return {
      name,
      status,
      detail,
      checkedAt: new Date().toISOString(),
      latencyMs,
      metrics,
    }
  }

  checkApplication(): HealthCheckResult {
    return this.check('application', 'healthy', 'Application process responsive')
  }

  checkProviders(): HealthCheckResult {
    if (this.providerStatuses.size === 0) {
      return this.check('providers', 'healthy', 'No live providers registered (mock defaults)')
    }
    let status: HealthStatus = 'healthy'
    for (const s of this.providerStatuses.values()) status = worst(status, s)
    return this.check(
      'providers',
      status,
      `Tracked providers: ${this.providerStatuses.size}`,
      null,
      { tracked: this.providerStatuses.size },
    )
  }

  checkDatabase(): HealthCheckResult {
    // Additive probe only — does not open DB connections or modify Supabase client.
    return this.check('database', 'unknown', 'Database probe deferred (Supabase client not invoked)')
  }

  checkCache(): HealthCheckResult {
    const metrics = getMetricsCollector().snapshot()
    const ratio = metrics.cacheHitRatio
    const status: HealthStatus = ratio >= 0.2 || metrics.cacheHits + metrics.cacheMisses === 0
      ? 'healthy'
      : 'degraded'
    return this.check('cache', status, `Cache hit ratio ${(ratio * 100).toFixed(1)}%`, null, {
      hitRatio: ratio,
    })
  }

  checkMemory(): HealthCheckResult {
    let used = 0
    let limit = 0
    try {
      const perf = (globalThis as { performance?: { memory?: { usedJSHeapSize?: number; jsHeapSizeLimit?: number } } }).performance
      used = perf?.memory?.usedJSHeapSize ?? 0
      limit = perf?.memory?.jsHeapSizeLimit ?? 0
    } catch {
      /* ignore */
    }
    if (this.memoryPressure) {
      return this.check('memory', 'degraded', 'Memory pressure flag set', null, { used, limit })
    }
    if (limit > 0 && used / limit > 0.9) {
      return this.check('memory', 'degraded', 'JS heap above 90%', null, { used, limit })
    }
    return this.check('memory', 'healthy', 'Memory within budget', null, { used, limit })
  }

  checkCpu(): HealthCheckResult {
    // Browser/Node SPA — coarse signal only
    return this.check('cpu', 'healthy', 'CPU probe not instrumented; assumed healthy')
  }

  checkDisk(): HealthCheckResult {
    return this.check('disk', 'unknown', 'Disk probe not available in SPA runtime')
  }

  checkQueue(): HealthCheckResult {
    return this.check('queue', 'healthy', 'No durable queue configured; in-memory OK')
  }

  report(): HealthReport {
    const checks = [
      this.checkApplication(),
      this.checkProviders(),
      this.checkDatabase(),
      this.checkCache(),
      this.checkMemory(),
      this.checkCpu(),
      this.checkDisk(),
      this.checkQueue(),
    ]
    let overall: HealthStatus = 'healthy'
    for (const c of checks) overall = worst(overall, c.status)
    return {
      overall,
      checkedAt: new Date().toISOString(),
      checks,
    }
  }

  /** HTTP-shaped payloads for health endpoints (no framework coupling). */
  endpointPayloads(): Record<string, HealthReport | HealthCheckResult> {
    const full = this.report()
    return {
      '/api/health': full,
      '/api/health/application': this.checkApplication(),
      '/api/health/providers': this.checkProviders(),
      '/api/health/database': this.checkDatabase(),
      '/api/health/cache': this.checkCache(),
      '/api/health/memory': this.checkMemory(),
      '/api/health/cpu': this.checkCpu(),
      '/api/health/disk': this.checkDisk(),
      '/api/health/queue': this.checkQueue(),
    }
  }

  getLastRestartAt(): string | null {
    return this.lastRestartAt
  }

  reset(): void {
    this.providerStatuses.clear()
    this.lastRestartAt = null
    this.memoryPressure = false
  }
}

let shared: HealthMonitor | null = null

export function getHealthMonitor(options?: { enabled?: boolean }): HealthMonitor {
  if (options) return new HealthMonitor(options)
  if (!shared) shared = new HealthMonitor()
  return shared
}

export function resetHealthMonitorForTests(): void {
  shared?.reset()
  shared = null
}

export function createHealthMonitor(options?: { enabled?: boolean }): HealthMonitor {
  return new HealthMonitor(options)
}
