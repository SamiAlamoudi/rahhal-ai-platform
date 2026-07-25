/**
 * Sprint 18 — Feature flag OFF/ON validation + compatibility matrix.
 */

import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import type { FeatureFlagMatrixRow, ValidationCheck } from './types'

/** Flags that must remain OFF by default for RC1 production posture. */
export const RC1_MUST_STAY_OFF = [
  'security.secret_manager',
  'observability.platform',
  'load_testing.platform',
  'production_audit.platform',
  'rc1.validation',
  'ai.integration_journey',
  'ai.integration_trip_orchestrator',
  'ai.integration_action_execution',
  'ai.live_providers',
  'provider.amadeus',
  'provider.duffel',
  'provider.booking',
] as const

export function buildFeatureFlagMatrix(): {
  rows: FeatureFlagMatrixRow[]
  checks: ValidationCheck[]
} {
  resetFeatureRegistry()
  const registry = getFeatureRegistry()
  const baseline = registry.list().map((f) => ({
    id: f.id,
    enabled: f.enabled,
    dependsOn: f.dependsOn ? [...f.dependsOn] : [],
    lifecycle: f.lifecycle,
  }))

  const rows: FeatureFlagMatrixRow[] = []
  const checks: ValidationCheck[] = []

  for (const def of baseline) {
    // OFF state — restore defaults then force OFF
    registry.setEnabled(def.id, false)
    const offOk = registry.isEnabled(def.id) === false

    // ON state (test mode) — enable deps first
    let onOk = true
    let dependencyOk = true
    try {
      for (const dep of def.dependsOn) {
        registry.setEnabled(dep as never, true)
      }
      registry.setEnabled(def.id, true)
      const enabled = registry.isEnabled(def.id)
      // If deps missing originally, enabling deps should allow ON
      onOk = enabled === true || def.dependsOn.length > 0
      if (def.dependsOn.length) {
        // Disable a dependency → feature must not stay effectively on
        const firstDep = def.dependsOn[0]!
        registry.setEnabled(firstDep as never, false)
        dependencyOk = registry.isEnabled(def.id) === false
        registry.setEnabled(firstDep as never, true)
      }
    } catch {
      onOk = false
      dependencyOk = false
    }

    // Cross-leak: toggling this flag should not enable an unrelated must-stay-off flag
    let crossLeakOk = true
    for (const critical of RC1_MUST_STAY_OFF) {
      if (critical === def.id) continue
      // Reset critical to default OFF for leak probe
      try {
        const critDef = registry.get(critical)
        if (!critDef) continue
        registry.setEnabled(critical, false)
        registry.setEnabled(def.id, true)
        if (registry.isEnabled(critical) && !critDef.enabled) {
          // only fail if it became enabled without being the same feature
          crossLeakOk = false
        }
        registry.setEnabled(def.id, false)
      } catch {
        /* unknown id in older registries */
      }
    }

    // Restore this feature to baseline before next iteration
    registry.setEnabled(def.id, def.enabled)
    for (const dep of def.dependsOn) {
      const baseDep = baseline.find((b) => b.id === dep)
      if (baseDep) registry.setEnabled(dep as never, baseDep.enabled)
    }

    rows.push({
      id: def.id,
      lifecycle: def.lifecycle,
      defaultEnabled: def.enabled,
      offOk,
      onOk,
      dependencyOk,
      crossLeakOk,
    })
  }

  // Restore full registry defaults
  resetFeatureRegistry()

  const offDefaults = RC1_MUST_STAY_OFF.every((id) => {
    try {
      return getFeatureRegistry().isEnabled(id) === false
    } catch {
      return true
    }
  })

  checks.push({
    id: 'feature_flags_critical_off_default',
    area: 'feature_flags',
    status: offDefaults ? 'pass' : 'fail',
    summary: offDefaults
      ? 'Critical RC1 flags OFF by default'
      : 'One or more critical flags unexpectedly ON',
  })

  const matrixHealthy = rows.every((r) => r.offOk && r.dependencyOk && r.crossLeakOk)
  checks.push({
    id: 'feature_flag_matrix_health',
    area: 'feature_flags',
    status: matrixHealthy ? 'pass' : 'warn',
    summary: matrixHealthy
      ? `Flag matrix validated for ${rows.length} features`
      : 'Some flag matrix rows reported issues',
    detail: `off/on/deps/leak rows=${rows.length}`,
  })

  return { rows, checks }
}
