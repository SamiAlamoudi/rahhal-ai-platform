/**
 * RC2 — final GO / GO WITH CONDITIONS / NO GO decision.
 */

import type { ChecklistItem, GoNoGoDecision, GoNoGoReport } from './types'
import { RC2_GA_REVIEW_VERSION } from './types'

export function decideGoNoGo(checklist: ChecklistItem[]): GoNoGoReport {
  const blockers = checklist.filter((c) => c.status === 'BLOCKER').map((c) => `${c.id}: ${c.summary}`)
  const warnings = checklist.filter((c) => c.status === 'WARNING')

  let decision: GoNoGoDecision
  let rationale: string

  if (blockers.length > 0) {
    decision = 'NO_GO'
    rationale = `Release blocked by ${blockers.length} blocker(s). Resolve before GA.`
  } else if (warnings.length > 0) {
    decision = 'GO_WITH_CONDITIONS'
    rationale =
      'Automated RC2 review finds no blockers. Remaining WARNINGs are operational conditions for public GA (hosted staging, live keys, parallel draft hygiene, pre-existing E2E).'
  } else {
    decision = 'GO'
    rationale = 'All checklist items PASS. Platform is cleared for GA.'
  }

  const conditions = warnings.map((w) => `${w.id}: ${w.summary}`)

  return {
    decision,
    rationale,
    blockers,
    conditions,
    generatedAt: new Date().toISOString(),
    version: RC2_GA_REVIEW_VERSION,
  }
}
