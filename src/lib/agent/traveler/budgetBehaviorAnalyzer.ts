/**
 * Evolution Sprint 5 — BudgetBehaviorAnalyzer
 */

import { signal, testAny, type AnalyzerContext } from './analyzerContext'
import type { PreferenceSignal } from './travelerTypes'

export function analyzeBudgetBehavior(ctx: AnalyzerContext): PreferenceSignal[] {
  const t = ctx.text
  const out: PreferenceSignal[] = []

  if (testAny(t, [/flexible budget|ميزانية مرنة|ok to stretch|يمكن نزيد/i])) {
    out.push(signal(ctx, 'budget_flexibility', 'high', 0.75, 0.8, 'Flexible budget language'))
  }
  if (testAny(t, [/strict budget|ميزانية ثابتة|cannot exceed|ما أقدر أزيد|hard cap|سقف/i])) {
    out.push(signal(ctx, 'budget_flexibility', 'low', -0.8, 0.85, 'Strict budget language'))
  }
  if (testAny(t, [/value|قيمة|worth|not just cheapest|مو بس الأرخص|best for money/i])) {
    out.push(signal(ctx, 'budget_flexibility', 'value_seeking', 0.35, 0.75, 'Value-seeking budget behavior'))
  }
  if (testAny(t, [/cheap|أرخص|lowest price|أقل سعر|tight|ضيقة/i])) {
    out.push(signal(ctx, 'budget_flexibility', 'low', -0.55, 0.7, 'Cheapest-first cues'))
    out.push(signal(ctx, 'luxury_preference', 'low', -0.5, 0.6, 'Price-sensitive implies lower luxury'))
  }
  if (testAny(t, [/luxury|فخم|premium|راقي|five\s*star/i])) {
    out.push(signal(ctx, 'luxury_preference', 'high', 0.8, 0.75, 'Luxury spend willingness'))
    out.push(signal(ctx, 'budget_flexibility', 'medium', 0.2, 0.55, 'Luxury may allow stretch'))
  }

  return out
}

export const BudgetBehaviorAnalyzer = { analyze: analyzeBudgetBehavior }
