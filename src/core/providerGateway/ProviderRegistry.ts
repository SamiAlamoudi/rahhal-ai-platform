/**
 * Sprint 104 — gateway provider registry (Phase 1: Amadeus only).
 * Does not replace Sprint 90 ProviderRegistry — wraps TravelProvider adapters.
 */

import type { TravelProvider } from '../providers'
import {
  AMADEUS_SANDBOX_PROVIDER_ID,
  createAmadeusSandboxProvider,
  type AmadeusSandboxProviderOptions,
} from '../amadeusSandbox'
import type { GatewayProviderDescriptor, GatewayProviderId } from './types'

export interface GatewayRegisteredProvider {
  descriptor: GatewayProviderDescriptor
  provider: TravelProvider
  enabled: boolean
}

const PHASE1_DESCRIPTORS: GatewayProviderDescriptor[] = [
  {
    id: 'amadeus',
    displayName: 'Amadeus',
    phase1Enabled: true,
    travelProviderId: AMADEUS_SANDBOX_PROVIDER_ID,
  },
  {
    id: 'duffel',
    displayName: 'Duffel',
    phase1Enabled: false,
    travelProviderId: 'duffel',
  },
  {
    id: 'booking_com',
    displayName: 'Booking.com',
    phase1Enabled: false,
    travelProviderId: 'booking_com',
  },
]

export class GatewayProviderRegistry {
  private readonly byId = new Map<GatewayProviderId, GatewayRegisteredProvider>()

  listDescriptors(): GatewayProviderDescriptor[] {
    return PHASE1_DESCRIPTORS.map((d) => ({ ...d }))
  }

  register(
    id: GatewayProviderId,
    provider: TravelProvider,
    options?: { enabled?: boolean },
  ): void {
    const descriptor = PHASE1_DESCRIPTORS.find((d) => d.id === id)
    if (!descriptor) {
      throw new Error(`Unknown gateway provider: ${id}`)
    }
    if (!descriptor.phase1Enabled && options?.enabled !== true) {
      // Phase 1: non-Amadeus stay registered as disabled.
      this.byId.set(id, {
        descriptor,
        provider,
        enabled: false,
      })
      return
    }
    this.byId.set(id, {
      descriptor,
      provider,
      enabled: options?.enabled !== false && descriptor.phase1Enabled,
    })
  }

  get(id: GatewayProviderId): GatewayRegisteredProvider | null {
    return this.byId.get(id) ?? null
  }

  listEnabled(): GatewayRegisteredProvider[] {
    return [...this.byId.values()].filter((p) => p.enabled)
  }

  listAll(): GatewayRegisteredProvider[] {
    return [...this.byId.values()]
  }

  /** Prefer explicit id; otherwise first Phase-1 enabled provider (Amadeus). */
  resolve(preferred?: GatewayProviderId | null): GatewayRegisteredProvider | null {
    if (preferred) {
      const hit = this.byId.get(preferred)
      if (hit?.enabled) return hit
      return null
    }
    return this.listEnabled()[0] ?? null
  }
}

export function createGatewayProviderRegistry(
  options?: {
    amadeus?: AmadeusSandboxProviderOptions
    /** When false, Amadeus is registered but disabled. */
    enableAmadeus?: boolean
  },
): GatewayProviderRegistry {
  const registry = new GatewayProviderRegistry()
  const amadeus = createAmadeusSandboxProvider(options?.amadeus)
  registry.register('amadeus', amadeus, {
    enabled: options?.enableAmadeus !== false,
  })
  return registry
}

export { PHASE1_DESCRIPTORS }
