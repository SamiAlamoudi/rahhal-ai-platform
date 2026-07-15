/**
 * Phase AK — Amadeus sandbox read-only probe.
 * Search/token only; never creates reservations or bookings.
 * Default CI / tests inject mocks — network only when probeFn is not overridden
 * and secrets + explicit sandbox probe are present.
 */

import { createAmadeusProviderAdapter } from '../providers/amadeus'
import {
  isAmadeusConfigured,
  resolveAmadeusProviderConfig,
  SANDBOX_HOST,
} from '../providers/amadeus/config'
import { isProductionAmadeusBaseUrl, readEnvValue } from './secrets'

const PROBE_TIMEOUT_MS = 4_000
const PROBE_MAX_RETRIES = 0

export interface AmadeusProbeOutcome {
  ok: boolean
  reason: string
}

/**
 * Build a safe Amadeus probe callable.
 * Uses a tiny, deterministic search window and short timeouts.
 */
export function createAmadeusSandboxProbeFn(options: {
  env?: Record<string, string | undefined>
  /** Injectable fetch for tests — when set, no real network. */
  fetchImpl?: typeof fetch
}): (providerId: string) => Promise<AmadeusProbeOutcome> {
  return async (providerId: string) => {
    if (providerId !== 'amadeus') {
      return { ok: false, reason: 'probe_not_supported_for_provider' }
    }

    const env = options.env
    const clientId = readEnvValue('AMADEUS_CLIENT_ID', env)
    const clientSecret = readEnvValue('AMADEUS_CLIENT_SECRET', env)
    const baseUrl =
      readEnvValue('AMADEUS_BASE_URL', env)
      ?? SANDBOX_HOST

    if (isProductionAmadeusBaseUrl(baseUrl)) {
      return { ok: false, reason: 'refused_production_host_use_sandbox' }
    }
    if (!clientId || !clientSecret) {
      return { ok: false, reason: 'missing_required_secrets' }
    }

    const config = resolveAmadeusProviderConfig({
      enabled: true,
      clientId,
      clientSecret,
      baseUrl,
      environment: 'sandbox',
      timeoutMs: PROBE_TIMEOUT_MS,
      maxRetries: PROBE_MAX_RETRIES,
    })

    if (!isAmadeusConfigured(config)) {
      return { ok: false, reason: 'amadeus_not_configured' }
    }

    // Injected fetch path for deterministic tests.
    if (options.fetchImpl) {
      const started = Date.now()
      void started
      try {
        const tokenRes = await options.fetchImpl(
          `${config.baseUrl}/v1/security/oauth2/token`,
          { method: 'POST', body: 'grant_type=client_credentials' },
        )
        if (!tokenRes.ok) {
          return { ok: false, reason: `oauth_http_${tokenRes.status}` }
        }
        return { ok: true, reason: 'sandbox_oauth_probe_ok' }
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : 'probe_network_error',
        }
      }
    }

    // Without injectable fetch, perform a bounded adapter search (read-only).
    const adapter = createAmadeusProviderAdapter({
      config: {
        enabled: true,
        clientId,
        clientSecret,
        baseUrl: config.baseUrl,
        environment: 'sandbox',
        timeoutMs: PROBE_TIMEOUT_MS,
        maxRetries: PROBE_MAX_RETRIES,
      },
    })

    if (!adapter.isAvailable()) {
      return { ok: false, reason: 'adapter_unavailable' }
    }

    try {
      const result = await adapter.fetch({
        domain: 'flights',
        locale: 'en',
        input: {
          origin: 'RUH',
          destination: 'Jeddah',
          startDate: '2027-11-15',
          travelers: 1,
          currency: 'SAR',
        },
      })
      if (result.status === 'ok') {
        return {
          ok: true,
          reason: `sandbox_search_ok_items_${result.items.length}`,
        }
      }
      return {
        ok: false,
        reason: `sandbox_search_${result.status}_${result.errorCode ?? 'error'}`,
      }
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : 'probe_adapter_error',
      }
    }
  }
}
