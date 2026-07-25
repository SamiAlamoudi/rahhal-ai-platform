/**
 * Evolution Sprint 5 — nightlife / photography / shopping-adjacent social cues.
 */

import { signal, testAny, type AnalyzerContext } from './analyzerContext'
import type { PreferenceSignal } from './travelerTypes'

export function analyzeSocialAndMedia(ctx: AnalyzerContext): PreferenceSignal[] {
  const t = ctx.text
  const out: PreferenceSignal[] = []

  if (testAny(t, [/nightlife|سهر|night club|bars?|حفلة ليلية/i])) {
    out.push(signal(ctx, 'nightlife_preference', 'high', 0.8, 0.8, 'Nightlife interest'))
  }
  if (testAny(t, [/no nightlife|بدون سهر|quiet nights|ليالي هادئة|early sleep/i])) {
    out.push(signal(ctx, 'nightlife_preference', 'low', -0.8, 0.8, 'Low nightlife preference'))
  }
  if (testAny(t, [/photo|photography|تصوير|instagram|صور كثيرة|scenic shots/i])) {
    out.push(signal(ctx, 'photography_interest', 'high', 0.85, 0.8, 'Photography interest'))
  }
  if (testAny(t, [/not into photos|ما يهمنا التصوير/i])) {
    out.push(signal(ctx, 'photography_interest', 'low', -0.6, 0.7, 'Low photography interest'))
  }
  if (testAny(t, [/family friendly|مناسب للعوائل|kid friendly|أطفال/i])) {
    out.push(signal(ctx, 'family_friendliness', 'high', 0.8, 0.8, 'Family friendliness'))
  }

  return out
}
