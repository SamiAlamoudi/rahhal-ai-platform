/**
 * Sprint 80 P1-3 — Provider Resolver.
 * Chooses which registered provider(s) to try for a domain (live → mock failover).
 */

import { isLiveFlightSearchEnabled } from '../liveFlightSearch/feature'
import { isLiveHotelSearchEnabled } from '../liveHotelSearch/feature'
import type { ConversationalProviderRegistry } from './registry'
import type {
  ConversationalProviderDomain,
  ConversationalTravelProvider,
} from './types'

export type ResolveProviderOptions = {
  domain: ConversationalProviderDomain
  registry: ConversationalProviderRegistry
  /** Prefer live when domain live flag is ON (default true). */
  preferLive?: boolean
  /** Test overrides for live flags. */
  liveFlightEnabled?: boolean
  liveHotelEnabled?: boolean
  /** Explicit provider id (skips preference order). */
  providerId?: string
}

export type ResolvedProviders = {
  domain: ConversationalProviderDomain
  /** Ordered attempt list (primary first). */
  providers: ConversationalTravelProvider[]
  preferLive: boolean
}

function livePreferredForDomain(
  domain: ConversationalProviderDomain,
  options: ResolveProviderOptions,
): boolean {
  if (options.preferLive === false) return false
  if (domain === 'flights') {
    return isLiveFlightSearchEnabled({ enabled: options.liveFlightEnabled })
  }
  if (domain === 'hotels') {
    return isLiveHotelSearchEnabled({ enabled: options.liveHotelEnabled })
  }
  return false
}

function sortForDomain(
  providers: ConversationalTravelProvider[],
  preferLive: boolean,
): ConversationalTravelProvider[] {
  const score = (p: ConversationalTravelProvider): number => {
    const caps = p.capabilities()
    if (preferLive && caps.live) return 0
    if (!preferLive && !caps.live) return 0
    if (caps.live) return 1
    return 2
  }
  return [...providers].sort((a, b) => score(a) - score(b) || a.providerId.localeCompare(b.providerId))
}

/**
 * Resolve an ordered list of providers for the domain.
 * Unavailable providers are filtered out asynchronously by the search orchestrator;
 * this step only orders candidates.
 */
export function resolveConversationalProviders(
  options: ResolveProviderOptions,
): ResolvedProviders {
  const { domain, registry, providerId } = options
  const preferLive = livePreferredForDomain(domain, options)

  if (providerId) {
    const exact = registry.get(providerId)
    return {
      domain,
      providers: exact && exact.domain === domain ? [exact] : [],
      preferLive,
    }
  }

  const candidates = registry.list(domain)
  return {
    domain,
    providers: sortForDomain(candidates, preferLive),
    preferLive,
  }
}

/** Filter to currently available providers (async-safe). */
export async function filterAvailableProviders(
  providers: ConversationalTravelProvider[],
  options?: { enabled?: boolean },
): Promise<ConversationalTravelProvider[]> {
  const out: ConversationalTravelProvider[] = []
  for (const provider of providers) {
    const available = await provider.isAvailable(options)
    if (available) out.push(provider)
  }
  return out
}
