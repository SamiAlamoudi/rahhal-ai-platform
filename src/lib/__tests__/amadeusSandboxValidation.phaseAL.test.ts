/**
 * Phase AL — Amadeus Sandbox Validation v1 deterministic tests.
 * All HTTP is mocked — never hits the real Amadeus sandbox.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isAmadeusSandboxValidationModeEnabled,
  runAmadeusSandboxValidation,
  validateAmadeusFlightOffersShape,
} from '../agent/aggregation/providerEnablement/amadeusSandboxValidation'
import { runAmadeusSandboxValidationCli } from '../agent/aggregation/providerEnablement/amadeusSandboxValidationCli'
import { resolveProviderEnablementFlags } from '../agent/aggregation/providerEnablement/flags'
import { getDefaultPaymentProviderType } from '../payment'
import { assertNoSecretsInText } from '../ops/logging/mask'
import { resetAppConfig } from '../ops'

const PROXY_URL = 'https://example.supabase.co/functions/v1/amadeus-token'
const INVOKE_KEY = 'sb-anon-test-key-not-a-real-secret-xxxx'
const SANDBOX = 'https://test.api.amadeus.com'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockSuccessFetch(): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('amadeus-token') || (init?.method === 'POST' && url.includes('token'))) {
      return jsonResponse({
        access_token: 'mock-access-token-should-never-appear-in-report',
        token_type: 'Bearer',
        expires_in: 1799,
      })
    }
    if (url.includes('flight-offers')) {
      return jsonResponse({
        meta: { count: 1 },
        data: [
          {
            type: 'flight-offer',
            id: '1',
            source: 'GDS',
            price: { currency: 'SAR', total: '100.00', base: '80.00' },
            itineraries: [],
            validatingAirlineCodes: ['XY'],
          },
        ],
      })
    }
    return jsonResponse({ error: 'unexpected' }, 500)
  }) as unknown as typeof fetch
}

describe('Phase AL — Amadeus Sandbox Validation', () => {
  beforeEach(() => {
    resetAppConfig()
  })

  it('sandbox validation mode is disabled by default', () => {
    expect(isAmadeusSandboxValidationModeEnabled({})).toBe(false)
    expect(isAmadeusSandboxValidationModeEnabled({ AMADEUS_SANDBOX_VALIDATION: 'false' })).toBe(false)
  })

  it('keeps flights live OFF and payment mock (mode does not enable traffic)', () => {
    const flags = resolveProviderEnablementFlags({
      AMADEUS_SANDBOX_VALIDATION: 'true',
      AMADEUS_TOKEN_URL: PROXY_URL,
      AMADEUS_TOKEN_PROXY_KEY: INVOKE_KEY,
    })
    expect(flags.masterLive).toBe(false)
    expect(flags.capabilities.flights.live).toBe(false)
    expect(flags.capabilities.hotels.live).toBe(false)
    expect(getDefaultPaymentProviderType()).toBe('mock')
  })

  it('missing sandbox proxy secrets fails safely', async () => {
    const result = await runAmadeusSandboxValidation({
      env: {
        AMADEUS_SANDBOX_VALIDATION: 'true',
        AMADEUS_BASE_URL: SANDBOX,
      },
      fetchImpl: mockSuccessFetch(),
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('missing_required_secrets')
    expect(result.httpStatusCategory).toBe('missing_secrets')
    expect(result.exitCode).toBe(1)
    expect(assertNoSecretsInText(result.summary)).toBe(true)
  })

  it('secrets are never exposed in success or failure reports', async () => {
    const secret = 'super-secret-amadeus-client-zzz'
    const result = await runAmadeusSandboxValidation({
      env: {
        AMADEUS_SANDBOX_VALIDATION: 'true',
        AMADEUS_TOKEN_URL: PROXY_URL,
        AMADEUS_TOKEN_PROXY_KEY: INVOKE_KEY,
        AMADEUS_CLIENT_SECRET: secret,
        AMADEUS_BASE_URL: SANDBOX,
      },
      fetchImpl: mockSuccessFetch(),
      correlationId: 'corr-al-test-1',
    })
    expect(result.ok).toBe(true)
    expect(result.summary).not.toContain(secret)
    expect(result.summary).not.toContain('mock-access-token-should-never-appear-in-report')
    expect(result.summary).not.toContain(INVOKE_KEY)
    expect(result.summary).toContain('credentialsPrinted=false')
    expect(assertNoSecretsInText(result.summary)).toBe(true)
  })

  it('mocked sandbox success reports latency, status category, mode, correlation id', async () => {
    const result = await runAmadeusSandboxValidation({
      env: {
        AMADEUS_SANDBOX_VALIDATION: 'true',
        AMADEUS_TOKEN_URL: PROXY_URL,
        AMADEUS_TOKEN_PROXY_KEY: INVOKE_KEY,
        AMADEUS_BASE_URL: SANDBOX,
      },
      fetchImpl: mockSuccessFetch(),
      correlationId: 'corr-al-success',
    })
    expect(result.ok).toBe(true)
    expect(result.providerMode).toBe('sandbox')
    expect(result.httpStatusCategory).toBe('2xx')
    expect(result.httpStatus).toBe(200)
    expect(result.correlationId).toBe('corr-al-success')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(result.oauthLatencyMs).toBeGreaterThanOrEqual(0)
    expect(result.searchLatencyMs).toBeGreaterThanOrEqual(0)
    expect(result.shapeValid).toBe(true)
    expect(result.offerCount).toBe(1)
    expect(result.summary).toContain('correlationId=corr-al-success')
    expect(result.summary).toContain('providerMode=sandbox')
  })

  it('mocked 401 fails safely', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      code: 'AMADEUS_INVALID_CREDENTIALS',
      error: 'Invalid',
    }, 401)) as unknown as typeof fetch

    const result = await runAmadeusSandboxValidation({
      env: {
        AMADEUS_SANDBOX_VALIDATION: 'true',
        AMADEUS_TOKEN_URL: PROXY_URL,
        AMADEUS_TOKEN_PROXY_KEY: INVOKE_KEY,
        AMADEUS_BASE_URL: SANDBOX,
      },
      fetchImpl,
    })
    expect(result.ok).toBe(false)
    expect(result.httpStatusCategory).toBe('401')
    expect(result.reason).toBe('oauth_401')
    expect(assertNoSecretsInText(result.summary)).toBe(true)
  })

  it('mocked 429 fails safely', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      code: 'AMADEUS_QUOTA_EXCEEDED',
      error: 'Quota',
    }, 429)) as unknown as typeof fetch

    const result = await runAmadeusSandboxValidation({
      env: {
        AMADEUS_SANDBOX_VALIDATION: 'true',
        AMADEUS_TOKEN_URL: PROXY_URL,
        AMADEUS_TOKEN_PROXY_KEY: INVOKE_KEY,
        AMADEUS_BASE_URL: SANDBOX,
      },
      fetchImpl,
    })
    expect(result.ok).toBe(false)
    expect(result.httpStatusCategory).toBe('429')
    expect(result.reason).toBe('oauth_429')
  })

  it('mocked timeout fails safely', async () => {
    const fetchImpl = vi.fn(async () => {
      const err = new Error('The operation was aborted due to timeout')
      err.name = 'AbortError'
      throw err
    }) as unknown as typeof fetch

    const result = await runAmadeusSandboxValidation({
      env: {
        AMADEUS_SANDBOX_VALIDATION: 'true',
        AMADEUS_TOKEN_URL: PROXY_URL,
        AMADEUS_TOKEN_PROXY_KEY: INVOKE_KEY,
        AMADEUS_BASE_URL: SANDBOX,
      },
      fetchImpl,
    })
    expect(result.ok).toBe(false)
    expect(result.httpStatusCategory).toBe('timeout')
    expect(result.reason).toMatch(/timeout/)
  })

  it('malformed flight response fails safely', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('amadeus-token')) {
        return jsonResponse({
          access_token: 'tok',
          token_type: 'Bearer',
          expires_in: 1000,
        })
      }
      return jsonResponse({ unexpected: true })
    }) as unknown as typeof fetch

    const result = await runAmadeusSandboxValidation({
      env: {
        AMADEUS_SANDBOX_VALIDATION: 'true',
        AMADEUS_TOKEN_URL: PROXY_URL,
        AMADEUS_TOKEN_PROXY_KEY: INVOKE_KEY,
        AMADEUS_BASE_URL: SANDBOX,
      },
      fetchImpl,
    })
    expect(result.ok).toBe(false)
    expect(result.httpStatusCategory).toBe('malformed')
    expect(result.shapeValid).toBe(false)
  })

  it('refuses production Amadeus hosts', async () => {
    const result = await runAmadeusSandboxValidation({
      env: {
        AMADEUS_SANDBOX_VALIDATION: 'true',
        AMADEUS_TOKEN_URL: PROXY_URL,
        AMADEUS_TOKEN_PROXY_KEY: INVOKE_KEY,
        AMADEUS_BASE_URL: 'https://api.amadeus.com',
      },
      fetchImpl: mockSuccessFetch(),
    })
    expect(result.ok).toBe(false)
    expect(result.providerMode).toBe('refused')
    expect(result.httpStatusCategory).toBe('refused_production')
  })

  it('CLI default path stays deterministic with mode OFF (no network)', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const cli = await runAmadeusSandboxValidationCli({
      env: { VITE_PAYMENT_PROVIDER: 'mock' },
      argv: ['node', 'amadeus:sandbox-validate'],
      fetchImpl,
    })
    expect(cli.exitCode).toBe(0)
    expect(cli.result.sandboxValidationMode).toBe(false)
    expect(cli.result.reason).toBe('sandbox_validation_disabled')
    expect(cli.report).toContain('sandboxValidationMode=false')
    expect(cli.report).toContain('paymentProvider=mock')
    expect(cli.report).toContain('flightsLive=false')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('validateAmadeusFlightOffersShape accepts empty data array', () => {
    const shape = validateAmadeusFlightOffersShape({ meta: { count: 0 }, data: [] })
    expect(shape.valid).toBe(true)
    expect(shape.offerCount).toBe(0)
  })

  it('opt-in via argv enables sandbox validation mode', () => {
    expect(
      isAmadeusSandboxValidationModeEnabled({}, ['node', 'cli', '--amadeus-sandbox-validate']),
    ).toBe(true)
  })
})
