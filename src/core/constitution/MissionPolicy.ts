/**
 * Sprint 87 — Mission Before Destination (Principle 2).
 */

import type { BehaviorSnapshot, PrincipleViolation } from './BehaviorTypes'

/** Lightweight mission cues from traveler language. */
const MISSION_CUES: Array<{ pattern: RegExp; mission: string }> = [
  { pattern: /\bwife\b|\bhusband\b|\bromantic\b|\bhoneymoon\b|زوجة|رومان/i, mission: 'Romantic Experience' },
  { pattern: /\bfamily\b|\bkids?\b|\bchildren\b|عائلة|أطفال/i, mission: 'Family Experience' },
  { pattern: /\bbusiness\b|\bmeeting\b|\bconference\b|عمل|اجتماع/i, mission: 'Business Productivity' },
  { pattern: /\badventure\b|\bhiking\b|\bexplore\b|مغامرة/i, mission: 'Adventure' },
  { pattern: /\brelax\b|\bspaa?\b|\bquiet\b|استرخاء/i, mission: 'Rest & Recovery' },
  { pattern: /\bbudget\b|\bcheap\b|\bvalue\b|ميزانية|أرخص/i, mission: 'Value Maximization' },
  { pattern: /\bluxury\b|فاخر/i, mission: 'Luxury Comfort' },
]

export function inferMissionFromText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null
  for (const cue of MISSION_CUES) {
    if (cue.pattern.test(text)) return cue.mission
  }
  return null
}

/** Destination is a variable when a mission is present. */
export function destinationIsVariable(mission: string | null | undefined): boolean {
  return Boolean(mission && mission.trim())
}

export function evaluateMissionPolicy(snapshot: BehaviorSnapshot): PrincipleViolation[] {
  const violations: PrincipleViolation[] = []
  if (snapshot.mission && snapshot.destinationLocked === true) {
    violations.push({
      principleId: 'mission_before_destination',
      code: 'destination_locked_over_mission',
      message:
        'Destination was locked while a traveler mission is active — mission must outrank destination.',
      severity: 'mandatory',
    })
  }
  return violations
}
