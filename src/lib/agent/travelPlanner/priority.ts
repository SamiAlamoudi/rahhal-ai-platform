/**
 * Sprint 78 — priority weights from purpose + constraints.
 */

import type { TravelPurpose } from './types'
import type { DetectedConstraint } from './types'
import type { PriorityWeights } from './types'

const BASE: PriorityWeights = {
  price: 0.16,
  speed: 0.14,
  comfort: 0.14,
  convenience: 0.14,
  luxury: 0.1,
  family: 0.1,
  business: 0.1,
}

function normalize(weights: PriorityWeights): PriorityWeights {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0) || 1
  return {
    price: round(weights.price / sum),
    speed: round(weights.speed / sum),
    comfort: round(weights.comfort / sum),
    convenience: round(weights.convenience / sum),
    luxury: round(weights.luxury / sum),
    family: round(weights.family / sum),
    business: round(weights.business / sum),
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function buildPriorityWeights(
  purpose: TravelPurpose,
  constraints: DetectedConstraint[],
): PriorityWeights {
  const w = { ...BASE }
  const has = (kind: DetectedConstraint['kind']) => constraints.some((c) => c.kind === kind)

  switch (purpose) {
    case 'business':
    case 'conference':
      w.business += 0.22
      w.speed += 0.12
      w.convenience += 0.1
      w.price -= 0.04
      break
    case 'family':
      w.family += 0.24
      w.comfort += 0.1
      w.convenience += 0.08
      break
    case 'luxury':
    case 'honeymoon':
      w.luxury += 0.26
      w.comfort += 0.14
      w.price -= 0.08
      break
    case 'medical':
      w.convenience += 0.16
      w.comfort += 0.14
      w.speed += 0.1
      break
    case 'adventure':
      w.comfort += 0.06
      w.price += 0.06
      w.convenience += 0.06
      break
    case 'weekend':
      w.speed += 0.16
      w.convenience += 0.12
      break
    case 'vacation':
    case 'shopping':
    case 'religious':
    case 'education':
    default:
      break
  }

  if (has('budget')) w.price += 0.1
  if (has('direct_flight') || has('meeting_time')) w.speed += 0.12
  if (has('children') || has('accessibility') || has('senior_travelers')) {
    w.family += 0.08
    w.comfort += 0.08
  }
  if (has('hotel_brand')) w.luxury += 0.04
  if (has('medical_needs')) w.convenience += 0.1

  return normalize(w)
}
