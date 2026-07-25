/**
 * Evolution Sprint 5 — TravelStyleAnalyzer
 */

import { signal, testAny, type AnalyzerContext } from './analyzerContext'
import type { PreferenceSignal } from './travelerTypes'

export function analyzeTravelStyle(ctx: AnalyzerContext): PreferenceSignal[] {
  const t = ctx.text
  const out: PreferenceSignal[] = []

  if (testAny(t, [/luxury|فخم|five\s*star|5\s*star|first class|راقي/i])) {
    out.push(signal(ctx, 'travel_style', 'luxury', 0.8, 0.75, 'Luxury / premium wording'))
    out.push(signal(ctx, 'luxury_preference', 'high', 0.85, 0.8, 'Explicit luxury preference'))
  }
  if (testAny(t, [/backpack|budget travel|رحّال بسيط|low cost trip|hostel/i])) {
    out.push(signal(ctx, 'travel_style', 'budget', -0.7, 0.7, 'Budget / backpacker cues'))
    out.push(signal(ctx, 'luxury_preference', 'low', -0.7, 0.7, 'Anti-luxury cues'))
  }
  if (testAny(t, [/adventure|مغامرة|trek|safari|hiking|تسلق/i])) {
    out.push(signal(ctx, 'travel_style', 'adventure', 0.7, 0.75, 'Adventure travel style'))
    out.push(signal(ctx, 'adventure_preference', 'high', 0.8, 0.8, 'Adventure preference'))
  }
  if (testAny(t, [/relax|استجمام|quiet|هدوء|spa|wellness/i])) {
    out.push(signal(ctx, 'travel_style', 'recovery', -0.2, 0.65, 'Recovery / relax style'))
  }
  if (testAny(t, [/family|عائلة|عائلية|kids|أطفال/i])) {
    out.push(signal(ctx, 'travel_style', 'family', 0.3, 0.8, 'Family travel style'))
    out.push(signal(ctx, 'family_friendliness', 'high', 0.85, 0.85, 'Family-friendly need'))
  }
  if (testAny(t, [/culture|ثقافة|museum|متحف|heritage|تاريخ/i])) {
    out.push(signal(ctx, 'travel_style', 'cultural', 0.4, 0.7, 'Cultural travel style'))
  }
  if (testAny(t, [/honeymoon|شهر\s*عسل|romantic|رومانسي/i])) {
    out.push(signal(ctx, 'travel_style', 'romantic', 0.5, 0.8, 'Romantic / honeymoon style'))
  }

  if (testAny(t, [/nature|طبيعة|mountains?|جبال|beach|بحر|forest|غابة/i])) {
    out.push(signal(ctx, 'nature_vs_cities', 'nature', -0.7, 0.7, 'Nature lean'))
  }
  if (testAny(t, [/city|cities|مدينة|urban|nightlife|skyline|مترو/i])) {
    out.push(signal(ctx, 'nature_vs_cities', 'cities', 0.7, 0.7, 'City lean'))
  }

  return out
}

export const TravelStyleAnalyzer = { analyze: analyzeTravelStyle }
