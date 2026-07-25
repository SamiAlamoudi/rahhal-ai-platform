/**
 * Phase 3 Stage 2 — Clarification manager.
 * At most one question; never repeat answered / resolved questions.
 */

import {
  clamp01,
  isoNow,
  uniqueStrings,
  type MultiTurnConversationSession,
} from './memoryTypes'
import type { ConversationLocale } from './types'
import { normalizeQuestionKey } from './conversationMemory'

export interface ClarificationDecision {
  shouldClarify: boolean
  question: string | null
  confidence: number
  missingInformation: string[]
  reason: 'enough_info' | 'high_confidence' | 'missing_info' | 'low_confidence'
}

export function computeSessionMissing(
  session: MultiTurnConversationSession,
): string[] {
  const missing: string[] = []
  if (!session.destinationFacts.destination) missing.push('destination')
  if (session.strategyFacts.budgetAmount == null) missing.push('budget')
  if (session.strategyFacts.durationDays == null) missing.push('duration')
  if (session.travelerFacts.adults == null) missing.push('travelers')
  return missing
}

export function scoreMultiTurnConfidence(
  session: MultiTurnConversationSession,
  missing: string[],
): number {
  let score = 0.3
  if (session.destinationFacts.destination) score += 0.25
  if (session.strategyFacts.budgetAmount != null) score += 0.15
  if (session.strategyFacts.durationDays != null) score += 0.12
  if (session.travelerFacts.adults != null) score += 0.08
  if ((session.travelerFacts.interests?.length ?? 0) > 0) score += 0.05
  if (session.conversationSummary) score += 0.05
  score -= missing.length * 0.1
  return clamp01(score)
}

export function decideClarification(input: {
  session: MultiTurnConversationSession
  locale?: ConversationLocale
  /** External confidence hint (e.g. from orchestrator). */
  confidenceHint?: number
}): ClarificationDecision {
  const locale = input.locale === 'en' ? 'en' : input.session.locale
  const missing = computeSessionMissing(input.session)
  const confidence =
    typeof input.confidenceHint === 'number'
      ? clamp01(input.confidenceHint)
      : scoreMultiTurnConfidence(input.session, missing)

  // High confidence → never interrupt
  if (confidence >= 0.7) {
    return {
      shouldClarify: false,
      question: null,
      confidence,
      missingInformation: missing,
      reason: 'high_confidence',
    }
  }

  if (missing.length === 0) {
    return {
      shouldClarify: false,
      question: null,
      confidence,
      missingInformation: [],
      reason: 'enough_info',
    }
  }

  // Low / medium with gaps → exactly one clarification
  const question = pickOneClarification({
    session: input.session,
    missing,
    locale,
  })

  if (!question) {
    return {
      shouldClarify: false,
      question: null,
      confidence,
      missingInformation: missing,
      reason: 'enough_info',
    }
  }

  return {
    shouldClarify: true,
    question,
    confidence,
    missingInformation: missing,
    reason: confidence < 0.35 ? 'low_confidence' : 'missing_info',
  }
}

function pickOneClarification(input: {
  session: MultiTurnConversationSession
  missing: string[]
  locale: ConversationLocale
}): string | null {
  const asked = new Set([
    ...input.session.answeredQuestions.map(normalizeQuestionKey),
    ...input.session.resolvedClarifications.map(normalizeQuestionKey),
  ])
  if (input.session.pendingClarification) {
    asked.add(normalizeQuestionKey(input.session.pendingClarification))
  }

  const candidates = input.missing.map((m) => missingToQuestion(m, input.locale))
  for (const q of candidates) {
    if (!asked.has(normalizeQuestionKey(q))) return q
  }
  return null
}

function missingToQuestion(missing: string, locale: ConversationLocale): string {
  if (missing === 'destination') {
    return locale === 'ar'
      ? 'إلى أي وجهة تفكر بالسفر؟'
      : 'Which destination are you considering?'
  }
  if (missing === 'budget') {
    return locale === 'ar'
      ? 'ما الميزانية التقريبية للرحلة؟'
      : 'What is your approximate trip budget?'
  }
  if (missing === 'duration') {
    return locale === 'ar'
      ? 'كم يوماً تريد للرحلة؟'
      : 'How many days should the trip last?'
  }
  if (missing === 'travelers') {
    return locale === 'ar'
      ? 'كم عدد المسافرين تقريباً؟'
      : 'How many travelers will join the trip?'
  }
  return locale === 'ar'
    ? `هل يمكنك توضيح: ${missing}؟`
    : `Could you clarify: ${missing}?`
}

export function applyClarificationToSession(
  session: MultiTurnConversationSession,
  decision: ClarificationDecision,
  now?: Date,
): MultiTurnConversationSession {
  const missingInformation = uniqueStrings(decision.missingInformation).slice(0, 16)
  if (!decision.shouldClarify || !decision.question) {
    return {
      ...session,
      missingInformation,
      pendingClarification: null,
      updatedAt: isoNow(now),
    }
  }
  return {
    ...session,
    missingInformation,
    pendingClarification: decision.question,
    updatedAt: isoNow(now),
  }
}

export function resolvePendingClarification(
  session: MultiTurnConversationSession,
  now?: Date,
): MultiTurnConversationSession {
  if (!session.pendingClarification) return session
  const key = normalizeQuestionKey(session.pendingClarification)
  return {
    ...session,
    answeredQuestions: uniqueStrings([...session.answeredQuestions, key]).slice(-40),
    resolvedClarifications: uniqueStrings([
      ...session.resolvedClarifications,
      key,
    ]).slice(-40),
    pendingClarification: null,
    updatedAt: isoNow(now),
  }
}

export const ClarificationManager = {
  decide: decideClarification,
  missing: computeSessionMissing,
  score: scoreMultiTurnConfidence,
  apply: applyClarificationToSession,
  resolve: resolvePendingClarification,
}
