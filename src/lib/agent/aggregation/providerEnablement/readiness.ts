/**
 * Phase AJ — provider readiness checks (config shape by default; optional sandbox probe).
 */

import { getAppConfig } from '../../../ops/production/appConfig'
import {
  resolveProviderEnablementFlags,
  isCapabilityLiveEnabled,
  defaultLiveProviderForCapability,
} from './flags'
import { getProviderConfigurationRegistry, getRegistryEntry } from './registry'
import {
  hasForbiddenClientSecrets,
  isProductionAmadeusBaseUrl,
  readEnvValue,
  requiredSecretsSatisfied,
  validateSecretPresence,
} from './secrets'
import type {
  ProviderEnablementFlags,
  ProviderEnvironment,
  ProviderId,
  ProviderReadinessResult,
  ProviderRegistryEntry,
} from './types'
import { recordReadinessFailure, recordConfigurationFailure } from './metrics'

function resolveEnvironment(entry: ProviderRegistryEntry, env?: Record<string, string | undefined>): ProviderEnvironment {
  if (entry.environment === 'mock' || !entry.liveAdapterAvailable) return 'mock'
  if (entry.providerId === 'amadeus') {
    const base = readEnvValue('AMADEUS_BASE_URL', env)
    const amadeusEnv = (readEnvValue('AMADEUS_ENV', env) ?? 'sandbox').toLowerCase()
    if (amadeusEnv === 'production' || isProductionAmadeusBaseUrl(base)) return 'production'
    return 'sandbox'
  }
  const deploy = getAppConfig().target
  if (deploy === 'production') return 'production'
  return 'sandbox'
}

function buildReason(parts: string[]): string {
  return parts.filter(Boolean).join('; ') || 'ok'
}

export interface ReadinessOptions {
  env?: Record<string, string | undefined>
  flags?: ProviderEnablementFlags
  /** Never performs network by default. */
  sandboxProbe?: boolean
  circuitState?: Record<string, 'closed' | 'open' | 'half_open'>
  now?: () => string
}

/**
 * Config-only readiness for one registry entry.
 * Does not call external APIs.
 */
export function checkProviderReadiness(
  entry: ProviderRegistryEntry,
  options: ReadinessOptions = {},
): ProviderReadinessResult {
  const flags = options.flags ?? resolveProviderEnablementFlags(options.env)
  const checkedAt = (options.now ?? (() => new Date().toISOString()))()
  const secrets = validateSecretPresence(entry.requiredSecretNames, options.env)
  const forbidden = hasForbiddenClientSecrets(options.env)
  const environment = resolveEnvironment(entry, options.env)
  const capabilityLive = isCapabilityLiveEnabled(flags, entry.capability)
  const selected = flags.capabilities[entry.capability]?.provider ?? 'mock'
  const defaultLive = defaultLiveProviderForCapability(entry.capability)
  const selectedThisLive =
    capabilityLive &&
    entry.liveAdapterAvailable &&
    (selected === entry.providerId ||
      selected === entry.providerId.replace('_com', '') ||
      (selected === 'booking' && entry.providerId === 'booking_com') ||
      (selected === defaultLive))

  const secretsOk =
    entry.requiredSecretNames.length === 0 || requiredSecretsSatisfied(secrets)
  const configured = entry.liveAdapterAvailable
    ? secretsOk && forbidden.length === 0
    : true

  const reasons: string[] = []
  if (forbidden.length) {
    reasons.push(`forbidden_client_secrets:${forbidden.join(',')}`)
    recordConfigurationFailure(entry.providerId, 'forbidden_vite_secret')
  }
  if (entry.liveAdapterAvailable && !secretsOk) {
    reasons.push('missing_required_secrets')
    if (capabilityLive) recordConfigurationFailure(entry.providerId, 'missing_secrets')
  }
  if (!entry.liveAdapterAvailable && capabilityLive) {
    reasons.push('live_adapter_unavailable')
  }
  if (capabilityLive && entry.liveAdapterAvailable && !selectedThisLive && selected !== 'mock') {
    if (selected !== entry.providerId && selected !== 'amadeus' && selected !== 'booking' && selected !== 'google_maps' && selected !== 'openweather') {
      reasons.push(`invalid_provider_selection:${selected}`)
    }
  }

  // Production mode must not use sandbox Amadeus URL when environment forces production.
  if (
    environment === 'production' &&
    entry.providerId === 'amadeus' &&
    entry.liveAdapterAvailable
  ) {
    const base = readEnvValue('AMADEUS_BASE_URL', options.env)
    if (base && base.includes('test.api.amadeus.com')) {
      reasons.push('sandbox_url_in_production_mode')
      recordConfigurationFailure(entry.providerId, 'sandbox_url_in_production')
    }
  }

  const enabled = Boolean(
    entry.liveAdapterAvailable &&
      capabilityLive &&
      selectedThisLive &&
      configured &&
      !reasons.includes('sandbox_url_in_production_mode'),
  )

  const circuit = options.circuitState?.[entry.providerId] ?? 'unknown'
  if (circuit === 'open') {
    reasons.push('circuit_open')
  }

  const healthy = entry.liveAdapterAvailable
    ? enabled && circuit !== 'open' && configured
    : true

  if (!healthy && capabilityLive && entry.liveAdapterAvailable) {
    recordReadinessFailure(entry.providerId, reasons[0] ?? 'unhealthy')
  }

  // Optional sandbox probe is handled by probe.ts — readiness stays config-only here.
  if (options.sandboxProbe) {
    reasons.push('sandbox_probe_deferred')
  }

  return {
    provider: entry.providerId as ProviderId,
    capability: entry.capability,
    configured,
    enabled,
    environment,
    healthy: entry.environment === 'mock' ? true : healthy,
    reason: buildReason(reasons.length ? reasons : enabled ? ['ready'] : ['flag_or_config_off']),
    fallbackAvailable: Boolean(entry.fallbackProviderId),
    checkedAt,
    secrets: secrets.map((s) => ({
      ...s,
      // Never expose length-derived clues from values beyond existing mask.
      masked: s.present ? (s.forbiddenClientExposure ? '[redacted]' : s.masked) : '[missing]',
    })),
    circuitState: circuit,
    selectionReason: enabled ? 'live_ready' : 'not_selected',
  }
}

export function checkAllProviderReadiness(
  options: ReadinessOptions = {},
): ProviderReadinessResult[] {
  return getProviderConfigurationRegistry().map((entry) =>
    checkProviderReadiness(entry, options),
  )
}

export function checkLiveProviderReadiness(
  providerId: string,
  options: ReadinessOptions = {},
): ProviderReadinessResult | null {
  const entry = getRegistryEntry(providerId)
  if (!entry) return null
  return checkProviderReadiness(entry, options)
}
