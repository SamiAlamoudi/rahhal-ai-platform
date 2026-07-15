/**
 * Application startup validation for staging/production.
 * Phase AI — loads centralized config, syncs feature flags, wires tracing/shutdown.
 */

import { assertValidEnvironment, validateEnvironment, type DeployTarget } from './security/envValidation'
import { getLogger } from './logging/structuredLogger'
import { createCorrelationId, getCorrelationId, setCorrelationId } from './logging/correlation'
import { installGlobalErrorHandlers } from './errors/globalHandlers'
import { getGracefulShutdown } from './reliability/gracefulShutdown'
import { installLongTaskDetector } from './performance/performanceToolkit'
import { getAppConfig, loadAppConfig, resetAppConfig } from './production/appConfig'
import { syncFeatureRegistryFromCapabilities } from './production/syncFeatureRegistry'
import { syncProviderEnablementFeatureFlags } from '../agent/aggregation/providerEnablement/syncFeatureFlags'
import { resetTracerProvider, setTracerProvider } from './production/tracing'
import { resetOpsCircuitBreaker } from './production/circuitBreaker'
import { resetFeatureRegistry } from '../ai/featureFlags'

export interface StartupOptions {
  target?: DeployTarget
  /** When true (default for staging/production), throw on invalid env. */
  failFast?: boolean
  installHandlers?: boolean
  /** Optional env snapshot for tests. */
  env?: Record<string, string | undefined>
  /** Reset singletons before boot (tests). */
  resetSingletons?: boolean
}

export interface StartupResult {
  ok: boolean
  correlationId: string
  target: DeployTarget
  paymentProvider: string
  liveCapabilities: ReturnType<typeof getAppConfig>['liveCapabilities']
  dispose: () => void
}

export function runStartup(options: StartupOptions = {}): StartupResult {
  if (options.resetSingletons) {
    resetAppConfig()
    resetFeatureRegistry()
    resetTracerProvider()
    resetOpsCircuitBreaker()
  }

  const config = loadAppConfig(options.env, { target: options.target })
  const target = options.target ?? config.target
  const failFast = options.failFast ?? (target === 'staging' || target === 'production')
  const correlationId = getCorrelationId() || createCorrelationId()
  setCorrelationId(correlationId)
  const logger = getLogger()

  const validation = failFast
    ? assertValidEnvironment({
        target,
        env: options.env,
        paymentProvider: config.paymentProvider,
        liveProvidersEnabled: config.liveCapabilities.liveProvidersMaster,
      })
    : validateEnvironment({
        target,
        env: options.env,
        paymentProvider: config.paymentProvider,
        liveProvidersEnabled: config.liveCapabilities.liveProvidersMaster,
      })

  // Keep product FeatureRegistry aligned with env-resolved capabilities (Phase AI + AJ).
  syncFeatureRegistryFromCapabilities(config.liveCapabilities)
  syncProviderEnablementFeatureFlags(options.env)

  // OTel hooks remain no-op unless a provider is registered later.
  if (!config.otelEnabled) {
    setTracerProvider(null)
  }

  logger.info('ops', 'startup', 'application_startup', {
    target,
    ok: validation.ok,
    paymentProvider: validation.resolved.paymentProvider,
    liveProvidersEnabled: validation.resolved.liveProvidersEnabled,
    liveCapabilities: validation.resolved.liveCapabilities,
    timeouts: config.timeouts,
    warnings: validation.warnings,
    correlationId,
  })

  const disposers: Array<() => void> = []
  if (options.installHandlers !== false) {
    disposers.push(installGlobalErrorHandlers())
    disposers.push(installLongTaskDetector())
  }

  const shutdown = getGracefulShutdown()
  shutdown.onShutdown(() => {
    logger.info('ops', 'shutdown', 'graceful_shutdown', {
      correlationId,
      target,
    })
  })

  return {
    ok: validation.ok,
    correlationId,
    target,
    paymentProvider: config.paymentProvider,
    liveCapabilities: config.liveCapabilities,
    dispose: () => {
      for (const d of disposers) d()
    },
  }
}

export async function requestGracefulShutdown(): Promise<void> {
  await getGracefulShutdown().shutdown()
}
