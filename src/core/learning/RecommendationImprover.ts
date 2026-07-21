/**
 * Sprint 80 — adjust decision candidates using learned preferences + explainability.
 */

import type { SearchCandidate, DecisionReason } from '../types'
import type { TravelerProfile } from '../profile/TravelerProfile'
import { derivePreferenceWeightBiases } from '../profile/PreferenceWeights'
import { emitLearningEvent, type LearningEvent } from './events'

function includesLoose(hay: string | null | undefined, needle: string): boolean {
  if (!hay) return false
  return hay.toLowerCase().includes(needle.toLowerCase())
}

export function improveRecommendations(input: {
  candidates: SearchCandidate[]
  profile: TravelerProfile | null
  events?: LearningEvent[]
}): {
  candidates: SearchCandidate[]
  adjustmentReasons: DecisionReason[]
  adjusted: boolean
} {
  const { candidates, profile, events } = input
  if (!profile || !profile.learningEnabled || candidates.length === 0) {
    return { candidates, adjustmentReasons: [], adjusted: false }
  }

  const biases = derivePreferenceWeightBiases(profile)
  const adjustmentReasons: DecisionReason[] = []

  const improved = candidates.map((candidate) => {
    let delta = 0
    const reasons: DecisionReason[] = [...candidate.reasons]

    for (const pref of profile.preferences) {
      if (pref.confidence < 0.25) continue
      if (pref.kind === 'airline') {
        const hit = includesLoose(candidate.flight.airline, pref.value)
        if (hit && pref.polarity === 'prefer') {
          delta += 8 * pref.confidence
          reasons.push({
            code: 'learned_airline',
            message: `You usually choose ${pref.value}`,
            impact: 'positive',
          })
        }
        if (hit && pref.polarity === 'avoid') delta -= 10 * pref.confidence
      }
      if (pref.kind === 'hotel_brand') {
        const hay = `${candidate.hotel.name} ${String(candidate.hotel.payload.chain ?? '')}`
        const hit = includesLoose(hay, pref.value)
        if (hit && pref.polarity === 'prefer') {
          delta += 9 * pref.confidence
          reasons.push({
            code: 'learned_hotel',
            message: `You usually choose ${pref.value}`,
            impact: 'positive',
          })
        }
      }
      if (pref.kind === 'walkability' && pref.polarity === 'prefer') {
        if ((candidate.hotel.walkMinutes ?? 99) <= 15) {
          delta += 7 * pref.confidence
          reasons.push({
            code: 'learned_walk',
            message: 'You prefer city-center / walkable hotels',
            impact: 'positive',
          })
        }
      }
      if (pref.kind === 'cabin' && pref.polarity === 'prefer') {
        if (includesLoose(candidate.flight.cabin, pref.value)) {
          delta += 6 * pref.confidence
          reasons.push({
            code: 'learned_cabin',
            message: `Matches your preferred cabin (${pref.value})`,
            impact: 'positive',
          })
        }
      }
      if (pref.kind === 'seat' && pref.polarity === 'prefer') {
        reasons.push({
          code: 'learned_seat',
          message: `You prefer ${pref.value} seats`,
          impact: 'neutral',
        })
      }
      if (pref.kind === 'luxury_vs_value' && pref.value === 'value' && pref.polarity === 'prefer') {
        if ((candidate.score?.dimensions.price ?? 0) >= 75) {
          delta += 5 * pref.confidence
          reasons.push({
            code: 'learned_value',
            message: 'Similar price style to your previous bookings',
            impact: 'positive',
          })
        }
      }
      if (pref.kind === 'luxury_vs_value' && pref.value === 'luxury' && pref.polarity === 'avoid') {
        if ((candidate.hotel.stars ?? 0) >= 5) delta -= 6 * pref.confidence
      }
      if (pref.kind === 'family_pattern' && candidate.hotel.familyFriendly) {
        delta += 4 * pref.confidence
        reasons.push({
          code: 'learned_family',
          message: 'Matches your travel style (family)',
          impact: 'positive',
        })
      }
    }

    delta += biases.walkability * 4 + biases.luxury * 3 + biases.price * 2

    if (!candidate.score) return candidate
    const overall = Math.max(0, Math.min(100, Math.round(candidate.score.overall + delta)))
    return {
      ...candidate,
      score: { ...candidate.score, overall },
      reasons: reasons.slice(0, 8),
    }
  })

  const adjusted = improved.some((c, i) => c.score?.overall !== candidates[i]?.score?.overall)
  if (adjusted) {
    emitLearningEvent('recommendation.adjusted', {
      candidateCount: improved.length,
      userId: profile.userId,
    }, events)
  }

  // Collect top unique explanation reasons from best-scoring candidate later
  const uniqueReasons = new Map<string, DecisionReason>()
  for (const c of improved) {
    for (const r of c.reasons) {
      if (r.code.startsWith('learned_') && !uniqueReasons.has(r.code)) {
        uniqueReasons.set(r.code, r)
      }
    }
  }

  return {
    candidates: improved,
    adjustmentReasons: [...uniqueReasons.values()],
    adjusted,
  }
}

export function formatLearningExplanation(reasons: DecisionReason[]): string {
  if (reasons.length === 0) return ''
  const bullets = reasons.slice(0, 5).map((r) => `✓ ${r.message}`).join('\n')
  return `Recommended because:\n${bullets}`
}
