import { getFeatureRegistry } from '../ai'
import { UI_NEW_EXPERIENCE_FEATURE_ID } from './tokens'

export function isUiNewExperienceEnabled(options?: {
  registry?: { isEnabled: (id: typeof UI_NEW_EXPERIENCE_FEATURE_ID) => boolean }
}): boolean {
  const registry = options?.registry ?? getFeatureRegistry()
  return registry.isEnabled(UI_NEW_EXPERIENCE_FEATURE_ID)
}
