/**
 * Evolution Sprint 5 — TravelerPreferenceModel
 * Preference store accessors.
 */

import type { PreferenceKey, StoredPreference, TravelerModelState } from './travelerTypes'

export function listPreferences(state: TravelerModelState): StoredPreference[] {
  return Object.values(state.preferences).filter(Boolean) as StoredPreference[]
}

export function getPreference(
  state: TravelerModelState,
  key: PreferenceKey,
): StoredPreference | null {
  return state.preferences[key] ?? null
}

export function preferencesAbove(
  state: TravelerModelState,
  minConfidence: number,
): StoredPreference[] {
  return listPreferences(state).filter((p) => p.confidence >= minConfidence)
}

export const TravelerPreferenceModel = {
  list: listPreferences,
  get: getPreference,
  above: preferencesAbove,
}
