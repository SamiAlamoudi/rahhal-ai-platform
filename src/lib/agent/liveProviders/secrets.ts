/**
 * Secrets Management — Sprint 56
 *
 * Supports `.env`, Vercel, and GitHub Actions env injection.
 * Never expose API keys in client-facing payloads or logs.
 *
 * Amadeus OAuth secrets MUST remain server-only
 * (`AMADEUS_API_KEY` / `AMADEUS_API_SECRET`, or aliases
 * `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET`) — never `VITE_*`.
 * Duffel tokens follow the same rule (`DUFFEL_API_TOKEN`).
 */

import {
  hasAmadeusCredentials,
  hasBookingCredentials,
  hasDuffelCredentials,
  readLiveProviderSecret,
} from './feature'

export type LiveProviderSecretsSnapshot = {
  amadeusConfigured: boolean
  duffelConfigured: boolean
  bookingConfigured: boolean
  /** Never includes secret values — only presence flags. */
  sources: {
    env: boolean
    vercel: boolean
    githubActions: boolean
  }
}

function readProcessEnv(key: string): string | undefined {
  try {
    return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
      key
    ]
  } catch {
    return undefined
  }
}

export function detectSecretSources(): LiveProviderSecretsSnapshot['sources'] {
  const vercel = Boolean(readProcessEnv('VERCEL') || readProcessEnv('VERCEL_ENV'))
  const githubActions = Boolean(readProcessEnv('GITHUB_ACTIONS'))
  const envLocal = Boolean(
    readLiveProviderSecret('AMADEUS_API_KEY') ||
      readLiveProviderSecret('AMADEUS_CLIENT_ID') ||
      readLiveProviderSecret('DUFFEL_API_TOKEN') ||
      readLiveProviderSecret('RAPIDAPI_KEY') ||
      readLiveProviderSecret('BOOKING_RAPIDAPI_KEY'),
  )
  return { env: envLocal, vercel, githubActions }
}

export function snapshotLiveProviderSecrets(): LiveProviderSecretsSnapshot {
  return {
    amadeusConfigured: hasAmadeusCredentials(),
    duffelConfigured: hasDuffelCredentials(),
    bookingConfigured: hasBookingCredentials(),
    sources: detectSecretSources(),
  }
}

/** Safe redaction helper — never returns secret material. */
export function redactSecrets(value: string): string {
  if (!value) return value
  if (value.length <= 8) return '***'
  return `${value.slice(0, 2)}…${value.slice(-2)}`
}

export {
  readLiveProviderSecret,
  readAmadeusApiKey,
  readAmadeusApiSecret,
  hasAmadeusCredentials,
  hasDuffelCredentials,
  hasBookingCredentials,
}
