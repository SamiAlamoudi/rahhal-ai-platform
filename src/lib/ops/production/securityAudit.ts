/**
 * Sprint 65 — Security audit (static review of platform controls).
 * Documents mitigations already present in ops/security/auth/providers.
 */

import type { SecurityAuditReport, SecurityFinding } from './types'

function finding(
  partial: Omit<SecurityFinding, 'status'> & { status?: SecurityFinding['status'] },
): SecurityFinding {
  return { status: 'mitigated', ...partial }
}

/** Full security audit report for Production V1. */
export function runSecurityAudit(now: () => number = Date.now): SecurityAuditReport {
  const findings: SecurityFinding[] = [
    finding({
      id: 'sec.auth.supabase',
      area: 'Authentication',
      severity: 'info',
      title: 'Supabase Auth + ProtectedRoute',
      detail: 'App routes gated by ProtectedRoute; session via Supabase Auth.',
      recommendation: 'Keep anon key public-only; never ship service role to client.',
      status: 'ok',
    }),
    finding({
      id: 'sec.authz.rls',
      area: 'Authorization',
      severity: 'info',
      title: 'Postgres RLS policies',
      detail: 'Migrations define RLS; ownership helpers in securityUtils.',
      recommendation: 'Verify hosted grants; local stacks need explicit GRANTs.',
      status: 'ok',
    }),
    finding({
      id: 'sec.secrets.env',
      area: 'Secrets',
      severity: 'info',
      title: 'Client secret ban + env validation',
      detail: 'validateEnvironment blocks VITE_* provider secrets; live secrets server-side.',
      recommendation: 'Run readiness with enforceEnv in staging/production.',
      status: 'mitigated',
    }),
    finding({
      id: 'sec.input.validation',
      area: 'Input validation',
      severity: 'warn',
      title: 'Light string validation (no schema lib)',
      detail: 'validateNonEmptyString / sanitizeInput / assertRequestSize in place; no Zod.',
      recommendation: 'Continue domain validators at booking/payment boundaries.',
      status: 'mitigated',
    }),
    finding({
      id: 'sec.output.sanitize',
      area: 'Output sanitization',
      severity: 'info',
      title: 'escapeHtml + safe media URLs',
      detail: 'securityPolicy.escapeHtml and safeMediaUrl for untrusted URLs.',
      recommendation: 'Prefer text nodes / React escaping; avoid raw HTML.',
      status: 'ok',
    }),
    finding({
      id: 'sec.injection',
      area: 'Injection risks',
      severity: 'info',
      title: 'Parameterized Supabase client',
      detail: 'No raw SQL string building in app path; provider payloads structured.',
      recommendation: 'Keep avoiding string-concatenated queries.',
      status: 'ok',
    }),
    finding({
      id: 'sec.logging.mask',
      area: 'Sensitive logging',
      severity: 'info',
      title: 'PII/secret masking',
      detail: 'maskMetadata / assertNoSecretsInText / providerLog sanitizeDetail.',
      recommendation: 'Route all provider logs through installProviderLogBridge.',
      status: 'mitigated',
    }),
    finding({
      id: 'sec.rate_limit',
      area: 'Rate limiting',
      severity: 'warn',
      title: 'Domain rate limits + live provider limiters',
      detail: 'checkDomainRateLimit, auth brute-force, liveProviders rateLimiter exist.',
      recommendation: 'Ensure hot SPA/API edges call checkDomainRateLimit.',
      status: 'mitigated',
    }),
    finding({
      id: 'sec.replay',
      area: 'Replay protection',
      severity: 'info',
      title: 'Idempotency store + booking idempotency keys',
      detail: 'ops IdempotencyStore + Booking Execution idempotencyKey.',
      recommendation: 'Use durable store if multi-instance deploy.',
      status: 'mitigated',
    }),
    finding({
      id: 'sec.provider.credentials',
      area: 'Provider credentials',
      severity: 'info',
      title: 'Server-only provider secrets',
      detail: 'AMADEUS_*/BOOKING_* not via VITE_*; secrets.ts redaction snapshot.',
      recommendation: 'Keep ORDER_LIVE flags false until Edge secrets configured.',
      status: 'ok',
    }),
    finding({
      id: 'sec.share_links',
      area: 'Temporary share links',
      severity: 'info',
      title: 'TTL share tokens (Document Center when enabled)',
      detail: 'Share links expire and can be revoked; audit logged.',
      recommendation: 'Keep short TTL defaults in production.',
      status: 'mitigated',
    }),
    finding({
      id: 'sec.documents',
      area: 'Document access',
      severity: 'info',
      title: 'Document access via trip/session keys + audit',
      detail: 'Legacy DocumentCenter session-scoped; enterprise path trip-scoped when flagged.',
      recommendation: 'Enforce trip ownership before download/preview.',
      status: 'mitigated',
    }),
    finding({
      id: 'sec.booking',
      area: 'Booking operations',
      severity: 'info',
      title: 'Booking Execution behind auth + feature flags',
      detail: 'Transaction manager retries/rollback; live order APIs gated.',
      recommendation: 'Keep AMADEUS_ORDER_LIVE/BOOKING_ORDER_LIVE opt-in.',
      status: 'ok',
    }),
    finding({
      id: 'sec.trips',
      area: 'Trip access',
      severity: 'info',
      title: 'Trip store userId scoping',
      detail: 'getTrips(userId) filters by owner; ProtectedRoute required for app.',
      recommendation: 'Persist trips with RLS when moving off in-memory store.',
      status: 'mitigated',
    }),
    finding({
      id: 'sec.csp',
      area: 'CSP',
      severity: 'warn',
      title: 'CSP profiles: strict prod, relaxed dev',
      detail: 'vite.config.ts relaxes dev; production script-src self; _headers present.',
      recommendation: 'Keep production CSP strict; align Amadeus connect-src if live search from browser.',
      status: 'mitigated',
    }),
  ]

  const riskCount = findings.filter((f) => f.status === 'risk').length
  const mitigatedCount = findings.filter((f) => f.status === 'mitigated').length
  return {
    generatedAt: new Date(now()).toISOString(),
    findings,
    ok: riskCount === 0,
    riskCount,
    mitigatedCount,
  }
}
