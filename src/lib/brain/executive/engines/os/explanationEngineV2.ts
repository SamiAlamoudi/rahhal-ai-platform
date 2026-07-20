/**
 * Sprint 52 — Explanation Engine v2.
 */

import { detectTravelGoal } from '../../os/goalDetection'
import { getDestinationIntelligence } from '../../os/globalKnowledge'
import { optimizeDecisions } from '../../os/scoring'
import type {
  ExecutiveEngine,
  ExecutiveEngineMetadata,
  ExecutiveRecommendation,
} from '../../platform/engineContract'

export function createExplanationEngineV2(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'explanation_v2',
    version: '2.0.0',
    name: 'Explanation Engine v2',
    description: 'Structural explanations: pros, cons, tradeoffs, confidence, cost/risk/visa/weather, why-not.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const goal = detectTravelGoal(ctx)
      const { strongest, rejected } = optimizeDecisions({
        memory: ctx.memory,
        profile: ctx.profile,
        reasoningResult: ctx.reasoningResult,
        goal,
      })
      return {
        engineId: 'explanation_v2',
        findings: strongest.map((row) => row.name),
        signals: { strongest, rejected: rejected.slice(0, 5), goal },
        priority: strongest.length > 0 ? 'high' : 'low',
      }
    },

    plan(ctx, analysis) {
      if (analysis.findings.length === 0) {
        return { engineId: 'explanation_v2', actions: [], alternatives: [] }
      }
      return {
        engineId: 'explanation_v2',
        actions: [{
          id: 'explain_structure',
          description: ctx.locale === 'ar'
            ? 'شرح هيكلي للتوصية'
            : 'Structured recommendation explanation',
          priority: 'high',
        }],
        alternatives: analysis.findings.slice(1),
      }
    },

    execute(ctx, plan) {
      if (plan.actions.length === 0) {
        return {
          engineId: 'explanation_v2',
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

      const goal = detectTravelGoal(ctx)
      const { strongest, rejected } = optimizeDecisions({
        memory: ctx.memory,
        profile: ctx.profile,
        reasoningResult: ctx.reasoningResult,
        goal,
      })
      const top = strongest[0]!
      const intel = getDestinationIntelligence(top.id)
      const alt = strongest[1]

      const recommendations: ExecutiveRecommendation[] = [{
        title: top.name,
        why: [
          ctx.locale === 'ar'
            ? `درجة ${(top.score * 100).toFixed(0)}% لهدف ${goal}`
            : `Score ${(top.score * 100).toFixed(0)}% for goal ${goal}`,
          ...Object.entries(top.objectives)
            .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
            .slice(0, 3)
            .map(([k, v]) => `${k}: ${((v ?? 0) * 100).toFixed(0)}%`),
        ],
        whyNot: [
          ...rejected.slice(0, 2).map((row) =>
            `${row.name}: ${row.rejectReason ?? 'weak fit'}`),
          ...(alt
            ? [ctx.locale === 'ar'
              ? `${alt.name} أقرب في بعض المحاور لكن أضعف إجمالاً`
              : `${alt.name} closer on some axes but weaker overall`]
            : []),
        ],
        pros: Object.entries(top.objectives)
          .filter(([, v]) => (v ?? 0) >= 0.7)
          .slice(0, 4)
          .map(([k, v]) => `${k} ${(Number(v) * 100).toFixed(0)}%`),
        cons: Object.entries(top.objectives)
          .filter(([, v]) => (v ?? 1) < 0.5)
          .slice(0, 3)
          .map(([k, v]) => `${k} ${(Number(v) * 100).toFixed(0)}%`),
        tradeoffs: [
          ctx.locale === 'ar'
            ? `تكلفة يومية ≈ ${intel?.averageDailyCostSar ?? '?'} ر.س`
            : `Daily cost ≈ ${intel?.averageDailyCostSar ?? '?'} SAR`,
          alt
            ? (ctx.locale === 'ar'
              ? `مقابل ${alt.name}: فرق درجة ${((top.score - alt.score) * 100).toFixed(0)} نقطة`
              : `Vs ${alt.name}: score delta ${((top.score - alt.score) * 100).toFixed(0)} pts`)
            : (ctx.locale === 'ar' ? 'لا بديل قريب بنفس القوة' : 'No near peer at equal strength'),
        ],
        confidence: top.confidence,
        budgetImpact: intel
          ? (ctx.locale === 'ar'
            ? `متوسط ${intel.averageDailyCostSar} ر.س/يوم`
            : `Avg ${intel.averageDailyCostSar} SAR/day`)
          : null,
        visaImpact: intel
          ? (ctx.locale === 'ar' ? `تأشيرة: ${intel.visa}` : `Visa: ${intel.visa}`)
          : null,
        weatherImpact: intel
          ? (ctx.locale === 'ar' ? `طقس: ${intel.weather}` : `Weather: ${intel.weather}`)
          : null,
      }]

      const fragment = ctx.locale === 'ar'
        ? [
          `شرح v2 — ${top.name}`,
          `إيجابيات: ${recommendations[0]!.pros.join(' · ') || '—'}`,
          `سلبيات: ${recommendations[0]!.cons.join(' · ') || '—'}`,
          `ثقة: ${(top.confidence * 100).toFixed(0)}%`,
          `لماذا ليس غيرها: ${recommendations[0]!.whyNot?.slice(0, 2).join('؛ ') ?? '—'}`,
        ].join('\n')
        : [
          `Explanation v2 — ${top.name}`,
          `Pros: ${recommendations[0]!.pros.join(' · ') || '—'}`,
          `Cons: ${recommendations[0]!.cons.join(' · ') || '—'}`,
          `Confidence: ${(top.confidence * 100).toFixed(0)}%`,
          `Why not others: ${recommendations[0]!.whyNot?.slice(0, 2).join('; ') ?? '—'}`,
        ].join('\n')

      return {
        engineId: 'explanation_v2',
        applied: true,
        effects: ['structured_explanation'],
        replyFragment: fragment,
        alerts: [],
        recommendations,
        memoryNotes: [],
        nextBestAction: ctx.locale === 'ar'
          ? 'هل تريد تحليلاً أعمق للمخاطر والتكلفة؟'
          : 'Want a deeper risk and cost breakdown?',
        metadata: {
          primaryId: top.id,
          riskScore: intel?.riskScore ?? null,
          cost: intel?.averageDailyCostSar ?? null,
        },
      }
    },

    confidence(_ctx, analysis) {
      return analysis.findings.length > 0 ? 0.89 : 0.3
    },
  }
}
