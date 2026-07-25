/**
 * Sprint 17 — production checklist statuses derived from audit findings.
 */

import type { AuditFinding, AuditStatus } from './types'

export const PRODUCTION_CHECKLIST_KEYS = [
  'Security',
  'Performance',
  'Scalability',
  'Reliability',
  'Monitoring',
  'Recovery',
  'Deployment',
  'Rollback',
  'Secrets',
  'Providers',
  'Feature Flags',
] as const

export type ProductionChecklistKey = (typeof PRODUCTION_CHECKLIST_KEYS)[number]

export function buildChecklist(findings: AuditFinding[]): Record<ProductionChecklistKey, AuditStatus> {
  const byArea = (area: string): AuditStatus => {
    const related = findings.filter((f) => f.area.toLowerCase() === area.toLowerCase()
      || f.id.startsWith(area.toLowerCase().replace(/\s+/g, '_')))
    if (related.some((f) => f.status === 'fail')) return 'fail'
    if (related.some((f) => f.status === 'warn')) return 'warn'
    if (related.length === 0) return 'info'
    return 'pass'
  }

  return {
    Security: byArea('security'),
    Performance: byArea('performance'),
    Scalability: byArea('scalability'),
    Reliability: byArea('reliability'),
    Monitoring: byArea('monitoring'),
    Recovery: byArea('recovery'),
    Deployment: byArea('deployment'),
    Rollback: byArea('rollback'),
    Secrets: byArea('secrets'),
    Providers: byArea('providers'),
    'Feature Flags': byArea('feature_flags'),
  }
}
