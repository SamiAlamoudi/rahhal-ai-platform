/**
 * Sprint 80 P1-3 — Provider Registry.
 * Registers ConversationalTravelProvider instances by domain + id.
 */

import type {
  ConversationalProviderDomain,
  ConversationalProviderId,
  ConversationalTravelProvider,
} from './types'
import { ConversationalProviderError } from './errors'

export class ConversationalProviderRegistry {
  private readonly byId = new Map<ConversationalProviderId, ConversationalTravelProvider>()

  register(provider: ConversationalTravelProvider): void {
    if (this.byId.has(provider.providerId)) {
      throw new ConversationalProviderError({
        code: 'INVALID_REQUEST',
        message: `Provider already registered: ${provider.providerId}`,
        providerId: provider.providerId,
        retryable: false,
      })
    }
    this.byId.set(provider.providerId, provider)
  }

  /** Replace or insert — useful for tests. */
  upsert(provider: ConversationalTravelProvider): void {
    this.byId.set(provider.providerId, provider)
  }

  get(providerId: ConversationalProviderId): ConversationalTravelProvider | null {
    return this.byId.get(providerId) ?? null
  }

  list(domain?: ConversationalProviderDomain): ConversationalTravelProvider[] {
    const all = [...this.byId.values()]
    return domain ? all.filter((p) => p.domain === domain) : all
  }

  ids(domain?: ConversationalProviderDomain): ConversationalProviderId[] {
    return this.list(domain).map((p) => p.providerId)
  }

  clear(): void {
    this.byId.clear()
  }

  size(): number {
    return this.byId.size
  }
}

let defaultRegistry: ConversationalProviderRegistry | null = null

export function getConversationalProviderRegistry(): ConversationalProviderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ConversationalProviderRegistry()
  }
  return defaultRegistry
}

export function resetConversationalProviderRegistry(): void {
  defaultRegistry = null
}

export function createConversationalProviderRegistry(
  providers: ConversationalTravelProvider[] = [],
): ConversationalProviderRegistry {
  const registry = new ConversationalProviderRegistry()
  for (const provider of providers) {
    registry.register(provider)
  }
  return registry
}
