/**
 * Sprint 67 — environment profiles for beta / staging / production.
 */

import type { BetaEnvironment, BetaEnvironmentProfile } from './types'

function readEnv(name: string): string | undefined {
  try {
    const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> }
    if (meta.env?.[name] != null && meta.env[name] !== '') return meta.env[name]
  } catch {
    /* ignore */
  }
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    return proc?.env?.[name]
  } catch {
    return undefined
  }
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === '') return fallback
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return fallback
}

/** Resolve beta environment from VITE_DEPLOY_TARGET / VITE_BETA_ENV. */
export function resolveBetaEnvironment(
  override?: BetaEnvironment,
): BetaEnvironment {
  if (override) return override
  const beta = readEnv('VITE_BETA_ENV') ?? readEnv('BETA_ENV')
  if (beta === 'beta' || beta === 'staging' || beta === 'production' || beta === 'development') {
    return beta
  }
  const target = readEnv('VITE_DEPLOY_TARGET')
  if (target === 'staging') return 'staging'
  if (target === 'production') return 'production'
  if (target === 'preview') return 'staging'
  return 'development'
}

export function getBetaEnvironmentProfile(
  environment?: BetaEnvironment,
): BetaEnvironmentProfile {
  const env = resolveBetaEnvironment(environment)
  const mockFallback = parseBool(readEnv('VITE_PROVIDER_MOCK_FALLBACK'), true)
  const logLevelRaw = (readEnv('VITE_LOG_LEVEL') ?? readEnv('LOG_LEVEL') ?? 'info').toLowerCase()
  const logLevel =
    logLevelRaw === 'debug' || logLevelRaw === 'warn' || logLevelRaw === 'error'
      ? logLevelRaw
      : 'info'

  switch (env) {
    case 'beta':
    case 'staging':
      return {
        environment: env,
        deployTarget: 'staging',
        liveProvidersAllowed: true,
        livePaymentsAllowed: false,
        mockPaymentsRequired: true,
        mockFallbackEnabled: mockFallback,
        requireSupabase: true,
        logLevel,
      }
    case 'production':
      return {
        environment: 'production',
        deployTarget: 'production',
        liveProvidersAllowed: true,
        livePaymentsAllowed: false,
        mockPaymentsRequired: true,
        mockFallbackEnabled: mockFallback,
        requireSupabase: true,
        logLevel: logLevel === 'debug' ? 'info' : logLevel,
      }
    case 'development':
    default:
      return {
        environment: 'development',
        deployTarget: 'development',
        liveProvidersAllowed: true,
        livePaymentsAllowed: false,
        mockPaymentsRequired: false,
        mockFallbackEnabled: true,
        requireSupabase: false,
        logLevel,
      }
  }
}

export function readBetaEnv(name: string): string | undefined {
  return readEnv(name)
}
