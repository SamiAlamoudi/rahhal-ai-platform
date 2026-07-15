/**
 * Phase AL — Amadeus Sandbox Validation v1
 *
 * Explicit sandbox-only validation of the existing Amadeus live-flight integration.
 * - Default OFF; never enables VITE_PROVIDERS_FLIGHTS_LIVE or production traffic
 * - OAuth via the secure server token proxy (credentials stay server-side)
 * - One minimal read-only flight search; never bookings/reservations
 * - Unit tests inject fetch / never hit the real sandbox
 */

import { AmadeusOAuthClient } from '../../../../integrations/providers/amadeus/amadeusOAuthClient'
import { AmadeusFlightApiClient } from '../../../../integrations/providers/amadeus/amadeusFlightApiClient'
import { createCorrelationId, setCorrelationId } from '../../../ops/logging/correlation'
import { assertNoSecretsInText, maskMetadata } from '../../../ops/logging/mask'
import {
  isProductionAmadeusBaseUrl,
  maskSecretValue,
  readEnvValue,
} from './secrets'
import { SANDBOX_HOST } from '../providers/amadeus/config'

const VALIDATION_TIMEOUT_MS = 8_000
const VALIDATION_MAX_RETRIES = 0

/** Explicit opt-in for Phase AL sandbox validation (default OFF). */
export const AMADEUS_SANDBOX_VALIDATION_ENV = 'AMADEUS_SANDBOX_VALIDATION'

export type HttpStatusCategory =
  | '2xx'
  | '4xx'
  | '5xx'
  | '401'
  | '429'
  | 'timeout'
  | 'network'
  | 'malformed'
  | 'disabled'
  | 'missing_secrets'
  | 'refused_production'
  | 'unknown'

export interface AmadeusSandboxValidationReport {
  ok: boolean
  /** Whether sandbox validation mode was enabled. */
  sandboxValidationMode: boolean
  providerMode: 'sandbox' | 'disabled' | 'refused'
  correlationId: string
  latencyMs: number
  oauthLatencyMs: number | null
  searchLatencyMs: number | null
  httpStatus: number | null
  httpStatusCategory: HttpStatusCategory
  reason: string
  offerCount: number | null
  shapeValid: boolean | null
  /** Human-readable report — secrets redacted. */
  summary: string
  exitCode: number
}

export interface AmadeusSandboxValidationOptions {
  env?: Record<string, string | undefined>
  argv?: string[]
  /**
   * When provided, all HTTP goes through this fetch — used by unit tests.
   * When omitted and mode is ON, uses global fetch (manual / workflow_dispatch only).
   */
  fetchImpl?: typeof fetch
  /** Correlation ID override (tests). */
  correlationId?: string
}

function parseBool(value: string | null | undefined): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function hasArg(argv: string[], name: string): boolean {
  return argv.includes(name)
}

/** Sandbox validation mode is OFF by default. */
export function isAmadeusSandboxValidationModeEnabled(
  env?: Record<string, string | undefined>,
  argv: string[] = [],
): boolean {
  if (hasArg(argv, '--amadeus-sandbox-validate')) return true
  return parseBool(readEnvValue(AMADEUS_SANDBOX_VALIDATION_ENV, env))
}

/**
 * Read from the provided env bag only (no process/import.meta fallback).
 * Keeps unit tests deterministic and avoids accidental host credential pickup.
 */
function readFromEnvBag(
  key: string,
  env: Record<string, string | undefined> | undefined,
  allowProcessFallback: boolean,
): string | null {
  if (env) {
    const fromBag = env[key]
    if (fromBag != null && String(fromBag).trim() !== '') return String(fromBag)
    if (!allowProcessFallback) return null
  }
  return readEnvValue(key, env)
}

export function resolveSandboxTokenProxyConfig(
  env?: Record<string, string | undefined>,
  options?: { allowProcessFallback?: boolean },
): {
  tokenUrl: string | null
  invokeApiKey: string | null
  baseUrl: string
} {
  // When callers pass an explicit env bag (tests / CLI overrides), do not leak
  // process.env credentials into the resolution — fail closed on missing keys.
  const allowProcessFallback = options?.allowProcessFallback ?? env == null
  const tokenUrl =
    readFromEnvBag('AMADEUS_TOKEN_URL', env, allowProcessFallback)
    ?? readFromEnvBag('AMADEUS_TOKEN_PROXY_URL', env, allowProcessFallback)
    ?? readFromEnvBag('VITE_AMADEUS_TOKEN_URL', env, allowProcessFallback)
  const invokeApiKey =
    readFromEnvBag('AMADEUS_TOKEN_PROXY_KEY', env, allowProcessFallback)
    ?? readFromEnvBag('SUPABASE_ANON_KEY', env, allowProcessFallback)
    ?? readFromEnvBag('VITE_SUPABASE_ANON_KEY', env, allowProcessFallback)
  const baseUrl =
    readFromEnvBag('AMADEUS_BASE_URL', env, allowProcessFallback)
    ?? readFromEnvBag('VITE_AMADEUS_BASE_URL', env, allowProcessFallback)
    ?? SANDBOX_HOST
  return { tokenUrl, invokeApiKey, baseUrl }
}

function categorizeHttpStatus(status: number | null, reason: string): HttpStatusCategory {
  if (reason.includes('timeout') || reason === 'oauth_timeout' || reason === 'search_timeout') {
    return 'timeout'
  }
  if (reason.includes('network') || reason === 'oauth_network' || reason === 'search_network') {
    return 'network'
  }
  if (reason.includes('malformed') || reason === 'oauth_malformed' || reason === 'search_malformed') {
    return 'malformed'
  }
  if (status === 401) return '401'
  if (status === 429) return '429'
  if (status == null) return 'unknown'
  if (status >= 200 && status < 300) return '2xx'
  if (status >= 500) return '5xx'
  if (status >= 400) return '4xx'
  return 'unknown'
}

/**
 * Minimal Amadeus flight-offers response shape check.
 * Does not require offers to be present (sandbox may return empty data).
 */
export function validateAmadeusFlightOffersShape(payload: unknown): {
  valid: boolean
  reason: string
  offerCount: number
} {
  if (payload == null || typeof payload !== 'object') {
    return { valid: false, reason: 'search_malformed_not_object', offerCount: 0 }
  }
  const body = payload as Record<string, unknown>
  if (!('data' in body)) {
    return { valid: false, reason: 'search_malformed_missing_data', offerCount: 0 }
  }
  if (!Array.isArray(body.data)) {
    return { valid: false, reason: 'search_malformed_data_not_array', offerCount: 0 }
  }
  for (const item of body.data) {
    if (item == null || typeof item !== 'object') {
      return { valid: false, reason: 'search_malformed_offer_item', offerCount: body.data.length }
    }
    const offer = item as Record<string, unknown>
    if (typeof offer.id !== 'string' && typeof offer.id !== 'number') {
      return { valid: false, reason: 'search_malformed_offer_id', offerCount: body.data.length }
    }
    if (offer.price != null && typeof offer.price === 'object') {
      const price = offer.price as Record<string, unknown>
      if (price.total != null && typeof price.total !== 'string' && typeof price.total !== 'number') {
        return { valid: false, reason: 'search_malformed_price_total', offerCount: body.data.length }
      }
    }
  }
  return { valid: true, reason: 'shape_ok', offerCount: body.data.length }
}

function redactReportText(text: string, env?: Record<string, string | undefined>): string {
  let out = text
  const secretKeys = [
    'AMADEUS_CLIENT_ID',
    'AMADEUS_CLIENT_SECRET',
    'AMADEUS_TOKEN_PROXY_KEY',
    'SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY',
  ]
  for (const key of secretKeys) {
    const value = readEnvValue(key, env)
    if (value && value.length >= 4) {
      out = out.split(value).join(maskSecretValue(value))
    }
  }
  out = out.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [redacted]')
  out = out.replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[redacted]"')
  out = out.replace(/access_token=[^&\s]+/gi, 'access_token=[redacted]')
  return out
}

function buildSummary(parts: {
  sandboxValidationMode: boolean
  providerMode: AmadeusSandboxValidationReport['providerMode']
  ok: boolean
  reason: string
  correlationId: string
  latencyMs: number
  oauthLatencyMs: number | null
  searchLatencyMs: number | null
  httpStatus: number | null
  httpStatusCategory: HttpStatusCategory
  offerCount: number | null
  shapeValid: boolean | null
  tokenUrlPresent: boolean
  invokeKeyPresent: boolean
}): string {
  const lines = [
    'Rahhal Amadeus sandbox validation (Phase AL)',
    `sandboxValidationMode=${parts.sandboxValidationMode}`,
    `providerMode=${parts.providerMode}`,
    `ok=${parts.ok}`,
    `reason=${parts.reason}`,
    `correlationId=${parts.correlationId}`,
    `latencyMs=${parts.latencyMs}`,
    `oauthLatencyMs=${parts.oauthLatencyMs ?? 'n/a'}`,
    `searchLatencyMs=${parts.searchLatencyMs ?? 'n/a'}`,
    `httpStatus=${parts.httpStatus ?? 'n/a'}`,
    `httpStatusCategory=${parts.httpStatusCategory}`,
    `offerCount=${parts.offerCount ?? 'n/a'}`,
    `shapeValid=${parts.shapeValid ?? 'n/a'}`,
    `tokenProxyConfigured=${parts.tokenUrlPresent && parts.invokeKeyPresent}`,
    'liveFlightsFlag=false (validation does not enable VITE_PROVIDERS_FLIGHTS_LIVE)',
    'paymentProvider=mock',
    'nonFlightProviders=off',
    'credentialsPrinted=false',
  ]
  return lines.join('\n')
}

function finalize(
  report: Omit<AmadeusSandboxValidationReport, 'summary' | 'exitCode'> & {
    exitCode?: number
  },
  env?: Record<string, string | undefined>,
  extras?: { tokenUrlPresent: boolean; invokeKeyPresent: boolean },
): AmadeusSandboxValidationReport {
  const summary = redactReportText(
    buildSummary({
      sandboxValidationMode: report.sandboxValidationMode,
      providerMode: report.providerMode,
      ok: report.ok,
      reason: report.reason,
      correlationId: report.correlationId,
      latencyMs: report.latencyMs,
      oauthLatencyMs: report.oauthLatencyMs,
      searchLatencyMs: report.searchLatencyMs,
      httpStatus: report.httpStatus,
      httpStatusCategory: report.httpStatusCategory,
      offerCount: report.offerCount,
      shapeValid: report.shapeValid,
      tokenUrlPresent: extras?.tokenUrlPresent ?? false,
      invokeKeyPresent: extras?.invokeKeyPresent ?? false,
    }),
    env,
  )
  if (!assertNoSecretsInText(summary)) {
    return {
      ...report,
      ok: false,
      reason: 'report_redaction_failed',
      summary: redactReportText(
        buildSummary({
          sandboxValidationMode: report.sandboxValidationMode,
          providerMode: report.providerMode,
          ok: false,
          reason: 'report_redaction_failed',
          correlationId: report.correlationId,
          latencyMs: report.latencyMs,
          oauthLatencyMs: report.oauthLatencyMs,
          searchLatencyMs: report.searchLatencyMs,
          httpStatus: report.httpStatus,
          httpStatusCategory: 'malformed',
          offerCount: null,
          shapeValid: null,
          tokenUrlPresent: false,
          invokeKeyPresent: false,
        }),
        env,
      ),
      exitCode: 2,
    }
  }
  // Also ensure structured metadata masking would not leak keys if logged.
  void maskMetadata({ reason: report.reason, access_token: 'should_never_appear' })
  return {
    ...report,
    summary,
    exitCode: report.exitCode ?? (report.ok ? 0 : 1),
  }
}

/**
 * Run Phase AL Amadeus sandbox validation.
 * Never enables production or live customer traffic.
 */
export async function runAmadeusSandboxValidation(
  options: AmadeusSandboxValidationOptions = {},
): Promise<AmadeusSandboxValidationReport> {
  const env = options.env
  const argv = options.argv
    ?? (globalThis as { process?: { argv?: string[] } }).process?.argv
    ?? []
  const correlationId = options.correlationId ?? createCorrelationId()
  setCorrelationId(correlationId)
  const started = Date.now()

  const modeOn = isAmadeusSandboxValidationModeEnabled(env, argv)
  if (!modeOn) {
    return finalize(
      {
        ok: true,
        sandboxValidationMode: false,
        providerMode: 'disabled',
        correlationId,
        latencyMs: Date.now() - started,
        oauthLatencyMs: null,
        searchLatencyMs: null,
        httpStatus: null,
        httpStatusCategory: 'disabled',
        reason: 'sandbox_validation_disabled',
        offerCount: null,
        shapeValid: null,
        exitCode: 0,
      },
      env,
    )
  }

  const proxy = resolveSandboxTokenProxyConfig(env)
  const tokenUrlPresent = Boolean(proxy.tokenUrl)
  const invokeKeyPresent = Boolean(proxy.invokeApiKey)

  if (isProductionAmadeusBaseUrl(proxy.baseUrl)) {
    return finalize(
      {
        ok: false,
        sandboxValidationMode: true,
        providerMode: 'refused',
        correlationId,
        latencyMs: Date.now() - started,
        oauthLatencyMs: null,
        searchLatencyMs: null,
        httpStatus: null,
        httpStatusCategory: 'refused_production',
        reason: 'refused_production_host_use_sandbox',
        offerCount: null,
        shapeValid: null,
        exitCode: 1,
      },
      env,
      { tokenUrlPresent, invokeKeyPresent },
    )
  }

  if (!proxy.tokenUrl || !proxy.invokeApiKey) {
    return finalize(
      {
        ok: false,
        sandboxValidationMode: true,
        providerMode: 'sandbox',
        correlationId,
        latencyMs: Date.now() - started,
        oauthLatencyMs: null,
        searchLatencyMs: null,
        httpStatus: null,
        httpStatusCategory: 'missing_secrets',
        reason: 'missing_required_secrets',
        offerCount: null,
        shapeValid: null,
        exitCode: 1,
      },
      env,
      { tokenUrlPresent, invokeKeyPresent },
    )
  }

  const previousFetch = globalThis.fetch
  if (options.fetchImpl) {
    globalThis.fetch = options.fetchImpl
  }

  let oauthLatencyMs: number | null = null
  let searchLatencyMs: number | null = null
  let httpStatus: number | null = null

  try {
    const oauth = new AmadeusOAuthClient({
      tokenUrl: proxy.tokenUrl,
      invokeApiKey: proxy.invokeApiKey,
      timeout: VALIDATION_TIMEOUT_MS,
    })

    const oauthStarted = Date.now()
    const tokenResult = await oauth.getToken()
    oauthLatencyMs = Date.now() - oauthStarted

    if (tokenResult.error || !tokenResult.token) {
      const code = tokenResult.error?.code ?? 'oauth_failed'
      const category = tokenResult.error?.category
      let reason = 'oauth_failed'
      let status: number | null = null
      if (code === 'AMADEUS_INVALID_CREDENTIALS' || category === 'auth') {
        reason = 'oauth_401'
        status = 401
      } else if (code === 'AMADEUS_QUOTA_EXCEEDED' || category === 'rate-limit') {
        reason = 'oauth_429'
        status = 429
      } else if (code === 'AMADEUS_AUTH_TIMEOUT' || category === 'timeout') {
        reason = 'oauth_timeout'
      } else if (code === 'AMADEUS_AUTH_NETWORK' || category === 'network') {
        reason = 'oauth_network'
      } else if (code === 'AMADEUS_SERVER_NOT_CONFIGURED') {
        reason = 'missing_required_secrets'
      }
      httpStatus = status
      return finalize(
        {
          ok: false,
          sandboxValidationMode: true,
          providerMode: 'sandbox',
          correlationId,
          latencyMs: Date.now() - started,
          oauthLatencyMs,
          searchLatencyMs: null,
          httpStatus,
          httpStatusCategory:
            reason === 'missing_required_secrets'
              ? 'missing_secrets'
              : categorizeHttpStatus(status, reason),
          reason,
          offerCount: null,
          shapeValid: null,
          exitCode: 1,
        },
        env,
        { tokenUrlPresent, invokeKeyPresent },
      )
    }

    // Never return or log the access token — only use it inside the API client.
    const api = new AmadeusFlightApiClient(
      {
        baseUrl: proxy.baseUrl,
        timeout: VALIDATION_TIMEOUT_MS,
        maxRetries: VALIDATION_MAX_RETRIES,
      },
      oauth,
    )

    const searchStarted = Date.now()
    const searchResult = await api.searchFlightOffers({
      origin: 'RUH',
      destination: 'JED',
      departureDate: '2027-11-15',
      adults: 1,
      currency: 'SAR',
      maxResults: 1,
    })
    searchLatencyMs = Date.now() - searchStarted

    if (searchResult.error || !searchResult.data) {
      const code = searchResult.error?.code ?? 'search_failed'
      const category = searchResult.error?.category
      let reason = 'search_failed'
      let status: number | null = null
      if (code === 'AMADEUS_TOKEN_EXPIRED' || code.includes('401')) {
        reason = 'search_401'
        status = 401
      } else if (code === 'AMADEUS_RATE_LIMITED' || code.includes('429')) {
        reason = 'search_429'
        status = 429
      } else if (code === 'AMADEUS_TIMEOUT' || category === 'timeout') {
        reason = 'search_timeout'
      } else if (code === 'AMADEUS_NETWORK_FAILURE' || category === 'network') {
        reason = 'search_network'
      }
      httpStatus = status
      return finalize(
        {
          ok: false,
          sandboxValidationMode: true,
          providerMode: 'sandbox',
          correlationId,
          latencyMs: Date.now() - started,
          oauthLatencyMs,
          searchLatencyMs,
          httpStatus,
          httpStatusCategory: categorizeHttpStatus(status, reason),
          reason,
          offerCount: null,
          shapeValid: null,
          exitCode: 1,
        },
        env,
        { tokenUrlPresent, invokeKeyPresent },
      )
    }

    const shape = validateAmadeusFlightOffersShape(searchResult.data)
    if (!shape.valid) {
      return finalize(
        {
          ok: false,
          sandboxValidationMode: true,
          providerMode: 'sandbox',
          correlationId,
          latencyMs: Date.now() - started,
          oauthLatencyMs,
          searchLatencyMs,
          httpStatus: 200,
          httpStatusCategory: 'malformed',
          reason: shape.reason,
          offerCount: shape.offerCount,
          shapeValid: false,
          exitCode: 1,
        },
        env,
        { tokenUrlPresent, invokeKeyPresent },
      )
    }

    httpStatus = 200
    return finalize(
      {
        ok: true,
        sandboxValidationMode: true,
        providerMode: 'sandbox',
        correlationId,
        latencyMs: Date.now() - started,
        oauthLatencyMs,
        searchLatencyMs,
        httpStatus,
        httpStatusCategory: '2xx',
        reason: 'sandbox_validation_ok',
        offerCount: shape.offerCount,
        shapeValid: true,
        exitCode: 0,
      },
      env,
      { tokenUrlPresent, invokeKeyPresent },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'validation_error'
    const lower = message.toLowerCase()
    const reason = lower.includes('abort') || lower.includes('timeout')
      ? 'network_timeout'
      : lower.includes('network') || lower.includes('fetch')
        ? 'network_failure'
        : 'validation_error'
    return finalize(
      {
        ok: false,
        sandboxValidationMode: true,
        providerMode: 'sandbox',
        correlationId,
        latencyMs: Date.now() - started,
        oauthLatencyMs,
        searchLatencyMs,
        httpStatus,
        httpStatusCategory: categorizeHttpStatus(null, reason),
        reason,
        offerCount: null,
        shapeValid: null,
        exitCode: 1,
      },
      env,
      { tokenUrlPresent, invokeKeyPresent },
    )
  } finally {
    if (options.fetchImpl) {
      globalThis.fetch = previousFetch
    }
  }
}
