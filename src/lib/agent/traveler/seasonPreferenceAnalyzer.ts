/**
 * Evolution Sprint 5 — SeasonPreferenceAnalyzer
 */

import { signal, testAny, type AnalyzerContext } from './analyzerContext'
import type { PreferenceSignal } from './travelerTypes'

export function analyzeSeasonPreference(ctx: AnalyzerContext): PreferenceSignal[] {
  const t = ctx.text
  const out: PreferenceSignal[] = []

  if (testAny(t, [/warm|hot|حار|دافئ|summer|صيّف|صيفي|beach weather/i])) {
    out.push(signal(ctx, 'climate_preference', 'warm', 0.7, 0.75, 'Warm climate preference'))
    out.push(signal(ctx, 'season_preference', 'warm_season', 0.65, 0.7, 'Warm season lean'))
  }
  if (testAny(t, [/cold|cool|بارد|شتاء|winter|snow|ثلج|ski/i])) {
    out.push(signal(ctx, 'climate_preference', 'cold', -0.7, 0.75, 'Cold climate preference'))
    out.push(signal(ctx, 'season_preference', 'cold_season', -0.65, 0.7, 'Cold season lean'))
  }
  if (testAny(t, [/mild|معتدل|spring|خريف|autumn|fall/i])) {
    out.push(signal(ctx, 'climate_preference', 'mild', 0.1, 0.65, 'Mild climate preference'))
    out.push(signal(ctx, 'season_preference', 'shoulder', 0.1, 0.6, 'Shoulder season lean'))
  }
  if (testAny(t, [/avoid heat|ما نبغى حر|too humid|رطوبة عالية/i])) {
    out.push(signal(ctx, 'climate_preference', 'mild', -0.2, 0.7, 'Avoid extreme heat'))
  }

  return out
}

export const SeasonPreferenceAnalyzer = { analyze: analyzeSeasonPreference }
