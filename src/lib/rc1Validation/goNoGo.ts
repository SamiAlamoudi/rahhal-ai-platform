/**
 * Sprint 18 — GO / NO-GO decision engine.
 */

import { RC1_VALIDATION_VERSION, type GoNoGoReport, type ValidationCheck } from './types'

export function decideGoNoGo(checks: ValidationCheck[]): GoNoGoReport {
  const blockers = checks
    .filter((c) => c.status === 'fail')
    .map((c) => `${c.id}: ${c.summary}`)
  const conditions = checks
    .filter((c) => c.status === 'warn')
    .map((c) => `${c.id}: ${c.summary}`)

  let decision: GoNoGoReport['decision'] = 'GO'
  let rationale = 'All RC1 validation checks passed. Platform is ready as Release Candidate 1.'

  if (blockers.length > 0) {
    decision = 'NO_GO'
    rationale = `RC1 blocked by ${blockers.length} failing check(s).`
  } else if (conditions.length > 0) {
    decision = 'GO_WITH_CONDITIONS'
    rationale = `RC1 may proceed with ${conditions.length} condition(s) documented for staging/ops.`
  }

  return {
    decision,
    rationale,
    blockers,
    conditions,
    checks,
    generatedAt: new Date().toISOString(),
    version: RC1_VALIDATION_VERSION,
  }
}
