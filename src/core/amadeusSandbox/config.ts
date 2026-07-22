/**
 * Sprint 92 — Amadeus sandbox config / secrets resolution (never expose values).
 */

import {
  AMADEUS_SANDBOX_DEFAULT_BASE_URL,
  type AmadeusSandboxConfig,
} from './types'

function readEnv(key: string): string | null {
  try {
    const vite = (import.meta as { env?: Record<string, unknown> }).env?.[key]
    if (vite !== undefined && vite !== null && String(vite) !== '') return String(vite)
  } catch {
    /* ignore */
  }
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    const value = proc?.env?.[key]
    if (value !== undefined && value !== null && value !== '') return String(value)
  } catch {
    /* ignore */
  }
  return null
}

export function readAmadeusClientId(
  env: Record<string, string | undefined> = {},
): string | null {
  return env.AMADEUS_API_KEY
    ?? env.AMADEUS_CLIENT_ID
    ?? readEnv('AMADEUS_API_KEY')
    ?? readEnv('AMADEUS_CLIENT_ID')
    ?? null
}

export function readAmadeusClientSecret(
  env: Record<string, string | undefined> = {},
): string | null {
  return env.AMADEUS_API_SECRET
    ?? env.AMADEUS_CLIENT_SECRET
    ?? readEnv('AMADEUS_API_SECRET')
    ?? readEnv('AMADEUS_CLIENT_SECRET')
    ?? null
}

export function readAmadeusBaseUrl(
  env: Record<string, string | undefined> = {},
): string {
  return env.AMADEUS_BASE_URL
    ?? readEnv('AMADEUS_BASE_URL')
    ?? AMADEUS_SANDBOX_DEFAULT_BASE_URL
}

export function resolveAmadeusSandboxConfig(options?: {
  clientId?: string
  clientSecret?: string
  baseUrl?: string
  env?: Record<string, string | undefined>
}): AmadeusSandboxConfig {
  const env = options?.env ?? {}
  const clientId = options?.clientId ?? readAmadeusClientId(env) ?? ''
  const clientSecret = options?.clientSecret ?? readAmadeusClientSecret(env) ?? ''
  const baseUrl = options?.baseUrl ?? readAmadeusBaseUrl(env)
  return {
    clientId,
    clientSecret,
    baseUrl,
    hasCredentials: Boolean(clientId && clientSecret),
  }
}

/** Production deploy targets force Amadeus flag default OFF. */
export function isProductionDeployTarget(
  env: Record<string, string | undefined> = {},
): boolean {
  const target = (
    env.VITE_DEPLOY_TARGET
    ?? readEnv('VITE_DEPLOY_TARGET')
    ?? env.NODE_ENV
    ?? readEnv('NODE_ENV')
    ?? ''
  ).toLowerCase()
  return target === 'production' || target === 'prod'
}

export function parseBoolEnv(value: string | null | undefined, fallback: boolean): boolean {
  if (value == null || value === '') return fallback
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return fallback
}
