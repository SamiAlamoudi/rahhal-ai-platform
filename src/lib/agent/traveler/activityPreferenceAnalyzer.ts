/**
 * Evolution Sprint 5 — ActivityPreferenceAnalyzer
 */

import { signal, testAny, type AnalyzerContext } from './analyzerContext'
import type { PreferenceSignal } from './travelerTypes'

export function analyzeActivityPreference(ctx: AnalyzerContext): PreferenceSignal[] {
  const t = ctx.text
  const out: PreferenceSignal[] = []

  if (testAny(t, [/shopping|تسوق|mall|أسواق|souk/i])) {
    out.push(signal(ctx, 'shopping_interest', 'high', 0.8, 0.8, 'Shopping interest'))
  }
  if (testAny(t, [/no shopping|ما نبغى تسوق|not into malls/i])) {
    out.push(signal(ctx, 'shopping_interest', 'low', -0.7, 0.75, 'Low shopping interest'))
  }
  if (testAny(t, [/many activities|أنشطة كثيرة|full days|برنامج مليان/i])) {
    out.push(signal(ctx, 'activity_density', 'high', 0.8, 0.75, 'Dense activity preference'))
  }
  if (testAny(t, [/few activities|أنشطة قليلة|light schedule|برنامج خفيف/i])) {
    out.push(signal(ctx, 'activity_density', 'low', -0.75, 0.75, 'Light activity preference'))
  }
  if (testAny(t, [/adventure|مغامرة|diving|تسلق|zip.?line/i])) {
    out.push(signal(ctx, 'adventure_preference', 'high', 0.75, 0.75, 'Activity-level adventure'))
  }

  return out
}

export const ActivityPreferenceAnalyzer = { analyze: analyzeActivityPreference }
