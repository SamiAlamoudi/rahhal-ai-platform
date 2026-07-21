/**
 * Sprint 80 — confidence ladder adjuster.
 */

import { CONFIDENCE_LEVELS } from '../profile/TravelerProfile'

function nearestLevel(value: number): number {
  let best: number = CONFIDENCE_LEVELS[0]!
  let bestDist = Math.abs(value - best)
  for (const level of CONFIDENCE_LEVELS) {
    const dist = Math.abs(value - level)
    if (dist < bestDist) {
      best = level
      bestDist = dist
    }
  }
  return best
}

export function snapConfidence(value: number): number {
  return nearestLevel(Math.max(0.1, Math.min(0.95, value)))
}

/** Increase confidence one ladder step (repeated behavior). */
export function increaseConfidence(current: number): number {
  const idx = CONFIDENCE_LEVELS.findIndex((l) => l >= current - 0.001)
  const at = idx < 0 ? 0 : idx
  const next = CONFIDENCE_LEVELS[Math.min(CONFIDENCE_LEVELS.length - 1, at + 1)]!
  return next
}

/** Decrease confidence one ladder step (opposite behavior). */
export function decreaseConfidence(current: number): number {
  const idx = CONFIDENCE_LEVELS.findIndex((l) => l >= current - 0.001)
  const at = idx < 0 ? CONFIDENCE_LEVELS.length - 1 : idx
  const next = CONFIDENCE_LEVELS[Math.max(0, at - 1)]!
  return next
}

export function confidenceFromObservations(observations: number): number {
  if (observations <= 1) return 0.1
  if (observations === 2) return 0.25
  if (observations === 3) return 0.4
  if (observations <= 5) return 0.6
  if (observations <= 8) return 0.8
  return 0.95
}
