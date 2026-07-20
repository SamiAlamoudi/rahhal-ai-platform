/**
 * Explainable Decision Engine — why this option, why not alternatives.
 */

import type {
  ExecutiveEngine,
  ExecutiveEngineMetadata,
  ExecutiveRecommendation,
} from '../platform/engineContract'

export function createExplainableDecisionEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'explainable_decision',
    version: '1.0.0',
    name: 'Explainable Decision Engine',
    description: 'Produces transparent why / why-not rationales for recommendations.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const rows = [
        ctx.reasoningResult?.primary,
        ...(ctx.reasoningResult?.alternatives ?? []),
      ].filter(Boolean)
      return {
        engineId: 'explainable_decision',
        findings: rows.map((row) => row!.name),
        signals: {
          candidateCount: rows.length,
          primary: ctx.reasoningResult?.primary?.name ?? null,
        },
        priority: rows.length > 0 ? 'medium' : 'low',
      }
    },

    plan(ctx, analysis) {
      if (analysis.findings.length === 0) {
        return { engineId: 'explainable_decision', actions: [], alternatives: [] }
      }
      return {
        engineId: 'explainable_decision',
        actions: [{
          id: 'explain_primary',
          description: ctx.locale === 'ar'
            ? 'شرح التوصية الأساسية والبدائل'
            : 'Explain primary recommendation and alternatives',
          priority: 'medium',
        }],
        alternatives: analysis.findings.slice(1, 4),
      }
    },

    execute(ctx, plan) {
      if (plan.actions.length === 0 || !ctx.reasoningResult?.primary) {
        return {
          engineId: 'explainable_decision',
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

      const primary = ctx.reasoningResult.primary
      const rejected = ctx.reasoningResult.rejected.slice(0, 2)
      const recommendations: ExecutiveRecommendation[] = [{
        title: primary.name,
        why: primary.whySelected.slice(0, 4),
        whyNot: rejected.flatMap((row) =>
          (row.whyRejected ?? row.cons).slice(0, 1).map((line) => `${row.name}: ${line}`),
        ),
        pros: primary.pros.slice(0, 3),
        cons: primary.cons.slice(0, 3),
        tradeoffs: [
          ctx.locale === 'ar'
            ? `تكلفة تقديرية ≈ ${primary.estimatedTripCostSar ?? '?'} ر.س`
            : `Estimated cost ≈ ${primary.estimatedTripCostSar ?? '?'} SAR`,
          primary.visaGuidance?.summary
            ?? (ctx.locale === 'ar' ? `تأشيرة: ${primary.visa}` : `Visa: ${primary.visa}`),
        ],
        confidence: primary.confidence,
        budgetImpact: primary.budgetFit === 'over'
          ? (ctx.locale === 'ar' ? 'أعلى من الميزانية' : 'Over budget')
          : primary.budgetFit === 'fit' || primary.budgetFit === 'under'
            ? (ctx.locale === 'ar' ? 'ضمن الميزانية' : 'Within budget')
            : null,
        visaImpact: primary.visaGuidance?.summary ?? null,
        weatherImpact: primary.climateMatch
          ? (ctx.locale === 'ar' ? `طقس: ${primary.climateMatch}` : `Climate: ${primary.climateMatch}`)
          : null,
      }]

      for (const alt of ctx.reasoningResult.alternatives.slice(0, 2)) {
        recommendations.push({
          title: alt.name,
          why: alt.whySelected.slice(0, 2),
          pros: alt.pros.slice(0, 2),
          cons: alt.cons.slice(0, 2),
          tradeoffs: [],
          confidence: alt.confidence,
          budgetImpact: alt.budgetFit,
          visaImpact: alt.visaGuidance?.summary ?? null,
          weatherImpact: alt.climateMatch,
        })
      }

      const fragment = ctx.locale === 'ar'
        ? `لماذا ${primary.name}؟ ${primary.whySelected[0] ?? 'تناسب تفضيلاتك'}.`
        : `Why ${primary.name}? ${primary.whySelected[0] ?? 'Best fit for your preferences'}.`

      return {
        engineId: 'explainable_decision',
        applied: true,
        effects: ['attach_explanations'],
        replyFragment: fragment,
        alerts: [],
        recommendations,
        memoryNotes: [],
        nextBestAction: ctx.locale === 'ar'
          ? 'هل تريد مقارنة أعمق مع البديل الثاني؟'
          : 'Want a deeper comparison with the second option?',
        metadata: {
          primaryId: primary.id,
          explanationCount: recommendations.length,
        },
      }
    },

    confidence(_ctx, analysis) {
      return analysis.findings.length > 0 ? 0.86 : 0.25
    },
  }
}
