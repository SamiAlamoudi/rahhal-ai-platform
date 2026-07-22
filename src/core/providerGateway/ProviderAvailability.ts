/**
 * Sprint 104 — automatic provider availability detection.
 */

import type { GatewayProviderRegistry } from './ProviderRegistry'
import type { ProviderHealthMonitor, GatewayHealthSnapshot } from './ProviderHealthMonitor'
import type { GatewayProviderId, GatewayProviderStatus } from './types'

export interface ProviderAvailabilityReport {
  checkedAt: string
  providers: Array<{
    id: GatewayProviderId
    status: GatewayProviderStatus
    available: boolean
    detail: string
  }>
  preferred: GatewayProviderId | null
}

export interface ProviderAvailabilityCheck {
  available: boolean
  reason?: string
}

/** Sync Phase-1 / registry gate (no network). */
export function checkRegistryAvailability(
  registry: GatewayProviderRegistry,
  providerId: GatewayProviderId,
): ProviderAvailabilityCheck {
  const descriptor = registry.listDescriptors().find((d) => d.id === providerId)
  if (!descriptor) {
    return { available: false, reason: `Unknown provider: ${providerId}` }
  }
  if (!descriptor.phase1Enabled) {
    return { available: false, reason: `${providerId} disabled in Phase 1` }
  }
  const row = registry.get(providerId)
  if (!row) {
    return { available: false, reason: `${providerId} not registered` }
  }
  if (!row.enabled) {
    return { available: false, reason: `${providerId} is disabled` }
  }
  return { available: true }
}

export async function detectProviderAvailability(
  monitor: ProviderHealthMonitor,
  signal?: AbortSignal,
): Promise<ProviderAvailabilityReport> {
  const snapshots = await monitor.checkAll(signal)
  const providers = snapshots.map((s) => toRow(s))
  const preferred = providers.find((p) => p.available)?.id ?? null
  return {
    checkedAt: new Date().toISOString(),
    providers,
    preferred,
  }
}

function toRow(snapshot: GatewayHealthSnapshot): ProviderAvailabilityReport['providers'][number] {
  const available = snapshot.status === 'available' || snapshot.status === 'degraded'
  return {
    id: snapshot.providerId,
    status: snapshot.status,
    available,
    detail: snapshot.health?.detail
      ?? (snapshot.status === 'disabled' ? 'Provider disabled for this phase' : 'Health check failed'),
  }
}

export type { GatewayHealthSnapshot }
