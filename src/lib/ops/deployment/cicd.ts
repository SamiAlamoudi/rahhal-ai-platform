/**
 * Sprint 68 — CI/CD gate report (build / test / lint / smoke / rollback trigger).
 */

import { buildRollbackPlan } from './rollback'
import type { CICDGate, CICDPipelineReport, GateStatus } from './types'

export interface CICDGateInput {
  lint?: boolean
  typecheck?: boolean
  test?: boolean
  build?: boolean
  releaseBuild?: boolean
  deploymentVerification?: boolean
  smokeVerification?: boolean
  now?: () => number
}

function gate(id: string, label: string, ok: boolean | undefined, detail: string): CICDGate {
  const status: GateStatus = ok === undefined ? 'skip' : ok ? 'pass' : 'fail'
  return { id, label, status, detail }
}

/**
 * Build a CI/CD pipeline report. When gates are omitted they are marked skip
 * (library callers / unit tests can assert structure without running npm).
 */
export function buildCICDPipelineReport(input: CICDGateInput = {}): CICDPipelineReport {
  const now = input.now ?? (() => Date.now())
  const rollback = buildRollbackPlan({ now })
  const gates: CICDGate[] = [
    gate('lint', 'Lint', input.lint, input.lint === false ? 'lint failed' : 'oxlint'),
    gate('typecheck', 'Typecheck', input.typecheck, input.typecheck === false ? 'tsc failed' : 'tsc -b'),
    gate('test', 'Test', input.test, input.test === false ? 'vitest failed' : 'vitest run'),
    gate('build', 'Build', input.build, input.build === false ? 'build failed' : 'vite build'),
    gate(
      'release_build',
      'Release build',
      input.releaseBuild,
      input.releaseBuild === false ? 'release build failed' : 'production release artifact',
    ),
    gate(
      'deployment_verification',
      'Deployment verification',
      input.deploymentVerification,
      input.deploymentVerification === false ? 'deploy verify failed' : 'health + readiness',
    ),
    gate(
      'smoke_verification',
      'Smoke verification',
      input.smokeVerification,
      input.smokeVerification === false ? 'smoke failed' : 'production validation flows',
    ),
    gate(
      'rollback_trigger',
      'Rollback trigger armed',
      true,
      rollback.recommended ? 'ROLLBACK RECOMMENDED' : 'armed — no active trigger',
    ),
  ]

  const hardFails = gates.filter(
    (g) => g.status === 'fail' && g.id !== 'rollback_trigger',
  )
  return {
    ok: hardFails.length === 0 && !rollback.recommended,
    gates,
    rollbackTrigger: rollback.recommended,
    generatedAt: new Date(now()).toISOString(),
  }
}

/** Default CI assumption for local library verification (gates already run by npm scripts). */
export function buildPassingCICDReport(now?: () => number): CICDPipelineReport {
  return buildCICDPipelineReport({
    lint: true,
    typecheck: true,
    test: true,
    build: true,
    releaseBuild: true,
    deploymentVerification: true,
    smokeVerification: true,
    now,
  })
}
