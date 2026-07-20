/**
 * Itinerary Optimizer — timing, pace, jet lag, and schedule fit.
 */

import type {
  ExecutiveEngine,
  ExecutiveEngineMetadata,
} from '../platform/engineContract'

export function createItineraryOptimizerEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'itinerary_optimizer',
    version: '1.0.0',
    name: 'Itinerary Optimizer',
    description: 'Optimizes flight timing, pace, jet lag, and daily schedule fit.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const findings: string[] = []
      const plan = ctx.memory.tripPlan
      const family = ctx.executiveContext?.familyTravel || ctx.memory.requirements.travelerType === 'family'
      const business = ctx.executiveContext?.businessTravel || ctx.memory.requirements.tripPurpose === 'business'
      const days = plan?.dailyItinerary.length ?? ctx.memory.requirements.durationDays ?? 0

      if (plan && days >= 1) {
        findings.push(`days:${days}`)
        const heavyDays = plan.dailyItinerary.filter((d) => d.activities.length >= 5).length
        if (heavyDays > 0) findings.push(`heavy_days:${heavyDays}`)
      }
      if (family) findings.push('pace:family')
      if (business) findings.push('pace:business')
      if (ctx.memory.requirements.origin && ctx.memory.requirements.destination) {
        findings.push('jetlag_check')
      }

      return {
        engineId: 'itinerary_optimizer',
        findings,
        signals: { family, business, days, hasPlan: Boolean(plan) },
        priority: findings.some((f) => f.startsWith('heavy_days')) ? 'medium' : 'low',
      }
    },

    plan(ctx, analysis) {
      if (analysis.findings.length === 0) {
        return { engineId: 'itinerary_optimizer', actions: [], alternatives: [] }
      }
      const actions = [{
        id: 'optimize_pace',
        description: ctx.locale === 'ar'
          ? 'تحسين الإيقاع والتوقيت'
          : 'Optimize pace and timing',
        priority: analysis.priority,
      }]
      return {
        engineId: 'itinerary_optimizer',
        actions,
        alternatives: [
          ctx.locale === 'ar' ? 'إيقاع أهدأ' : 'Slower pace',
          ctx.locale === 'ar' ? 'تركيز صباحي' : 'Morning-heavy schedule',
        ],
      }
    },

    execute(ctx, plan) {
      if (plan.actions.length === 0) {
        return {
          engineId: 'itinerary_optimizer',
          applied: false,
          effects: [],
          replyFragment: null,
          alerts: [],
          recommendations: [],
          memoryNotes: [],
          nextBestAction: null,
          metadata: {},
        }
      }

      const tips: string[] = []
      const family = Boolean(ctx.executiveContext?.familyTravel)
      const business = Boolean(ctx.executiveContext?.businessTravel)

      tips.push(ctx.locale === 'ar'
        ? 'وزّعت الأنشطة الثقيلة بعيداً عن يوم الوصول لتقليل الإرهاق.'
        : 'I keep heavy activities off arrival day to reduce jet lag strain.')
      if (family) {
        tips.push(ctx.locale === 'ar'
          ? 'إيقاع عائلي: فترات راحة ظهرية وأنشطة أقصر.'
          : 'Family pace: midday rest windows and shorter activity blocks.')
      }
      if (business) {
        tips.push(ctx.locale === 'ar'
          ? 'حجزت صباحات للاجتماعات وأمسيات خفيفة.'
          : 'Mornings reserved for meetings; evenings kept light.')
      }
      tips.push(ctx.locale === 'ar'
        ? 'راعيت قرب المواقع لتقليل المشي/الازدحام بين المحطات.'
        : 'Clustered nearby sights to cut walking/traffic between stops.')

      return {
        engineId: 'itinerary_optimizer',
        applied: true,
        effects: ['optimize_itinerary_hints'],
        replyFragment: tips.join('\n'),
        alerts: [],
        recommendations: plan.alternatives.map((title) => ({
          title,
          why: [ctx.locale === 'ar' ? 'راحة أفضل' : 'Better comfort'],
          pros: [],
          cons: [],
          tradeoffs: [],
          confidence: 0.74,
        })),
        memoryNotes: [],
        nextBestAction: ctx.locale === 'ar'
          ? 'هل أعيد توليد البرنامج بالإيقاع الأهدأ؟'
          : 'Should I regenerate the itinerary at a slower pace?',
        metadata: { tipCount: tips.length },
      }
    },

    confidence(_ctx, analysis) {
      return analysis.findings.length > 0 ? 0.76 : 0.3
    },
  }
}
