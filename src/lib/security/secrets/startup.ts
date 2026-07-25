/**
 * Sprint 14 — production startup validation + graceful optional disable.
 */

import { createEnvironmentSecretProvider } from './EnvironmentSecretProvider'
import { createValidationService } from './ValidationService'
import {
  incrementMissingConfiguration,
  incrementValidationFailure,
} from './metrics'
import type { SecretProviderId, SecretValidationReport } from './types'

export interface StartupValidationResult extends SecretValidationReport {
  mode: 'production' | 'development'
  failedHard: boolean
  gracefullyDisabled: SecretProviderId[]
}

export function isProductionRuntime(): boolean {
  try {
    const env = (import.meta as { env?: { PROD?: boolean; MODE?: string } }).env
    if (env?.PROD === true) return true
    if (env?.MODE === 'production') return true
  } catch {
    /* ignore */
  }
  try {
    const nodeEnv = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
      ?.NODE_ENV
    return nodeEnv === 'production'
  } catch {
    return false
  }
}

/**
 * Validate secrets at startup.
 * Critical failures in production → failedHard (caller should abort boot).
 * Optional integrations → gracefullyDisabled (conversation continues).
 */
export function validateSecretsAtStartup(options?: {
  production?: boolean
}): StartupValidationResult {
  const production = options?.production ?? isProductionRuntime()
  const env = createEnvironmentSecretProvider()
  const report = createValidationService().validateStartup({
    resolve: (key) => env.get(key),
    production,
  })
  if (report.criticalFailures.length) {
    incrementValidationFailure(report.criticalFailures.length)
    incrementMissingConfiguration(report.criticalFailures.length)
  }
  return {
    ...report,
    mode: production ? 'production' : 'development',
    failedHard: production && !report.ok,
    gracefullyDisabled: report.optionalDisabled,
  }
}

export function shouldDisableProvider(
  providerId: SecretProviderId,
  startup?: StartupValidationResult,
): boolean {
  const result = startup ?? validateSecretsAtStartup({ production: false })
  return result.gracefullyDisabled.includes(providerId)
}
