/**
 * Sprint 104 — provider health monitoring via existing TravelProvider.health().
 */

import type { ProviderHealthResult } from '../providers'
import type { GatewayProviderRegistry } from './ProviderRegistry'
import type { GatewayProviderId, GatewayProviderStatus } from './types'

export interface GatewayHealthSnapshot {
  providerId: GatewayProviderId
  status: GatewayProviderStatus
  health: ProviderHealthResult | null
  checkedAt: string
}

export class ProviderHealthMonitor {
  constructor(private readonly registry: GatewayProviderRegistry) {}

  async check(
    providerId: GatewayProviderId,
    signal?: AbortSignal,
  ): Promise<GatewayHealthSnapshot> {
    const row = this.registry.get(providerId)
    const checkedAt = new Date().toISOString()
    if (!row || !row.enabled) {
      return {
        providerId,
        status: 'disabled',
        health: null,
        checkedAt,
      }
    }
    try {
      const health = await row.provider.health(signal)
      const status: GatewayProviderStatus = health.ok
        ? (health.latencyMs > 2_500 ? 'degraded' : 'available')
        : 'unavailable'
      return { providerId, status, health, checkedAt }
    } catch {
      return {
        providerId,
        status: 'unavailable',
        health: null,
        checkedAt,
      }
    }
  }

  async checkAll(signal?: AbortSignal): Promise<GatewayHealthSnapshot[]> {
    const ids = this.registry.listAll().map((r) => r.descriptor.id)
    const out: GatewayHealthSnapshot[] = []
    for (const id of ids) {
      out.push(await this.check(id, signal))
    }
    return out
  }
}

export function createProviderHealthMonitor(
  registry: GatewayProviderRegistry,
): ProviderHealthMonitor {
  return new ProviderHealthMonitor(registry)
}
