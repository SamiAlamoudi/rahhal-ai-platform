/**
 * Manual / workflow_dispatch live entry for Phase AL.
 * Invoked via: npm run amadeus:sandbox-validate:live
 *
 * Real network requires BOTH:
 *   AMADEUS_SANDBOX_VALIDATION=true
 *   ALLOW_AMADEUS_SANDBOX_NETWORK=true
 *
 * Default unit suite (test:run) always takes the no-network path.
 */

import { describe, expect, it } from 'vitest'
import { runAmadeusSandboxValidationCli } from '../agent/aggregation/providerEnablement/amadeusSandboxValidationCli'

function readProcessEnv(): Record<string, string | undefined> {
  try {
    return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
  } catch {
    return {}
  }
}

function envFlag(name: string): boolean {
  const env = readProcessEnv()
  return ['1', 'true', 'yes', 'on'].includes(String(env[name] ?? '').toLowerCase())
}

const modeOn = envFlag('AMADEUS_SANDBOX_VALIDATION')
const networkAllowed = envFlag('ALLOW_AMADEUS_SANDBOX_NETWORK')

describe('amadeus:sandbox-validate:live', () => {
  it('runs Phase AL validation only when explicitly opted in for network', async () => {
    if (!modeOn || !networkAllowed) {
      const disabled = await runAmadeusSandboxValidationCli({
        env: {
          VITE_PAYMENT_PROVIDER: 'mock',
          AMADEUS_SANDBOX_VALIDATION: 'false',
        },
        argv: ['node', 'amadeus:sandbox-validate:live'],
      })
      // eslint-disable-next-line no-console
      console.log(disabled.report)
      expect(disabled.exitCode).toBe(0)
      expect(disabled.result.sandboxValidationMode).toBe(false)
      expect(disabled.result.reason).toBe('sandbox_validation_disabled')
      return
    }

    const result = await runAmadeusSandboxValidationCli({
      env: readProcessEnv(),
      argv: ['node', 'amadeus:sandbox-validate:live', '--amadeus-sandbox-validate'],
    })
    // eslint-disable-next-line no-console
    console.log(result.report)
    expect(result.report).toContain('credentialsPrinted=false')
    expect(result.report).not.toMatch(/Bearer\s+[A-Za-z0-9\-._~+/]{8,}/)
    if (result.result.reason === 'missing_required_secrets') {
      expect(result.exitCode).toBe(1)
      expect(result.result.ok).toBe(false)
      return
    }
    expect(result.exitCode).toBe(result.result.ok ? 0 : 1)
  })
})
