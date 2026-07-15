/**
 * npm run providers:check — Phase AJ readiness CLI entrypoint.
 * Config/readiness validation only by default (no network).
 */

import { describe, expect, it } from 'vitest'
import { runProvidersCheck } from '../agent/aggregation/providerEnablement/cli'

describe('providers:check', () => {
  it('runs configuration/readiness validation without network calls', async () => {
    const result = await runProvidersCheck({
      env: {
        VITE_PAYMENT_PROVIDER: 'mock',
        VITE_LIVE_PROVIDERS_ENABLED: 'false',
      },
      argv: ['node', 'providers:check'],
    })
    // eslint-disable-next-line no-console
    console.log(result.report)
    expect(result.probed).toBe(false)
    expect(result.report).toContain('No network calls performed')
    expect(result.report).toContain('paymentProvider=mock')
    expect(result.exitCode).toBe(0)
  })
})
