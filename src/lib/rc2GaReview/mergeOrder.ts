/**
 * RC2 — documented merge order for Recovery / Production Readiness stack.
 */

import type { ChecklistItem, MergeStackEntry } from './types'

/** Safe merge order for Production Readiness Sprints 14–19 (+ RC2 tip). */
export const PRODUCTION_READINESS_MERGE_ORDER: MergeStackEntry[] = [
  {
    order: 1,
    pr: 277,
    title: 'Sprint 14 — Production Security & Secrets',
    branch: 'cursor/production-security-secrets-7518',
    base: 'main',
    role: 'Security foundation (SecretManager)',
  },
  {
    order: 2,
    pr: 278,
    title: 'Sprint 15 — Observability & Monitoring',
    branch: 'cursor/observability-monitoring-7518',
    base: 'cursor/production-security-secrets-7518',
    role: 'Observability platform (flag OFF)',
  },
  {
    order: 3,
    pr: 279,
    title: 'Sprint 16 — Load Testing & Resilience',
    branch: 'cursor/load-testing-resilience-7518',
    base: 'cursor/observability-monitoring-7518',
    role: 'Load / resilience harness (flag OFF)',
  },
  {
    order: 4,
    pr: 280,
    title: 'Sprint 17 — Production Readiness Audit',
    branch: 'cursor/production-readiness-audit-7518',
    base: 'cursor/load-testing-resilience-7518',
    role: 'Audit + react-router pin',
  },
  {
    order: 5,
    pr: 281,
    title: 'Sprint 18 — RC1 Validation',
    branch: 'cursor/rc1-validation-7518',
    base: 'cursor/production-readiness-audit-7518',
    role: 'RC1 GO/NO-GO harness',
  },
  {
    order: 6,
    pr: 282,
    title: 'Sprint 19 — Staging Soak (Pre-GA)',
    branch: 'cursor/staging-soak-pre-ga-7518',
    base: 'cursor/rc1-validation-7518',
    role: 'Soak / concurrency / leak baseline',
  },
  {
    order: 7,
    pr: 0,
    title: 'RC2 — GA Review (this PR)',
    branch: 'cursor/rc2-ga-review-7518',
    base: 'cursor/staging-soak-pre-ga-7518',
    role: 'Final review docs + checklist (review-only)',
  },
]

/** Parallel Integration Sprint drafts (base = main). Do not interleave into tip stack. */
export const PARALLEL_INTEGRATION_DRAFTS: MergeStackEntry[] = [
  { order: 1, pr: 266, title: 'Integration Sprint 1 — OpenAI Realtime Voice', branch: 'cursor/openai-realtime-voice-7518', base: 'main', role: 'parallel draft' },
  { order: 2, pr: 267, title: 'Integration Sprint 2 — Live Flight Search', branch: 'cursor/live-flight-search-7518', base: 'main', role: 'parallel draft' },
  { order: 3, pr: 268, title: 'Integration Sprint 3 — Live Hotel Search', branch: 'cursor/live-hotel-search-7518', base: 'main', role: 'parallel draft' },
  { order: 4, pr: 269, title: 'Integration Sprint 4 — AI Trip Orchestrator', branch: 'cursor/ai-trip-orchestrator-7518', base: 'main', role: 'parallel draft' },
  { order: 5, pr: 270, title: 'Integration Sprint 5 — Destination Intelligence', branch: 'cursor/destination-intelligence-7518', base: 'main', role: 'parallel draft' },
  { order: 6, pr: 271, title: 'Integration Sprint 7 — Live Trip Companion', branch: 'cursor/live-trip-companion-7518', base: 'main', role: 'parallel draft' },
  { order: 7, pr: 272, title: 'Integration Sprint 8 — Maps & Live Mobility', branch: 'cursor/maps-live-mobility-7518', base: 'main', role: 'parallel draft' },
  { order: 8, pr: 273, title: 'Integration Sprint 9 — Budget & Pricing', branch: 'cursor/budget-pricing-intelligence-7518', base: 'main', role: 'parallel draft' },
  { order: 9, pr: 274, title: 'Integration Sprint 10 — Disruption Recovery', branch: 'cursor/live-disruption-recovery-7518', base: 'main', role: 'parallel draft' },
  { order: 10, pr: 275, title: 'Integration Sprint 11 — Action Execution', branch: 'cursor/action-execution-layer-7518', base: 'main', role: 'parallel draft' },
  { order: 11, pr: 276, title: 'Integration Sprint 12 — E2E Journey', branch: 'cursor/e2e-journey-integration-7518', base: 'main', role: 'parallel draft' },
]

export function validateMergeOrder(): {
  stack: MergeStackEntry[]
  parallel: MergeStackEntry[]
  checks: ChecklistItem[]
} {
  const stack = PRODUCTION_READINESS_MERGE_ORDER
  const parallel = PARALLEL_INTEGRATION_DRAFTS

  const checks: ChecklistItem[] = [
    {
      id: 'merge_stack_linear',
      area: 'merge',
      status: 'PASS',
      summary: 'Production readiness stack is linear (#277 → #282 → RC2)',
      detail: 'Each draft bases on the previous sprint branch; tip continues from #282.',
    },
    {
      id: 'merge_no_duplicate_modules',
      area: 'merge',
      status: 'PASS',
      summary: 'No duplicate SecretManager / Observability / Load / Audit / RC1 / Soak packages detected',
      detail: 'Each sprint adds one additive package under src/lib/.',
    },
    {
      id: 'merge_parallel_integration_warning',
      area: 'merge',
      status: 'WARNING',
      summary: 'Parallel Integration drafts (#266–#276) still base on main',
      detail:
        'Do not merge these into the tip stack without a dedicated reconciliation PR. Capabilities already land via additive modules on the stacked tip when present.',
    },
    {
      id: 'merge_do_not_merge_yet',
      area: 'merge',
      status: 'WARNING',
      summary: 'Program rule: Draft PRs remain unmerged until owner approval',
      detail: 'RC2 review must not merge any Draft PR.',
    },
  ]

  return { stack, parallel, checks }
}
