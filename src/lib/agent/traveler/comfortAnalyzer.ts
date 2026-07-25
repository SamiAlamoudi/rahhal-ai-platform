/**
 * Evolution Sprint 5 — ComfortAnalyzer
 */

import { signal, testAny, type AnalyzerContext } from './analyzerContext'
import type { PreferenceSignal } from './travelerTypes'

export function analyzeComfort(ctx: AnalyzerContext): PreferenceSignal[] {
  const t = ctx.text
  const out: PreferenceSignal[] = []

  if (testAny(t, [/comfort|راحة|comfortable|spa|suite|direct flight|رحلة مباشرة|no layover/i])) {
    out.push(signal(ctx, 'comfort_preference', 'high', 0.8, 0.75, 'Comfort-first cues'))
  }
  if (testAny(t, [/rough it|basic stay|بسيط|minimal comfort|sleep anywhere/i])) {
    out.push(signal(ctx, 'comfort_preference', 'low', -0.7, 0.7, 'Low comfort needs'))
  }
  if (testAny(t, [/avoid long transit|ما نبغى تنقل طويل|hate connections|كره المواصلات/i])) {
    out.push(signal(ctx, 'transit_tolerance', 'low', -0.75, 0.8, 'Low transit tolerance'))
    out.push(signal(ctx, 'comfort_preference', 'high', 0.5, 0.6, 'Transit avoidance implies comfort'))
  }

  return out
}

export const ComfortAnalyzer = { analyze: analyzeComfort }
