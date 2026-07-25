/**
 * Evolution Sprint 5 — shared analyzer helpers.
 */

import { createEvidence } from './preferenceEvidence'
import {
  clamp01,
  clampLean,
  isoNow,
  type PreferenceKey,
  type PreferenceSignal,
  type TravelerLocale,
} from './travelerTypes'

export interface AnalyzerContext {
  text: string
  locale: TravelerLocale
  conversationSource: string
  reasoningRef: string | null
  reflectionRef: string | null
  now?: Date
}

export function signal(
  ctx: AnalyzerContext,
  key: PreferenceKey,
  value: string,
  lean: number,
  confidence: number,
  evidenceText: string,
): PreferenceSignal {
  const evidence = createEvidence({
    text: evidenceText,
    conversationSource: ctx.conversationSource,
    reasoningRef: ctx.reasoningRef,
    reflectionRef: ctx.reflectionRef,
    now: ctx.now,
  })
  return {
    key,
    value,
    lean: clampLean(lean),
    confidence: clamp01(confidence),
    evidence: [evidence],
    timestamp: isoNow(ctx.now),
    conversationSource: ctx.conversationSource,
    reasoningRef: ctx.reasoningRef,
    reflectionRef: ctx.reflectionRef,
  }
}

export function testAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text))
}
