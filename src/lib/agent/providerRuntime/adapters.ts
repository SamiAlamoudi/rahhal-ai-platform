/**
 * Sprint 71 — Provider adapter factories (Amadeus / Duffel / Booking.com / mock).
 * Feature-flag + credential gated; never crash — fall back to mock mode.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import { createAmadeusLiveProvider } from '../liveProviders/adapters/amadeus'
import { createBookingLiveProvider } from '../liveProviders/adapters/booking'
import { createDuffelLiveProvider } from '../liveProviders/adapters/duffel'
import {
  hasAmadeusCredentials,
  hasBookingCredentials,
  hasDuffelCredentials,
  isLiveProviderEnabled,
  isLiveProvidersEnabled,
} from '../liveProviders/feature'
import type { LiveFetch, LiveProviderSdk } from '../liveProviders/types'
import { ProviderRuntimeHealthMonitor } from './healthMonitor'
import { createProviderRetryPolicy, type ProviderRetryPolicy } from './retryPolicy'
import { validateProviderSecrets } from './secretsDiagnostics'
import type { ProviderRuntimeAdapter, ProviderRuntimeId, ProviderRuntimeMode } from './types'
import { wrapLiveSdkAsRuntimeAdapter } from './wrapAdapter'

export type CreateRuntimeAdapterOptions = {
  fetchImpl?: LiveFetch
  healthMonitor: ProviderRuntimeHealthMonitor
  retry?: ProviderRetryPolicy
  /** Force mock regardless of flags/secrets. */
  forceMock?: boolean
  /** Override live enable for tests. */
  forceLive?: boolean
}

function resolveMode(
  providerId: Exclude<ProviderRuntimeId, 'mock'>,
  options: CreateRuntimeAdapterOptions,
): { mode: ProviderRuntimeMode; authOk: boolean; detail: string; sdk: LiveProviderSdk | null } {
  const secrets = validateProviderSecrets(providerId)
  if (options.forceMock) {
    return {
      mode: 'mock',
      authOk: true,
      detail: 'Forced mock mode',
      sdk: null,
    }
  }

  const masterOn = options.forceLive || isLiveProvidersEnabled()
  const flagOn =
    options.forceLive
    || (providerId === 'amadeus'
      ? getFeatureRegistry().isEnabled('provider.amadeus')
      : providerId === 'duffel'
        ? getFeatureRegistry().isEnabled('provider.duffel')
        : getFeatureRegistry().isEnabled('provider.booking'))
  const envOn = options.forceLive || isLiveProviderEnabled(providerId)
  const creds =
    providerId === 'amadeus'
      ? hasAmadeusCredentials()
      : providerId === 'duffel'
        ? hasDuffelCredentials()
        : hasBookingCredentials()

  if (!masterOn || !flagOn || !envOn || !creds) {
    return {
      mode: 'mock',
      authOk: true,
      detail: secrets.ok
        ? 'Feature/env gated OFF — using mock'
        : secrets.detail,
      sdk: null,
    }
  }

  try {
    const sdk =
      providerId === 'amadeus'
        ? createAmadeusLiveProvider({ fetchImpl: options.fetchImpl })
        : providerId === 'duffel'
          ? createDuffelLiveProvider({ fetchImpl: options.fetchImpl })
          : createBookingLiveProvider({ fetchImpl: options.fetchImpl })
    return {
      mode: 'live',
      authOk: true,
      detail: `${providerId} live adapter ready`,
      sdk,
    }
  } catch (err) {
    return {
      mode: 'mock',
      authOk: false,
      detail: `Adapter init failed — mock fallback (${err instanceof Error ? err.message : 'error'})`,
      sdk: null,
    }
  }
}

export function createMockRuntimeAdapter(
  healthMonitor: ProviderRuntimeHealthMonitor,
  retry?: ProviderRetryPolicy,
): ProviderRuntimeAdapter {
  return wrapLiveSdkAsRuntimeAdapter({
    providerId: 'mock',
    displayName: 'Mock Provider',
    mode: 'mock',
    sdk: null,
    healthMonitor,
    retry: retry ?? createProviderRetryPolicy(),
    authOk: true,
    authDetail: 'Always-available mock provider',
  })
}

export function createAmadeusRuntimeAdapter(
  options: CreateRuntimeAdapterOptions,
): ProviderRuntimeAdapter {
  const resolved = resolveMode('amadeus', options)
  return wrapLiveSdkAsRuntimeAdapter({
    providerId: 'amadeus',
    displayName: 'Amadeus',
    mode: resolved.mode,
    sdk: resolved.sdk,
    healthMonitor: options.healthMonitor,
    retry: options.retry,
    authOk: resolved.authOk,
    authDetail: resolved.detail,
  })
}

export function createDuffelRuntimeAdapter(
  options: CreateRuntimeAdapterOptions,
): ProviderRuntimeAdapter {
  const resolved = resolveMode('duffel', options)
  return wrapLiveSdkAsRuntimeAdapter({
    providerId: 'duffel',
    displayName: 'Duffel',
    mode: resolved.mode,
    sdk: resolved.sdk,
    healthMonitor: options.healthMonitor,
    retry: options.retry,
    authOk: resolved.authOk,
    authDetail: resolved.detail,
  })
}

export function createBookingComRuntimeAdapter(
  options: CreateRuntimeAdapterOptions,
): ProviderRuntimeAdapter {
  const resolved = resolveMode('booking', options)
  return wrapLiveSdkAsRuntimeAdapter({
    providerId: 'booking',
    displayName: 'Booking.com',
    mode: resolved.mode,
    sdk: resolved.sdk,
    healthMonitor: options.healthMonitor,
    retry: options.retry,
    authOk: resolved.authOk,
    authDetail: resolved.detail,
  })
}
