import type { TripPreferences } from './types'

export function createEmptyTripPreferences(): TripPreferences {
  return {
    pace: null,
    style: null,
    interests: [],
    avoid: [],
    notes: null,
  }
}

export const TripPreferencesApi = {
  create: createEmptyTripPreferences,

  merge(base: TripPreferences, patch: Partial<TripPreferences>): TripPreferences {
    return {
      pace: patch.pace ?? base.pace,
      style: patch.style ?? base.style,
      interests: unique([...(base.interests ?? []), ...(patch.interests ?? [])]),
      avoid: unique([...(base.avoid ?? []), ...(patch.avoid ?? [])]),
      notes: patch.notes ?? base.notes,
    }
  },
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))]
}
