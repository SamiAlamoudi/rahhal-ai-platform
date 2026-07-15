/**
 * Phase AJ — server-side secret presence validation (never stores or logs values).
 */

import type { SecretPresenceResult } from './types'

function readRawEnv(key: string, env?: Record<string, string | undefined>): string | null {
  const fromInput = env?.[key]
  if (fromInput != null && String(fromInput).trim() !== '') return String(fromInput)
  try {
    const vite = (import.meta as { env?: Record<string, unknown> }).env?.[key]
    if (vite != null && String(vite) !== '') return String(vite)
  } catch {
    /* ignore */
  }
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    const value = proc?.env?.[key]
    if (value != null && value !== '') return String(value)
  } catch {
    /* ignore */
  }
  return null
}

/** Mask a secret value for diagnostics — never echo the raw credential. */
export function maskSecretValue(value: string | null | undefined): string {
  if (value == null || value === '') return '[missing]'
  if (value.length <= 4) return '****'
  return `${value.slice(0, 2)}…[redacted:${value.length}]`
}

export const FORBIDDEN_VITE_SECRET_KEYS = [
  'VITE_AMADEUS_CLIENT_ID',
  'VITE_AMADEUS_CLIENT_SECRET',
  'VITE_OPENWEATHER_API_KEY',
  'VITE_GOOGLE_MAPS_API_KEY',
  'VITE_BOOKING_RAPIDAPI_KEY',
  'VITE_MOYASAR_SECRET_KEY',
  'VITE_MOYASAR_SECRET',
] as const

/**
 * Check presence of expected secret names. Values are never returned unmasked.
 * BOOKING_RAPIDAPI_KEY may be satisfied by RAPIDAPI_KEY as an alternate server key.
 */
export function validateSecretPresence(
  requiredSecretNames: string[],
  env?: Record<string, string | undefined>,
): SecretPresenceResult[] {
  return requiredSecretNames.map((name) => {
    let value = readRawEnv(name, env)
    if (!value && name === 'BOOKING_RAPIDAPI_KEY') {
      value = readRawEnv('RAPIDAPI_KEY', env)
    }
    const viteKey = name.startsWith('VITE_') ? name : `VITE_${name}`
    const forbiddenClientExposure = Boolean(readRawEnv(viteKey, env))
    return {
      name,
      present: Boolean(value),
      masked: maskSecretValue(value),
      forbiddenClientExposure,
    }
  })
}

export function requiredSecretsSatisfied(secrets: SecretPresenceResult[]): boolean {
  if (secrets.some((s) => s.forbiddenClientExposure)) return false
  return secrets.every((s) => s.present)
}

export function hasForbiddenClientSecrets(env?: Record<string, string | undefined>): string[] {
  return FORBIDDEN_VITE_SECRET_KEYS.filter((k) => Boolean(readRawEnv(k, env)))
}

/** Detect obvious production Amadeus hosts. */
export function isProductionAmadeusBaseUrl(baseUrl: string | null | undefined): boolean {
  if (!baseUrl) return false
  const host = baseUrl.toLowerCase()
  return host.includes('://api.amadeus.com') && !host.includes('test.api.amadeus.com')
}

export function readEnvValue(key: string, env?: Record<string, string | undefined>): string | null {
  return readRawEnv(key, env)
}
