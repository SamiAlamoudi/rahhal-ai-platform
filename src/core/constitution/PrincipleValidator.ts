/**
 * Sprint 87 — validate a BehaviorSnapshot against Rahhal AI Constitution.
 * Additive governance — engines opt in; public APIs unchanged.
 */

import { evaluateAlternativePolicy } from './AlternativePolicy'
import { evaluateConversationPolicy } from './ConversationPolicy'
import { evaluateExplanationPolicy } from './ExplanationPolicy'
import { evaluateMissionPolicy } from './MissionPolicy'
import { listPrincipleIds } from './RahhalPrinciples'
import { evaluateRecoveryPolicy } from './RecoveryPolicy'
import {
  SPRINT87_AI_CONSTITUTION_VERSION,
  type BehaviorSnapshot,
  type PrincipleId,
  type PrincipleValidationResult,
  type PrincipleViolation,
} from './BehaviorTypes'
import { emitConstitutionEvent, type ConstitutionEvent } from './events'

export interface ValidatePrinciplesInput {
  snapshot: BehaviorSnapshot
  /** Limit checks to a subset of principles. Default: all. */
  principles?: PrincipleId[]
}

export function validatePrinciples(
  input: ValidatePrinciplesInput,
): PrincipleValidationResult & { events: ConstitutionEvent[] } {
  const started = performance.now()
  const events: ConstitutionEvent[] = []
  emitConstitutionEvent('constitution.validation.started', {}, events)

  const checked = input.principles?.length
    ? [...new Set(input.principles)]
    : listPrincipleIds()

  const snapshot = input.snapshot
  const all: PrincipleViolation[] = [
    ...evaluateRecoveryPolicy(snapshot),
    ...evaluateMissionPolicy(snapshot),
    ...evaluateExplanationPolicy(snapshot),
    ...evaluateAlternativePolicy(snapshot),
    ...evaluateConversationPolicy(snapshot),
  ]

  // Deduplicate by code
  const seen = new Set<string>()
  const violations: PrincipleViolation[] = []
  for (const v of all) {
    if (!checked.includes(v.principleId)) continue
    const key = `${v.principleId}:${v.code}`
    if (seen.has(key)) continue
    seen.add(key)
    violations.push(v)
    emitConstitutionEvent('constitution.violation', {
      principleId: v.principleId,
      code: v.code,
    }, events)
  }

  for (const id of checked) {
    emitConstitutionEvent('constitution.principle.checked', { principleId: id }, events)
  }

  const ok = violations.length === 0
  emitConstitutionEvent(
    ok ? 'constitution.validation.passed' : 'constitution.validation.failed',
    { violationCount: violations.length },
    events,
  )

  return {
    version: SPRINT87_AI_CONSTITUTION_VERSION,
    ok,
    violations,
    checkedPrinciples: checked,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    events,
  }
}

export class PrincipleValidator {
  validate(snapshot: BehaviorSnapshot, principles?: PrincipleId[]) {
    return validatePrinciples({ snapshot, principles })
  }
}

export function createPrincipleValidator(): PrincipleValidator {
  return new PrincipleValidator()
}
