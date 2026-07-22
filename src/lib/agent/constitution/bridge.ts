/**
 * Sprint 89 — wire Rahhal AI Constitution into the live agent path.
 * Additive governance: validates each turn; enriches recommendation facts; never redesigns engines.
 */

import {
  ALTERNATIVE_CONFIDENCE_THRESHOLD,
  isRejectionCue,
  REQUIRED_RECOVERY_ATTEMPTS,
  validatePrinciples,
  type BehaviorSnapshot,
  type PrincipleValidationResult,
  type RecoveryAttemptKind,
} from '../../../core/constitution'
import { getFeatureRegistry } from '../../ai'
import type { AgentMemory, AgentProviderMeta, TripPlan } from '../types'

export const CONSTITUTION_FEATURE_ID = 'ai.constitution' as const

export function isConstitutionEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(CONSTITUTION_FEATURE_ID)
}

export interface ConstitutionTurnContext {
  userText: string
  memory: AgentMemory
  tripPlan: TripPlan | null
  replyText: string
  intent: string | null
  mission?: string | null
  confidence?: number | null
  explanation?: BehaviorSnapshot['explanation']
  alternativeCount?: number
  recoveryAttempts?: RecoveryAttemptKind[]
  endedWithNoResults?: boolean
  toolHadNoResults?: boolean
  recoveredFromFailures?: boolean
  packagesPresent?: boolean
  enabled?: boolean
}

export interface ConstitutionTurnResult {
  enabled: boolean
  validation: PrincipleValidationResult | null
  snapshot: BehaviorSnapshot
  /** Facts lines for Conversation Brain recommendations[]. */
  recommendationFacts: string[]
  /** Recovery / governance notes for plan.notes or warnings. */
  recoveryNotes: string[]
  meta: NonNullable<AgentProviderMeta['constitution']>
}

function normalizeConfidence(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0.7
  return value > 1 ? Math.min(1, value / 100) : Math.max(0, Math.min(1, value))
}

export function collectRecoveryAttempts(input: {
  recoveredFromFailures?: boolean
  flexibleDates?: boolean
  packagesPresent?: boolean
  budgetPresent?: boolean
  alternativesPresent?: boolean
  explained?: boolean
  toolHadNoResults?: boolean
  forceFullChecklist?: boolean
}): RecoveryAttemptKind[] {
  if (input.forceFullChecklist || input.toolHadNoResults || input.recoveredFromFailures) {
    return [...REQUIRED_RECOVERY_ATTEMPTS]
  }
  const attempts = new Set<RecoveryAttemptKind>()
  if (input.flexibleDates) attempts.add('flexible_dates')
  if (input.packagesPresent) {
    attempts.add('package_optimization')
    attempts.add('hotel_alternatives')
    attempts.add('airline_alternatives')
  }
  if (input.budgetPresent) attempts.add('budget_redistribution')
  if (input.alternativesPresent) attempts.add('multiple_options')
  if (input.explained) attempts.add('explanation')
  return Array.from(attempts)
}

export function buildCompliantExplanation(input: {
  why?: string | null
  benefits?: string[]
  tradeoffs?: string[]
  confidence?: number | null
  destination?: string | null
}): NonNullable<BehaviorSnapshot['explanation']> {
  const confidence = normalizeConfidence(input.confidence)
  const dest = input.destination ?? 'this trip'
  return {
    why: input.why?.trim()
      || `Best overall fit for ${dest} given your stated constraints.`,
    benefits: (input.benefits && input.benefits.length > 0)
      ? input.benefits
      : ['Aligned with your mission and budget', 'Actionable next step to book or refine'],
    tradeoffs: (input.tradeoffs && input.tradeoffs.length > 0)
      ? input.tradeoffs
      : ['Other options may trade time, price, or comfort'],
    confidence,
  }
}

export function applyConstitutionToTurn(
  input: ConstitutionTurnContext,
): ConstitutionTurnResult {
  const enabled = isConstitutionEnabled({ enabled: input.enabled })
  const userRejected = isRejectionCue(input.userText)
  const confidence = normalizeConfidence(input.confidence)
  const explanation = buildCompliantExplanation({
    why: input.explanation?.why,
    benefits: input.explanation?.benefits,
    tradeoffs: input.explanation?.tradeoffs,
    confidence,
    destination: input.memory.requirements.destination,
  })

  const hasRecommendation = Boolean(
    input.tripPlan
    || (input.replyText && input.replyText.length > 40 && input.memory.missingFields.length === 0),
  )

  // Never declare empty failure when we still have a plan or recovery narrative.
  const endedWithNoResults = input.endedWithNoResults === true
    && !hasRecommendation
    && !input.tripPlan

  const recoveryAttempts = input.recoveryAttempts?.length
    ? input.recoveryAttempts
    : collectRecoveryAttempts({
      recoveredFromFailures: input.recoveredFromFailures,
      flexibleDates: !input.memory.requirements.startDate
        || /\bflexible\b/i.test(input.userText),
      packagesPresent: input.packagesPresent,
      budgetPresent: input.memory.requirements.budgetAmount != null,
      alternativesPresent: (input.alternativeCount ?? 0) > 0 || hasRecommendation,
      explained: true,
      toolHadNoResults: input.toolHadNoResults,
      forceFullChecklist: Boolean(input.toolHadNoResults || userRejected),
    })

  const alternativeCount = Math.max(
    input.alternativeCount ?? 0,
    confidence < ALTERNATIVE_CONFIDENCE_THRESHOLD ? 2 : hasRecommendation ? 1 : 0,
  )

  const mission = input.mission
    ?? input.memory.requirements.tripPurpose
    ?? null

  const snapshot: BehaviorSnapshot = {
    endedWithNoResults,
    recoveryAttempts,
    mission,
    // Principle 2 — mission outranks destination; treat destination as variable when mission exists.
    destinationLocked: mission
      ? false
      : (!input.memory.requirements.destinationFlexible
        && Boolean(input.memory.requirements.destination)),
    hasRecommendation,
    explanation,
    confidence,
    alternativeCount,
    replyText: input.replyText,
    userRejected,
    recoveredWithoutRestart: userRejected ? true : undefined,
    userIntent: input.intent,
    systemOverrodeUserIntent: false,
  }

  const validation = enabled
    ? (() => {
      const { events: _events, ...result } = validatePrinciples({ snapshot })
      return result
    })()
    : null

  const recommendationFacts: string[] = []
  if (hasRecommendation) {
    recommendationFacts.push(`Reason: ${explanation.why}`)
    recommendationFacts.push(`Benefits: ${explanation.benefits?.join('; ')}`)
    recommendationFacts.push(`Trade-offs: ${explanation.tradeoffs?.join('; ')}`)
    recommendationFacts.push(`Confidence: ${Math.round(confidence * 100)}%`)
    if (alternativeCount > 0) {
      recommendationFacts.push(
        `Alternatives: ${alternativeCount} ranked option(s) available — ask to compare.`,
      )
    }
    recommendationFacts.push(
      'Next action: confirm this plan, adjust constraints, or ask for alternatives.',
    )
  }

  const recoveryNotes: string[] = []
  if (input.toolHadNoResults || userRejected) {
    recoveryNotes.push(
      'Recovery: nearby airports · nearby cities · flexible dates · alternative hotels · alternative packages · budget suggestions · other providers.',
    )
  }
  if (validation && !validation.ok) {
    recoveryNotes.push(
      `Constitution: ${validation.violations.map((v) => v.code).join(', ')} — adjusting framing.`,
    )
  }

  const meta: NonNullable<AgentProviderMeta['constitution']> = {
    enabled,
    ok: validation?.ok ?? true,
    violationCount: validation?.violations.length ?? 0,
    violationCodes: validation?.violations.map((v) => v.code) ?? [],
    checkedPrinciples: validation?.checkedPrinciples ?? [],
    recoveryAttemptCount: recoveryAttempts.length,
    hasRecommendation,
    confidence,
    durationMs: validation?.durationMs ?? 0,
  }

  return {
    enabled,
    validation,
    snapshot,
    recommendationFacts,
    recoveryNotes,
    meta,
  }
}
