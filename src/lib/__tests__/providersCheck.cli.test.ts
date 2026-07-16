/**
 * npm run providers:check — readiness CLI entrypoint.
 *
 * Origin:
 * - Phase AJ (f982c60) introduced providers:check via src/scripts/providersCheck.ts.
 * - Later AJ/AK branches moved the entry to this __tests__ path so Vitest's
 *   src test include pattern picks it up.
 * - v1.0.1 restores the quality gate against Phase W/X APIs on main (the full
 *   unmerged providerEnablement module is not pulled in).
 *
 * Config/readiness validation only by default (no network).
 */

import { describe, expect, it } from 'vitest'
import { runProvidersCheck } from '../ops/providersCheck'

describe('providers:check', () => {
  it('runs configuration/readiness validation without network calls', async () => {
    const result = await runProvidersCheck({
      env: {
        VITE_PAYMENT_PROVIDER: 'mock',
        VITE_LIVE_PROVIDERS_ENABLED: 'false',
        VITE_PROVIDER_MOCK_FALLBACK: 'true',
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
