/**
 * Application startup validation for staging/production.
 */

import { assertValidEnvironment, validateEnvironment, type DeployTarget } from './security/envValidation'
import { getLogger } from './logging/structuredLogger'
import { getCorrelationId } from './logging/correlation'
import { installGlobalErrorHandlers } from './errors/globalHandlers'
import { getGracefulShutdown } from './reliability/gracefulShutdown'
import { installLongTaskDetector } from './performance/performanceToolkit'

export interface StartupOptions {
  target?: DeployTarget
  /** When true (default for staging/production), throw on invalid env. */
  failFast?: boolean
  installHandlers?: boolean
}

export interface StartupResult {
  ok: boolean
  correlationId: string
  target: DeployTarget
  dispose: () => void
}

export function runStartup(options: StartupOptions = {}): StartupResult {
  const target = options.target
    ?? (readTargetFromEnv() ?? 'development')
  const failFast = options.failFast
    ?? (target === 'preview' || target === 'staging' || target === 'production')
  const correlationId = getCorrelationId()
  const logger = getLogger()

  const validation = failFast
    ? assertValidEnvironment({ target })
    : validateEnvironment({ target })

  logger.info('ops', 'startup', 'application_startup', {
    target,
    ok: validation.ok,
    paymentProvider: validation.resolved.paymentProvider,
    liveProvidersEnabled: validation.resolved.liveProvidersEnabled,
    warnings: validation.warnings,
  })

  const disposers: Array<() => void> = []
  if (options.installHandlers !== false) {
    disposers.push(installGlobalErrorHandlers())
    disposers.push(installLongTaskDetector())
  }

  const shutdown = getGracefulShutdown()
  shutdown.onShutdown(() => {
    logger.info('ops', 'shutdown', 'graceful_shutdown', { correlationId })
  })

  return {
    ok: validation.ok,
    correlationId,
    target,
    dispose: () => {
      for (const d of disposers) d()
    },
  }
}

function readTargetFromEnv(): DeployTarget | null {
  try {
    const value = (import.meta as { env?: Record<string, unknown> }).env?.VITE_DEPLOY_TARGET
    if (
      value === 'preview'
      || value === 'staging'
      || value === 'production'
      || value === 'development'
    ) {
      return value
    }
  } catch {
    /* ignore */
  }
  return null
}
