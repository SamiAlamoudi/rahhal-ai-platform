/**
 * Sprint 17 — Release scorecard aggregation.
 */

import type { AuditFinding, DimensionScore, ReleaseScorecard } from './types'
import { PRODUCTION_AUDIT_VERSION } from './types'

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function buildScorecard(findings: AuditFinding[]): ReleaseScorecard {
  const impact = (areaPrefix: string, base: number): number => {
    const related = findings.filter(
      (f) => f.area === areaPrefix || f.id.startsWith(areaPrefix),
    )
    let score = base
    for (const f of related) {
      if (f.status === 'fail') score += f.scoreImpact ?? -8
      else if (f.status === 'warn') score += f.scoreImpact ?? -3
      else if (f.status === 'pass') score += f.scoreImpact ?? 0
    }
    return clamp(score)
  }

  const dimensions: DimensionScore[] = [
    {
      dimension: 'Architecture',
      score: impact('architecture', 96),
      weight: 0.12,
      notes: 'Module boundaries, circular import gate, feature isolation',
    },
    {
      dimension: 'Performance',
      score: impact('performance', 95),
      weight: 0.12,
      notes: 'ChatPage bundle stability, lazy routes, load-test baselines',
    },
    {
      dimension: 'Security',
      score: impact('security', 94),
      weight: 0.14,
      notes: 'SecretManager, sanitization, CI secret gate, dependency advisories',
    },
    {
      dimension: 'AI Quality',
      score: impact('ai', 93),
      weight: 0.12,
      notes: 'Brain/Journey/Orchestrator/Budget/Maps/Action/Recovery present; experimental flags OFF',
    },
    {
      dimension: 'Maintainability',
      score: impact('quality', 94),
      weight: 0.1,
      notes: 'Lint, typecheck, broad unit suite, docs',
    },
    {
      dimension: 'Scalability',
      score: impact('scalability', 91),
      weight: 0.1,
      notes: 'Load testing framework + capacity estimator (simulated)',
    },
    {
      dimension: 'Reliability',
      score: impact('reliability', 92),
      weight: 0.1,
      notes: 'Resilience simulation, graceful degradation, recovery paths',
    },
    {
      dimension: 'Developer Experience',
      score: impact('dx', 94),
      weight: 0.08,
      notes: 'Scripts, CI gates, mock-default providers, AGENTS.md',
    },
    {
      dimension: 'Production Readiness',
      score: impact('production', 91),
      weight: 0.12,
      notes: 'Checklist coverage across secrets, flags, monitoring, rollback',
    },
  ]

  const overall = clamp(
    dimensions.reduce((sum, d) => sum + d.score * d.weight, 0)
      / dimensions.reduce((sum, d) => sum + d.weight, 0),
  )

  const blockers = findings
    .filter((f) => f.status === 'fail')
    .map((f) => f.summary)

  const recommendations = findings
    .filter((f) => f.status === 'warn' || f.status === 'fail')
    .map((f) => f.detail ?? f.summary)

  return {
    version: PRODUCTION_AUDIT_VERSION,
    generatedAt: new Date().toISOString(),
    dimensions,
    overall,
    // Ready for staging/beta; hard blockers only when findings include fail
    productionReady: blockers.length === 0 && overall >= 85,
    blockers,
    recommendations,
  }
}
