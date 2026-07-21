/**
 * Sprint 65 — Feature flag production audit.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type { FeatureFlagAuditItem, FeatureFlagAuditReport } from './types'

/** Flags that must stay OFF (or env-gated) for safe Production V1 defaults. */
const MUST_BE_OFF_IN_PROD: ReadonlySet<string> = new Set([
  'ai.live_providers',
  'provider.amadeus',
  'provider.duffel',
  'provider.booking',
  'payments.live',
  'providers.live_master',
  'brain.debug',
])

/** Experimental flags that are OK when ON but noted. */
const EXPERIMENTAL_WARN_WHEN_ON: ReadonlySet<string> = new Set([
  'ui.chatgpt_experience',
])

export function auditFeatureFlags(now: () => number = Date.now): FeatureFlagAuditReport {
  const registry = getFeatureRegistry()
  const defs = registry.list()
  const items: FeatureFlagAuditItem[] = defs.map((def) => {
    const enabled = registry.isEnabled(def.id)
    const mustOff = MUST_BE_OFF_IN_PROD.has(def.id)
    const experimentalOn = EXPERIMENTAL_WARN_WHEN_ON.has(def.id) && enabled
    let risk: FeatureFlagAuditItem['risk'] = 'none'
    let safeDefault = true
    let notes = def.notes ?? def.description

    if (mustOff && enabled) {
      risk = 'critical'
      safeDefault = false
      notes = `PRODUCTION RISK: ${def.id} should be OFF unless Edge secrets + ops approval.`
    } else if (mustOff && !enabled) {
      notes = `Safe default OFF for Production V1. ${notes}`
    } else if (experimentalOn) {
      risk = 'warn'
      notes = `Experimental flag enabled — verify UX before go-live. ${notes}`
    } else if (def.lifecycle === 'experimental' && enabled) {
      risk = 'info'
    }

    // Hidden dependency check: enabled but dependency disabled would fail isEnabled —
    // surface definitions whose dependsOn are not all enabled when self.enabled=true in registry.
    if (def.enabled) {
      for (const dep of def.dependsOn ?? []) {
        if (!registry.isEnabled(dep) && enabled === false) {
          notes = `Depends on ${dep} (currently ineffective). ${notes}`
        }
      }
    }

    return {
      id: def.id,
      enabled,
      lifecycle: def.lifecycle,
      dependsOn: def.dependsOn ? [...def.dependsOn] : [],
      safeDefault,
      notes,
      risk,
    }
  })

  const riskyEnabled = items.filter(
    (i) => i.enabled && (i.risk === 'critical' || i.risk === 'warn' || i.risk === 'error'),
  )
  const enabledCount = items.filter((i) => i.enabled).length

  return {
    generatedAt: new Date(now()).toISOString(),
    total: items.length,
    enabledCount,
    disabledCount: items.length - enabledCount,
    riskyEnabled,
    items,
    ok: riskyEnabled.every((i) => i.risk !== 'critical'),
  }
}
