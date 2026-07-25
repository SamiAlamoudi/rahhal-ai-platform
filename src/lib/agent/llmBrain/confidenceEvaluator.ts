/**
 * Phase 5 — ConfidenceEvaluator
 * High / medium / low. Low → ask clarification.
 */

import type { ConversationIntentKind, LiveTravelMemory } from '../conversationIntelligence'
import type { ConfidenceLevel, ToolDecision } from './types'

export function scoreToLevel(score: number): ConfidenceLevel {
  if (score >= 0.75) return 'high'
  if (score >= 0.45) return 'medium'
  return 'low'
}

export function evaluateConfidence(input: {
  memory: LiveTravelMemory
  intent: ConversationIntentKind
  tool: ToolDecision
  usedRulesFallback: boolean
  entityCueCount: number
}): { score: number; level: ConfidenceLevel; shouldClarify: boolean; reasons: string[] } {
  let score = 0.35
  const reasons: string[] = []
  const m = input.memory

  if (m.destination) {
    score += 0.2
    reasons.push('destination_known')
  }
  if (m.monthHint || m.flexibleDates || m.startDate) {
    score += 0.12
    reasons.push('timing_signal')
  }
  if (m.travelers.adults != null || m.travelers.total != null) {
    score += 0.1
    reasons.push('travelers_known')
  }
  if (m.budgetAmount != null || m.purpose) {
    score += 0.08
    reasons.push('budget_or_purpose')
  }
  if (input.entityCueCount >= 3) {
    score += 0.1
    reasons.push('rich_entities')
  }
  if (input.intent !== 'unknown') {
    score += 0.08
    reasons.push('intent_clear')
  }
  if (input.usedRulesFallback) {
    score -= 0.08
    reasons.push('rules_fallback_penalty')
  }
  if (input.tool.confidence === 'high') score += 0.05
  if (input.tool.confidence === 'low') score -= 0.05

  score = Math.max(0, Math.min(1, score))
  const level = scoreToLevel(score)
  const shouldClarify = level === 'low' || input.tool.tool === 'ask_question'

  return { score, level, shouldClarify, reasons }
}

export const ConfidenceEvaluator = {
  evaluate: evaluateConfidence,
  scoreToLevel,
}
