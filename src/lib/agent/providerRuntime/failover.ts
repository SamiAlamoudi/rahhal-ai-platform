/**
 * Sprint 71 — Automatic failover: primary → secondary → mock → graceful message.
 */

import {
  GRACEFUL_PROVIDER_MESSAGE,
  type ProviderFailoverResult,
  type ProviderRuntimeAdapter,
  type ProviderRuntimeId,
  type ProviderRuntimeSearchRequest,
  type ProviderRuntimeSearchResult,
} from './types'

export function buildFailoverChain(
  preferred: ProviderRuntimeId | null,
  available: ProviderRuntimeAdapter[],
): ProviderRuntimeAdapter[] {
  const byId = new Map(available.map((a) => [a.providerId, a]))
  const ordered: ProviderRuntimeAdapter[] = []
  const push = (id: ProviderRuntimeId) => {
    const a = byId.get(id)
    if (a && !ordered.includes(a)) ordered.push(a)
  }

  if (preferred) push(preferred)
  // Prefer live-capable providers before mock
  for (const a of available) {
    if (a.providerId !== 'mock' && a.health().mode === 'live') push(a.providerId)
  }
  for (const a of available) {
    if (a.providerId !== 'mock') push(a.providerId)
  }
  push('mock')
  return ordered
}

export async function searchWithFailover(
  adapters: ProviderRuntimeAdapter[],
  request: ProviderRuntimeSearchRequest,
  preferred: ProviderRuntimeId | null = null,
): Promise<ProviderFailoverResult<ProviderRuntimeSearchResult>> {
  const chain = buildFailoverChain(preferred, adapters)
  const attempted: ProviderRuntimeId[] = []

  for (const adapter of chain) {
    attempted.push(adapter.providerId)
    try {
      const result = await adapter.search(request)
      if (result.ok && (result.offers.length > 0 || result.mode === 'mock')) {
        return {
          ok: true,
          result,
          attempted,
          usedProviderId: adapter.providerId,
          gracefulMessage:
            result.mode === 'mock' && attempted.length > 1
              ? GRACEFUL_PROVIDER_MESSAGE
              : undefined,
        }
      }
    } catch {
      // never crash — continue chain
    }
  }

  return {
    ok: false,
    result: null,
    attempted,
    usedProviderId: null,
    gracefulMessage: GRACEFUL_PROVIDER_MESSAGE,
  }
}
