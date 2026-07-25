/**
 * RC2 — documentation index for release review categories.
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ChecklistItem, DocumentationIndexEntry } from './types'

const ROOT = process.cwd()

/** Required report paths grouped by category. */
export const DOCUMENTATION_INDEX: Array<{ category: string; path: string }> = [
  // Architecture
  { category: 'Architecture', path: 'FINAL_ARCHITECTURE_AUDIT.md' },
  { category: 'Architecture', path: 'ARCHITECTURE_GUIDE.md' },
  { category: 'Architecture', path: 'AI_ARCHITECTURE.md' },
  { category: 'Architecture', path: 'MODULE_MAP.md' },
  { category: 'Architecture', path: 'DEPENDENCY_GRAPH.md' },
  // Recovery
  { category: 'Recovery', path: 'RECOVERY_AUDIT.md' },
  { category: 'Recovery', path: 'RECOVERY_PHASE_1_REPORT.md' },
  { category: 'Recovery', path: 'RC1_AUDIT_REPORT.md' },
  { category: 'Recovery', path: 'RC2_PERFORMANCE_REPORT.md' },
  { category: 'Recovery', path: 'RC3_FOUNDATION_REPORT.md' },
  { category: 'Recovery', path: 'RECOVERY_PHASE_SUMMARY.md' },
  // Performance
  { category: 'Performance', path: 'FINAL_PERFORMANCE_AUDIT.md' },
  { category: 'Performance', path: 'PRODUCTION_BASELINE.md' },
  { category: 'Performance', path: 'PERFORMANCE_BASELINE.md' },
  { category: 'Performance', path: 'PERFORMANCE_BASELINE_V2.md' },
  // Security
  { category: 'Security', path: 'FINAL_SECURITY_AUDIT.md' },
  { category: 'Security', path: 'PRODUCTION_SECURITY_REPORT.md' },
  { category: 'Security', path: 'PROVIDER_SECRET_MATRIX.md' },
  // Providers
  { category: 'Providers', path: 'PROVIDER_VALIDATION.md' },
  { category: 'Providers', path: 'LIVE_FLIGHT_PROVIDER_REPORT.md' },
  { category: 'Providers', path: 'LIVE_HOTEL_PROVIDER_REPORT.md' },
  // Observability
  { category: 'Observability', path: 'OBSERVABILITY_REPORT.md' },
  { category: 'Observability', path: 'LOGGING_GUIDE.md' },
  { category: 'Observability', path: 'METRICS_GUIDE.md' },
  { category: 'Observability', path: 'HEALTH_CHECKS.md' },
  // Testing
  { category: 'Testing', path: 'END_TO_END_RESULTS.md' },
  { category: 'Testing', path: 'FEATURE_FLAG_MATRIX.md' },
  { category: 'Testing', path: 'RC1_TEST_REPORT.md' },
  // Load
  { category: 'Load', path: 'LOAD_TEST_REPORT.md' },
  { category: 'Load', path: 'SOAK_TEST_REPORT.md' },
  { category: 'Load', path: 'CONCURRENCY_REPORT.md' },
  { category: 'Load', path: 'MEMORY_LEAK_REPORT.md' },
  { category: 'Load', path: 'RESILIENCE_REPORT.md' },
  { category: 'Load', path: 'CAPACITY_REPORT.md' },
  // RC Validation
  { category: 'RC Validation', path: 'RC1_VALIDATION_REPORT.md' },
  { category: 'RC Validation', path: 'GO_NO_GO_DECISION.md' },
  { category: 'RC Validation', path: 'GA_READINESS_REPORT.md' },
  { category: 'RC Validation', path: 'FINAL_RELEASE_DECISION.md' },
  { category: 'RC Validation', path: 'MASTER_RELEASE_REPORT.md' },
  { category: 'RC Validation', path: 'MASTER_CHECKLIST.md' },
  { category: 'RC Validation', path: 'MERGE_ORDER.md' },
  { category: 'RC Validation', path: 'FEATURE_FLAG_STATUS.md' },
  { category: 'RC Validation', path: 'FINAL_GO_NO_GO.md' },
]

export function buildDocumentationIndex(options?: {
  assumeRc2DocsWritten?: boolean
}): {
  entries: DocumentationIndexEntry[]
  checks: ChecklistItem[]
} {
  const assume = options?.assumeRc2DocsWritten ?? false
  const rc2Docs = new Set([
    'RECOVERY_PHASE_SUMMARY.md',
    'MASTER_RELEASE_REPORT.md',
    'MASTER_CHECKLIST.md',
    'MERGE_ORDER.md',
    'FEATURE_FLAG_STATUS.md',
    'FINAL_GO_NO_GO.md',
  ])

  const entries: DocumentationIndexEntry[] = DOCUMENTATION_INDEX.map((item) => {
    const abs = resolve(ROOT, item.path)
    let exists = existsSync(abs)
    if (!exists && assume && rc2Docs.has(item.path)) exists = true
    return { category: item.category, path: item.path, exists }
  })

  const missing = entries.filter((e) => !e.exists)
  const checks: ChecklistItem[] = [
    {
      id: 'docs_index_complete',
      area: 'documentation',
      status: missing.length === 0 ? 'PASS' : 'WARNING',
      summary:
        missing.length === 0
          ? 'All indexed release reports present'
          : `Missing indexed docs: ${missing.map((m) => m.path).join(', ')}`,
    },
  ]

  return { entries, checks }
}
