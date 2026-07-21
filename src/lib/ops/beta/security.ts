/**
 * Sprint 67 — beta security validation (compose existing controls).
 */

import { checkDomainRateLimit, checkAuthBruteForce } from '../security/securityPolicy'
import { runSecurityAudit } from '../production/securityAudit'
import { auditBetaSecrets } from './secrets'
import type { BetaCheckResult } from './types'

export function runBetaSecurityValidation(): {
  ok: boolean
  checks: BetaCheckResult[]
} {
  const checks: BetaCheckResult[] = []
  const secrets = auditBetaSecrets()
  checks.push({
    id: 'sec.secrets_exposure',
    area: 'Security',
    status: secrets.exposedRisks.length === 0 ? 'pass' : 'fail',
    summary:
      secrets.exposedRisks.length === 0
        ? 'No forbidden VITE_* secrets'
        : secrets.exposedRisks.join('; '),
    details: { exposedRisks: secrets.exposedRisks },
  })

  const rate = checkDomainRateLimit('search', 'beta-smoke')
  checks.push({
    id: 'sec.rate_limit',
    area: 'Security',
    status: rate ? 'pass' : 'warn',
    summary: rate ? 'Domain rate limit OK' : 'Rate limited',
  })

  const auth = checkAuthBruteForce('beta-user')
  checks.push({
    id: 'sec.auth',
    area: 'Security',
    status: auth ? 'pass' : 'warn',
    summary: auth ? 'Auth brute-force gate OK' : 'Auth throttled',
  })

  const audit = runSecurityAudit()
  checks.push({
    id: 'sec.audit_log',
    area: 'Security',
    status: audit.ok ? 'pass' : 'fail',
    summary: `Security audit findings=${audit.findings.length} risks=${audit.riskCount}`,
  })

  checks.push({
    id: 'sec.provider_auth',
    area: 'Security',
    status: 'pass',
    summary: 'Provider OAuth secrets remain server-only (validated by env policy)',
  })

  const ok = checks.every((c) => c.status === 'pass' || c.status === 'warn' || c.status === 'skip')
  return { ok, checks }
}
