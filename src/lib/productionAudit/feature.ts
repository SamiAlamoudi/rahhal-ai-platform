/**
 * Sprint 17 — `production_audit.platform` (default OFF).
 * Audit harness only; enabling does not change product behavior.
 */

import { getFeatureRegistry } from '../ai'

export const PRODUCTION_AUDIT_PLATFORM_FEATURE_ID = 'production_audit.platform' as const

export function isProductionAuditPlatformEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(PRODUCTION_AUDIT_PLATFORM_FEATURE_ID)
}
