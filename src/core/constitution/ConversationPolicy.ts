/**
 * Sprint 87 — conversation tone + intent respect (Principles 5 & 7).
 */

import {
  FORBIDDEN_FAILURE_PHRASES,
  type BehaviorSnapshot,
  type PrincipleViolation,
} from './BehaviorTypes'

export function containsForbiddenFailureLanguage(text: string | null | undefined): boolean {
  if (!text?.trim()) return false
  return FORBIDDEN_FAILURE_PHRASES.some((re) => re.test(text))
}

/** Prefer constraint + closest-solution framing. */
export function preferredFailureFraming(input: {
  constraints: string[]
  closestSolution: string
}): string {
  const constraints = input.constraints.length
    ? `Given ${input.constraints.join(', ')}, `
    : ''
  return `${constraints}here is the closest achievable option: ${input.closestSolution}`
}

export function evaluateConversationPolicy(snapshot: BehaviorSnapshot): PrincipleViolation[] {
  const violations: PrincipleViolation[] = []
  if (containsForbiddenFailureLanguage(snapshot.replyText)) {
    violations.push({
      principleId: 'never_make_user_feel_wrong',
      code: 'forbidden_failure_language',
      message:
        'Reply uses blocked language (impossible / wrong / cannot). Explain constraints and closest solution instead.',
      severity: 'mandatory',
    })
  }
  if (snapshot.userIntent && snapshot.systemOverrodeUserIntent === true) {
    violations.push({
      principleId: 'respect_user_intent',
      code: 'intent_overridden',
      message: 'System overrode explicit user intent.',
      severity: 'mandatory',
    })
  }
  return violations
}
