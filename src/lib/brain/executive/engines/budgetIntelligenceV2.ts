/**
 * Budget Intelligence Engine v2 — full trip cost breakdown + confidence.
 */

import { findDestinationProfile } from '../../../agent/reasoning/destinationCatalog'
import type {
  ExecutiveEngine,
  ExecutiveEngineContext,
  ExecutiveEngineMetadata,
} from '../platform/engineContract'

export interface BudgetBreakdown {
  flights: number
  hotel: number
  food: number
  activities: number
  transfers: number
  visa: number
  insurance: number
  shopping: number
  taxes: number
  forexBuffer: number
  total: number
  currency: string
  confidence: number
}

export function createBudgetIntelligenceV2Engine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'budget_intelligence_v2',
    version: '2.0.0',
    name: 'Budget Intelligence Engine v2',
    description: 'Estimates total trip cost with hidden fees and value alternatives.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const breakdown = estimateBreakdown(ctx)
      const budget = ctx.memory.requirements.budgetAmount
      const findings = [
        `total:${breakdown.total}`,
        `confidence:${breakdown.confidence}`,
      ]
      if (budget != null) {
        findings.push(breakdown.total > budget * 1.1 ? 'over_budget' : 'within_budget')
      }
      return {
        engineId: 'budget_intelligence_v2',
        findings,
        signals: { breakdown, budget },
        priority: budget != null && breakdown.total > budget * 1.15 ? 'high' : 'medium',
      }
    },

    plan(ctx, analysis) {
      const over = analysis.findings.includes('over_budget')
      return {
        engineId: 'budget_intelligence_v2',
        actions: [{
          id: 'present_breakdown',
          description: ctx.locale === 'ar'
            ? 'عرض تفصيل التكلفة الكاملة'
            : 'Present full cost breakdown',
          priority: over ? 'high' : 'medium',
        }],
        alternatives: over
          ? [
            ctx.locale === 'ar' ? 'خيار اقتصادي' : 'Budget alternative',
            ctx.locale === 'ar' ? 'خيار فاخر' : 'Luxury alternative',
          ]
          : [ctx.locale === 'ar' ? 'خيار فاخر' : 'Luxury alternative'],
      }
    },

    execute(ctx, plan) {
      const breakdown = estimateBreakdown(ctx)
      const budget = ctx.memory.requirements.budgetAmount
      const lines = [
        ctx.locale === 'ar'
          ? `تقدير الرحلة ≈ ${Math.round(breakdown.total)} ${breakdown.currency}`
          : `Trip estimate ≈ ${Math.round(breakdown.total)} ${breakdown.currency}`,
        ctx.locale === 'ar'
          ? `طيران ${Math.round(breakdown.flights)} · فندق ${Math.round(breakdown.hotel)} · طعام ${Math.round(breakdown.food)}`
          : `Flights ${Math.round(breakdown.flights)} · Hotel ${Math.round(breakdown.hotel)} · Food ${Math.round(breakdown.food)}`,
        ctx.locale === 'ar'
          ? `خفي: تأشيرة ${Math.round(breakdown.visa)} · تأمين ${Math.round(breakdown.insurance)} · نقل ${Math.round(breakdown.transfers)} · ضرائب ${Math.round(breakdown.taxes)}`
          : `Hidden: visa ${Math.round(breakdown.visa)} · insurance ${Math.round(breakdown.insurance)} · transfers ${Math.round(breakdown.transfers)} · taxes ${Math.round(breakdown.taxes)}`,
      ]
      if (budget != null && breakdown.total > budget) {
        lines.push(ctx.locale === 'ar'
          ? `أعلى من ميزانيتك (${budget}) بمقدار ≈ ${Math.round(breakdown.total - budget)}`
          : `About ${Math.round(breakdown.total - budget)} over your ${budget} budget`)
      }

      return {
        engineId: 'budget_intelligence_v2',
        applied: true,
        effects: ['budget_breakdown'],
        replyFragment: lines.join('\n'),
        alerts: budget != null && breakdown.total > budget * 1.15
          ? [{
            priority: 'high' as const,
            message: lines[lines.length - 1]!,
            category: 'budget',
          }]
          : [],
        recommendations: plan.alternatives.map((title) => ({
          title,
          why: [ctx.locale === 'ar' ? 'مواءمة الميزانية' : 'Budget alignment'],
          pros: [],
          cons: [],
          tradeoffs: [],
          confidence: breakdown.confidence,
          budgetImpact: title,
        })),
        memoryNotes: [],
        nextBestAction: ctx.locale === 'ar'
          ? 'هل تريد تحسين التكلفة أم الإبقاء على التجربة؟'
          : 'Optimize for cost or keep the experience level?',
        metadata: { breakdown },
      }
    },

    confidence(_ctx, analysis) {
      const breakdown = analysis.signals.breakdown as BudgetBreakdown | undefined
      return breakdown?.confidence ?? 0.5
    },
  }
}

export function estimateBreakdown(ctx: ExecutiveEngineContext): BudgetBreakdown {
  const dest = ctx.memory.requirements.destination
    ?? ctx.reasoningResult?.primary?.name
    ?? null
  const profile = dest ? findDestinationProfile(dest) : null
  const days = ctx.memory.requirements.durationDays ?? 5
  const travelers = ctx.memory.requirements.travelers ?? 2
  const luxury = ctx.executiveContext?.luxuryPreference
    || ctx.memory.requirements.budgetStyle === 'luxury'
  const mid = profile?.dailyBudgetSar.mid ?? 700
  const high = profile?.dailyBudgetSar.high ?? 1100
  const low = profile?.dailyBudgetSar.low ?? 450
  const daily = luxury ? high : (ctx.memory.requirements.budgetStyle === 'budget' ? low : mid)

  const hotel = daily * 0.45 * days * Math.max(1, Math.ceil(travelers / 2))
  const food = daily * 0.25 * days * travelers
  const activities = daily * 0.15 * days * travelers
  const flights = (profile?.flightHoursFromRiyadh ?? 5) * 180 * travelers * (luxury ? 1.6 : 1)
  const transfers = 180 * travelers
  const visa = profile?.visaFromSaudi === 'visa_free' ? 0
    : profile?.visaFromSaudi === 'evisa' ? 300 * travelers
      : profile?.visaFromSaudi === 'embassy' ? 450 * travelers
        : 200 * travelers
  const insurance = 90 * travelers
  const shopping = daily * 0.08 * days * travelers
  const taxes = (flights + hotel) * 0.05
  const forexBuffer = (hotel + food + activities) * 0.03
  const total = flights + hotel + food + activities + transfers + visa + insurance + shopping + taxes + forexBuffer

  const confidence = profile ? 0.78 : 0.55

  return {
    flights,
    hotel,
    food,
    activities,
    transfers,
    visa,
    insurance,
    shopping,
    taxes,
    forexBuffer,
    total,
    currency: ctx.memory.requirements.budgetCurrency || 'SAR',
    confidence,
  }
}
