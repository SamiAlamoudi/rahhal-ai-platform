/**
 * Sprint 80 P2 — staging/dev-only gate for live flight pilot validation.
 * Production is always blocked. Feature flags remain OFF by default.
 */

import {
  readAmadeusBaseUrl,
  readAmadeusClientId,
  readAmadeusClientSecret,
} from '../../../../core/amadeusSandbox/config'
import { detectDeployProfile } from '../../../ops/deployment/profiles'
import { isPilotDeployTargetAllowed } from '../pilotFeature'

export type LiveFlightValidationGateResult = {
  allowed: boolean
  productionBlocked: boolean
  deployTarget: string
  profileName: string
  reason: string
  sandboxHost: boolean
  hasCredentials: boolean
}

function readEnvBag(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  try {
    const vite = (import.meta as { env?: Record<string, unknown> }).env ?? {}
    for (const [k, v] of Object.entries(vite)) {
      if (typeof v === 'string') out[k] = v
    }
  } catch {
    /* ignore */
  }
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    for (const [k, v] of Object.entries(proc?.env ?? {})) {
      if (typeof v === 'string' && out[k] === undefined) out[k] = v
    }
  } catch {
    /* ignore */
  }
  return out
}

export function isSandboxAmadeusHost(baseUrl: string): boolean {
  const host = baseUrl.replace(/\/+$/, '').toLowerCase()
  return host.includes('test.api.amadeus.com') || host.includes('test.api')
}

/**
 * Live pilot / validation is allowed only on development, staging, preview, or beta.
 * Production is hard-blocked regardless of feature flags.
 */
export function evaluateLiveFlightValidationGate(options?: {
  env?: Record<string, string | undefined>
  /** Test override — still never allows production unless explicitly opted in. */
  allowProductionForTests?: boolean
}): LiveFlightValidationGateResult {
  const env = options?.env ?? readEnvBag()
  const profile = detectDeployProfile({ env })
  const deployTarget = (
    env.VITE_DEPLOY_TARGET
    ?? env.DEPLOY_TARGET
    ?? profile.envTarget
    ?? 'development'
  ).toLowerCase()

  const baseUrl = readAmadeusBaseUrl(env)
  const sandboxHost = isSandboxAmadeusHost(baseUrl)
  const hasCredentials = Boolean(readAmadeusClientId(env) && readAmadeusClientSecret(env))
  const allowed = options?.allowProductionForTests
    ? true
    : isPilotDeployTargetAllowed({ env })
  const productionBlocked = !allowed && (
    deployTarget === 'production' || deployTarget === 'prod' || profile.name === 'production'
  )

  if (!allowed) {
    return {
      allowed: false,
      productionBlocked,
      deployTarget,
      profileName: profile.name,
      reason: productionBlocked
        ? 'Live flight pilot/validation is blocked on production deploy targets'
        : `Deploy profile "${profile.name}" is not allowed for live flight pilot`,
      sandboxHost,
      hasCredentials,
    }
  }

  return {
    allowed: true,
    productionBlocked: false,
    deployTarget,
    profileName: profile.name,
    reason: 'Allowed for development/staging (feature flags still OFF by default)',
    sandboxHost,
    hasCredentials,
  }
}

/** Whether the pilot feature may activate for the current deploy target. */
export function isLiveFlightPilotAllowedForDeploy(options?: {
  env?: Record<string, string | undefined>
  allowProductionForTests?: boolean
}): boolean {
  return evaluateLiveFlightValidationGate(options).allowed
}
