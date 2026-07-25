/**
 * Integration Sprint 9 — Budget optimizer tiers.
 */

import { createBudgetEngine } from './budgetEngine'
import { buildCostBreakdown, type OfferPriceHints } from './breakdown'
import type { TripPlan, TripRequirements } from '../types'
import type { BudgetEnvelope, BudgetTier, OptimizedBudgetOption } from './types'

const TIERS: BudgetTier[] = ['budget', 'balanced', 'premium', 'luxury', 'best_value']

const LABELS: Record<BudgetTier, { en: string; ar: string }> = {
  budget: { en: 'Budget', ar: 'اقتصادي' },
  balanced: { en: 'Balanced', ar: 'متوازن' },
  premium: { en: 'Premium', ar: 'مميّز' },
  luxury: { en: 'Luxury', ar: 'فاخر' },
  best_value: { en: 'Best Value', ar: 'أفضل قيمة' },
}

function tierMultiplier(tier: BudgetTier): number {
  switch (tier) {
    case 'budget': return 0.85
    case 'best_value': return 0.92
    case 'balanced': return 1
    case 'premium': return 1.15
    case 'luxury': return 1.35
  }
}

function scoreOption(option: OptimizedBudgetOption, preferred: BudgetTier | null): number {
  let score = 70
  if (option.breakdown.withinBudget) score += 15
  else score -= Math.min(40, option.breakdown.overBy / Math.max(1, option.envelope.total.amount) * 100)
  if (option.tier === 'best_value') score += 8
  if (option.tier === preferred) score += 10
  if (option.breakdown.underBy > 0 && option.breakdown.underBy < option.envelope.total.amount * 0.2) {
    score += 5
  }
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function optimizeBudgetOptions(input: {
  baseEnvelope: BudgetEnvelope
  requirements?: TripRequirements | null
  plan?: TripPlan | null
  offers?: OfferPriceHints
  preferredTier?: BudgetTier | null
}): OptimizedBudgetOption[] {
  const engine = createBudgetEngine()
  const preferred = input.preferredTier
    ?? (input.requirements?.budgetStyle === 'luxury'
      ? 'luxury'
      : input.requirements?.budgetStyle === 'budget'
        ? 'budget'
        : 'balanced')

  const options = TIERS.map((tier) => {
    const envelope = engine.buildEnvelope({
      total: input.baseEnvelope.total.amount,
      currency: input.baseEnvelope.total.currency,
      travelers: input.baseEnvelope.travelers,
      nights: input.baseEnvelope.nights,
      reserveRatio: tier === 'luxury' ? 0.1 : 0.08,
    })
    // Scale usable spend by tier intensity while keeping the traveler's total cap.
    const scaledUsable = Math.round(envelope.usable.amount * tierMultiplier(tier))
    const spendEnvelope: BudgetEnvelope = {
      ...envelope,
      usable: { amount: scaledUsable, currency: envelope.usable.currency },
      perTraveler: {
        amount: Math.round(scaledUsable / envelope.travelers),
        currency: envelope.usable.currency,
      },
      perDay: {
        amount: Math.round(scaledUsable / envelope.nights),
        currency: envelope.usable.currency,
      },
    }
    const breakdown = buildCostBreakdown({
      envelope: spendEnvelope,
      tier,
      plan: input.plan,
      requirements: input.requirements,
      offers: tier === preferred ? input.offers : undefined,
    })
    const labels = LABELS[tier]
    const option: OptimizedBudgetOption = {
      tier,
      labelEn: labels.en,
      labelAr: labels.ar,
      envelope,
      breakdown,
      score: 0,
      whyEn: `${labels.en} mix · est. ${Math.round(breakdown.estimatedTotal)} ${breakdown.currency}`,
      whyAr: `مزيج ${labels.ar} · تقدير ${Math.round(breakdown.estimatedTotal)} ${breakdown.currency}`,
    }
    option.score = scoreOption(option, preferred)
    return option
  })

  return options.sort((a, b) => b.score - a.score)
}
