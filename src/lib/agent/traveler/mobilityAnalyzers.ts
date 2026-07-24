/**
 * Evolution Sprint 5 — transit / walking tolerance analyzers.
 */

import { signal, testAny, type AnalyzerContext } from './analyzerContext'
import type { PreferenceSignal } from './travelerTypes'

export function analyzeWalkingAndTransit(ctx: AnalyzerContext): PreferenceSignal[] {
  const t = ctx.text
  const out: PreferenceSignal[] = []

  if (testAny(t, [/love walking|نحب نمشي|walk a lot|كثير مشي|walkable/i])) {
    out.push(signal(ctx, 'walking_tolerance', 'high', 0.8, 0.8, 'High walking tolerance'))
  }
  if (testAny(t, [/cannot walk much|ما نقدر نمشي|limited walking|wheelchair|عربة|prefer taxi/i])) {
    out.push(signal(ctx, 'walking_tolerance', 'low', -0.85, 0.85, 'Low walking tolerance'))
  }
  if (testAny(t, [/ok with trains|نرتاح للقطارات|metro fine|مواصلات عادية/i])) {
    out.push(signal(ctx, 'transit_tolerance', 'high', 0.7, 0.7, 'High transit tolerance'))
  }
  if (testAny(t, [/hate transit|كره المواصلات|minimal transfers|أقل تنقل|direct only/i])) {
    out.push(signal(ctx, 'transit_tolerance', 'low', -0.8, 0.8, 'Low transit tolerance'))
  }

  return out
}
