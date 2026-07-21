/**
 * Sprint 68 — Environment profiles for development / staging / beta / production.
 */

import type { DeployProfile, DeployProfileName } from './types'

export const DEPLOY_PROFILES: Record<DeployProfileName, DeployProfile> = {
  development: {
    name: 'development',
    label: 'Development',
    envTarget: 'development',
    requireMockPayments: false,
    allowLiveProviders: true,
    requireSupabase: false,
    failFastOnInvalidEnv: false,
    description: 'Local development — permissive env, mock or live adapters.',
  },
  staging: {
    name: 'staging',
    label: 'Staging',
    envTarget: 'staging',
    requireMockPayments: true,
    allowLiveProviders: false,
    requireSupabase: false,
    failFastOnInvalidEnv: true,
    description: 'Staging — mock payments, live providers off by default.',
  },
  beta: {
    name: 'beta',
    label: 'Beta',
    envTarget: 'staging',
    requireMockPayments: true,
    allowLiveProviders: true,
    requireSupabase: true,
    failFastOnInvalidEnv: true,
    description: 'Beta — production-like with optional live providers behind flags + Edge secrets.',
  },
  production: {
    name: 'production',
    label: 'Production',
    envTarget: 'production',
    requireMockPayments: true,
    allowLiveProviders: false,
    requireSupabase: true,
    failFastOnInvalidEnv: true,
    description: 'Production — mock payments required until freeze lifted; live providers gated.',
  },
}

export function getDeployProfile(name: DeployProfileName): DeployProfile {
  return DEPLOY_PROFILES[name]
}

export function detectDeployProfile(input?: {
  env?: Record<string, string | undefined>
  explicit?: DeployProfileName
}): DeployProfile {
  if (input?.explicit) return getDeployProfile(input.explicit)

  const env = input?.env ?? readEnv()
  const target = (env.VITE_DEPLOY_TARGET ?? env.DEPLOY_TARGET ?? '').toLowerCase()
  const phase = (env.VITE_LAUNCH_PHASE ?? env.LAUNCH_PHASE ?? '').toLowerCase()

  if (phase === 'beta' || target === 'beta') return getDeployProfile('beta')
  if (target === 'production') return getDeployProfile('production')
  if (target === 'staging' || target === 'preview') return getDeployProfile('staging')
  if (target === 'development') return getDeployProfile('development')
  return getDeployProfile('development')
}

function readEnv(): Record<string, string | undefined> {
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
    if (proc?.env) Object.assign(out, proc.env)
  } catch {
    /* ignore */
  }
  return out
}
