/**
 * Sprint 87 — decision-path governance (Principles 1, 4, 7).
 */

import { evaluateAlternativePolicy } from './AlternativePolicy'
import { evaluateRecoveryPolicy } from './RecoveryPolicy'
import type { BehaviorSnapshot, PrincipleViolation } from './BehaviorTypes'

export function evaluateDecisionPolicy(snapshot: BehaviorSnapshot): PrincipleViolation[] {
  const violations: PrincipleViolation[] = [
    ...evaluateRecoveryPolicy(snapshot),
    ...evaluateAlternativePolicy(snapshot),
  ]

  if (snapshot.userIntent && snapshot.systemOverrodeUserIntent === true) {
    violations.push({
      principleId: 'respect_user_intent',
      code: 'decision_ignored_intent',
      message: 'Decision path ignored explicit user intent.',
      severity: 'mandatory',
    })
  }

  return violations
}

/** Whether a decision turn may declare hard failure. */
export function mayDeclareNoResults(snapshot: BehaviorSnapshot): boolean {
  // Constitution: never — always surface closest options instead.
  if (snapshot.endedWithNoResults) return false
  return true
}
