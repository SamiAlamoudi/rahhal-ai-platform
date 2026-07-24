/**
 * Evolution Sprint 5 — PaceAnalyzer
 */

import { signal, testAny, type AnalyzerContext } from './analyzerContext'
import type { PreferenceSignal } from './travelerTypes'

export function analyzePace(ctx: AnalyzerContext): PreferenceSignal[] {
  const t = ctx.text
  const out: PreferenceSignal[] = []

  if (testAny(t, [/slow|relaxed|هادئ|استجمام|no rush|لا استعجل|chill/i])) {
    out.push(signal(ctx, 'pace', 'relaxed', -0.75, 0.8, 'Relaxed pace'))
    out.push(signal(ctx, 'activity_density', 'low', -0.7, 0.75, 'Low activity density'))
  }
  if (testAny(t, [/packed|كثيف|see everything|كل يوم مشغول|busy itinerary|jam[- ]?packed/i])) {
    out.push(signal(ctx, 'pace', 'packed', 0.8, 0.8, 'Packed pace'))
    out.push(signal(ctx, 'activity_density', 'high', 0.85, 0.8, 'High activity density'))
  }
  if (testAny(t, [/balanced|متوازن|moderate pace|إيقاع معتدل/i])) {
    out.push(signal(ctx, 'pace', 'balanced', 0, 0.7, 'Balanced pace'))
    out.push(signal(ctx, 'activity_density', 'medium', 0, 0.65, 'Medium activity density'))
  }

  return out
}

export const PaceAnalyzer = { analyze: analyzePace }
