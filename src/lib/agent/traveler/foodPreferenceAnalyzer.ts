/**
 * Evolution Sprint 5 — FoodPreferenceAnalyzer
 */

import { signal, testAny, type AnalyzerContext } from './analyzerContext'
import type { PreferenceSignal } from './travelerTypes'

export function analyzeFoodPreference(ctx: AnalyzerContext): PreferenceSignal[] {
  const t = ctx.text
  const out: PreferenceSignal[] = []

  if (testAny(t, [/foodie|cuisine|مطعم|أكل|culinary|street food|طعام الشارع|gastro|\bfoods?\b|great food/i])) {
    out.push(signal(ctx, 'food_exploration', 'high', 0.85, 0.8, 'Food exploration interest'))
  }
  if (testAny(t, [/picky|أكل بسيط|familiar food only|ما نجرب أكل غريب|safe food/i])) {
    out.push(signal(ctx, 'food_exploration', 'low', -0.7, 0.75, 'Low food exploration'))
  }
  if (testAny(t, [/halal|حلال|vegetarian|نباتي|vegan/i])) {
    out.push(signal(ctx, 'food_exploration', 'constrained', 0.2, 0.7, 'Dietary constraint with exploration nuance'))
  }

  return out
}

export const FoodPreferenceAnalyzer = { analyze: analyzeFoodPreference }
