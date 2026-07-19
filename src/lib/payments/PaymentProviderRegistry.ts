/**
 * Sprint 34 — PaymentProviderRegistry with priority failover.
 * Providers are never hardcoded at call sites — selection goes through the registry.
 */

import { PaymentPlatformError } from './PaymentErrors'
import {
  createAdyenPaymentAdapter,
  createCheckoutComPaymentAdapter,
  createHyperPayPaymentAdapter,
  createMockPaymentProvider,
  createStripePaymentAdapter,
} from './providers'
import type {
  PlatformPaymentProvider,
  PlatformPaymentProviderId,
  ProviderChargeRequest,
  ProviderChargeResult,
} from './types'

export class PaymentProviderRegistry {
  private readonly providers = new Map<PlatformPaymentProviderId, PlatformPaymentProvider>()
  private failovers = 0

  constructor(providers?: PlatformPaymentProvider[]) {
    const list = providers ?? createDefaultPaymentProviders()
    for (const provider of list) {
      this.register(provider)
    }
  }

  register(provider: PlatformPaymentProvider): void {
    this.providers.set(provider.id, provider)
  }

  get(id: PlatformPaymentProviderId): PlatformPaymentProvider | null {
    return this.providers.get(id) ?? null
  }

  list(): PlatformPaymentProvider[] {
    return [...this.providers.values()].sort((a, b) => a.priority - b.priority)
  }

  getFailoverCount(): number {
    return this.failovers
  }

  /**
   * Select a healthy provider. Preferred id first, then priority order, mock last resort.
   */
  async selectProvider(
    preferredId?: PlatformPaymentProviderId,
  ): Promise<PlatformPaymentProvider> {
    const ordered = this.list()
    const candidates = preferredId
      ? [
          ...ordered.filter((p) => p.id === preferredId),
          ...ordered.filter((p) => p.id !== preferredId),
        ]
      : ordered

    let sawUnhealthyPreferred = false
    for (const provider of candidates) {
      const health = await provider.healthCheck()
      if (health.healthy) {
        if (sawUnhealthyPreferred) this.failovers += 1
        return provider
      }
      if (preferredId && provider.id === preferredId) {
        sawUnhealthyPreferred = true
      }
    }

    throw new PaymentPlatformError(
      'PROVIDER_UNAVAILABLE',
      'No healthy payment provider available',
    )
  }

  async chargeWithFailover(
    request: ProviderChargeRequest,
    preferredId?: PlatformPaymentProviderId,
  ): Promise<{ result: ProviderChargeResult; provider: PlatformPaymentProvider; failovers: number }> {
    const startFailovers = this.failovers
    const provider = await this.selectProvider(preferredId)
    const result = await provider.charge(request)
    return {
      result,
      provider,
      failovers: this.failovers - startFailovers,
    }
  }
}

export function createDefaultPaymentProviders(): PlatformPaymentProvider[] {
  return [
    createStripePaymentAdapter(),
    createAdyenPaymentAdapter(),
    createCheckoutComPaymentAdapter(),
    createHyperPayPaymentAdapter(),
    createMockPaymentProvider(),
  ]
}

export function createPaymentProviderRegistry(
  providers?: PlatformPaymentProvider[],
): PaymentProviderRegistry {
  return new PaymentProviderRegistry(providers)
}
