/**
 * Evolution Sprint 5 — RiskToleranceAnalyzer
 */

import { signal, testAny, type AnalyzerContext } from './analyzerContext'
import type { PreferenceSignal } from './travelerTypes'

export function analyzeRiskTolerance(ctx: AnalyzerContext): PreferenceSignal[] {
  const t = ctx.text
  const out: PreferenceSignal[] = []

  if (testAny(t, [/safe|آمن|safety|with kids|أطفال|elderly|avoid risk|ما نبغى مخاطرة/i])) {
    out.push(signal(ctx, 'risk_tolerance', 'low', -0.8, 0.85, 'Low risk / safety cues'))
  }
  if (testAny(t, [/adventure|remote|مغامرة|off.?grid|unpredictable|نجرب شيء جديد جدا/i])) {
    out.push(signal(ctx, 'risk_tolerance', 'high', 0.75, 0.75, 'Higher risk tolerance cues'))
    out.push(signal(ctx, 'adventure_preference', 'high', 0.7, 0.7, 'Adventure linked to risk appetite'))
  }
  if (testAny(t, [/moderate risk|مخاطرة معقولة|balanced risk/i])) {
    out.push(signal(ctx, 'risk_tolerance', 'medium', 0, 0.65, 'Moderate risk stance'))
  }

  return out
}

export const RiskToleranceAnalyzer = { analyze: analyzeRiskTolerance }
