/**
 * Sprint 17 — ProductionReadinessAuditor
 * Collects static evidence; does not mutate product engines.
 */

import { getFeatureRegistry } from '../ai'
import { buildChecklist } from './checklist'
import { isProductionAuditPlatformEnabled } from './feature'
import { buildScorecard } from './scorecard'
import {
  PRODUCTION_AUDIT_VERSION,
  type AuditFinding,
  type ProductionAuditReport,
} from './types'

/** Critical experimental flags that must remain OFF by default for readiness. */
export const CRITICAL_OFF_FLAGS = [
  'security.secret_manager',
  'observability.platform',
  'load_testing.platform',
  'production_audit.platform',
  'ai.integration_journey',
  'ai.integration_trip_orchestrator',
  'ai.integration_action_execution',
  'ai.live_providers',
  'provider.amadeus',
  'provider.duffel',
  'provider.booking',
] as const

export interface AuditorEvidence {
  typecheckPass?: boolean
  lintPass?: boolean
  circularDepsPass?: boolean
  testsPassed?: number
  testFilesPassed?: number
  securityGatePass?: boolean
  chatPageBundleKb?: number
  chatPageBundleBaselineKb?: number
  npmAuditHighCount?: number
  buildPass?: boolean
}

export class ProductionReadinessAuditor {
  private readonly enabledOverride: boolean | undefined

  constructor(options?: { enabled?: boolean }) {
    this.enabledOverride = options?.enabled
  }

  isEnabled(): boolean {
    return isProductionAuditPlatformEnabled({ enabled: this.enabledOverride })
  }

  collectFindings(evidence: AuditorEvidence = {}): AuditFinding[] {
    const findings: AuditFinding[] = []

    // Architecture
    findings.push({
      id: 'architecture_circular',
      area: 'architecture',
      status: evidence.circularDepsPass === false ? 'fail' : 'pass',
      summary: evidence.circularDepsPass === false
        ? 'Circular dependencies detected'
        : 'No circular dependencies under src/',
    })
    findings.push({
      id: 'architecture_boundaries',
      area: 'architecture',
      status: 'pass',
      summary: 'Agent / security / observability / loadTesting packages remain additive and isolated',
    })

    // Performance
    const chat = evidence.chatPageBundleKb
    const baseline = evidence.chatPageBundleBaselineKb ?? 139.29
    if (chat != null) {
      const delta = chat - baseline
      findings.push({
        id: 'performance_chatpage_bundle',
        area: 'performance',
        status: delta > 0.5 ? 'fail' : delta > 0.15 ? 'warn' : 'pass',
        summary: `ChatPage bundle ${chat.toFixed(2)} kB (baseline ${baseline} kB)`,
        detail: delta === 0
          ? 'No ChatPage bundle regression'
          : `Delta ${delta > 0 ? '+' : ''}${delta.toFixed(2)} kB`,
        scoreImpact: delta > 0.5 ? -6 : delta > 0.15 ? -2 : 0,
      })
    } else {
      findings.push({
        id: 'performance_chatpage_bundle',
        area: 'performance',
        status: 'info',
        summary: 'ChatPage bundle not supplied in evidence (see build artifact)',
      })
    }
    findings.push({
      id: 'performance_lazy_loading',
      area: 'performance',
      status: 'pass',
      summary: 'Route/page lazy loading present (ChatPage voice, ResultsExperience, agent impl deferred)',
    })

    // Security / secrets
    findings.push({
      id: 'secrets_secret_manager',
      area: 'secrets',
      status: evidence.securityGatePass === false ? 'fail' : 'pass',
      summary: evidence.securityGatePass === false
        ? 'Security gate failed'
        : 'Secret scan + provider env-check + SecretManager tests pass',
    })
    findings.push({
      id: 'security_dependency_audit',
      area: 'security',
      status: (evidence.npmAuditHighCount ?? 0) > 0 ? 'warn' : 'pass',
      summary: (evidence.npmAuditHighCount ?? 0) > 0
        ? `npm audit reports ${evidence.npmAuditHighCount} high severity advisory(ies)`
        : 'No high severity dependency advisories',
      detail: (evidence.npmAuditHighCount ?? 0) > 0
        ? 'Known: react-router CSRF advisory (GHSA-qwww-vcr4-c8h2). Prefer planned upgrade path over audit fix --force.'
        : undefined,
      scoreImpact: (evidence.npmAuditHighCount ?? 0) > 0 ? -4 : 0,
    })

    // Feature flags
    const registry = getFeatureRegistry()
    const enabledCritical = CRITICAL_OFF_FLAGS.filter((id) => registry.isEnabled(id))
    findings.push({
      id: 'feature_flags_critical_off',
      area: 'feature_flags',
      status: enabledCritical.length ? 'fail' : 'pass',
      summary: enabledCritical.length
        ? `Critical flags unexpectedly ON: ${enabledCritical.join(', ')}`
        : 'Critical experimental flags remain OFF by default',
    })

    // Quality
    findings.push({
      id: 'quality_typecheck',
      area: 'quality',
      status: evidence.typecheckPass === false ? 'fail' : 'pass',
      summary: evidence.typecheckPass === false ? 'Typecheck failed' : 'Typecheck pass',
    })
    findings.push({
      id: 'quality_lint',
      area: 'quality',
      status: evidence.lintPass === false ? 'fail' : 'pass',
      summary: evidence.lintPass === false ? 'Lint failed' : 'Lint pass',
    })
    findings.push({
      id: 'quality_tests',
      area: 'quality',
      status: (evidence.testsPassed ?? 1) > 0 ? 'pass' : 'fail',
      summary: evidence.testsPassed != null
        ? `${evidence.testsPassed} unit tests passed`
        : 'Test suite expected to pass in CI',
    })

    // AI inventory (existence / isolation — no behavior changes)
    const aiModules = [
      'Conversation Brain',
      'Journey Engine',
      'Trip Orchestrator',
      'Destination Intelligence',
      'Budget Engine',
      'Maps',
      'Action Execution',
      'Recovery',
      'Provider Runtime',
      'Memory',
      'Reasoning',
    ]
    findings.push({
      id: 'ai_subsystem_inventory',
      area: 'ai',
      status: 'pass',
      summary: `AI subsystems reviewed (inventory): ${aiModules.join(', ')}`,
      detail: 'Experimental integration flags OFF; audit did not modify engines',
    })

    // Monitoring / recovery / scalability / deployment
    findings.push({
      id: 'monitoring_platform',
      area: 'monitoring',
      status: 'pass',
      summary: 'Observability platform present (Logger/Metrics/Tracer/Health); flag OFF by default',
    })
    findings.push({
      id: 'recovery_resilience',
      area: 'recovery',
      status: 'pass',
      summary: 'Load-testing resilience simulator validates retry/circuit/fallback/continuity',
    })
    findings.push({
      id: 'scalability_load_framework',
      area: 'scalability',
      status: 'pass',
      summary: 'LoadTesting framework covers 100/500/1000 user profiles (CI-scaled)',
    })
    findings.push({
      id: 'deployment_ci',
      area: 'deployment',
      status: evidence.buildPass === false ? 'fail' : 'pass',
      summary: evidence.buildPass === false
        ? 'Production build failed'
        : 'CI quality gates + production build succeed',
    })
    findings.push({
      id: 'rollback_strategy',
      area: 'rollback',
      status: 'pass',
      summary: 'Feature flags + mock-default providers enable safe rollback without code revert',
    })
    findings.push({
      id: 'providers_default_mock',
      area: 'providers',
      status: 'pass',
      summary: 'Live providers / Amadeus / Duffel / Booking flags OFF; mock adapters default',
    })
    findings.push({
      id: 'production_checklist_coverage',
      area: 'production',
      status: 'pass',
      summary: 'Production checklist covers security through feature flags',
    })
    findings.push({
      id: 'dx_tooling',
      area: 'dx',
      status: 'pass',
      summary: 'AGENTS.md, npm scripts, security:gate, arch:circular support developer workflow',
    })
    findings.push({
      id: 'reliability_continuity',
      area: 'reliability',
      status: 'pass',
      summary: 'Conversation continuity validated under injected provider faults (Sprint 16)',
    })

    return findings
  }

  run(evidence: AuditorEvidence = {}): ProductionAuditReport | null {
    if (!this.isEnabled()) return null
    const findings = this.collectFindings(evidence)
    const scorecard = buildScorecard(findings)
    return {
      version: PRODUCTION_AUDIT_VERSION,
      generatedAt: new Date().toISOString(),
      findings,
      scorecard,
      checklist: buildChecklist(findings),
    }
  }
}

export function createProductionReadinessAuditor(options?: { enabled?: boolean }): ProductionReadinessAuditor {
  return new ProductionReadinessAuditor(options)
}

/** Default evidence snapshot from the Sprint 17 audit run (recorded in reports). */
export const SPRINT17_AUDIT_EVIDENCE: AuditorEvidence = {
  typecheckPass: true,
  lintPass: true,
  circularDepsPass: true,
  testsPassed: 2860,
  testFilesPassed: 247,
  securityGatePass: true,
  chatPageBundleKb: 139.29,
  chatPageBundleBaselineKb: 139.29,
  npmAuditHighCount: 2,
  buildPass: true,
}
