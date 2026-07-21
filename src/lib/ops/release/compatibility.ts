/**
 * Sprint 70 — Compatibility checks across ops modules (additive).
 */

import type { CompatibilityReport } from './types'

const REQUIRED_OPS_MODULES = [
  'production',
  'validation',
  'beta',
  'deployment',
  'operations',
  'release',
  'observability',
  'alerting',
  'incidents',
  'security',
] as const

/** Pure compatibility report — does not import engines (avoids circular deps). */
export function checkGACompatibility(input?: {
  presentModules?: string[]
  packageVersion?: string
  expectedPackagePrefix?: string
}): CompatibilityReport {
  const present = input?.presentModules ?? [...REQUIRED_OPS_MODULES]
  const missing = REQUIRED_OPS_MODULES.filter((m) => !present.includes(m))
  const packageVersion = input?.packageVersion ?? '1.1.0-rc.1'
  const prefix = input?.expectedPackagePrefix ?? '1.1'
  const packageAligned = packageVersion.startsWith(prefix)

  const notes: string[] = []
  if (!packageAligned) {
    notes.push(`Package version ${packageVersion} does not start with ${prefix}`)
  }
  if (missing.length === 0) {
    notes.push('All required ops modules present for GA')
  }

  return {
    ok: missing.length === 0 && packageAligned,
    packageAligned,
    opsModulesPresent: present.filter((m) =>
      (REQUIRED_OPS_MODULES as readonly string[]).includes(m),
    ),
    missingModules: [...missing],
    notes,
    generatedAt: new Date().toISOString(),
  }
}

export { REQUIRED_OPS_MODULES }
