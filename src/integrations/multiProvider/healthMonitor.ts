/**
 * Provider Health Monitor — Connected, Latency, Errors, Fallback count, Quota status.
 */

import type {
  DomainHealthSummary,
  MultiProviderHealthReport,
  MultiProviderId,
  ProviderAttemptRecord,
  ProviderHealthSnapshot,
  QuotaStatus,
  TravelDomain,
} from './types'
import { PROVIDER_CATALOG } from './types'
import { getDomainChain } from './config'

interface MutableStats {
  connected: boolean
  latencyMs: number | null
  errors: number
  fallbackCount: number
  quotaStatus: QuotaStatus
  lastError: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  prepared: boolean
  mocked: boolean
}

function key(domain: TravelDomain, providerId: MultiProviderId): string {
  return `${domain}:${providerId}`
}

function catalogMeta(providerId: MultiProviderId) {
  return PROVIDER_CATALOG.find((p) => p.id === providerId)
}

export class ProviderHealthMonitor {
  private readonly stats = new Map<string, MutableStats>()
  private readonly attempts: ProviderAttemptRecord[] = []
  private activeByDomain = new Map<TravelDomain, MultiProviderId>()

  ensure(domain: TravelDomain, providerId: MultiProviderId): MutableStats {
    const k = key(domain, providerId)
    let entry = this.stats.get(k)
    if (!entry) {
      const meta = catalogMeta(providerId)
      entry = {
        connected: false,
        latencyMs: null,
        errors: 0,
        fallbackCount: 0,
        quotaStatus: 'unknown',
        lastError: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        prepared: meta?.prepared ?? false,
        mocked: meta?.mocked ?? providerId === 'mock',
      }
      this.stats.set(k, entry)
    }
    return entry
  }

  recordAttempt(attempt: ProviderAttemptRecord, quotaStatus?: QuotaStatus): void {
    this.attempts.push(attempt)
    if (this.attempts.length > 500) this.attempts.shift()

    const entry = this.ensure(attempt.domain, attempt.providerId)
    entry.latencyMs = attempt.latencyMs

    if (attempt.success) {
      entry.connected = true
      entry.lastSuccessAt = attempt.at
      entry.lastError = null
      entry.quotaStatus = quotaStatus ?? 'ok'
      this.activeByDomain.set(attempt.domain, attempt.providerId)
    } else {
      entry.errors += 1
      entry.lastFailureAt = attempt.at
      entry.lastError = attempt.errorCode ?? attempt.reason ?? 'error'
      if (attempt.reason === 'quota') entry.quotaStatus = 'limited'
      else if (quotaStatus) entry.quotaStatus = quotaStatus
      if (attempt.reason && attempt.reason !== 'not_configured') {
        entry.fallbackCount += 1
      }
    }
  }

  recordDomainFallback(domain: TravelDomain): void {
    const active = this.activeByDomain.get(domain)
    if (active) {
      this.ensure(domain, active).fallbackCount += 1
    }
  }

  snapshot(domain: TravelDomain, providerId: MultiProviderId): ProviderHealthSnapshot {
    const entry = this.ensure(domain, providerId)
    return {
      providerId,
      domain,
      connected: entry.connected,
      latencyMs: entry.latencyMs,
      errors: entry.errors,
      fallbackCount: entry.fallbackCount,
      quotaStatus: entry.quotaStatus,
      lastError: entry.lastError,
      lastSuccessAt: entry.lastSuccessAt,
      lastFailureAt: entry.lastFailureAt,
      prepared: entry.prepared,
      mocked: entry.mocked,
    }
  }

  domainSummary(domain: TravelDomain): DomainHealthSummary {
    const chain = getDomainChain(domain)
    const providers = chain.map((id) => this.snapshot(domain, id))
    const fallbackCount = providers.reduce((sum, p) => sum + p.fallbackCount, 0)
    const activeProviderId = this.activeByDomain.get(domain) ?? null

    return {
      domain,
      chain,
      activeProviderId,
      connected: providers.some((p) => p.connected),
      fallbackCount,
      providers,
    }
  }

  report(domains: TravelDomain[] = ['flight', 'hotel', 'cars', 'activities', 'transfers']): MultiProviderHealthReport {
    const summaries = domains.map((d) => this.domainSummary(d))
    return {
      checkedAt: new Date().toISOString(),
      domains: summaries,
      totals: {
        connected: summaries.filter((d) => d.connected).length,
        errors: summaries.reduce(
          (sum, d) => sum + d.providers.reduce((s, p) => s + p.errors, 0),
          0,
        ),
        fallbackCount: summaries.reduce((sum, d) => sum + d.fallbackCount, 0),
      },
    }
  }

  recentAttempts(limit = 50): ProviderAttemptRecord[] {
    return this.attempts.slice(-limit)
  }

  reset(): void {
    this.stats.clear()
    this.attempts.length = 0
    this.activeByDomain.clear()
  }
}

let sharedMonitor: ProviderHealthMonitor | null = null

export function getProviderHealthMonitor(): ProviderHealthMonitor {
  if (!sharedMonitor) sharedMonitor = new ProviderHealthMonitor()
  return sharedMonitor
}

export function resetProviderHealthMonitor(): void {
  sharedMonitor?.reset()
  sharedMonitor = null
}
