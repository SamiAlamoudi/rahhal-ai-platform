/**
 * Security policy helpers — headers, CORS, request size, rate limits, brute-force.
 */

import { checkRateLimit, clearRateLimit } from '../../security/securityUtils'
import { getOpsMetrics } from '../observability/metricsRegistry'

export interface SecurityHeaderOptions {
  /**
   * Vite/React Refresh injects an inline preamble script and opens a local
   * HMR websocket. Production/preview CSP stays strict; only the Vite *dev*
   * server should pass `{ development: true }`.
   */
  development?: boolean
}

/** Build security headers. Keep vite.config.ts on this helper (do not fork). */
export function buildSecurityHeaders(
  options: SecurityHeaderOptions = {},
): Record<string, string> {
  const development = options.development === true
  const scriptSrc = development ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'"
  const connectSrc = [
    "connect-src 'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://test.api.amadeus.com',
    'https://api.amadeus.com',
    'https://api.openai.com',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    // Vite HMR websocket + local module graph (port varies; allow ws/http schemes in dev only).
    ...(development ? ['ws:', 'wss:', 'http://localhost:*', 'http://127.0.0.1:*'] : []),
  ].join(' ')

  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https:",
      // HTMLAudioElement TTS plays MP3 blobs from /api/tts.
      "media-src 'self' blob: data:",
      connectSrc,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // microphone=(self) for Web Speech STT; autoplay=(self) for TTS HTMLAudioElement after gesture.
    'Permissions-Policy': 'camera=(), microphone=(self), geolocation=(), autoplay=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'X-DNS-Prefetch-Control': 'off',
  }
}

/** Production / preview defaults (strict CSP). */
export const SECURITY_HEADERS: Record<string, string> = buildSecurityHeaders()

export const DEFAULT_CORS_ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type, x-correlation-id'
export const DEFAULT_MAX_REQUEST_BYTES = 256 * 1024

export interface CorsPolicy {
  allowOrigin: string
  allowMethods: string
  allowHeaders: string
  maxAge: string
}

/** Restrictive CORS for staging/production when allowlist provided. */
export function buildCorsPolicy(options: {
  allowedOrigins?: string[]
  requestOrigin?: string | null
}): CorsPolicy {
  const allowlist = options.allowedOrigins?.filter(Boolean) ?? []
  const requestOrigin = options.requestOrigin ?? null
  let allowOrigin = 'null'
  if (allowlist.length === 0) {
    allowOrigin = '*'
  } else if (requestOrigin && allowlist.includes(requestOrigin)) {
    allowOrigin = requestOrigin
  } else if (allowlist.length === 1) {
    allowOrigin = allowlist[0]
  }

  return {
    allowOrigin,
    allowMethods: 'GET, POST, OPTIONS',
    allowHeaders: DEFAULT_CORS_ALLOW_HEADERS,
    maxAge: '86400',
  }
}

export function assertRequestSize(bytes: number, maxBytes = DEFAULT_MAX_REQUEST_BYTES): void {
  if (bytes > maxBytes) {
    throw new Error(`request_too_large:${bytes}>${maxBytes}`)
  }
}

/** Escape HTML for safe text rendering (output escaping). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function validateNonEmptyString(value: unknown, maxLen = 500): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLen) return null
  return trimmed
}

export type RateLimitDomain =
  | 'auth'
  | 'search'
  | 'booking'
  | 'payment'
  | 'ticketing'
  | 'notification'
  | 'ops'
  | 'default'

const DOMAIN_LIMITS: Record<RateLimitDomain, number> = {
  auth: 10,
  search: 60,
  booking: 30,
  payment: 20,
  ticketing: 20,
  notification: 40,
  ops: 120,
  default: 30,
}

export function checkDomainRateLimit(
  domain: RateLimitDomain,
  key: string,
  maxRequests?: number,
): boolean {
  const allowed = checkRateLimit(`${domain}:${key}`, maxRequests ?? DOMAIN_LIMITS[domain])
  if (!allowed) getOpsMetrics().incr('ops.rate_limited', { domain })
  return allowed
}

/** Brute-force protection for auth-sensitive actions (stricter window key). */
export function checkAuthBruteForce(identityKey: string, maxAttempts = 5): boolean {
  return checkDomainRateLimit('auth', `brute:${identityKey}`, maxAttempts)
}

export function resetSecurityRateLimits(key?: string): void {
  if (key) clearRateLimit(key)
}
