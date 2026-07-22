/**
 * Sprint 87 — Never End With No Results + Recover Conversation (Principles 1 & 6).
 */

import type {
  BehaviorSnapshot,
  PrincipleViolation,
  RecoveryAttemptKind,
} from './BehaviorTypes'

export const REQUIRED_RECOVERY_ATTEMPTS: readonly RecoveryAttemptKind[] = [
  'nearby_airports',
  'flexible_dates',
  'different_durations',
  'hotel_alternatives',
  'airline_alternatives',
  'nearby_destinations',
  'package_optimization',
  'budget_redistribution',
  'explanation',
  'multiple_options',
] as const

export function missingRecoveryAttempts(
  attempted: RecoveryAttemptKind[] | undefined,
): RecoveryAttemptKind[] {
  const set = new Set(attempted ?? [])
  return REQUIRED_RECOVERY_ATTEMPTS.filter((k) => !set.has(k))
}

export function isRejectionCue(text: string | null | undefined): boolean {
  if (!text?.trim()) return false
  return /\bno\b|\bnot\s+this\b|\bchanged?\s+my\s+mind\b|\bdon'?t\s+(?:like|want)\b|لا\b|ليس\s+هذا|غيرت\s+رأي/i.test(text)
}

export function evaluateRecoveryPolicy(snapshot: BehaviorSnapshot): PrincipleViolation[] {
  const violations: PrincipleViolation[] = []

  if (snapshot.endedWithNoResults === true) {
    const missing = missingRecoveryAttempts(snapshot.recoveryAttempts)
    if (missing.length > 0) {
      violations.push({
        principleId: 'never_end_with_no_results',
        code: 'incomplete_recovery_before_failure',
        message:
          `Declared no results without required recovery attempts: ${missing.join(', ')}.`,
        severity: 'mandatory',
      })
    } else {
      // All attempts present but still ended empty — still a governance miss; must offer options/explanation.
      violations.push({
        principleId: 'never_end_with_no_results',
        code: 'ended_with_no_results',
        message: 'Turn ended with no results after recovery — surface closest options instead of empty failure.',
        severity: 'mandatory',
      })
    }
  }

  if (snapshot.userRejected === true && snapshot.recoveredWithoutRestart === false) {
    violations.push({
      principleId: 'recover_conversation',
      code: 'restarted_instead_of_recover',
      message: 'User rejection must recover the conversation without a full restart.',
      severity: 'mandatory',
    })
  }

  return violations
}
