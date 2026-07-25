/**
 * Phase 4 Stage 1 — Application Shell feature gate.
 * Flag `ui.application_shell` default OFF.
 * Not wired into production routes / main.tsx.
 */

import { getFeatureRegistry } from '../../lib/ai/featureFlags'

export const APPLICATION_SHELL_FEATURE_ID = 'ui.application_shell' as const

export function isApplicationShellEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(APPLICATION_SHELL_FEATURE_ID)
}

export const ApplicationShellRegistry = {
  featureId: APPLICATION_SHELL_FEATURE_ID,
  isEnabled: isApplicationShellEnabled,
}
