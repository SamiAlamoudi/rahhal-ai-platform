import { isProviderHealthyEnough } from './health'
import type {
  AggregatableDomain,
  ProviderAdapter,
  ProviderRegistry,
  ProviderSelectionOptions,
  ProviderSelectionStrategy,
} from './types'

/**
 * Select adapters for a domain using priority + health + availability filters.
 */
export function selectProviders(
  registry: ProviderRegistry,
  options: ProviderSelectionOptions,
): ProviderAdapter[] {
  const strategy: ProviderSelectionStrategy = options.strategy ?? 'parallel'
  const includeFuture = options.includeFutureSlots === true
  const excludeUnhealthy = options.excludeUnhealthy !== false

  const selected = registry.forDomain(options.domain)
    .filter((adapter) => {
      if (!includeFuture && adapter.metadata.futureSlot) return false
      if (!adapter.isAvailable()) return false
      const health = adapter.getHealth()
      return isProviderHealthyEnough(health, { excludeUnhealthy })
    })
    .sort((a, b) => b.metadata.priority - a.metadata.priority)

  void strategy
  return selected
}

export function selectNextFallback(
  adapters: ProviderAdapter[],
  alreadyTried: Set<string>,
): ProviderAdapter | null {
  for (const adapter of adapters) {
    if (alreadyTried.has(String(adapter.metadata.id))) continue
    return adapter
  }
  return null
}

export function domainsSupportedByRegistry(registry: ProviderRegistry): AggregatableDomain[] {
  const set = new Set<AggregatableDomain>()
  for (const meta of registry.list()) {
    for (const domain of meta.domains) set.add(domain)
  }
  return [...set]
}
