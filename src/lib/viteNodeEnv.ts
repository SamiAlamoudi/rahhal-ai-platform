/**
 * Node/Vite middleware env bridge (process.env only).
 *
 * SPA and provider modules MUST use SecretManager → EnvironmentSecretProvider.
 * This file exists solely for vite.config.ts middleware (tsconfig.node), which
 * cannot import the app SecretManager graph under nodenext resolution.
 */

function read(key: string): string | undefined {
  const value = process.env[key]
  if (value === undefined || value === null || value === '') return undefined
  return String(value)
}

/** Env bag for api/_lib/amadeusEnv helpers. */
export function buildAmadeusEnvBag(): Record<string, string | undefined> {
  return {
    AMADEUS_API_KEY: read('AMADEUS_API_KEY'),
    AMADEUS_API_SECRET: read('AMADEUS_API_SECRET'),
    AMADEUS_CLIENT_ID: read('AMADEUS_CLIENT_ID'),
    AMADEUS_CLIENT_SECRET: read('AMADEUS_CLIENT_SECRET'),
    AMADEUS_BASE_URL: read('AMADEUS_BASE_URL'),
    AMADEUS_HOST: read('AMADEUS_HOST'),
  }
}

/** Env bag for managed API plugins (Amadeus, etc.). */
export function buildOpenAiEnvBag(): Record<string, string | undefined> {
  return {
    OPENAI_API_KEY: read('OPENAI_API_KEY'),
    OPENAI_REALTIME_MODEL: read('OPENAI_REALTIME_MODEL'),
    OPENAI_REALTIME_VOICE: read('OPENAI_REALTIME_VOICE'),
  }
}
