/**
 * Evolution Sprint 5 — decision confidence from conversational certainty.
 */

import { signal, testAny, type AnalyzerContext } from './analyzerContext'
import type { PreferenceSignal } from './travelerTypes'

export function analyzeDecisionConfidence(ctx: AnalyzerContext): PreferenceSignal[] {
  const t = ctx.text
  const out: PreferenceSignal[] = []

  if (testAny(t, [/definitely|sure|أكيد|واثق|lock it|ثبت|نحجز/i])) {
    out.push(signal(ctx, 'decision_confidence', 'high', 0.85, 0.8, 'High decision certainty language'))
  }
  if (testAny(t, [/maybe|not sure|مو متأكد|متردد|perhaps|أفكر|still deciding/i])) {
    out.push(signal(ctx, 'decision_confidence', 'low', -0.7, 0.75, 'Low decision certainty language'))
  }
  if (testAny(t, [/compare|قارن|options|خيارات|أيهما/i])) {
    out.push(signal(ctx, 'decision_confidence', 'medium', 0, 0.6, 'Comparing options — medium certainty'))
  }

  return out
}
