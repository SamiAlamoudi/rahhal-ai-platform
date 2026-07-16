/**
 * providers:check — configuration/readiness quality gate.
 *
 * Origin: introduced in Phase AJ (`f982c60`, `providers:check` npm script +
 * `src/scripts/providersCheck.ts`). The full `providerEnablement` module from
 * that phase was never merged to main; this v1.0.1 restoration keeps the same
 * quality-gate contract using Phase W/X APIs already on main:
 * - mock payment required
 * - live providers master switch OFF by default
 * - mock fallback ON by default
 * - no network probes in the default path
 */

import {
  resolveProviderFeatureFlags,
  isLiveProviderFlagEnabled,
  type LiveProviderFlagKey,
} from '../agent/aggregation/liveIntegration/featureFlags'
import { validateEnvironment } from './security/envValidation'
import { checkReadiness } from './observability/health'

export interface ProvidersCheckOptions {
  env?: Record<string, string | undefined>
  argv?: string[]
}

export interface ProvidersCheckResult {
  exitCode: number
  report: string
  probed: boolean
}

const LIVE_KEYS: LiveProviderFlagKey[] = [
  'amadeus',
  'booking_com',
  'google_maps',
  'openweather',
]

function readPaymentProvider(env?: Record<string, string | undefined>): string {
  const fromEnv = env?.VITE_PAYMENT_PROVIDER
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim().toLowerCase()
  try {
    const vite = (import.meta as { env?: Record<string, unknown> }).env?.VITE_PAYMENT_PROVIDER
    if (vite !== undefined && vite !== null && String(vite).trim()) {
      return String(vite).trim().toLowerCase()
    }
  } catch {
    /* ignore */
  }
  return 'mock'
}

function hasSandboxProbeRequest(
  env: Record<string, string | undefined> | undefined,
  argv: string[],
): boolean {
  if (argv.includes('--sandbox-probe')) return true
  const flag = env?.PROVIDER_SANDBOX_PROBE ?? env?.VITE_PROVIDER_SANDBOX_PROBE
  return ['1', 'true', 'yes', 'on'].includes(String(flag ?? '').trim().toLowerCase())
}

/**
 * Config-only provider readiness check (default: no network).
 * Returns exitCode 0 when payment is mock and live providers resolve OFF.
 */
export async function runProvidersCheck(
  options: ProvidersCheckOptions = {},
): Promise<ProvidersCheckResult> {
  const env = options.env
    ?? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  const argv = options.argv
    ?? (globalThis as { process?: { argv?: string[] } }).process?.argv
    ?? []

  const paymentProvider = readPaymentProvider(env)
  const liveOverride = env?.VITE_LIVE_PROVIDERS_ENABLED ?? env?.LIVE_PROVIDERS_ENABLED
  const flags = resolveProviderFeatureFlags({
    liveIntegrationEnabled: liveOverride == null
      ? undefined
      : ['1', 'true', 'yes', 'on'].includes(String(liveOverride).trim().toLowerCase()),
    mockFallbackEnabled: (() => {
      const raw = env?.VITE_PROVIDER_MOCK_FALLBACK ?? env?.PROVIDER_MOCK_FALLBACK
      if (raw == null) return undefined
      return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase())
    })(),
  })

  const envRecord = env ? { ...env } : {}
  const validation = validateEnvironment({
    target: 'staging',
    paymentProvider,
    liveProvidersEnabled: flags.liveIntegrationEnabled,
    env: {
      ...envRecord,
      VITE_PAYMENT_PROVIDER: paymentProvider,
      VITE_LIVE_PROVIDERS_ENABLED: flags.liveIntegrationEnabled ? 'true' : 'false',
    },
  })

  const readiness = checkReadiness({
    target: 'staging',
    paymentProvider,
    liveProvidersEnabled: flags.liveIntegrationEnabled,
  })

  const liveEnabled = LIVE_KEYS.filter((key) => isLiveProviderFlagEnabled(flags, key))
  const probeRequested = hasSandboxProbeRequest(env, argv)
  // Default CLI never performs network I/O (matches Phase AJ default contract).
  const probed = false

  const lines: string[] = []
  lines.push('Rahhal provider readiness check')
  lines.push(`paymentProvider=${paymentProvider}`)
  lines.push(`masterLive=${flags.liveIntegrationEnabled}`)
  lines.push(`mockFallback=${flags.mockFallbackEnabled}`)
  lines.push(`probeRequested=${probeRequested}`)
  lines.push(`readiness=${readiness.status}`)
  lines.push('')
  lines.push('Live provider flags (effective):')
  for (const key of LIVE_KEYS) {
    lines.push(`  - ${key}: ${isLiveProviderFlagEnabled(flags, key)}`)
  }
  lines.push('')
  if (validation.errors.length) {
    lines.push('Environment errors:')
    for (const err of validation.errors) lines.push(`  - ${err}`)
    lines.push('')
  }
  lines.push('No network calls performed')

  const paymentOk = paymentProvider === 'mock'
  const liveOff = flags.liveIntegrationEnabled === false && liveEnabled.length === 0
  const fallbackOn = flags.mockFallbackEnabled === true
  const envOk = validation.ok || (paymentOk && !validation.errors.some((e) =>
    e.includes('must not be set') || e.includes('VITE_PAYMENT_PROVIDER')))
  const readyOk = readiness.checks.payment_provider_safe?.ok === true

  const exitCode = paymentOk && liveOff && fallbackOn && envOk && readyOk ? 0 : 1
  if (exitCode !== 0) {
    lines.push('')
    lines.push('providers:check FAILED')
    if (!paymentOk) lines.push('  - payment provider must be mock')
    if (!liveOff) lines.push('  - live providers must be OFF by default')
    if (!fallbackOn) lines.push('  - mock fallback must be ON')
    if (!readyOk) lines.push('  - readiness payment_provider_safe check failed')
  } else {
    lines.push('providers:check OK')
  }

  return {
    exitCode,
    report: lines.join('\n'),
    probed,
  }
}
