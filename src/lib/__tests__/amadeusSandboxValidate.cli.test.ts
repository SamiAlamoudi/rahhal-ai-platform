/**
 * npm run amadeus:sandbox-validate — Phase AL CLI entrypoint.
 * Default: mode OFF, no network, deterministic.
 * Real sandbox calls require AMADEUS_SANDBOX_VALIDATION=true + proxy secrets
 * (manual / workflow_dispatch only — never scheduled).
 */

import { describe, expect, it } from 'vitest'
import { runAmadeusSandboxValidationCli } from '../agent/aggregation/providerEnablement/amadeusSandboxValidationCli'

describe('amadeus:sandbox-validate', () => {
  it('reports sandbox validation disabled by default without network', async () => {
    const result = await runAmadeusSandboxValidationCli({
      env: {
        VITE_PAYMENT_PROVIDER: 'mock',
        VITE_PROVIDERS_FLIGHTS_LIVE: 'false',
        VITE_LIVE_PROVIDERS_ENABLED: 'false',
      },
      argv: ['node', 'amadeus:sandbox-validate'],
    })
    // eslint-disable-next-line no-console
    console.log(result.report)
    expect(result.exitCode).toBe(0)
    expect(result.result.sandboxValidationMode).toBe(false)
    expect(result.report).toContain('Phase AL')
    expect(result.report).toContain('sandboxValidationMode=false')
    expect(result.report).toContain('paymentProvider=mock')
    expect(result.report).toContain('flightsLive=false')
    expect(result.report).toContain('liveFlightsFlag=false')
  })
})
