/**
 * Sprint 80 — derive soft scoring weight biases from traveler preferences.
 */

import type { TravelerProfile } from './TravelerProfile'
import type { ScoringWeights } from '../types'

export interface PreferenceWeightBiases {
  price: number
  luxury: number
  walkability: number
  comfort: number
  speed: number
  family: number
}

export function derivePreferenceWeightBiases(profile: TravelerProfile | null): PreferenceWeightBiases {
  const biases: PreferenceWeightBiases = {
    price: 0,
    luxury: 0,
    walkability: 0,
    comfort: 0,
    speed: 0,
    family: 0,
  }
  if (!profile) return biases

  for (const pref of profile.preferences) {
    const w = pref.confidence
    if (pref.kind === 'luxury_vs_value') {
      if (pref.value === 'luxury' && pref.polarity === 'prefer') biases.luxury += w * 0.2
      if (pref.value === 'value' && pref.polarity === 'prefer') biases.price += w * 0.22
      if (pref.value === 'luxury' && pref.polarity === 'avoid') biases.luxury -= w * 0.2
    }
    if (pref.kind === 'hotel_budget_style') {
      if (pref.value === 'budget' || pref.value === 'value') biases.price += w * 0.18
      if (pref.value === 'luxury') biases.luxury += w * 0.18
    }
    if (pref.kind === 'walkability' && pref.polarity === 'prefer') {
      biases.walkability += w * 0.25
    }
    if (pref.kind === 'cabin' && (pref.value === 'business' || pref.value === 'first')) {
      biases.comfort += w * 0.18
    }
    if (pref.kind === 'transfer_tolerance') {
      if (pref.value === 'direct' || pref.value === 'low') biases.speed += w * 0.2
    }
    if (pref.kind === 'family_pattern' && pref.polarity === 'prefer') {
      biases.family += w * 0.22
    }
    if (pref.kind === 'solo_pattern' && pref.polarity === 'prefer') {
      biases.comfort += w * 0.08
    }
  }

  // Merge explicit profile.weightBiases
  for (const [key, value] of Object.entries(profile.weightBiases)) {
    if (typeof value === 'number' && key in biases) {
      biases[key as keyof PreferenceWeightBiases] += value
    }
  }

  return biases
}

/** Apply preference biases onto ScoringWeights (additive, renormalized). */
export function applyBiasesToScoringWeights(
  base: ScoringWeights,
  biases: PreferenceWeightBiases,
): ScoringWeights {
  const next: ScoringWeights = { ...base }
  next.price = Math.max(0.02, next.price + biases.price * 0.15)
  next.hotel_rating = Math.max(0.02, next.hotel_rating + biases.luxury * 0.12 + biases.comfort * 0.08)
  next.walking_distance = Math.max(0.02, next.walking_distance + biases.walkability * 0.2)
  next.duration = Math.max(0.02, next.duration + biases.speed * 0.12)
  next.layovers = Math.max(0.02, next.layovers + biases.speed * 0.1)
  next.overall_convenience = Math.max(0.02, next.overall_convenience + biases.family * 0.08 + biases.comfort * 0.06)

  const sum = Object.values(next).reduce((a, b) => a + b, 0) || 1
  for (const key of Object.keys(next) as Array<keyof ScoringWeights>) {
    next[key] = Math.round((next[key]! / sum) * 1000) / 1000
  }
  return next
}
