/**
 * Sprint 69 — Beta Environment Manager (composes S67/S68 profiles).
 */

import {
  getBetaEnvironmentProfile,
  resolveBetaEnvironment,
  type BetaEnvironment,
} from '../beta'
import { getDeployProfile, detectDeployProfile } from '../deployment'
import { validateEnvironment } from '../security/envValidation'
import type {
  EnvironmentRuntimeReport,
  EnvironmentSwitchResult,
  OpsEnvironment,
} from './types'

export function toOpsEnvironment(value: string | undefined | null): OpsEnvironment {
  const v = (value ?? '').toLowerCase()
  if (v === 'production') return 'production'
  if (v === 'beta') return 'beta'
  if (v === 'staging' || v === 'preview') return 'staging'
  return 'development'
}

export function detectOpsEnvironment(input?: {
  env?: Record<string, string | undefined>
  explicit?: OpsEnvironment
}): OpsEnvironment {
  if (input?.explicit) return input.explicit
  const env = input?.env ?? {}
  const launch = (env.VITE_LAUNCH_PHASE ?? env.VITE_BETA_ENV ?? '').toLowerCase()
  if (launch === 'beta') return 'beta'
  const deploy = detectDeployProfile({ env: input?.env })
  if (deploy.name === 'beta') return 'beta'
  return toOpsEnvironment(deploy.name)
}

export function switchOpsEnvironment(
  to: OpsEnvironment,
  input?: { from?: OpsEnvironment; env?: Record<string, string | undefined> },
): EnvironmentSwitchResult {
  const from = input?.from ?? detectOpsEnvironment({ env: input?.env })
  const verified = verifyOpsEnvironment(to, { env: input?.env }).ok
  const betaProfile = getBetaEnvironmentProfile(
    resolveBetaEnvironment(to as BetaEnvironment),
  )
  const deploy = getDeployProfile(
    to === 'beta' ? 'beta' : to === 'staging' ? 'staging' : to === 'production' ? 'production' : 'development',
  )

  return {
    from,
    to,
    ok: true,
    verified,
    report: [
      `Switched ${from} → ${to}`,
      `betaEnv=${betaProfile.environment}`,
      `deployProfile=${deploy.name}`,
      `requireMockPayments=${deploy.requireMockPayments}`,
      `verified=${verified}`,
    ].join('; '),
    generatedAt: new Date().toISOString(),
  }
}

export function verifyOpsEnvironment(
  environment: OpsEnvironment = 'beta',
  input?: { env?: Record<string, string | undefined> },
): EnvironmentRuntimeReport {
  const deploy = getDeployProfile(
    environment === 'beta'
      ? 'beta'
      : environment === 'staging'
        ? 'staging'
        : environment === 'production'
          ? 'production'
          : 'development',
  )
  const envResult = validateEnvironment({
    target: deploy.envTarget,
    env: input?.env,
  })
  const beta = getBetaEnvironmentProfile(resolveBetaEnvironment(environment as BetaEnvironment))

  const checks = [
    {
      id: 'env.valid',
      ok: envResult.ok || environment === 'development',
      detail: envResult.ok ? 'valid' : envResult.errors.join('; ') || 'warnings present',
    },
    {
      id: 'payments.mock',
      ok: !deploy.requireMockPayments || envResult.resolved.paymentProvider === 'mock',
      detail: `paymentProvider=${envResult.resolved.paymentProvider}`,
    },
    {
      id: 'live_providers',
      ok: !envResult.resolved.liveProvidersEnabled || deploy.allowLiveProviders || beta.liveProvidersAllowed,
      detail: `liveProviders=${envResult.resolved.liveProvidersEnabled}`,
    },
    {
      id: 'profile',
      ok: true,
      detail: `deploy=${deploy.name} beta=${beta.environment}`,
    },
  ]

  return {
    environment,
    ok: checks.every((c) => c.ok),
    checks,
    generatedAt: new Date().toISOString(),
  }
}

export function buildEnvironmentReport(
  environment: OpsEnvironment = 'beta',
  input?: { env?: Record<string, string | undefined> },
): EnvironmentRuntimeReport {
  return verifyOpsEnvironment(environment, input)
}
