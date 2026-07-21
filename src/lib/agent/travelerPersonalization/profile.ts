/**
 * Sprint 76 — traveler profile helpers + gradual confidence learning.
 */

import type {
  CabinPreference,
  ConfidencePreference,
  LearningEvent,
  PreferencePolarity,
  SeatPreference,
  SmokingPreference,
  TravelerProfile,
  TripStyleKind,
} from './types'

const CONFIDENCE_STEP = 0.18
const CONFIDENCE_START = 0.4
const CONFIDENCE_CAP = 1
const CONFLICT_DECAY = 0.08
const CONFLICT_FLIP_BELOW = 0.22

export function emptyTravelerProfile(userId: string, now = new Date().toISOString()): TravelerProfile {
  return {
    userId,
    version: 1,
    preferredAirlines: [],
    preferredAlliances: [],
    preferredCabin: null,
    preferredSeat: null,
    mealPreferences: [],
    hotelChains: [],
    hotelStarPreference: null,
    roomType: null,
    smokingPreference: null,
    budgetHistory: [],
    tripStyle: null,
    favoriteDestinations: [],
    preferredDepartureAirports: [],
    loyaltyPrograms: [],
    createdAt: now,
    updatedAt: now,
  }
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(CONFIDENCE_CAP, Math.round(value * 1000) / 1000))
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

function makePref<T>(
  value: T,
  polarity: PreferencePolarity,
  confidence: number,
  observations: number,
  now: string,
): ConfidencePreference<T> {
  return {
    value,
    polarity,
    confidence: clampConfidence(confidence),
    observations,
    updatedAt: now,
  }
}

/**
 * Learn a multi-value preference (airlines, hotels, etc.).
 * Does not overwrite immediately — raises confidence on repeats;
 * conflicting polarity on the same value decays confidence.
 */
export function learnListPreference(
  list: ConfidencePreference[],
  value: string,
  polarity: PreferencePolarity,
  field: string,
  now = new Date().toISOString(),
): { list: ConfidencePreference[]; event: LearningEvent } {
  const key = normalizeKey(value)
  const index = list.findIndex((item) => normalizeKey(String(item.value)) === key)
  if (index < 0) {
    const next = makePref(value, polarity, CONFIDENCE_START, 1, now)
    return {
      list: [...list, next],
      event: {
        kind: 'created',
        field,
        value,
        polarity,
        previousConfidence: null,
        nextConfidence: next.confidence,
        conflict: false,
      },
    }
  }

  const current = list[index]!
  const previousConfidence = current.confidence
  let nextConfidence = previousConfidence
  let conflict = false
  let observations = current.observations

  if (current.polarity === polarity) {
    nextConfidence = clampConfidence(previousConfidence + CONFIDENCE_STEP)
    observations += 1
  } else {
    // Conflicting signal — decay old confidence; flip polarity only when weak.
    conflict = true
    nextConfidence = clampConfidence(previousConfidence - CONFLICT_DECAY)
    observations += 1
    if (nextConfidence < CONFLICT_FLIP_BELOW) {
      const flipped = makePref(value, polarity, CONFIDENCE_START, 1, now)
      const nextList = [...list]
      nextList[index] = flipped
      return {
        list: nextList,
        event: {
          kind: 'conflict_flip',
          field,
          value,
          polarity,
          previousConfidence,
          nextConfidence: flipped.confidence,
          conflict: true,
        },
      }
    }
  }

  const updated = makePref(current.value, current.polarity, nextConfidence, observations, now)
  const nextList = [...list]
  nextList[index] = updated
  return {
    list: nextList,
    event: {
      kind: conflict ? 'conflict_decay' : 'reinforced',
      field,
      value,
      polarity: current.polarity,
      previousConfidence,
      nextConfidence: updated.confidence,
      conflict,
    },
  }
}

/**
 * Learn a single-slot preference (cabin, seat, trip style).
 * Same value reinforces; different value is a soft conflict (decay + slow replace).
 */
export function learnSingularPreference<T extends string | number>(
  current: ConfidencePreference<T> | null,
  value: T,
  polarity: PreferencePolarity,
  field: string,
  now = new Date().toISOString(),
): { preference: ConfidencePreference<T>; event: LearningEvent } {
  if (!current) {
    const created = makePref(value, polarity, CONFIDENCE_START, 1, now)
    return {
      preference: created,
      event: {
        kind: 'created',
        field,
        value: String(value),
        polarity,
        previousConfidence: null,
        nextConfidence: created.confidence,
        conflict: false,
      },
    }
  }

  const sameValue = current.value === value
  const samePolarity = current.polarity === polarity

  if (sameValue && samePolarity) {
    const next = makePref(
      current.value,
      current.polarity,
      current.confidence + CONFIDENCE_STEP,
      current.observations + 1,
      now,
    )
    return {
      preference: next,
      event: {
        kind: 'reinforced',
        field,
        value: String(value),
        polarity,
        previousConfidence: current.confidence,
        nextConfidence: next.confidence,
        conflict: false,
      },
    }
  }

  // Conflict: do not overwrite immediately — decay, then replace only when weak.
  const decayed = clampConfidence(current.confidence - CONFLICT_DECAY)
  if (decayed < CONFLICT_FLIP_BELOW) {
    const replaced = makePref(value, polarity, CONFIDENCE_START, 1, now)
    return {
      preference: replaced,
      event: {
        kind: 'conflict_flip',
        field,
        value: String(value),
        polarity,
        previousConfidence: current.confidence,
        nextConfidence: replaced.confidence,
        conflict: true,
      },
    }
  }

  const held = makePref(current.value, current.polarity, decayed, current.observations + 1, now)
  return {
    preference: held,
    event: {
      kind: 'conflict_decay',
      field,
      value: String(current.value),
      polarity: current.polarity,
      previousConfidence: current.confidence,
      nextConfidence: held.confidence,
      conflict: true,
    },
  }
}

export function confidenceMap(profile: TravelerProfile): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const airline of profile.preferredAirlines) {
    scores[`airline:${airline.value}`] = airline.confidence
  }
  for (const alliance of profile.preferredAlliances) {
    scores[`alliance:${alliance.value}`] = alliance.confidence
  }
  if (profile.preferredCabin) scores[`cabin:${profile.preferredCabin.value}`] = profile.preferredCabin.confidence
  if (profile.preferredSeat) scores[`seat:${profile.preferredSeat.value}`] = profile.preferredSeat.confidence
  for (const meal of profile.mealPreferences) {
    scores[`meal:${meal.value}`] = meal.confidence
  }
  for (const chain of profile.hotelChains) {
    scores[`hotel:${chain.value}`] = chain.confidence
  }
  if (profile.hotelStarPreference) {
    scores[`hotelStars:min${profile.hotelStarPreference.value}`] = profile.hotelStarPreference.confidence
  }
  if (profile.roomType) scores[`room:${profile.roomType.value}`] = profile.roomType.confidence
  if (profile.smokingPreference) {
    scores[`smoking:${profile.smokingPreference.value}`] = profile.smokingPreference.confidence
  }
  if (profile.tripStyle) scores[`tripStyle:${profile.tripStyle.value}`] = profile.tripStyle.confidence
  for (const dest of profile.favoriteDestinations) {
    scores[`destination:${dest.value}`] = dest.confidence
  }
  for (const airport of profile.preferredDepartureAirports) {
    scores[`airport:${airport.value}`] = airport.confidence
  }
  return scores
}

export function matchedPreferenceLabels(profile: TravelerProfile): string[] {
  const labels: string[] = []
  for (const airline of profile.preferredAirlines.filter((p) => p.polarity === 'prefer')) {
    labels.push(`airline:${airline.value}`)
  }
  for (const airline of profile.preferredAirlines.filter((p) => p.polarity === 'avoid')) {
    labels.push(`avoid-airline:${airline.value}`)
  }
  for (const chain of profile.hotelChains.filter((p) => p.polarity === 'prefer')) {
    labels.push(`hotel:${chain.value}`)
  }
  if (profile.preferredCabin?.polarity === 'prefer') labels.push(`cabin:${profile.preferredCabin.value}`)
  if (profile.preferredSeat?.polarity === 'prefer') labels.push(`seat:${profile.preferredSeat.value}`)
  if (profile.hotelStarPreference) labels.push(`minStars:${profile.hotelStarPreference.value}`)
  if (profile.tripStyle) labels.push(`style:${profile.tripStyle.value}`)
  if (profile.roomType) labels.push(`room:${profile.roomType.value}`)
  return labels
}

export type { CabinPreference, SeatPreference, SmokingPreference, TripStyleKind }
