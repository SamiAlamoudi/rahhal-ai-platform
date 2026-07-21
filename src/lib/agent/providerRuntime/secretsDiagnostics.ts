/**
 * Sprint 71 — Secret validation diagnostics (never exposes secret values).
 */

import {
  hasAmadeusCredentials,
  hasBookingCredentials,
  hasDuffelCredentials,
  readLiveProviderSecret,
} from '../liveProviders/feature'
import type { ProviderRuntimeId, ProviderSecretDiagnostic } from './types'

const REQUIRED: Record<Exclude<ProviderRuntimeId, 'mock'>, string[]> = {
  amadeus: ['AMADEUS_API_KEY|AMADEUS_CLIENT_ID', 'AMADEUS_API_SECRET|AMADEUS_CLIENT_SECRET'],
  duffel: ['DUFFEL_API_TOKEN'],
  booking: ['BOOKING_API_KEY|RAPIDAPI_KEY|BOOKING_RAPIDAPI_KEY'],
}

function keyPresent(altGroup: string): boolean {
  return altGroup.split('|').some((k) => Boolean(readLiveProviderSecret(k.trim())))
}

export function validateProviderSecrets(
  providerId: ProviderRuntimeId,
): ProviderSecretDiagnostic {
  if (providerId === 'mock') {
    return {
      providerId: 'mock',
      requiredKeys: [],
      presentKeys: [],
      missingKeys: [],
      ok: true,
      detail: 'Mock provider requires no secrets',
    }
  }

  const required = REQUIRED[providerId]
  const presentKeys: string[] = []
  const missingKeys: string[] = []
  for (const group of required) {
    if (keyPresent(group)) presentKeys.push(group)
    else missingKeys.push(group)
  }

  const ok =
    providerId === 'amadeus'
      ? hasAmadeusCredentials()
      : providerId === 'duffel'
        ? hasDuffelCredentials()
        : hasBookingCredentials()

  return {
    providerId,
    requiredKeys: [...required],
    presentKeys,
    missingKeys,
    ok,
    detail: ok
      ? `${providerId} credentials present (values redacted)`
      : `${providerId} missing credentials — will use mock fallback`,
  }
}

export function validateAllProviderSecrets(): ProviderSecretDiagnostic[] {
  return (['amadeus', 'duffel', 'booking', 'mock'] as ProviderRuntimeId[]).map(
    validateProviderSecrets,
  )
}
