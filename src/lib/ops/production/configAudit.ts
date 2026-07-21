/**
 * Sprint 65 — Production configuration audit.
 */

import { validateEnvironment, type DeployTarget } from '../security/envValidation'
import type { ConfigAuditReport } from './types'

function readEnv(name: string): string | undefined {
  try {
    const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> }
    return meta.env?.[name]
  } catch {
    return undefined
  }
}

export function auditProductionConfig(input?: {
  target?: DeployTarget
  paymentProvider?: string | null
  liveProvidersEnabled?: boolean
  now?: () => number
}): ConfigAuditReport {
  const target = input?.target ?? 'production'
  const now = input?.now ?? (() => Date.now())
  const env = validateEnvironment({
    target,
    paymentProvider: input?.paymentProvider,
    liveProvidersEnabled: input?.liveProvidersEnabled,
  })

  const warnings = [...env.warnings]
  const errors = [...env.errors]

  const debugFlag = readEnv('VITE_DEBUG') ?? readEnv('DEBUG')
  if (debugFlag === 'true' || debugFlag === '1') {
    warnings.push('DEBUG flag enabled — disable verbose debug in production builds')
  }

  const logLevel = readEnv('VITE_LOG_LEVEL') ?? readEnv('LOG_LEVEL') ?? 'info'
  if (target === 'production' && (logLevel === 'debug' || logLevel === 'trace')) {
    warnings.push(`Logging level "${logLevel}" too verbose for production`)
  }

  // Mock defaults must remain for payment in V1
  if (env.resolved.paymentProvider !== 'mock' && target === 'production') {
    errors.push('Production V1 requires VITE_PAYMENT_PROVIDER=mock (live payments frozen)')
  }

  if (env.resolved.liveProvidersEnabled && target === 'production') {
    warnings.push('Live providers enabled — ensure Edge secrets and ops approval')
  }

  return {
    generatedAt: new Date(now()).toISOString(),
    target,
    ok: errors.length === 0,
    errors,
    warnings,
    resolved: {
      paymentProvider: env.resolved.paymentProvider,
      liveProvidersEnabled: env.resolved.liveProvidersEnabled,
      logLevel,
      debug: debugFlag ?? null,
      target,
    },
  }
}
