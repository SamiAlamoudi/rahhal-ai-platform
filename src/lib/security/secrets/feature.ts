/**
 * Sprint 14 — `security.secret_manager` (default OFF).
 */

import { getFeatureRegistry } from '../../ai'

export const SECURITY_SECRET_MANAGER_FEATURE_ID = 'security.secret_manager' as const

export function isSecretManagerEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(SECURITY_SECRET_MANAGER_FEATURE_ID)
}
