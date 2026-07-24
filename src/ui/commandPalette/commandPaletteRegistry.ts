/**
 * Phase 4 Stage 8 — Command Palette feature gate.
 * Flag `ui.command_palette` default OFF.
 */

import { getFeatureRegistry } from '../../lib/ai/featureFlags'

export const COMMAND_PALETTE_FEATURE_ID = 'ui.command_palette' as const

export function isCommandPaletteEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(COMMAND_PALETTE_FEATURE_ID)
}

export const CommandPaletteRegistry = {
  featureId: COMMAND_PALETTE_FEATURE_ID,
  isEnabled: isCommandPaletteEnabled,
}
